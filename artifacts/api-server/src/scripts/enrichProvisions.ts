import { and, eq, inArray, isNotNull, notInArray, or } from "drizzle-orm";
import {
  db,
  pool,
  candidatePositionsTable,
  candidateRecordsTable,
  candidateRecordEnrichmentTable,
  type CandidateRecord,
} from "@workspace/db";
import {
  batchProcess,
  isRateLimitError,
} from "@workspace/integrations-openai-ai-server/batch";
import {
  fetchBillSummary,
  fetchBillSubjects,
  fetchBillDetail,
  billToIssue,
} from "../lib/congress";
import { extractProvisions } from "../lib/provisions";
import { classifyBillStance } from "../lib/classify";
import { aggregateStancePositions, type ClassifiedRecord } from "../lib/scoring";
import { logger } from "../lib/logger";

/**
 * v2 scoring pipeline. For the top bills each member sponsored/cosponsored this
 * fetches the bill's neutral CRS summary, its legislative subjects, and its
 * advancement status, then:
 *   1. classifies a stance (issue + direction + confidence + rationale) from the
 *      summary via a two-pass (propose → refute) LLM classifier, and
 *   2. extracts notable/unrelated provisions (the existing "what's in the bills"
 *      feature).
 * Everything is stored in candidate_record_enrichment (keyed by the deterministic
 * record id so it survives the Congress sync's delete+insert). After a run, each
 * affected candidate's candidate_positions are RECOMPUTED purely from their
 * classified bills — no party priors, with an "insufficient record" flag and
 * clickable receipts.
 *
 * Resumable: skips records already enriched. Env knobs:
 *  - PROVISIONS_LIMIT          max candidates to process this run (default all)
 *  - PROVISIONS_PER_CANDIDATE  bills per candidate (default 4)
 */

function parseBill(
  billNumber: string | null,
): { type: string; number: string } | null {
  if (!billNumber) return null;
  const m = billNumber.trim().match(/^([A-Za-z]+)\s*([0-9]+)$/);
  if (!m || !m[1] || !m[2]) return null;
  return { type: m[1], number: m[2] };
}

function kindFromRecordId(recordId: string): "sponsored" | "cosponsored" {
  return recordId.includes(":cosponsored:") ? "cosponsored" : "sponsored";
}

/**
 * Recomputes one candidate's positions from ALL their classified enrichment rows
 * (this run plus prior runs), then writes a full refresh of candidate_positions
 * for that candidate.
 */
async function recomputeCandidatePositions(candidateId: string) {
  const rows = await db
    .select()
    .from(candidateRecordEnrichmentTable)
    .where(
      and(
        eq(candidateRecordEnrichmentTable.candidateId, candidateId),
        isNotNull(candidateRecordEnrichmentTable.classifiedIssueId),
      ),
    );

  const classified: ClassifiedRecord[] = rows
    .filter((r) => r.classifiedIssueId)
    .map((r) => ({
      recordId: r.recordId,
      issueId: r.classifiedIssueId!,
      direction: r.direction ?? 0,
      confidence: r.dirConfidence ?? 0,
      kind: kindFromRecordId(r.recordId),
      actionStatus: r.actionStatus,
      omnibus: r.omnibus ?? false,
      billNumber: r.billNumber,
      title: r.billTitle ?? "Legislation",
      url: r.url,
      date: null,
      rationale: r.rationale ?? "",
    }));

  const positions = aggregateStancePositions(classified);

  await db.transaction(async (tx) => {
    await tx
      .delete(candidatePositionsTable)
      .where(eq(candidatePositionsTable.candidateId, candidateId));
    if (positions.length > 0) {
      await tx.insert(candidatePositionsTable).values(
        positions.map((p) => ({
          candidateId,
          issueId: p.issueId,
          position: p.position,
          confidence: p.confidence,
          summary: p.summary,
          sourceCount: p.sourceCount,
          insufficient: p.insufficient,
          evidence: p.evidence,
        })),
      );
    }
  });
}

async function main() {
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) {
    logger.error("CONGRESS_API_KEY is not set; cannot run the scoring pipeline.");
    process.exit(1);
  }
  if (
    !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    !process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  ) {
    logger.error(
      "OpenAI AI integration not provisioned; cannot run the scoring pipeline.",
    );
    process.exit(1);
  }

  const perCandidate = Math.max(
    1,
    Number(process.env.PROVISIONS_PER_CANDIDATE ?? 4),
  );
  const candidateLimit = Number(process.env.PROVISIONS_LIMIT ?? 1_000_000);

  const rows = await db
    .select()
    .from(candidateRecordsTable)
    .where(
      and(
        or(
          eq(candidateRecordsTable.kind, "sponsored"),
          eq(candidateRecordsTable.kind, "cosponsored"),
        ),
        isNotNull(candidateRecordsTable.billNumber),
        isNotNull(candidateRecordsTable.congress),
      ),
    );

  const enriched = await db
    .select({ recordId: candidateRecordEnrichmentTable.recordId })
    .from(candidateRecordEnrichmentTable);
  const done = new Set(enriched.map((r) => r.recordId));

  const byCandidate = new Map<string, CandidateRecord[]>();
  for (const r of rows) {
    const arr = byCandidate.get(r.candidateId) ?? [];
    arr.push(r);
    byCandidate.set(r.candidateId, arr);
  }

  const selected: CandidateRecord[] = [];
  let candidatesUsed = 0;
  for (const arr of byCandidate.values()) {
    if (candidatesUsed >= candidateLimit) break;
    // Sponsored first (stronger signal), then oldest-first: CRS summaries lag
    // introduction by weeks/months, so a member's oldest tracked bills maximize
    // the summary hit-rate.
    arr.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "sponsored" ? -1 : 1;
      const da = a.date ?? "";
      const dbb = b.date ?? "";
      if (!da) return 1;
      if (!dbb) return -1;
      return da.localeCompare(dbb);
    });
    const top = arr.slice(0, perCandidate).filter((r) => !done.has(r.id));
    if (top.length === 0) continue;
    selected.push(...top);
    candidatesUsed++;
  }

  logger.info(
    `Scoring ${selected.length} bills across ${candidatesUsed} candidates…`,
  );

  let stored = 0;
  let noSummary = 0;
  let errors = 0;
  const affected = new Set<string>();

  await batchProcess(
    selected,
    async (rec) => {
      try {
        const parsed = parseBill(rec.billNumber);
        if (!parsed || rec.congress == null) return;

        const summary = await fetchBillSummary(
          rec.congress,
          parsed.type,
          parsed.number,
          apiKey,
        );
        // No CRS summary published yet — don't persist a row, so a later run
        // retries this bill once Congress.gov has a summary for it.
        if (!summary) {
          noSummary++;
          return;
        }

        const subjects = await fetchBillSubjects(
          rec.congress,
          parsed.type,
          parsed.number,
          apiKey,
        );
        const detail = await fetchBillDetail(
          rec.congress,
          parsed.type,
          parsed.number,
          apiKey,
        );
        const actionStatus = detail?.actionStatus ?? "introduced";

        const [stance, provisions] = await Promise.all([
          classifyBillStance({ title: rec.title, summary, subjects }),
          extractProvisions(rec.title, summary),
        ]);

        // Bucket (policyArea/subjects) is metadata only — it labels which topic a
        // bill touches for display. It NEVER enters the scored path. Scored
        // positions come ONLY from the LLM classifier: if it can't confidently
        // place a stance, classifiedIssueId stays null and the bill contributes
        // no scored evidence (it can still surface as a provision/receipt).
        const bucketIssue =
          billToIssue(detail?.policyArea ?? null, subjects) ?? rec.issueId;
        const classifiedIssueId = stance.issueId ?? null;
        const now = new Date().toISOString();

        await db
          .insert(candidateRecordEnrichmentTable)
          .values({
            recordId: rec.id,
            candidateId: rec.candidateId,
            billNumber: rec.billNumber,
            congress: rec.congress,
            billTitle: rec.title,
            issueId: bucketIssue,
            url: rec.url,
            summary,
            subjects,
            actionStatus,
            provisions,
            classifiedIssueId,
            direction: stance.issueId ? stance.direction : 0,
            dirConfidence: stance.issueId ? stance.confidence : 0,
            rationale: stance.rationale,
            omnibus: stance.omnibus,
            enrichedAt: now,
          })
          .onConflictDoUpdate({
            target: candidateRecordEnrichmentTable.recordId,
            set: {
              summary,
              subjects,
              actionStatus,
              provisions,
              issueId: bucketIssue,
              classifiedIssueId,
              direction: stance.issueId ? stance.direction : 0,
              dirConfidence: stance.issueId ? stance.confidence : 0,
              rationale: stance.rationale,
              omnibus: stance.omnibus,
              enrichedAt: now,
            },
          });

        affected.add(rec.candidateId);
        stored++;
        if (stored % 25 === 0) {
          logger.info(`Classified ${stored}/${selected.length}…`);
        }
      } catch (err) {
        if (isRateLimitError(err)) throw err;
        errors++;
        logger.warn({ err, recordId: rec.id }, "scoring record failed");
      }
    },
    { concurrency: 2, retries: 5 },
  );

  logger.info(
    `Classification complete: ${stored} stored, ${noSummary} skipped (no CRS summary yet), ${errors} errors. Recomputing positions for ${affected.size} candidates…`,
  );

  let recomputed = 0;
  for (const candidateId of affected) {
    try {
      await recomputeCandidatePositions(candidateId);
      recomputed++;
    } catch (err) {
      logger.warn({ err, candidateId }, "position recompute failed");
    }
  }

  // One-time/idempotent legacy purge: candidate_positions must ONLY ever hold v2
  // (classifier-derived) rows. Any candidate with no classified evidence at all
  // is carrying pre-v2 prior-based positions — delete them so the system never
  // serves a mixed v1/v2 view.
  const scoredRows = await db
    .selectDistinct({ candidateId: candidateRecordEnrichmentTable.candidateId })
    .from(candidateRecordEnrichmentTable)
    .where(isNotNull(candidateRecordEnrichmentTable.classifiedIssueId));
  const scoredIds = scoredRows.map((r) => r.candidateId);
  const purged =
    scoredIds.length > 0
      ? await db
          .delete(candidatePositionsTable)
          .where(notInArray(candidatePositionsTable.candidateId, scoredIds))
          .returning({ id: candidatePositionsTable.id })
      : await db
          .delete(candidatePositionsTable)
          .returning({ id: candidatePositionsTable.id });

  logger.info(
    `Scoring pipeline complete: positions recomputed for ${recomputed} candidates; purged ${purged.length} legacy position rows.`,
  );
  await pool.end();
}

main().catch((err) => {
  logger.error(err, "Scoring pipeline failed");
  process.exit(1);
});

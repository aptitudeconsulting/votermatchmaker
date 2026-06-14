import { and, eq, isNotNull } from "drizzle-orm";
import {
  db,
  pool,
  candidateRecordsTable,
  candidateRecordEnrichmentTable,
  type CandidateRecord,
} from "@workspace/db";
import {
  batchProcess,
  isRateLimitError,
} from "@workspace/integrations-openai-ai-server/batch";
import { fetchBillSummary } from "../lib/congress";
import { extractProvisions } from "../lib/provisions";
import { logger } from "../lib/logger";

/**
 * Enriches the top few bills each candidate sponsored with their official CRS
 * summary plus AI-extracted notable/unrelated provisions. Enrichment is stored
 * in a separate table keyed by the deterministic record id, so it survives the
 * delete+insert that the Congress sync performs on candidate_records.
 *
 * Resumable: skips records already enriched. Env knobs:
 *  - PROVISIONS_LIMIT          max candidates to process this run (default all)
 *  - PROVISIONS_PER_CANDIDATE  bills per candidate (default 3)
 */

function parseBill(
  billNumber: string | null,
): { type: string; number: string } | null {
  if (!billNumber) return null;
  const m = billNumber.trim().match(/^([A-Za-z]+)\s*([0-9]+)$/);
  if (!m || !m[1] || !m[2]) return null;
  return { type: m[1], number: m[2] };
}

async function main() {
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) {
    logger.error("CONGRESS_API_KEY is not set; cannot enrich provisions.");
    process.exit(1);
  }
  if (
    !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    !process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  ) {
    logger.error(
      "OpenAI AI integration not provisioned; cannot enrich provisions.",
    );
    process.exit(1);
  }

  const perCandidate = Math.max(
    1,
    Number(process.env.PROVISIONS_PER_CANDIDATE ?? 3),
  );
  const candidateLimit = Number(process.env.PROVISIONS_LIMIT ?? 1_000_000);

  const rows = await db
    .select()
    .from(candidateRecordsTable)
    .where(
      and(
        eq(candidateRecordsTable.kind, "sponsored"),
        isNotNull(candidateRecordsTable.issueId),
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
    // Oldest tracked bills first: CRS summaries lag introduction by weeks/months,
    // so a member's most recent (current-congress) bills usually have no summary
    // yet. Picking their oldest tracked bills maximizes the enrichment hit-rate.
    arr.sort((a, b) => {
      const da = a.date ?? "";
      const db = b.date ?? "";
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    });
    const top = arr.slice(0, perCandidate).filter((r) => !done.has(r.id));
    if (top.length === 0) continue;
    selected.push(...top);
    candidatesUsed++;
  }

  logger.info(
    `Enriching ${selected.length} bills across ${candidatesUsed} candidates…`,
  );

  let stored = 0;
  let noSummary = 0;
  let errors = 0;

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

        const provisions = await extractProvisions(rec.title, summary);
        const now = new Date().toISOString();

        await db
          .insert(candidateRecordEnrichmentTable)
          .values({
            recordId: rec.id,
            candidateId: rec.candidateId,
            billNumber: rec.billNumber,
            congress: rec.congress,
            billTitle: rec.title,
            issueId: rec.issueId,
            url: rec.url,
            summary,
            provisions,
            enrichedAt: now,
          })
          .onConflictDoUpdate({
            target: candidateRecordEnrichmentTable.recordId,
            set: { summary, provisions, enrichedAt: now },
          });

        stored++;
        if (stored % 25 === 0) {
          logger.info(`Stored ${stored}/${selected.length}…`);
        }
      } catch (err) {
        if (isRateLimitError(err)) throw err;
        errors++;
        logger.warn({ err, recordId: rec.id }, "enrich record failed");
      }
    },
    { concurrency: 2, retries: 5 },
  );

  logger.info(
    `Enrichment complete: ${stored} stored, ${noSummary} skipped (no CRS summary yet), ${errors} errors.`,
  );
  await pool.end();
}

main().catch((err) => {
  logger.error(err, "Provisions enrichment failed");
  process.exit(1);
});

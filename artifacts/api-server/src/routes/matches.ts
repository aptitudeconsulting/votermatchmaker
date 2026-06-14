import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  votersTable,
  voterStancesTable,
  candidatesTable,
  candidatePositionsTable,
  candidateDonorSignalsTable,
  candidateRecordsTable,
  candidateRecordEnrichmentTable,
  type Candidate,
} from "@workspace/db";
import { ListMyMatchesResponse, GetMyMatchResponse } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { toCandidate } from "../lib/serialize";
import {
  computeMatch,
  buildMatchSummary,
  type VoterStanceInput,
  type CandidatePositionInput,
  type DonorSignalInput,
} from "../lib/matching";
import { ISSUES } from "../data/political";

const router: IRouter = Router();
router.use(requireAuth);

const ISSUE_NAME = new Map(ISSUES.map((i) => [i.id, i.name]));

async function loadVoterStances(userId: string): Promise<VoterStanceInput[]> {
  const stances = await db
    .select()
    .from(voterStancesTable)
    .where(eq(voterStancesTable.userId, userId));
  return stances.map((s) => ({
    issueId: s.issueId,
    issueName: ISSUE_NAME.get(s.issueId) ?? s.issueId,
    position: s.position,
    importance: s.importance,
  }));
}

async function loadCandidatesForVoter(
  state: string | null,
  level: string | undefined,
): Promise<Candidate[]> {
  const rows = await db.select().from(candidatesTable);
  return rows.filter((c) => {
    if (level && c.level !== level) return false;
    if (c.isSample) return true; // sample races are always shown (clearly labeled)
    if (state && c.state) return c.state === state;
    return !state; // if voter has no state yet, include all congress members
  });
}

async function positionsByCandidate(
  candidateIds: string[],
): Promise<Map<string, CandidatePositionInput[]>> {
  const map = new Map<string, CandidatePositionInput[]>();
  if (candidateIds.length === 0) return map;
  const rows = await db
    .select()
    .from(candidatePositionsTable)
    .where(inArray(candidatePositionsTable.candidateId, candidateIds));
  for (const r of rows) {
    const arr = map.get(r.candidateId) ?? [];
    arr.push({
      issueId: r.issueId,
      issueName: ISSUE_NAME.get(r.issueId) ?? r.issueId,
      position: r.position,
      confidence: r.confidence,
      summary: r.summary,
    });
    map.set(r.candidateId, arr);
  }
  return map;
}

async function donorSignalsByCandidate(
  candidateIds: string[],
): Promise<Map<string, DonorSignalInput[]>> {
  const map = new Map<string, DonorSignalInput[]>();
  if (candidateIds.length === 0) return map;
  const rows = await db
    .select()
    .from(candidateDonorSignalsTable)
    .where(inArray(candidateDonorSignalsTable.candidateId, candidateIds));
  for (const r of rows) {
    const arr = map.get(r.candidateId) ?? [];
    arr.push({
      issueId: r.issueId,
      lean: r.lean,
      confidence: r.confidence,
      classifiedTotal: r.classifiedTotal,
      topSectorLabel: r.topSectorLabel ?? null,
    });
    map.set(r.candidateId, arr);
  }
  return map;
}

router.get("/me/matches", async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const level =
    typeof req.query.level === "string" ? req.query.level : undefined;
  const limit =
    typeof req.query.limit === "string"
      ? Math.min(parseInt(req.query.limit, 10) || 50, 200)
      : 100;

  const [voter] = await db
    .select()
    .from(votersTable)
    .where(eq(votersTable.userId, userId));
  const stances = await loadVoterStances(userId);
  if (stances.length === 0) {
    res.json(ListMyMatchesResponse.parse([]));
    return;
  }

  const candidates = await loadCandidatesForVoter(voter?.state ?? null, level);
  const candidateIds = candidates.map((c) => c.id);
  const posMap = await positionsByCandidate(candidateIds);
  const donorMap = await donorSignalsByCandidate(candidateIds);

  const results = candidates.map((c) => {
    const result = computeMatch(
      stances,
      posMap.get(c.id) ?? [],
      donorMap.get(c.id) ?? [],
    );
    return {
      candidate: toCandidate(c),
      score: result.score,
      grade: result.grade,
      summary: buildMatchSummary(c.name, result),
      topAgreements: result.topAgreements,
      topDisagreements: result.topDisagreements,
      sharedPriorityCount: result.sharedPriorityCount,
      donorTensionCount: result.donorTensionCount,
    };
  });

  results.sort((a, b) => b.score - a.score);
  const data = ListMyMatchesResponse.parse(results.slice(0, limit));
  res.json(data);
});

router.get(
  "/me/matches/:candidateId",
  async (req: AuthedRequest, res): Promise<void> => {
    const userId = req.userId!;
    const candidateId = String(req.params.candidateId);

    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, candidateId));
    if (!candidate) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    const stances = await loadVoterStances(userId);
    const posMap = await positionsByCandidate([candidateId]);
    const donorMap = await donorSignalsByCandidate([candidateId]);
    const result = computeMatch(
      stances,
      posMap.get(candidateId) ?? [],
      donorMap.get(candidateId) ?? [],
    );

    // Surface notable provisions inside bills this candidate backed that touch an
    // issue the voter answered, flagging ones whose direction opposes the voter.
    const stanceByIssue = new Map(stances.map((s) => [s.issueId, s]));
    const currentRecordIds = new Set(
      (
        await db
          .select({ id: candidateRecordsTable.id })
          .from(candidateRecordsTable)
          .where(eq(candidateRecordsTable.candidateId, candidateId))
      ).map((r) => r.id),
    );
    const enrichmentRows = (
      await db
        .select()
        .from(candidateRecordEnrichmentTable)
        .where(eq(candidateRecordEnrichmentTable.candidateId, candidateId))
    ).filter((e) => currentRecordIds.has(e.recordId));

    const provisionFlags = enrichmentRows
      .flatMap((e) =>
        (e.provisions ?? []).map((p) => {
          if (!p.issueId) return null;
          const stance = stanceByIssue.get(p.issueId);
          if (!stance) return null;
          const sSign = Math.sign(stance.position);
          const conflict =
            sSign !== 0 &&
            p.direction !== 0 &&
            sSign !== Math.sign(p.direction);
          return {
            issueId: p.issueId,
            issueName: ISSUE_NAME.get(p.issueId) ?? p.issueId,
            text: p.text,
            unrelated: p.unrelated,
            conflict,
            billTitle: e.billTitle ?? "Legislation",
            billNumber: e.billNumber ?? null,
            url: e.url ?? null,
          };
        }),
      )
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort(
        (a, b) =>
          Number(b.conflict) - Number(a.conflict) ||
          Number(b.unrelated) - Number(a.unrelated),
      )
      .slice(0, 12);

    const data = GetMyMatchResponse.parse({
      candidate: toCandidate(candidate),
      score: result.score,
      grade: result.grade,
      summary: buildMatchSummary(candidate.name, result),
      coverage: result.coverage,
      breakdown: result.breakdown,
      provisionFlags,
    });
    res.json(data);
  },
);

export default router;

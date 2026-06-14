import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import {
  db,
  candidatesTable,
  candidatePositionsTable,
  candidateRecordsTable,
  candidateRecordEnrichmentTable,
  candidateDonorCategoriesTable,
  candidateDonorSignalsTable,
  candidateVoteSignalsTable,
} from "@workspace/db";
import { ListCandidatesResponse, GetCandidateResponse } from "@workspace/api-zod";
import { toCandidate } from "../lib/serialize";
import { applyVoteEvidence } from "../lib/matching";
import { ISSUES } from "../data/political";

const ISSUE_NAME = new Map(ISSUES.map((i) => [i.id, i.name]));

const router: IRouter = Router();

router.get("/candidates", async (req, res): Promise<void> => {
  const level =
    typeof req.query.level === "string" ? req.query.level : undefined;
  const state =
    typeof req.query.state === "string" ? req.query.state.toUpperCase() : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
  const limit =
    typeof req.query.limit === "string"
      ? Math.min(parseInt(req.query.limit, 10) || 100, 600)
      : 200;

  const conditions = [];
  if (level) conditions.push(eq(candidatesTable.level, level));
  if (state) conditions.push(eq(candidatesTable.state, state));
  if (q) conditions.push(ilike(candidatesTable.name, `%${q}%`));

  const rows = await db
    .select()
    .from(candidatesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(candidatesTable.isSample), asc(candidatesTable.name))
    .limit(limit);

  const data = ListCandidatesResponse.parse(rows.map(toCandidate));
  res.json(data);
});

router.get("/candidates/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [candidate] = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.id, id));

  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }

  const positions = await db
    .select()
    .from(candidatePositionsTable)
    .where(eq(candidatePositionsTable.candidateId, id));

  const records = await db
    .select()
    .from(candidateRecordsTable)
    .where(eq(candidateRecordsTable.candidateId, id))
    .orderBy(desc(candidateRecordsTable.date));

  const donorCategories = await db
    .select()
    .from(candidateDonorCategoriesTable)
    .where(eq(candidateDonorCategoriesTable.candidateId, id))
    .orderBy(desc(candidateDonorCategoriesTable.total));

  const donorSignals = await db
    .select()
    .from(candidateDonorSignalsTable)
    .where(eq(candidateDonorSignalsTable.candidateId, id));
  const signalByIssue = new Map(donorSignals.map((s) => [s.issueId, s]));

  const voteSignals = await db
    .select()
    .from(candidateVoteSignalsTable)
    .where(eq(candidateVoteSignalsTable.candidateId, id));
  const voteByIssue = new Map(voteSignals.map((v) => [v.issueId, v]));

  const enrichmentRows = await db
    .select()
    .from(candidateRecordEnrichmentTable)
    .where(eq(candidateRecordEnrichmentTable.candidateId, id));
  const enrichmentByRecord = new Map(
    enrichmentRows.map((e) => [e.recordId, e]),
  );

  // A position carries a tension flag when classified donor money clearly points
  // the opposite way from the (vote-blended) position. Donor money never moves it.
  const positionTension = (issueId: string, positionValue: number) => {
    const sig = signalByIssue.get(issueId);
    if (!sig || !(sig.classifiedTotal > 0) || Math.abs(sig.lean) < 0.3) {
      return { donorTension: false, donorNote: null as string | null, donorLean: sig?.lean ?? null };
    }
    const posSign = Math.sign(positionValue);
    const donorSign = Math.sign(sig.lean);
    if (posSign === 0 || donorSign === 0 || donorSign === posSign) {
      return { donorTension: false, donorNote: null as string | null, donorLean: sig.lean };
    }
    const dollars = `$${Math.round(sig.classifiedTotal).toLocaleString("en-US")}`;
    const sector = sig.topSectorLabel ?? "their largest classified donors";
    const issueName = ISSUE_NAME.get(issueId) ?? issueId;
    const note = `Their record leans one way on ${issueName.toLowerCase()}, but ${dollars} in classified donations (led by ${sector}) leans the other way.`;
    return { donorTension: true, donorNote: note, donorLean: sig.lean };
  };

  // Surface an issue when it has sponsorship evidence OR an actual voting record.
  const positionByIssue = new Map(positions.map((p) => [p.issueId, p]));
  const issueIds = new Set<string>([
    ...positions.filter((p) => p.sourceCount > 0).map((p) => p.issueId),
    ...voteSignals.filter((v) => v.voteCount > 0).map((v) => v.issueId),
  ]);

  const outPositions = [...issueIds]
    .map((issueId) => {
      const p = positionByIssue.get(issueId);
      const vote = voteByIssue.get(issueId);
      const basePosition = p?.position ?? 0;
      // A vote-only issue (no sponsorship) starts from a low base confidence that
      // the voting record then raises; sourceCount stays 0 to be transparent.
      const baseConfidence = p?.confidence ?? 0.3;
      const blended = applyVoteEvidence(
        basePosition,
        baseConfidence,
        vote ? { issueId, position: vote.position, voteCount: vote.voteCount } : undefined,
      );
      const t = positionTension(issueId, blended.position);
      const issueName = ISSUE_NAME.get(issueId) ?? issueId;
      const summary =
        p?.summary ||
        (vote
          ? `Position derived from ${vote.voteCount} House floor vote${vote.voteCount === 1 ? "" : "s"} on ${issueName.toLowerCase()}.`
          : "");
      return {
        issueId,
        issueName,
        // An issue with no sponsorship position but a real voting record is NOT
        // insufficient — the votes establish it. Otherwise honor the stored flag.
        position: blended.position,
        confidence: blended.confidence,
        summary,
        sourceCount: p?.sourceCount ?? 0,
        insufficientRecord:
          (p?.insufficient ?? true) && !(vote && vote.voteCount > 0),
        evidence: p?.evidence ?? [],
        voteCount: blended.voteCount,
        voteShare: vote ? vote.agreeShare : null,
        voteExamples: vote ? vote.examples : [],
        donorTension: t.donorTension,
        donorNote: t.donorNote,
        donorLean: t.donorLean,
      };
    })
    // Strongest evidence first: most floor votes, then most sponsorship sources.
    .sort((a, b) => b.voteCount - a.voteCount || b.sourceCount - a.sourceCount);

  const data = GetCandidateResponse.parse({
    candidate: toCandidate(candidate),
    positions: outPositions,
    record: records.map((r) => {
      const enr = enrichmentByRecord.get(r.id);
      return {
        id: r.id,
        title: r.title,
        kind: r.kind as "sponsored" | "cosponsored" | "statement",
        issueId: r.issueId ?? null,
        issueName: r.issueId ? ISSUE_NAME.get(r.issueId) ?? null : null,
        date: r.date ?? null,
        billNumber: r.billNumber ?? null,
        congress: r.congress ?? null,
        url: r.url ?? null,
        summary: enr?.summary ?? r.summary ?? null,
        provisions: (enr?.provisions ?? []).map((p) => ({
          text: p.text,
          issueId: p.issueId,
          issueName: p.issueId ? ISSUE_NAME.get(p.issueId) ?? null : null,
          direction: p.direction,
          unrelated: p.unrelated,
        })),
      };
    }),
    recordCount: records.length,
    donorCategories: donorCategories.map((d) => ({
      sector: d.sector,
      label: d.label,
      issueId: d.issueId,
      issueName: ISSUE_NAME.get(d.issueId) ?? d.issueId,
      direction: d.direction,
      total: d.total,
      contributorCount: d.contributorCount,
    })),
    hasDonorData: donorCategories.length > 0,
  });
  res.json(data);
});

export default router;

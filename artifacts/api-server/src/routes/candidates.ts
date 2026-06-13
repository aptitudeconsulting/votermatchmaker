import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import {
  db,
  candidatesTable,
  candidatePositionsTable,
  candidateRecordsTable,
} from "@workspace/db";
import { ListCandidatesResponse, GetCandidateResponse } from "@workspace/api-zod";
import { toCandidate } from "../lib/serialize";
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

  const data = GetCandidateResponse.parse({
    candidate: toCandidate(candidate),
    positions: positions
      .filter((p) => p.sourceCount > 0)
      .sort((a, b) => b.sourceCount - a.sourceCount)
      .map((p) => ({
        issueId: p.issueId,
        issueName: ISSUE_NAME.get(p.issueId) ?? p.issueId,
        position: p.position,
        confidence: p.confidence,
        summary: p.summary,
        sourceCount: p.sourceCount,
      })),
    record: records.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind as "sponsored" | "cosponsored" | "statement",
      issueId: r.issueId ?? null,
      issueName: r.issueId ? ISSUE_NAME.get(r.issueId) ?? null : null,
      date: r.date ?? null,
      billNumber: r.billNumber ?? null,
      congress: r.congress ?? null,
      url: r.url ?? null,
      summary: r.summary ?? null,
    })),
    recordCount: records.length,
  });
  res.json(data);
});

export default router;

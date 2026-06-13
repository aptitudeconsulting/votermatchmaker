import { Router, type IRouter } from "express";
import { sql, eq } from "drizzle-orm";
import {
  db,
  candidatesTable,
  issuesTable,
  candidateRecordsTable,
  syncMetaTable,
} from "@workspace/db";
import { GetStatsOverviewResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats/overview", async (_req, res): Promise<void> => {
  const [candidateCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(candidatesTable);
  const [issueCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(issuesTable);
  const [recordCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(candidateRecordsTable);
  const [stateCount] = await db
    .select({ n: sql<number>`count(distinct ${candidatesTable.state})::int` })
    .from(candidatesTable);

  const sync = await db
    .select()
    .from(syncMetaTable)
    .where(eq(syncMetaTable.key, "last_full_sync"));

  const data = GetStatsOverviewResponse.parse({
    candidateCount: candidateCount?.n ?? 0,
    issueCount: issueCount?.n ?? 0,
    recordCount: recordCount?.n ?? 0,
    stateCount: stateCount?.n ?? 0,
    lastSyncedAt: sync[0]?.value ?? null,
  });
  res.json(data);
});

export default router;

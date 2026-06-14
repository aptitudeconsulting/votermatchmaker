import { Router, type IRouter } from "express";
import { sql, inArray } from "drizzle-orm";
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

  const meta = await db
    .select()
    .from(syncMetaTable)
    .where(
      inArray(syncMetaTable.key, [
        "last_full_sync",
        "last_fec_sync",
        "fec_sync_status",
      ]),
    );
  const metaByKey = new Map(meta.map((m) => [m.key, m.value]));

  const fecStatusRaw = metaByKey.get("fec_sync_status") ?? null;
  const fecSyncStatus =
    fecStatusRaw === "running" ||
    fecStatusRaw === "complete" ||
    fecStatusRaw === "error"
      ? fecStatusRaw
      : null;

  const data = GetStatsOverviewResponse.parse({
    candidateCount: candidateCount?.n ?? 0,
    issueCount: issueCount?.n ?? 0,
    recordCount: recordCount?.n ?? 0,
    stateCount: stateCount?.n ?? 0,
    lastSyncedAt: metaByKey.get("last_full_sync") ?? null,
    fecLastSyncedAt: metaByKey.get("last_fec_sync") ?? null,
    fecSyncStatus,
  });
  res.json(data);
});

export default router;

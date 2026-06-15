import { Router, type IRouter } from "express";
import { sql, inArray } from "drizzle-orm";
import {
  db,
  candidatesTable,
  issuesTable,
  candidateRecordsTable,
  voterStancesTable,
  syncMetaTable,
} from "@workspace/db";
import {
  GetStatsOverviewResponse,
  GetStanceAggregateResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/** Below this many contributing voters, an issue's aggregate is withheld to protect anonymity. */
const MIN_AGGREGATE_VOTERS = 5;

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

/**
 * Anonymized, opt-in-free aggregate of how all voters have positioned themselves
 * on each issue (mean of the internal -2..+2 axis + voter count). Issues with
 * fewer than MIN_AGGREGATE_VOTERS contributors are withheld so an individual's
 * stance can never be reverse-engineered. Public — no auth, no per-user data.
 */
router.get("/stats/stances", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      issueId: voterStancesTable.issueId,
      voterCount: sql<number>`count(*)::int`,
      meanPosition: sql<number>`avg(${voterStancesTable.position})::float`,
    })
    .from(voterStancesTable)
    .groupBy(voterStancesTable.issueId);

  const issues = await db
    .select({ id: issuesTable.id, name: issuesTable.name })
    .from(issuesTable);
  const issueName = new Map(issues.map((i) => [i.id, i.name]));

  const items = rows
    .filter((r) => r.voterCount >= MIN_AGGREGATE_VOTERS && issueName.has(r.issueId))
    .map((r) => ({
      issueId: r.issueId,
      issueName: issueName.get(r.issueId)!,
      voterCount: r.voterCount,
      meanPosition: r.meanPosition,
    }))
    .sort((a, b) => b.voterCount - a.voterCount);

  const data = GetStanceAggregateResponse.parse({
    minVoters: MIN_AGGREGATE_VOTERS,
    items,
  });
  res.json(data);
});

export default router;

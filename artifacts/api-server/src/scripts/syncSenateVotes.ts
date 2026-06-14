import { eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  candidatesTable,
  candidateVoteSignalsTable,
  syncMetaTable,
} from "@workspace/db";
import {
  fetchBillDetail,
  fetchBillSubjects,
  fetchBillSummary,
  publicBillUrlFrom,
} from "../lib/congress";
import {
  buildLisToBioguide,
  fetchSenateVoteList,
  fetchSenateVoteMembers,
  fetchVoteviewSenate,
  isSenatePassageQuestion,
  type SenateRollCall,
  type SenateMemberVote,
} from "../lib/senate";
import { classifyBillStance } from "../lib/classify";
import { aggregateVoteSignals, type VoteEvent } from "../lib/votes";
import { logger } from "../lib/logger";

// Pulls the ACTUAL Senate roll-call voting record and writes vote-derived issue
// positions for each sitting senator. The Senate has no Congress.gov votes API,
// so this reads the official senate.gov LIS XML (primary) and falls back to
// Voteview (UCLA) CSVs when senate.gov is unreachable or empty. Designed to run
// as the "Senate Votes Sync" workflow (long-running; classification is the
// expensive part).
//
// Degrades silently: no CONGRESS_API_KEY → exits 0 without touching data (we
// can't classify a bill's issue/direction without it). Tunable via env:
// SENATE_VOTES_CONGRESS (default 119), SENATE_VOTES_SESSIONS (default "1,2"),
// SENATE_VOTES_LIMIT (cap roll calls processed per run),
// SENATE_VOTES_SOURCE ("auto" | "voteview" to force the fallback).

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function setMeta(key: string, value: string) {
  await db
    .insert(syncMetaTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMetaTable.key, set: { value } });
}

async function main() {
  const apiKey = process.env.CONGRESS_API_KEY?.trim();
  if (!apiKey) {
    logger.warn(
      "CONGRESS_API_KEY is not set; skipping Senate votes sync (feature degrades silently).",
    );
    await pool.end();
    return;
  }

  const congress = process.env.SENATE_VOTES_CONGRESS
    ? Math.max(1, parseInt(process.env.SENATE_VOTES_CONGRESS, 10) || 0)
    : 119;
  const sessions = (process.env.SENATE_VOTES_SESSIONS ?? "1,2")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const limit = process.env.SENATE_VOTES_LIMIT
    ? Math.max(1, parseInt(process.env.SENATE_VOTES_LIMIT, 10) || 0)
    : undefined;
  const forceVoteview =
    (process.env.SENATE_VOTES_SOURCE ?? "auto").toLowerCase() === "voteview";

  await setMeta("senate_votes_sync_status", "running");

  // Senate members only: bioguide → candidateId.
  const senate = await db
    .select({ id: candidatesTable.id, level: candidatesTable.level })
    .from(candidatesTable)
    .where(eq(candidatesTable.level, "senate"));
  const candidateIdByBioguide = new Map<string, string>();
  for (const c of senate) {
    // id format is `congress-{bioguideId}`.
    const m = c.id.match(/^congress-(.+)$/);
    if (m) candidateIdByBioguide.set(m[1], c.id);
  }
  if (candidateIdByBioguide.size === 0) {
    logger.warn("No Senate candidates found; run the Congress sync first.");
    await setMeta("senate_votes_sync_status", "error");
    await pool.end();
    return;
  }
  logger.info(`Tracking ${candidateIdByBioguide.size} senators.`);

  // 1) Gather roll calls (+ a way to fetch each roll's members) from whichever
  //    source is available. senate.gov is primary; Voteview is the fallback.
  interface RollWithMembers {
    roll: SenateRollCall;
    getMembers: () => Promise<SenateMemberVote[]>;
  }
  let source: "senate.gov" | "voteview" = "senate.gov";
  let rolls: RollWithMembers[] = [];

  if (!forceVoteview) {
    const lisToBioguide = await buildLisToBioguide();
    if (lisToBioguide.size === 0) {
      logger.warn("Empty LIS→bioguide crosswalk; will try Voteview fallback.");
    } else {
      for (const session of sessions) {
        logger.info(`Listing Senate votes for ${congress}/${session} (senate.gov)…`);
        const list = await fetchSenateVoteList(congress, session);
        logger.info(`  ${list.length} roll calls.`);
        for (const roll of list) {
          rolls.push({
            roll,
            getMembers: () =>
              fetchSenateVoteMembers(
                congress,
                roll.session,
                roll.voteNumber,
                lisToBioguide,
              ),
          });
        }
      }
    }
  }

  if (forceVoteview || rolls.length === 0) {
    logger.info(`Falling back to Voteview for Senate ${congress}…`);
    const vv = await fetchVoteviewSenate(congress, sessions);
    logger.info(`  ${vv.rollCalls.length} roll calls from Voteview.`);
    source = "voteview";
    rolls = vv.rollCalls.map((roll) => ({
      roll,
      getMembers: async () => vv.membersByRoll.get(roll.voteNumber) ?? [],
    }));
  }

  if (rolls.length === 0) {
    logger.warn("No Senate roll calls available from any source.");
    await setMeta("senate_votes_sync_status", "error");
    await pool.end();
    return;
  }
  await setMeta("senate_votes_source", source);

  // 2) Keep substantive passage votes on law-making measures, classify each
  //    distinct bill once (CRS summary → issue + direction), and build events.
  const billCache = new Map<
    string,
    { issueId: string; direction: number; title: string; url: string | null } | null
  >();
  const events: VoteEvent[] = [];
  let processed = 0;
  let kept = 0;

  for (const { roll, getMembers } of rolls) {
    if (limit && kept >= limit) break;
    if (!roll.billType || !roll.billNumber) continue;
    if (!isSenatePassageQuestion(roll.question)) continue;

    const cacheKey = `${roll.billType}${roll.billNumber}`;
    let meta = billCache.get(cacheKey);
    if (meta === undefined) {
      const detail = await fetchBillDetail(
        congress,
        roll.billType,
        roll.billNumber,
        apiKey,
      );
      if (!detail) {
        billCache.set(cacheKey, null);
        meta = null;
      } else {
        const subjects = await fetchBillSubjects(
          congress,
          roll.billType,
          roll.billNumber,
          apiKey,
        );
        await sleep(120);
        const summary = await fetchBillSummary(
          congress,
          roll.billType,
          roll.billNumber,
          apiKey,
        );
        await sleep(120);
        let stance = null;
        if (summary) {
          try {
            stance = await classifyBillStance({
              title: detail.title,
              summary,
              subjects,
            });
          } catch (err) {
            logger.warn({ err, cacheKey }, "senate vote bill classify failed");
          }
        }
        meta =
          stance && stance.issueId && stance.direction !== 0
            ? {
                issueId: stance.issueId,
                direction: stance.direction,
                title: detail.title,
                url: publicBillUrlFrom(congress, roll.billType, roll.billNumber),
              }
            : null;
        billCache.set(cacheKey, meta);
      }
      await sleep(120);
    }
    if (!meta) continue;

    const members = await getMembers();
    for (const mv of members) {
      const candidateId = candidateIdByBioguide.get(mv.bioguideId);
      if (!candidateId) continue;
      events.push({
        candidateId,
        issueId: meta.issueId,
        direction: meta.direction,
        voteCast: mv.voteCast,
        billNumber: cacheKey,
        title: meta.title,
        url: meta.url,
        date: roll.date,
      });
    }

    kept++;
    processed++;
    if (processed % 20 === 0) {
      await setMeta("senate_votes_sync_progress", `${kept} interpretable roll calls`);
      logger.info(`  tallied ${kept} interpretable roll calls`);
    }
    if (source === "senate.gov") await sleep(150);
  }
  logger.info(`${kept} interpretable Senate roll calls tallied.`);

  // 3) Aggregate to one signal per (candidate, issue) and write a full refresh
  //    scoped to senators (so it never clobbers the House votes sync).
  const signals = aggregateVoteSignals(events);
  logger.info(`Writing ${signals.length} Senate vote signals.`);

  const candidateIds = [...candidateIdByBioguide.values()];
  await db.transaction(async (tx) => {
    await tx
      .delete(candidateVoteSignalsTable)
      .where(inArray(candidateVoteSignalsTable.candidateId, candidateIds));
    if (signals.length > 0) {
      await tx.insert(candidateVoteSignalsTable).values(
        signals.map((s) => ({
          candidateId: s.candidateId,
          issueId: s.issueId,
          position: s.position,
          voteCount: s.voteCount,
          agreeShare: s.agreeShare,
          examples: s.examples,
        })),
      );
    }
  });

  await setMeta("senate_votes_sync_status", "ok");
  await setMeta("last_senate_votes_sync", new Date().toISOString());
  await setMeta("senate_votes_sync_progress", `${kept}/${kept} roll calls`);
  logger.info("Senate votes sync complete.");
  await pool.end();
}

main().catch(async (err) => {
  logger.error({ err }, "Senate votes sync failed");
  try {
    await setMeta("senate_votes_sync_status", "error");
  } catch {
    // ignore
  }
  await pool.end();
  process.exit(1);
});

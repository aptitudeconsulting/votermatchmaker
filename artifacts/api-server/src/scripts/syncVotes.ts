import { eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  candidatesTable,
  candidateVoteSignalsTable,
  syncMetaTable,
} from "@workspace/db";
import {
  fetchHouseVoteList,
  fetchHouseVoteDetail,
  fetchHouseVoteMembers,
  fetchBillDetail,
  fetchBillSubjects,
  fetchBillSummary,
  publicBillUrlFrom,
} from "../lib/congress";
import { classifyBillStance } from "../lib/classify";
import {
  isSubstantivePassageVote,
  isSubstantiveLegislationType,
  aggregateVoteSignals,
  type VoteEvent,
} from "../lib/votes";
import { logger } from "../lib/logger";

// Pulls the ACTUAL House roll-call voting record and writes vote-derived issue
// positions for each House member. Designed to run as the "House Votes Sync"
// workflow (long-running; hundreds of Congress.gov calls).
//
// Degrades silently: no CONGRESS_API_KEY → exits 0 without touching data.
// Tunable via env: VOTES_CONGRESS (default 119), VOTES_SESSIONS (default "1,2"),
// VOTES_LIMIT (cap roll calls processed per run, for quick test runs).

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
      "CONGRESS_API_KEY is not set; skipping House votes sync (feature degrades silently).",
    );
    await pool.end();
    return;
  }

  const congress = process.env.VOTES_CONGRESS
    ? Math.max(1, parseInt(process.env.VOTES_CONGRESS, 10) || 0)
    : 119;
  const sessions = (process.env.VOTES_SESSIONS ?? "1,2")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const limit = process.env.VOTES_LIMIT
    ? Math.max(1, parseInt(process.env.VOTES_LIMIT, 10) || 0)
    : undefined;

  await setMeta("votes_sync_status", "running");

  // House members only: bioguide → candidateId.
  const house = await db
    .select({ id: candidatesTable.id, level: candidatesTable.level })
    .from(candidatesTable)
    .where(eq(candidatesTable.level, "house"));
  const candidateIdByBioguide = new Map<string, string>();
  for (const c of house) {
    // id format is `congress-{bioguideId}`.
    const m = c.id.match(/^congress-(.+)$/);
    if (m) candidateIdByBioguide.set(m[1], c.id);
  }
  if (candidateIdByBioguide.size === 0) {
    logger.warn("No House candidates found; run the Congress sync first.");
    await setMeta("votes_sync_status", "error");
    await pool.end();
    return;
  }
  logger.info(`Tracking ${candidateIdByBioguide.size} House members.`);

  // 1) Collect substantive, directionally-interpretable roll calls across sessions.
  interface ScoredVote {
    rollCallNumber: number;
    session: number;
    issueId: string;
    direction: number;
    billNumber: string;
    title: string;
    url: string | null;
    date: string | null;
  }
  const billCache = new Map<
    string,
    { issueId: string; direction: number; title: string; url: string | null } | null
  >();
  const scored: ScoredVote[] = [];

  for (const session of sessions) {
    logger.info(`Listing House votes for ${congress}/${session}…`);
    const votes = await fetchHouseVoteList(congress, session, apiKey);
    logger.info(`  ${votes.length} roll calls.`);
    for (const v of votes) {
      if (limit && scored.length >= limit) break;
      if (!v.legislationType || !v.legislationNumber) continue;
      // Only count votes on legislation that can become law (bills + joint
      // resolutions). Simple/concurrent resolutions (H Res, H Con Res, …) are
      // either procedural rule-adoption votes or non-binding messaging — they
      // would otherwise pass the "agree to the resolution" question filter and
      // a rule's title (which quotes the bills it queues) would map to an issue.
      if (!isSubstantiveLegislationType(v.legislationType)) continue;
      // voteQuestion lives only in the per-roll detail endpoint.
      const detail = await fetchHouseVoteDetail(
        congress,
        session,
        v.rollCallNumber,
        apiKey,
      );
      await sleep(120);
      if (!isSubstantivePassageVote(detail?.voteQuestion ?? undefined)) continue;
      const cacheKey = `${v.legislationType}${v.legislationNumber}`;
      let meta = billCache.get(cacheKey);
      if (meta === undefined) {
        const detail = await fetchBillDetail(
          congress,
          v.legislationType,
          v.legislationNumber,
          apiKey,
        );
        if (!detail) {
          billCache.set(cacheKey, null);
          meta = null;
        } else {
          // v2: a voted bill's issue + direction come from its neutral CRS
          // summary (two-pass classifier), not title keywords. A vote we can't
          // interpret directionally is simply not counted.
          const subjects = await fetchBillSubjects(
            congress,
            v.legislationType,
            v.legislationNumber,
            apiKey,
          );
          await sleep(120);
          const summary = await fetchBillSummary(
            congress,
            v.legislationType,
            v.legislationNumber,
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
              logger.warn({ err, cacheKey }, "vote bill classify failed");
            }
          }
          meta =
            stance && stance.issueId && stance.direction !== 0
              ? {
                  issueId: stance.issueId,
                  direction: stance.direction,
                  title: detail.title,
                  url: publicBillUrlFrom(
                    congress,
                    v.legislationType,
                    v.legislationNumber,
                  ),
                }
              : null;
          billCache.set(cacheKey, meta);
        }
        await sleep(120);
      }
      if (!meta) continue;
      scored.push({
        rollCallNumber: v.rollCallNumber,
        session,
        issueId: meta.issueId,
        direction: meta.direction,
        billNumber: cacheKey,
        title: meta.title,
        url: meta.url,
        date: v.startDate ?? null,
      });
    }
  }
  logger.info(`${scored.length} interpretable roll calls to tally.`);

  // 2) For each kept roll call, pull member votes and build directional events.
  const events: VoteEvent[] = [];
  let processed = 0;
  for (const sv of scored) {
    const members = await fetchHouseVoteMembers(
      congress,
      sv.session,
      sv.rollCallNumber,
      apiKey,
    );
    for (const mv of members) {
      const candidateId = candidateIdByBioguide.get(mv.bioguideId);
      if (!candidateId) continue;
      events.push({
        candidateId,
        issueId: sv.issueId,
        direction: sv.direction,
        voteCast: mv.voteCast,
        billNumber: sv.billNumber,
        title: sv.title,
        url: sv.url,
        date: sv.date,
      });
    }
    processed++;
    if (processed % 20 === 0) {
      await setMeta(
        "votes_sync_progress",
        `${processed}/${scored.length} roll calls`,
      );
      logger.info(`  tallied ${processed}/${scored.length} roll calls`);
    }
    await sleep(150);
  }

  // 3) Aggregate to one signal per (candidate, issue) and write a full refresh.
  const signals = aggregateVoteSignals(events);
  logger.info(`Writing ${signals.length} vote signals.`);

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

  await setMeta("votes_sync_status", "ok");
  await setMeta("last_votes_sync", new Date().toISOString());
  await setMeta("votes_sync_progress", `${scored.length}/${scored.length} roll calls`);
  logger.info("House votes sync complete.");
  await pool.end();
}

main().catch(async (err) => {
  logger.error({ err }, "House votes sync failed");
  try {
    await setMeta("votes_sync_status", "error");
  } catch {
    // ignore
  }
  await pool.end();
  process.exit(1);
});

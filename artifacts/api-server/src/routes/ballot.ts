import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  votersTable,
  candidatesTable,
  voterBallotPicksTable,
  candidateVoteSignalsTable,
  issuesTable,
} from "@workspace/db";
import {
  GetMyBallotResponse,
  ListMyBallotPicksResponse,
  AddMyBallotPickBody,
  GetMyVoteFeedResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { toCandidate } from "../lib/serialize";
import { buildBallotResources, type BallotResource } from "../data/ballot-resources";
import { getBallotMeasures } from "../lib/civic";

const router: IRouter = Router();
router.use(requireAuth);

/**
 * Returns the voter's saved ballot picks, newest first, each joined to its
 * candidate snapshot. Picks whose candidate no longer exists are skipped.
 */
async function listPicks(userId: string) {
  const picks = await db
    .select()
    .from(voterBallotPicksTable)
    .where(eq(voterBallotPicksTable.userId, userId))
    .orderBy(desc(voterBallotPicksTable.createdAt));
  if (picks.length === 0) return [];

  const ids = picks.map((p) => p.candidateId);
  const rows = await db
    .select()
    .from(candidatesTable)
    .where(inArray(candidatesTable.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  return picks.flatMap((p) => {
    const row = byId.get(p.candidateId);
    if (!row) return [];
    return [
      {
        candidate: toCandidate(row),
        note: p.note ?? null,
        createdAt: p.createdAt.toISOString(),
      },
    ];
  });
}

function dedupeResources(resources: BallotResource[]): BallotResource[] {
  const seen = new Set<string>();
  return resources.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

router.get("/me/ballot", async (req: AuthedRequest, res): Promise<void> => {
  const [voter] = await db
    .select()
    .from(votersTable)
    .where(eq(votersTable.userId, req.userId!));

  const zip = voter?.zip ?? null;
  const state = voter?.state ?? null;
  const stateName = voter?.stateName ?? null;

  const curated = buildBallotResources(state, stateName);

  const civic = zip
    ? await getBallotMeasures(zip, req.log)
    : ({ available: false, reason: "no_election" } as const);

  const resources = civic.available
    ? dedupeResources([...civic.officialResources, ...curated])
    : curated;

  const data = GetMyBallotResponse.parse({
    location: {
      zip,
      address: voter?.address ?? null,
      state,
      stateName,
      district: voter?.district ?? null,
    },
    hasLocation: Boolean(zip),
    liveData: civic.available
      ? {
          available: true,
          reason: null,
          electionName: civic.electionName,
          electionDay: civic.electionDay,
        }
      : {
          available: false,
          reason: civic.reason,
          electionName: null,
          electionDay: null,
        },
    measures: civic.available ? civic.measures : [],
    resources,
  });

  res.json(data);
});

router.get("/me/ballot/picks", async (req: AuthedRequest, res): Promise<void> => {
  const data = ListMyBallotPicksResponse.parse(await listPicks(req.userId!));
  res.json(data);
});

router.post("/me/ballot/picks", async (req: AuthedRequest, res): Promise<void> => {
  const body = AddMyBallotPickBody.parse(req.body);
  const userId = req.userId!;

  const [candidate] = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.id, body.candidateId));
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }

  await db
    .insert(voterBallotPicksTable)
    .values({ userId, candidateId: body.candidateId, note: body.note ?? null })
    .onConflictDoUpdate({
      target: [voterBallotPicksTable.userId, voterBallotPicksTable.candidateId],
      set: { note: body.note ?? null },
    });

  const data = ListMyBallotPicksResponse.parse(await listPicks(userId));
  res.json(data);
});

router.delete(
  "/me/ballot/picks/:candidateId",
  async (req: AuthedRequest, res): Promise<void> => {
    const userId = req.userId!;
    const candidateId = String(req.params.candidateId);
    await db
      .delete(voterBallotPicksTable)
      .where(
        and(
          eq(voterBallotPicksTable.userId, userId),
          eq(voterBallotPicksTable.candidateId, candidateId),
        ),
      );
    const data = ListMyBallotPicksResponse.parse(await listPicks(userId));
    res.json(data);
  },
);

const VOTE_FEED_LIMIT = 40;

/**
 * In-app activity feed: recent ACTUAL roll-call floor votes cast by the candidates
 * the voter has saved to their ballot. No email infra — this is a pull feed built
 * from the same vote examples that back each candidate's vote-derived positions,
 * flattened across saved candidates and sorted newest-first. Empty when the voter
 * has saved no candidates (the client nudges them to save some).
 */
router.get("/me/vote-feed", async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;

  const picks = await db
    .select({ candidateId: voterBallotPicksTable.candidateId })
    .from(voterBallotPicksTable)
    .where(eq(voterBallotPicksTable.userId, userId));
  const candidateIds = picks.map((p) => p.candidateId);

  if (candidateIds.length === 0) {
    res.json(GetMyVoteFeedResponse.parse({ items: [] }));
    return;
  }

  const [candRows, issueRows, signals] = await Promise.all([
    db.select().from(candidatesTable).where(inArray(candidatesTable.id, candidateIds)),
    db.select({ id: issuesTable.id, name: issuesTable.name }).from(issuesTable),
    db
      .select()
      .from(candidateVoteSignalsTable)
      .where(inArray(candidateVoteSignalsTable.candidateId, candidateIds)),
  ]);

  const candName = new Map(candRows.map((c) => [c.id, c]));
  const issueName = new Map(issueRows.map((i) => [i.id, i.name]));

  const items = signals
    .flatMap((sig) =>
      (sig.examples ?? []).map((ex) => ({
        candidateId: sig.candidateId,
        candidateName: candName.get(sig.candidateId)?.name ?? "Unknown",
        issueId: sig.issueId,
        issueName: issueName.get(sig.issueId) ?? sig.issueId,
        billNumber: ex.billNumber,
        title: ex.title,
        url: ex.url,
        voteCast: ex.voteCast,
        date: ex.date,
        aligns: ex.aligns,
      })),
    )
    .filter((it) => candName.has(it.candidateId))
    .sort((a, b) => {
      const da = a.date ?? "";
      const db_ = b.date ?? "";
      return db_.localeCompare(da);
    })
    .slice(0, VOTE_FEED_LIMIT);

  res.json(GetMyVoteFeedResponse.parse({ items }));
});

export default router;

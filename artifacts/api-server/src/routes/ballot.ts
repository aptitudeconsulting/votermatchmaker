import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, votersTable } from "@workspace/db";
import { GetMyBallotResponse } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { buildBallotResources, type BallotResource } from "../data/ballot-resources";
import { getBallotMeasures } from "../lib/civic";

const router: IRouter = Router();
router.use(requireAuth);

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

export default router;

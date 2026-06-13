import { logger } from "./logger";
import type { BallotResource } from "../data/ballot-resources";

// Google Civic Information API — Elections (voterInfoQuery). This returns the
// official ballot for an address during active election windows, including
// referendums with the state-provided pro/con statements. It is the only piece
// of this feature that depends on an external key; when the key is absent or no
// election is loaded for the area, the feature degrades to the curated resource
// hub rather than failing.

export interface CivicMeasure {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  url: string | null;
  proStatement: string | null;
  conStatement: string | null;
  passageThreshold: string | null;
}

export type CivicResult =
  | { available: false; reason: "no_key" | "no_election" | "error" }
  | {
      available: true;
      electionName: string | null;
      electionDay: string | null;
      measures: CivicMeasure[];
      officialResources: BallotResource[];
    };

interface VoterInfoContest {
  type?: string;
  referendumTitle?: string;
  referendumSubtitle?: string;
  referendumBrief?: string;
  referendumUrl?: string;
  referendumProStatement?: string;
  referendumConStatement?: string;
  referendumPassageThreshold?: string;
}

interface ElectionAdministrationBody {
  ballotInfoUrl?: string;
  votingLocationFinderUrl?: string;
  electionInfoUrl?: string;
  electionRegistrationUrl?: string;
}

interface VoterInfoResponse {
  election?: { name?: string; electionDay?: string };
  contests?: VoterInfoContest[];
  state?: Array<{
    name?: string;
    electionAdministrationBody?: ElectionAdministrationBody;
  }>;
}

function buildOfficialResources(
  body: ElectionAdministrationBody | undefined,
): BallotResource[] {
  if (!body) return [];
  const out: BallotResource[] = [];
  if (body.ballotInfoUrl) {
    out.push({
      name: "Official ballot information",
      description: "Your state's official ballot information for this election.",
      url: body.ballotInfoUrl,
      category: "sample-ballot",
    });
  }
  if (body.votingLocationFinderUrl) {
    out.push({
      name: "Find your polling place",
      description: "Your state's official polling place finder.",
      url: body.votingLocationFinderUrl,
      category: "polling",
    });
  }
  if (body.electionRegistrationUrl) {
    out.push({
      name: "Register to vote (official)",
      description: "Your state's official voter registration page.",
      url: body.electionRegistrationUrl,
      category: "registration",
    });
  }
  if (body.electionInfoUrl) {
    out.push({
      name: "Official election information",
      description: "Your state's official election information page.",
      url: body.electionInfoUrl,
      category: "research",
    });
  }
  return out;
}

export async function getBallotMeasures(
  zip: string,
  reqLogger: Pick<typeof logger, "warn" | "info"> = logger,
): Promise<CivicResult> {
  const key = process.env.GOOGLE_CIVIC_API_KEY;
  if (!key) return { available: false, reason: "no_key" };

  const url = new URL("https://www.googleapis.com/civicinfo/v2/voterinfo");
  url.searchParams.set("key", key);
  url.searchParams.set("address", zip);

  let body: VoterInfoResponse;
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      // 404 = no election currently loaded for this address; not an error state.
      if (resp.status === 404 || resp.status === 400) {
        return { available: false, reason: "no_election" };
      }
      reqLogger.warn(
        { status: resp.status },
        "Google Civic voterinfo request failed",
      );
      return { available: false, reason: "error" };
    }
    body = (await resp.json()) as VoterInfoResponse;
  } catch (err) {
    reqLogger.warn({ err }, "Google Civic voterinfo request threw");
    return { available: false, reason: "error" };
  }

  const measures: CivicMeasure[] = (body.contests ?? [])
    .filter((c) => c.type === "Referendum" && c.referendumTitle)
    .map((c, i) => ({
      id: `civic-${i}`,
      title: c.referendumTitle!,
      subtitle: c.referendumSubtitle ?? null,
      summary: c.referendumBrief ?? null,
      url: c.referendumUrl ?? null,
      proStatement: c.referendumProStatement ?? null,
      conStatement: c.referendumConStatement ?? null,
      passageThreshold: c.referendumPassageThreshold ?? null,
    }));

  const officialResources = buildOfficialResources(
    body.state?.[0]?.electionAdministrationBody,
  );

  if (measures.length === 0 && officialResources.length === 0) {
    return { available: false, reason: "no_election" };
  }

  return {
    available: true,
    electionName: body.election?.name ?? null,
    electionDay: body.election?.electionDay ?? null,
    measures,
    officialResources,
  };
}

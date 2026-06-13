// Curated, strictly non-partisan civic resources. Every source here is either an
// official government body or a recognized non-partisan organization (e.g. the
// League of Women Voters, the National Association of Secretaries of State).
// No advocacy groups, parties, or ideologically-aligned sources are included.

export type BallotResourceCategory =
  | "ballot-measures"
  | "sample-ballot"
  | "registration"
  | "polling"
  | "research";

export interface BallotResource {
  name: string;
  description: string;
  url: string;
  category: BallotResourceCategory;
}

function ballotpediaStateMeasuresUrl(stateName: string): string {
  // Ballotpedia uses underscore-separated state names and redirects the bare
  // "<State>_ballot_measures" slug to the current cycle's page.
  const slug = stateName.trim().replace(/\s+/g, "_");
  return `https://ballotpedia.org/${slug}_ballot_measures`;
}

/**
 * Build the non-partisan resource list for a voter. When a state is known the
 * list is tailored with a state-specific ballot-measures page; otherwise only
 * the national tools (all of which accept an address or ZIP) are returned.
 */
export function buildBallotResources(
  state: string | null,
  stateName: string | null,
): BallotResource[] {
  const resources: BallotResource[] = [];

  if (state && stateName) {
    resources.push({
      name: `${stateName} ballot measures (Ballotpedia)`,
      description: `Neutral, encyclopedic summaries of statewide ballot measures in ${stateName}, including the official text, fiscal impact, and arguments from both supporters and opponents.`,
      url: ballotpediaStateMeasuresUrl(stateName),
      category: "ballot-measures",
    });
  }

  resources.push(
    {
      name: "Ballotpedia Sample Ballot Lookup",
      description:
        "Enter your address to see a full sample ballot for your next election, with neutral explanations of every contest and measure.",
      url: "https://ballotpedia.org/Sample_Ballot_Lookup",
      category: "sample-ballot",
    },
    {
      name: "Vote411 (League of Women Voters)",
      description:
        "A non-partisan, address-based ballot guide from the League of Women Voters Education Fund covering candidates and ballot measures.",
      url: "https://www.vote411.org/ballot",
      category: "sample-ballot",
    },
    {
      name: "BallotReady",
      description:
        "A non-partisan guide to everything on your ballot, from the top of the ticket down to local measures and judicial races.",
      url: "https://www.ballotready.org/",
      category: "research",
    },
    {
      name: "Can I Vote (NASS)",
      description:
        "Official voter information from the National Association of Secretaries of State: check registration, find your polling place, and view state deadlines.",
      url: "https://www.nass.org/can-I-vote",
      category: "polling",
    },
    {
      name: "Vote.gov",
      description:
        "The U.S. government's official voter registration site. Register or confirm your registration in your state.",
      url: "https://vote.gov/",
      category: "registration",
    },
  );

  return resources;
}

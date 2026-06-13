import { ISSUES } from "./political";

const ISSUE_NAME = new Map(ISSUES.map((i) => [i.id, i.name]));

interface SamplePosition {
  issueId: string;
  position: number;
  confidence: number;
  summary: string;
}

interface SampleRecord {
  title: string;
  issueId: string;
  summary: string;
}

export interface SampleCandidate {
  id: string;
  name: string;
  party: string;
  level: "local";
  state: string;
  stateName: string;
  district: string | null;
  currentRole: string;
  incumbent: boolean;
  positions: SamplePosition[];
  records: SampleRecord[];
}

function pos(
  issueId: string,
  position: number,
  confidence: number,
  summary: string,
): SamplePosition {
  return { issueId, position, confidence, summary };
}

// These are illustrative, hand-authored example local races. Congress.gov has no
// local data, so every one of these is clearly flagged as a sample throughout
// the app (isSample / dataSource = "sample").
export const SAMPLE_CANDIDATES: SampleCandidate[] = [
  {
    id: "sample-portland-mayor-rivera",
    name: "Maya Rivera",
    party: "Nonpartisan",
    level: "local",
    state: "OR",
    stateName: "Oregon",
    district: "Portland Mayor",
    currentRole: "Candidate for Mayor of Portland (sample race)",
    incumbent: false,
    positions: [
      pos("housing", 1.7, 0.9, "Centers her campaign on building affordable housing and tenant protections."),
      pos("climate", 1.5, 0.85, "Backs aggressive local climate goals and clean transit."),
      pos("criminal-justice", 1.2, 0.8, "Favors community-based public safety and reform."),
      pos("economy", 0.9, 0.7, "Supports public investment in downtown revitalization."),
      pos("labor", 1.1, 0.75, "Pro-union and supports a higher local minimum wage."),
    ],
    records: [
      { title: "Affordable Housing Bond proposal", issueId: "housing", summary: "Proposed a city bond to fund 5,000 affordable units." },
      { title: "Green Transit Plan", issueId: "climate", summary: "Plan to electrify the city bus fleet by 2032." },
    ],
  },
  {
    id: "sample-portland-mayor-coleman",
    name: "Daniel Coleman",
    party: "Nonpartisan",
    level: "local",
    state: "OR",
    stateName: "Oregon",
    district: "Portland Mayor",
    currentRole: "Candidate for Mayor of Portland (sample race)",
    incumbent: false,
    positions: [
      pos("criminal-justice", -1.3, 0.85, "Runs on a tough-on-crime, more-policing platform."),
      pos("economy", -1.0, 0.8, "Prioritizes business tax relief and deregulation downtown."),
      pos("housing", -0.4, 0.7, "Prefers market-driven development over public housing."),
      pos("climate", -0.3, 0.6, "Cautious on climate mandates that affect business costs."),
      pos("labor", -0.8, 0.65, "More business-friendly on wage and labor rules."),
    ],
    records: [
      { title: "Downtown Safety Initiative", issueId: "criminal-justice", summary: "Proposed expanding the police budget and patrols." },
      { title: "Small Business Tax Relief plan", issueId: "economy", summary: "Plan to cut local business license fees." },
    ],
  },
  {
    id: "sample-austin-council-nguyen",
    name: "Linh Nguyen",
    party: "Nonpartisan",
    level: "local",
    state: "TX",
    stateName: "Texas",
    district: "Austin City Council, District 4",
    currentRole: "Candidate for Austin City Council (sample race)",
    incumbent: false,
    positions: [
      pos("housing", 1.4, 0.85, "Champions denser, more affordable housing and zoning reform."),
      pos("technology", 1.0, 0.7, "Supports municipal broadband and data-privacy rules."),
      pos("climate", 1.2, 0.75, "Backs a local clean-energy transition."),
      pos("education", 1.1, 0.7, "Supports expanded after-school and pre-K funding."),
      pos("economy", 0.7, 0.65, "Favors targeted public investment in transit."),
    ],
    records: [
      { title: "Missing Middle Housing reform", issueId: "housing", summary: "Proposed allowing duplexes and triplexes citywide." },
      { title: "Municipal Broadband pilot", issueId: "technology", summary: "Pilot to bring public internet to underserved areas." },
    ],
  },
  {
    id: "sample-austin-council-barrett",
    name: "Grace Barrett",
    party: "Nonpartisan",
    level: "local",
    state: "TX",
    stateName: "Texas",
    district: "Austin City Council, District 4",
    currentRole: "Candidate for Austin City Council (sample race)",
    incumbent: true,
    positions: [
      pos("economy", -0.8, 0.8, "Emphasizes fiscal restraint and lower city spending."),
      pos("housing", 0.2, 0.7, "Supports incremental, market-led housing growth."),
      pos("criminal-justice", -0.6, 0.7, "Backs steady police funding and traditional public safety."),
      pos("technology", -0.2, 0.6, "Skeptical of city-run broadband on cost grounds."),
      pos("climate", 0.3, 0.6, "Supports modest, cost-conscious sustainability steps."),
    ],
    records: [
      { title: "Balanced Budget resolution", issueId: "economy", summary: "Led a push to cap annual city budget growth." },
      { title: "Neighborhood Preservation measure", issueId: "housing", summary: "Backed limits on density in established neighborhoods." },
    ],
  },
];

export function sampleRecordsFor(candidateId: string) {
  const c = SAMPLE_CANDIDATES.find((s) => s.id === candidateId);
  if (!c) return [];
  return c.records.map((r, idx) => ({
    id: `${candidateId}:statement:${idx}`,
    candidateId,
    title: r.title,
    kind: "statement" as const,
    issueId: r.issueId,
    issueName: ISSUE_NAME.get(r.issueId) ?? null,
    date: null,
    billNumber: null,
    congress: null,
    url: null,
    summary: r.summary,
  }));
}

export { ISSUE_NAME };

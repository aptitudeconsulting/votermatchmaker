/**
 * Donor classification dictionary.
 *
 * The FEC has NO industry/sector field. Every donor "sector" here is *derived*
 * by matching keywords against contributor/employer names, so every signal is
 * approximate and must be presented to users as a derived transparency signal —
 * never as a partisan label.
 *
 * Each sector maps to ONE of our canonical issues and a `direction` on that
 * issue's internal -2..+2 axis (see data/political.ts). Direction is a sign:
 *   +1 → money leans toward the issue's "+" pole
 *   -1 → money leans toward the issue's "-" pole
 * Direction is used only to (a) raise confidence when donor money agrees in sign
 * with a candidate's legislation-derived position and (b) flag a neutral "donor
 * tension" when it points the opposite way. Donor money NEVER moves a position.
 */

export interface DonorSector {
  /** Stable machine key. */
  key: string;
  /** Human label shown in the "Who funds them" section. */
  label: string;
  /** Canonical issue this sector informs. */
  issueId: string;
  /** Sign on the issue's -2..+2 axis. */
  direction: 1 | -1;
  /** Lowercased substrings matched against contributor/employer names. */
  keywords: string[];
}

/**
 * Curated, high-signal sectors tied to our 14 issues. Intentionally small and
 * transparent rather than an OpenSecrets-grade taxonomy. Keywords are matched
 * as case-insensitive substrings, so they are kept specific to limit false hits.
 */
export const DONOR_SECTORS: DonorSector[] = [
  {
    key: "fossil-energy",
    label: "Fossil fuel & oil/gas",
    issueId: "climate",
    direction: -1,
    keywords: [
      "exxon",
      "chevron",
      "conocophillips",
      "marathon petroleum",
      "phillips 66",
      "valero",
      "occidental petroleum",
      "halliburton",
      "schlumberger",
      "koch industries",
      "petroleum",
      "oil & gas",
      "oil and gas",
      "natural gas",
      "coal",
      "pipeline",
      "drilling",
      "energy transfer",
      "duke energy",
      "southern company",
    ],
  },
  {
    key: "clean-energy",
    label: "Clean & renewable energy",
    issueId: "climate",
    direction: 1,
    keywords: [
      "solar",
      "sunrun",
      "first solar",
      "wind energy",
      "renewable",
      "nextera",
      "vestas",
      "clean energy",
      "tesla energy",
    ],
  },
  {
    key: "labor-unions",
    label: "Labor unions",
    issueId: "labor",
    direction: 1,
    keywords: [
      "afl-cio",
      "afl cio",
      "teamsters",
      "seiu",
      "service employees",
      "uaw",
      "united auto workers",
      "afscme",
      "ufcw",
      "united food",
      "laborers",
      "ibew",
      "electrical workers",
      "machinists",
      "steelworkers",
      "carpenters union",
      "communications workers",
      "transport workers",
      "union local",
      "labor union",
      "national education association",
      "american federation of teachers",
    ],
  },
  {
    key: "finance",
    label: "Banking & finance",
    issueId: "economy",
    direction: -1,
    keywords: [
      "goldman sachs",
      "jpmorgan",
      "jp morgan",
      "morgan stanley",
      "citigroup",
      "wells fargo",
      "bank of america",
      "blackrock",
      "citadel",
      "bridgewater",
      "hedge fund",
      "private equity",
      "capital management",
      "capital partners",
      "investment bank",
      "securities",
      "credit union",
      "mortgage",
      "m&t bank",
      "charles schwab",
      "american bankers",
    ],
  },
  {
    key: "defense",
    label: "Defense contractors",
    issueId: "foreign-policy",
    direction: -1,
    keywords: [
      "lockheed",
      "raytheon",
      "rtx ",
      "northrop grumman",
      "general dynamics",
      "boeing",
      "l3harris",
      "bae systems",
      "huntington ingalls",
      "leidos",
      "defense contractor",
      "aerospace & defense",
      "missile",
    ],
  },
  {
    key: "pharma-insurers",
    label: "Pharma & health insurers",
    issueId: "healthcare",
    direction: -1,
    keywords: [
      "pfizer",
      "merck",
      "abbvie",
      "eli lilly",
      "amgen",
      "bristol myers",
      "johnson & johnson",
      "pharmaceutical",
      "pharma ",
      "unitedhealth",
      "cigna",
      "aetna",
      "anthem",
      "humana",
      "centene",
      "health insurance",
      "blue cross",
    ],
  },
  {
    key: "big-tech",
    label: "Big tech & telecom",
    issueId: "technology",
    direction: -1,
    keywords: [
      "google",
      "alphabet",
      "meta platforms",
      "facebook",
      "amazon",
      "microsoft",
      "apple inc",
      "comcast",
      "at&t",
      "verizon",
      "t-mobile",
      "oracle corp",
      "netflix",
    ],
  },
  {
    key: "gun-rights",
    label: "Gun rights groups",
    issueId: "guns",
    direction: -1,
    keywords: [
      "national rifle association",
      "nra ",
      "gun owners of america",
      "firearms industry",
      "national shooting sports",
      "second amendment",
    ],
  },
  {
    key: "real-estate",
    label: "Real estate & development",
    issueId: "housing",
    direction: -1,
    keywords: [
      "national association of realtors",
      "realtor",
      "real estate",
      "realty",
      "apartment",
      "homebuilders",
      "property management",
      "developers",
      "zillow",
      "cbre",
    ],
  },
  {
    key: "teachers",
    label: "Teachers & public education",
    issueId: "education",
    direction: 1,
    keywords: [
      "national education association",
      "american federation of teachers",
      "teachers union",
      "education association",
      "school district",
      "public schools",
      "university of",
    ],
  },
];

/**
 * Employer/occupation values that carry no usable sector signal. Raw FEC
 * itemized individual donors are dominated by these; they must be dropped before
 * any name→sector mapping.
 */
export const DONOR_NOISE_EMPLOYERS: string[] = [
  "not employed",
  "unemployed",
  "retired",
  "self employed",
  "self-employed",
  "self",
  "none",
  "n/a",
  "na",
  "not applicable",
  "homemaker",
  "home maker",
  "disabled",
  "student",
  "volunteer",
  "information requested",
  "requested",
  "best efforts",
  "not provided",
  "refused",
];

/**
 * Pass-through conduits (not interest groups). Money routed through these tells
 * us nothing about a sector, so they are excluded from classification.
 */
export const CONDUIT_COMMITTEES: string[] = ["actblue", "winred", "democracy engine"];

/**
 * Name fragments identifying a member's OWN joint-fundraising / leadership /
 * campaign committees. A member's top "PAC" receipts are often self-transfers
 * from these, not outside interest money, so they are excluded. The FEC client
 * additionally excludes any committee whose name contains the member's surname.
 */
export const SELF_COMMITTEE_KEYWORDS: string[] = [
  "victory",
  "joint fundraising",
  "joint fundraiser",
  "leadership pac",
  "for congress",
  "for senate",
  "for u.s. senate",
  "for u.s. house",
  "friends of",
  "committee to elect",
  "committee to re-elect",
  "reelect",
  "re-elect",
];

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True if a contributor/employer name is donor noise (no usable signal). */
export function isNoiseEmployer(name: string): boolean {
  const n = normalize(name);
  if (!n) return true;
  return DONOR_NOISE_EMPLOYERS.some((noise) => n === noise || n.startsWith(noise + " "));
}

/** True if a contributor committee is a pass-through conduit. */
export function isConduit(name: string): boolean {
  const n = normalize(name);
  return CONDUIT_COMMITTEES.some((c) => n.includes(c));
}

/**
 * True if a committee name looks like the member's own joint-fundraising,
 * leadership, or campaign committee. `surnames` is matched in addition to the
 * generic self-committee keywords.
 */
export function isSelfCommittee(name: string, surnames: string[] = []): boolean {
  const n = normalize(name);
  if (SELF_COMMITTEE_KEYWORDS.some((k) => n.includes(k))) return true;
  return surnames.some((s) => s.length >= 4 && n.includes(s.toLowerCase()));
}

/**
 * Classify a contributor/employer name to a donor sector, or null when it is
 * noise, a conduit, or unmatched. First match wins (sectors are ordered most to
 * least specific within each issue).
 */
export function classifyName(name: string): DonorSector | null {
  if (isNoiseEmployer(name) || isConduit(name)) return null;
  const n = normalize(name);
  for (const sector of DONOR_SECTORS) {
    if (sector.keywords.some((k) => n.includes(k))) return sector;
  }
  return null;
}

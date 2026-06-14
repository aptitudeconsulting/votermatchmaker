import type { InsertIssue, InsertQuestion } from "@workspace/db";

/**
 * The canonical issue axis convention.
 *
 * Every issue has an internal numeric axis from -2 to +2. The orientation is
 * arbitrary and NEVER shown to users as "left/right" or party-coded — it exists
 * only so a voter's stance and a candidate's derived stance can be compared as
 * coordinates. The "+" pole and "-" pole are described per issue below purely so
 * the onboarding statements and the candidate-direction model stay consistent.
 */

export const ISSUES: InsertIssue[] = [
  {
    id: "economy",
    name: "Economy & Taxes",
    shortLabel: "Economy",
    description:
      "Taxation, government spending, regulation, and how the country grows jobs and wages.",
    icon: "banknote",
    displayOrder: 1,
  },
  {
    id: "healthcare",
    name: "Healthcare",
    shortLabel: "Healthcare",
    description:
      "How Americans get and pay for medical care, and the government's role in coverage.",
    icon: "heart-pulse",
    displayOrder: 2,
  },
  {
    id: "immigration",
    name: "Immigration",
    shortLabel: "Immigration",
    description:
      "Border policy, paths to citizenship, visas, and enforcement.",
    icon: "globe",
    displayOrder: 3,
  },
  {
    id: "climate",
    name: "Climate & Energy",
    shortLabel: "Climate",
    description:
      "Climate change, environmental regulation, and the country's energy mix.",
    icon: "leaf",
    displayOrder: 4,
  },
  {
    id: "education",
    name: "Education",
    shortLabel: "Education",
    description:
      "Funding for public schools, college affordability, and parental choice.",
    icon: "graduation-cap",
    displayOrder: 5,
  },
  {
    id: "guns",
    name: "Gun Policy",
    shortLabel: "Guns",
    description:
      "The balance between gun ownership rights and firearm regulation.",
    icon: "shield",
    displayOrder: 6,
  },
  {
    id: "abortion",
    name: "Reproductive Rights",
    shortLabel: "Abortion",
    description: "Access to abortion and reproductive healthcare.",
    icon: "stethoscope",
    displayOrder: 7,
  },
  {
    id: "criminal-justice",
    name: "Criminal Justice",
    shortLabel: "Justice",
    description:
      "Policing, sentencing, prisons, and the balance of reform and enforcement.",
    icon: "scale",
    displayOrder: 8,
  },
  {
    id: "foreign-policy",
    name: "Foreign Policy & Defense",
    shortLabel: "Defense",
    description:
      "Military spending, diplomacy, alliances, and America's role abroad.",
    icon: "flag",
    displayOrder: 9,
  },
  {
    id: "civil-rights",
    name: "Civil Rights & Equality",
    shortLabel: "Civil Rights",
    description:
      "Anti-discrimination protections and equal treatment under the law.",
    icon: "users",
    displayOrder: 10,
  },
  {
    id: "housing",
    name: "Housing",
    shortLabel: "Housing",
    description:
      "Affordability, homelessness, tenant protections, and development.",
    icon: "home",
    displayOrder: 11,
  },
  {
    id: "labor",
    name: "Labor & Jobs",
    shortLabel: "Labor",
    description:
      "Wages, unions, worker protections, and the balance with business interests.",
    icon: "briefcase",
    displayOrder: 12,
  },
  {
    id: "technology",
    name: "Technology & Privacy",
    shortLabel: "Tech",
    description:
      "Regulation of big tech, data privacy, and online speech.",
    icon: "cpu",
    displayOrder: 13,
  },
  {
    id: "democracy",
    name: "Voting & Democracy",
    shortLabel: "Democracy",
    description:
      "Voting access, election administration, and campaign finance.",
    icon: "vote",
    displayOrder: 14,
  },
];

const SCALE_OPTIONS = [
  { value: -2, label: "Strongly disagree" },
  { value: -1, label: "Disagree" },
  { value: 0, label: "Unsure / Neutral" },
  { value: 1, label: "Agree" },
  { value: 2, label: "Strongly agree" },
];

/**
 * Onboarding questions. Each statement is phrased toward the issue's "+" pole,
 * so an "agree" answer (+) places the voter on that pole. `kind: "choice"`
 * questions present nuanced options that each carry a position value.
 */
export const QUESTIONS: InsertQuestion[] = [
  {
    id: "economy-1",
    issueId: "economy",
    prompt:
      "Government should invest more in public programs and services, even if it means higher taxes on high earners.",
    helpText:
      "This weighs an active, well-funded government against lower taxes and a smaller public sector.",
    kind: "scale",
    displayOrder: 1,
    options: SCALE_OPTIONS,
  },
  {
    id: "economy-2",
    issueId: "economy",
    prompt: "When it comes to business, the bigger concern is...",
    helpText: "Pick the statement closest to your view.",
    kind: "choice",
    displayOrder: 2,
    options: [
      {
        value: 2,
        label: "Too little regulation",
        description: "Markets need stronger rules to protect people.",
      },
      {
        value: 0,
        label: "It's about balanced",
        description: "Roughly the right mix today.",
      },
      {
        value: -2,
        label: "Too much regulation",
        description: "Red tape holds back growth and jobs.",
      },
    ],
  },
  {
    id: "healthcare-1",
    issueId: "healthcare",
    prompt:
      "The government should guarantee health coverage for all Americans, even through a larger public role.",
    helpText:
      "This contrasts a government coverage guarantee with a mainly private, market-based system.",
    kind: "scale",
    displayOrder: 3,
    options: SCALE_OPTIONS,
  },
  {
    id: "immigration-1",
    issueId: "immigration",
    prompt:
      "There should be an accessible path to citizenship for undocumented immigrants already living here.",
    helpText:
      "This weighs expanded legal pathways against stricter enforcement and border restriction.",
    kind: "scale",
    displayOrder: 4,
    options: SCALE_OPTIONS,
  },
  {
    id: "immigration-2",
    issueId: "immigration",
    prompt: "On border security and immigration levels, you lean toward...",
    helpText: "Pick the statement closest to your view.",
    kind: "choice",
    displayOrder: 5,
    options: [
      {
        value: 2,
        label: "More openness",
        description: "Welcome more immigrants and ease restrictions.",
      },
      {
        value: 0,
        label: "Keep current levels",
        description: "Maintain a balanced approach.",
      },
      {
        value: -2,
        label: "Tighter enforcement",
        description: "Prioritize stronger borders and fewer entries.",
      },
    ],
  },
  {
    id: "climate-1",
    issueId: "climate",
    prompt:
      "The government should act decisively to cut emissions and accelerate the shift to clean energy, even at a cost to some industries.",
    helpText:
      "This weighs ambitious climate action against protecting existing energy jobs and minimizing regulation.",
    kind: "scale",
    displayOrder: 6,
    options: SCALE_OPTIONS,
  },
  {
    id: "education-1",
    issueId: "education",
    prompt:
      "We should increase public funding for schools and make college more affordable through government support.",
    helpText:
      "This contrasts greater public investment with school choice and reduced federal involvement.",
    kind: "scale",
    displayOrder: 7,
    options: SCALE_OPTIONS,
  },
  {
    id: "guns-1",
    issueId: "guns",
    prompt:
      "We need stronger gun laws, such as universal background checks and limits on certain firearms.",
    helpText:
      "This weighs tighter firearm regulation against protecting broad gun ownership rights.",
    kind: "scale",
    displayOrder: 8,
    options: SCALE_OPTIONS,
  },
  {
    id: "abortion-1",
    issueId: "abortion",
    prompt:
      "Abortion should remain legal and accessible, with the decision left to the individual.",
    helpText:
      "This contrasts protecting abortion access with placing greater restrictions on it.",
    kind: "scale",
    displayOrder: 9,
    options: SCALE_OPTIONS,
  },
  {
    id: "criminal-justice-1",
    issueId: "criminal-justice",
    prompt:
      "Criminal justice should focus more on rehabilitation and reducing incarceration than on tougher sentencing.",
    helpText:
      "This weighs reform and rehabilitation against a tough-on-crime, enforcement-first approach.",
    kind: "scale",
    displayOrder: 10,
    options: SCALE_OPTIONS,
  },
  {
    id: "foreign-policy-1",
    issueId: "foreign-policy",
    prompt:
      "The U.S. should rely more on diplomacy and less on military spending and intervention abroad.",
    helpText:
      "This contrasts diplomacy and a leaner military with a larger defense posture and active intervention.",
    kind: "scale",
    displayOrder: 11,
    options: SCALE_OPTIONS,
  },
  {
    id: "civil-rights-1",
    issueId: "civil-rights",
    prompt:
      "The federal government should do more to protect against discrimination and expand civil rights protections.",
    helpText:
      "This weighs expanded federal protections against a more limited federal role.",
    kind: "scale",
    displayOrder: 12,
    options: SCALE_OPTIONS,
  },
  {
    id: "housing-1",
    issueId: "housing",
    prompt:
      "Government should invest heavily in affordable housing and strengthen protections for renters.",
    helpText:
      "This contrasts public investment and tenant protections with a market-led, deregulated approach.",
    kind: "scale",
    displayOrder: 13,
    options: SCALE_OPTIONS,
  },
  {
    id: "labor-1",
    issueId: "labor",
    prompt:
      "The federal minimum wage should be raised significantly.",
    helpText:
      "This is only about the wage floor — it weighs a higher minimum wage against letting the market set pay.",
    kind: "scale",
    displayOrder: 14,
    options: SCALE_OPTIONS,
  },
  {
    id: "labor-2",
    issueId: "labor",
    prompt:
      "Laws should make it easier for workers to organize and join unions.",
    helpText:
      "This is only about unions — it weighs stronger collective-bargaining rights against a more business-friendly approach.",
    kind: "scale",
    displayOrder: 15,
    options: SCALE_OPTIONS,
  },
  {
    id: "technology-1",
    issueId: "technology",
    prompt:
      "Large technology companies should face stronger regulation and stricter data-privacy rules.",
    helpText:
      "This contrasts stronger tech oversight with a lighter-touch, innovation-first approach.",
    kind: "scale",
    displayOrder: 16,
    options: SCALE_OPTIONS,
  },
  {
    id: "democracy-1",
    issueId: "democracy",
    prompt:
      "We should make voting easier and more accessible, such as expanded mail-in and early voting.",
    helpText:
      "This weighs expanding voting access against tighter election-security requirements.",
    kind: "scale",
    displayOrder: 17,
    options: SCALE_OPTIONS,
  },
];

/**
 * Maps Congress.gov bill `policyArea.name` values (a controlled vocabulary) to
 * our canonical issue ids. Only the areas that map cleanly are included.
 */
export const POLICY_AREA_MAP: Record<string, string> = {
  "Economics and Public Finance": "economy",
  Taxation: "economy",
  "Finance and Financial Sector": "economy",
  Commerce: "economy",
  "Foreign Trade and International Finance": "economy",
  "Transportation and Public Works": "economy",
  "Agriculture and Food": "economy",
  "Social Welfare": "economy",
  Health: "healthcare",
  Immigration: "immigration",
  "Environmental Protection": "climate",
  Energy: "climate",
  "Public Lands and Natural Resources": "climate",
  "Water Resources Development": "climate",
  Education: "education",
  "Crime and Law Enforcement": "criminal-justice",
  "Armed Forces and National Security": "foreign-policy",
  "International Affairs": "foreign-policy",
  "Civil Rights and Liberties, Minority Issues": "civil-rights",
  "Native Americans": "civil-rights",
  "Housing and Community Development": "housing",
  "Labor and Employment": "labor",
  "Science, Technology, Communications": "technology",
  "Government Operations and Politics": "democracy",
};

/**
 * Title keyword overrides. Some issues (guns, abortion) don't have a dedicated
 * Congress.gov policy area, so bill titles are scanned for these keywords first.
 */
export const TITLE_KEYWORD_ISSUE: { issueId: string; keywords: string[] }[] = [
  {
    issueId: "guns",
    keywords: ["firearm", "gun ", "guns", "ammunition", "second amendment", "assault weapon"],
  },
  {
    issueId: "abortion",
    keywords: ["abortion", "reproductive", "pro-life", "unborn", "roe v", "contraception"],
  },
  {
    issueId: "immigration",
    keywords: ["immigration", "border", "asylum", "daca", "dreamer", "deportation", "visa"],
  },
  {
    issueId: "climate",
    keywords: ["climate", "clean energy", "emissions", "carbon", "renewable", "pollution"],
  },
];

/**
 * Per-issue, per-party directional prior on the issue's "+" axis (-2..2). These
 * are transparent baselines used when little title signal is available, and they
 * are blended with real bill-text signal. Disclosed to users as methodology.
 */
export const PARTY_PRIORS: Record<string, { D: number; R: number; I: number }> = {
  economy: { D: 1.3, R: -1.3, I: 0 },
  healthcare: { D: 1.5, R: -1.3, I: 0.2 },
  immigration: { D: 1.2, R: -1.4, I: 0 },
  climate: { D: 1.6, R: -1.4, I: 0.3 },
  education: { D: 1.2, R: -1.1, I: 0.1 },
  guns: { D: 1.4, R: -1.5, I: 0 },
  abortion: { D: 1.6, R: -1.5, I: 0.2 },
  "criminal-justice": { D: 1.0, R: -1.1, I: 0.1 },
  "foreign-policy": { D: 0.6, R: -1.0, I: 0.2 },
  "civil-rights": { D: 1.4, R: -1.0, I: 0.3 },
  housing: { D: 1.1, R: -0.9, I: 0.2 },
  labor: { D: 1.3, R: -1.2, I: 0.2 },
  technology: { D: 0.7, R: -0.6, I: 0.1 },
  democracy: { D: 1.3, R: -1.2, I: 0.2 },
};

/**
 * Compact directional lexicon used to nudge a candidate's derived position based
 * on the actual language of the bills they back. `pos` words push toward the
 * issue's "+" pole, `neg` words toward the "-" pole.
 */
export const ISSUE_LEXICON: Record<string, { pos: string[]; neg: string[] }> = {
  economy: {
    pos: ["invest", "expand", "relief", "infrastructure", "fair share", "minimum wage"],
    neg: ["tax cut", "deregulat", "repeal", "reduce spending", "balanced budget"],
  },
  healthcare: {
    pos: ["expand", "coverage", "affordable care", "medicaid", "lower drug", "public option"],
    neg: ["repeal", "market", "block grant", "deregulat"],
  },
  immigration: {
    pos: ["citizenship", "dreamer", "daca", "protect", "asylum", "reunif"],
    neg: ["border security", "enforcement", "deport", "wall", "illegal"],
  },
  climate: {
    pos: ["clean energy", "renewable", "emissions", "climate", "conservation", "carbon"],
    neg: ["drilling", "fossil", "pipeline", "repeal", "deregulat"],
  },
  guns: {
    pos: ["background check", "safety", "ban", "red flag", "prevent gun"],
    neg: ["right to carry", "protect second amendment", "constitutional carry", "self-defense"],
  },
  abortion: {
    pos: ["protect", "access", "reproductive freedom", "right to choose"],
    neg: ["unborn", "pro-life", "ban abortion", "heartbeat", "protect life"],
  },
  "criminal-justice": {
    pos: ["reform", "rehabilitat", "reentry", "expunge", "sentencing reform", "second chance"],
    neg: ["back the blue", "mandatory minimum", "tough", "law and order"],
  },
  "foreign-policy": {
    pos: ["diplomacy", "withdraw", "war powers", "humanitarian", "peace"],
    neg: ["defense", "military", "missile", "deterrence", "armed forces"],
  },
  "civil-rights": {
    pos: ["equality", "anti-discrimination", "protect", "voting rights", "lgbt"],
    neg: ["religious freedom restoration", "states' rights"],
  },
  housing: {
    pos: ["affordable housing", "tenant", "homeless", "rental assistance", "fair housing"],
    neg: ["deregulat", "zoning reform", "private"],
  },
  labor: {
    pos: ["union", "collective bargaining", "minimum wage", "worker", "paid leave", "overtime"],
    neg: ["right to work", "flexib", "small business relief"],
  },
  technology: {
    pos: ["privacy", "antitrust", "net neutrality", "data protection", "consumer"],
    neg: ["innovation", "light-touch", "deregulat"],
  },
  democracy: {
    pos: ["voting rights", "expand", "automatic registration", "mail-in", "access"],
    neg: ["voter id", "election integrity", "security", "citizenship verification"],
  },
};

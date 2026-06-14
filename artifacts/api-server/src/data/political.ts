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
    name: "Energy & Environment",
    shortLabel: "Energy",
    description:
      "The country's energy mix, environmental rules, and how it balances cost and conservation.",
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
    name: "Abortion",
    shortLabel: "Abortion",
    description: "Abortion law, access, and restrictions.",
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
    name: "Equal Treatment & Discrimination",
    shortLabel: "Equal Treatment",
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
    name: "Elections & Voting",
    shortLabel: "Elections",
    description:
      "Voting access, election security, and how elections are run.",
    icon: "vote",
    displayOrder: 14,
  },
];

const CHOICE_HELP = "Pick the statement closest to your view.";

/**
 * Onboarding questions. Every question is a balanced multiple choice so neither
 * pole is ever the default "agree." Each option is stated in the proud words its
 * own believers would use — never the other side's caricature. Options are
 * ordered "+" pole, middle, "-" pole on the internal axis; the order and wording
 * are intentionally non-partisan and are never shown to users as left/right.
 */
export const QUESTIONS: InsertQuestion[] = [
  {
    id: "economy-1",
    issueId: "economy",
    prompt: "On taxes and the size of government, which comes closest to your view?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 1,
    options: [
      {
        value: 2,
        label: "Invest and tax the top",
        description:
          "Fund public programs and services, with higher taxes on high earners.",
      },
      {
        value: 0,
        label: "A balance of both",
        description: "Some public investment, some tax relief — depends on the program.",
      },
      {
        value: -2,
        label: "Lower taxes, smaller government",
        description:
          "Let people keep more of what they earn and shrink the public sector.",
      },
    ],
  },
  {
    id: "economy-2",
    issueId: "economy",
    prompt: "When it comes to business, the bigger concern is...",
    helpText: CHOICE_HELP,
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
    prompt: "What's the right role for government in healthcare?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 3,
    options: [
      {
        value: 2,
        label: "Guarantee coverage for all",
        description: "Government should make sure every American can get and afford care.",
      },
      {
        value: 0,
        label: "A mix of both",
        description: "Keep private coverage, but expand public help where it's needed.",
      },
      {
        value: -2,
        label: "Mostly private",
        description:
          "Care works best through private choice and competition, not government control.",
      },
    ],
  },
  {
    id: "immigration-1",
    issueId: "immigration",
    prompt:
      "For undocumented immigrants already living here, what's the right approach?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 4,
    options: [
      {
        value: 2,
        label: "A path to citizenship",
        description: "Offer fair, accessible legal status to those already here.",
      },
      {
        value: 0,
        label: "Case by case",
        description: "Legal status for some, paired with stronger enforcement.",
      },
      {
        value: -2,
        label: "Enforcement first",
        description: "Prioritize enforcing the law over new legal pathways.",
      },
    ],
  },
  {
    id: "immigration-2",
    issueId: "immigration",
    prompt: "On border security and immigration levels, you lean toward...",
    helpText: CHOICE_HELP,
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
    prompt: "How should the country balance energy and the environment?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 6,
    options: [
      {
        value: 2,
        label: "Act urgently on emissions",
        description: "Aggressively cut emissions and lead the shift to clean energy.",
      },
      {
        value: 0,
        label: "Balance both",
        description: "Move toward cleaner energy while protecting affordability and jobs.",
      },
      {
        value: -2,
        label: "Affordability and jobs first",
        description: "Keep energy affordable and reliable; don't over-rely on regulation.",
      },
    ],
  },
  {
    id: "education-1",
    issueId: "education",
    prompt: "What should drive education policy?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 7,
    options: [
      {
        value: 2,
        label: "Invest in public schools",
        description: "More public funding for schools and more affordable college.",
      },
      {
        value: 0,
        label: "Both matter",
        description: "Strong public schools and more options for parents.",
      },
      {
        value: -2,
        label: "Choice and local control",
        description: "Empower parents with school choice and keep decisions local.",
      },
    ],
  },
  {
    id: "guns-1",
    issueId: "guns",
    prompt: "On guns, where do you land?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 8,
    options: [
      {
        value: 2,
        label: "Stronger gun laws",
        description: "Measures like background checks help prevent violence.",
      },
      {
        value: 0,
        label: "Some limits, protect rights",
        description: "Targeted safety rules while protecting lawful ownership.",
      },
      {
        value: -2,
        label: "Protect gun rights",
        description: "The right to keep and bear arms shouldn't be infringed.",
      },
    ],
  },
  {
    id: "abortion-1",
    issueId: "abortion",
    prompt: "On abortion, which is closest to your view?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 9,
    options: [
      {
        value: 2,
        label: "Legal, the woman decides",
        description: "Abortion should be legal, with the decision left to the woman.",
      },
      {
        value: 0,
        label: "Legal with limits",
        description: "Legal in some cases, restricted in others.",
      },
      {
        value: -2,
        label: "Protect unborn life",
        description: "Unborn life deserves legal protection.",
      },
    ],
  },
  {
    id: "criminal-justice-1",
    issueId: "criminal-justice",
    prompt: "What should criminal justice prioritize?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 10,
    options: [
      {
        value: 2,
        label: "Reform and rehabilitation",
        description: "Focus on rehabilitation and reducing incarceration.",
      },
      {
        value: 0,
        label: "Safety and reform",
        description: "Firm enforcement paired with reform where it works.",
      },
      {
        value: -2,
        label: "Safety and enforcement",
        description:
          "Back law enforcement and firm consequences to keep communities safe.",
      },
    ],
  },
  {
    id: "foreign-policy-1",
    issueId: "foreign-policy",
    prompt: "What should guide America's role abroad?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 11,
    options: [
      {
        value: 2,
        label: "Diplomacy and restraint",
        description: "Lead with diplomacy and avoid costly intervention.",
      },
      {
        value: 0,
        label: "Strength and diplomacy",
        description: "Use both, depending on the situation.",
      },
      {
        value: -2,
        label: "Strong military leadership",
        description:
          "A strong military and active leadership keep us and our allies secure.",
      },
    ],
  },
  {
    id: "civil-rights-1",
    issueId: "civil-rights",
    prompt: "On discrimination and equal treatment, which comes closer?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 12,
    options: [
      {
        value: 2,
        label: "Expand protections",
        description:
          "Government should actively protect against discrimination and expand protections.",
      },
      {
        value: 0,
        label: "About right today",
        description: "Keep existing protections without major changes.",
      },
      {
        value: -2,
        label: "Equal rules for all",
        description:
          "Equal treatment means the same rules for everyone, without new mandates.",
      },
    ],
  },
  {
    id: "housing-1",
    issueId: "housing",
    prompt: "How should we tackle housing costs?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 13,
    options: [
      {
        value: 2,
        label: "Invest and protect renters",
        description:
          "Public investment in affordable housing and stronger renter protections.",
      },
      {
        value: 0,
        label: "Build more and protect renters",
        description: "Both more supply and protections for renters.",
      },
      {
        value: -2,
        label: "Let the market build",
        description: "Cut regulation and zoning barriers so the market can build more homes.",
      },
    ],
  },
  {
    id: "labor-1",
    issueId: "labor",
    prompt: "What's better for workers?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 14,
    options: [
      {
        value: 2,
        label: "Stronger unions and wages",
        description: "Strengthen unions and raise wages to give workers more power.",
      },
      {
        value: 0,
        label: "A balance",
        description: "Support workers without overburdening employers.",
      },
      {
        value: -2,
        label: "Flexible labor markets",
        description:
          "Right-to-work freedom and flexibility help workers and employers alike.",
      },
    ],
  },
  {
    id: "technology-1",
    issueId: "technology",
    prompt: "How should government treat big tech?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 15,
    options: [
      {
        value: 2,
        label: "Regulate and protect privacy",
        description: "Rein in big tech with stronger rules and privacy protections.",
      },
      {
        value: 0,
        label: "Targeted rules",
        description: "Regulate clear harms but keep a light touch overall.",
      },
      {
        value: -2,
        label: "Light-touch, pro-innovation",
        description: "Minimal rules protect innovation and free expression online.",
      },
    ],
  },
  {
    id: "democracy-1",
    issueId: "democracy",
    prompt: "What should elections prioritize?",
    helpText: CHOICE_HELP,
    kind: "choice",
    displayOrder: 16,
    options: [
      {
        value: 2,
        label: "Access",
        description: "Make voting more accessible — expanded early and mail-in voting.",
      },
      {
        value: 0,
        label: "Access and security",
        description: "Both easy access and strong safeguards.",
      },
      {
        value: -2,
        label: "Security",
        description: "Protect election integrity with safeguards like voter ID.",
      },
    ],
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

/**
 * Plain-language description of each issue's two poles on the internal axis,
 * derived directly from the onboarding statements above. Used to ground AI
 * provision analysis in the SAME axis voters and candidates are scored on.
 * `plus` describes the "+" pole, `minus` the "-" pole. Never shown to users as
 * left/right or party-coded.
 */
export const ISSUE_POLES: Record<string, { plus: string; minus: string }> = {
  economy: {
    plus: "more public investment and stronger market regulation, funded by higher taxes on high earners",
    minus: "lower taxes, less regulation, and a smaller government role",
  },
  healthcare: {
    plus: "a government guarantee of health coverage and a larger public role",
    minus: "a mainly private, market-based health system",
  },
  immigration: {
    plus: "expanded legal pathways and a path to citizenship",
    minus: "stricter enforcement and tighter borders",
  },
  climate: {
    plus: "aggressive action to cut emissions and accelerate clean energy",
    minus: "protecting existing energy industries and minimizing climate regulation",
  },
  education: {
    plus: "more public-school funding and government-backed college affordability",
    minus: "school choice and a reduced federal role in education",
  },
  guns: {
    plus: "stronger gun laws such as background checks and firearm limits",
    minus: "protecting broad gun-ownership rights",
  },
  abortion: {
    plus: "keeping abortion legal and accessible",
    minus: "placing greater restrictions on abortion",
  },
  "criminal-justice": {
    plus: "rehabilitation and reducing incarceration",
    minus: "tougher sentencing and an enforcement-first approach",
  },
  "foreign-policy": {
    plus: "diplomacy and a leaner military posture",
    minus: "higher defense spending and a more interventionist posture",
  },
  "civil-rights": {
    plus: "expanded federal anti-discrimination and civil-rights protections",
    minus: "a more limited federal role in civil rights",
  },
  housing: {
    plus: "public investment in affordable housing and stronger renter protections",
    minus: "a market-led, deregulated housing approach",
  },
  labor: {
    plus: "a higher minimum wage and stronger union and worker protections",
    minus: "a more business-friendly approach that lets the market set pay",
  },
  technology: {
    plus: "stronger regulation of big tech and stricter data-privacy rules",
    minus: "a lighter-touch, innovation-first approach",
  },
  democracy: {
    plus: "expanding voting access",
    minus: "tighter election-security requirements",
  },
};

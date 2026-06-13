import {
  POLICY_AREA_MAP,
  TITLE_KEYWORD_ISSUE,
  PARTY_PRIORS,
  ISSUE_LEXICON,
  ISSUES,
} from "../data/political";

const BASE = "https://api.congress.gov/v3";

export interface RawMember {
  bioguideId: string;
  name: string;
  partyName?: string;
  state?: string;
  district?: number | string | null;
  depiction?: { imageUrl?: string };
  terms?: { item?: { chamber?: string }[] };
}

export interface RawBill {
  congress?: number;
  introducedDate?: string;
  number?: string;
  type?: string;
  title?: string;
  policyArea?: { name?: string };
  url?: string;
}

export interface DerivedRecord {
  id: string;
  title: string;
  kind: "sponsored" | "cosponsored";
  issueId: string | null;
  issueName: string | null;
  date: string | null;
  billNumber: string | null;
  congress: number | null;
  url: string | null;
}

export interface DerivedPosition {
  issueId: string;
  issueName: string;
  position: number;
  confidence: number;
  summary: string;
  sourceCount: number;
}

const ISSUE_NAME_BY_ID = new Map(ISSUES.map((i) => [i.id, i.name]));

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiGet<T>(
  path: string,
  apiKey: string,
  attempt = 0,
): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}api_key=${apiKey}&format=json`;
  const res = await fetch(url);
  if (res.status === 429 || res.status >= 500) {
    if (attempt < 4) {
      await sleep(1500 * (attempt + 1));
      return apiGet<T>(path, apiKey, attempt + 1);
    }
  }
  if (!res.ok) {
    throw new Error(`Congress API ${res.status} for ${path.split("?")[0]}`);
  }
  return (await res.json()) as T;
}

export async function fetchAllCurrentMembers(
  apiKey: string,
): Promise<RawMember[]> {
  const members: RawMember[] = [];
  let offset = 0;
  const limit = 250;
  // The full sitting Congress is ~540; cap iterations defensively.
  for (let i = 0; i < 12; i++) {
    const data = await apiGet<{ members?: RawMember[] }>(
      `/member?currentMember=true&limit=${limit}&offset=${offset}`,
      apiKey,
    );
    const batch = data.members ?? [];
    members.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    await sleep(250);
  }
  return members;
}

export async function fetchMemberBills(
  bioguideId: string,
  kind: "sponsored" | "cosponsored",
  apiKey: string,
): Promise<RawBill[]> {
  const endpoint =
    kind === "sponsored" ? "sponsored-legislation" : "cosponsored-legislation";
  const data = await apiGet<Record<string, RawBill[]>>(
    `/member/${bioguideId}/${endpoint}?limit=250`,
    apiKey,
  );
  const key = kind === "sponsored" ? "sponsoredLegislation" : "cosponsoredLegislation";
  return (data[key] as RawBill[] | undefined) ?? [];
}

function billTypePath(type: string): string | null {
  const map: Record<string, string> = {
    HR: "house-bill",
    S: "senate-bill",
    HJRES: "house-joint-resolution",
    SJRES: "senate-joint-resolution",
    HCONRES: "house-concurrent-resolution",
    SCONRES: "senate-concurrent-resolution",
    HRES: "house-resolution",
    SRES: "senate-resolution",
  };
  return map[type.toUpperCase()] ?? null;
}

function publicBillUrl(bill: RawBill): string | null {
  if (!bill.congress || !bill.type || !bill.number) return null;
  const path = billTypePath(bill.type);
  if (!path) return null;
  return `https://www.congress.gov/bill/${bill.congress}th-congress/${path}/${bill.number}`;
}

export function billToIssue(bill: RawBill): string | null {
  const title = (bill.title ?? "").toLowerCase();
  for (const { issueId, keywords } of TITLE_KEYWORD_ISSUE) {
    if (keywords.some((k) => title.includes(k))) return issueId;
  }
  const area = bill.policyArea?.name;
  if (area && POLICY_AREA_MAP[area]) return POLICY_AREA_MAP[area];
  return null;
}

function partyKey(partyName?: string): "D" | "R" | "I" {
  const p = (partyName ?? "").toLowerCase();
  if (p.startsWith("democrat")) return "D";
  if (p.startsWith("republican")) return "R";
  return "I";
}

/** Returns a directional nudge in [-1, 1] from the bill titles' language. */
function textDirection(issueId: string, titles: string[]): number | null {
  const lex = ISSUE_LEXICON[issueId];
  if (!lex) return null;
  let pos = 0;
  let neg = 0;
  for (const t of titles) {
    const lower = t.toLowerCase();
    for (const w of lex.pos) if (lower.includes(w)) pos++;
    for (const w of lex.neg) if (lower.includes(w)) neg++;
  }
  if (pos + neg === 0) return null;
  return (pos - neg) / (pos + neg);
}

export interface DerivationResult {
  positions: DerivedPosition[];
  records: DerivedRecord[];
}

export function derivePositions(
  member: RawMember,
  sponsored: RawBill[],
  cosponsored: RawBill[],
): DerivationResult {
  const pk = partyKey(member.partyName);
  const records: DerivedRecord[] = [];
  const titlesByIssue = new Map<string, string[]>();
  const countByIssue = new Map<string, number>();

  const consume = (bills: RawBill[], kind: "sponsored" | "cosponsored") => {
    for (const bill of bills) {
      const issueId = billToIssue(bill);
      if (!issueId) continue;
      countByIssue.set(issueId, (countByIssue.get(issueId) ?? 0) + 1);
      const arr = titlesByIssue.get(issueId) ?? [];
      if (bill.title) arr.push(bill.title);
      titlesByIssue.set(issueId, arr);

      const billNumber =
        bill.type && bill.number ? `${bill.type} ${bill.number}` : null;
      records.push({
        id: `${member.bioguideId}:${kind}:${bill.type ?? "X"}${bill.number ?? Math.random().toString(36).slice(2, 7)}:${bill.congress ?? 0}`,
        title: bill.title ?? "Untitled legislation",
        kind,
        issueId,
        issueName: ISSUE_NAME_BY_ID.get(issueId) ?? null,
        date: bill.introducedDate ?? null,
        billNumber,
        congress: bill.congress ?? null,
        url: publicBillUrl(bill),
      });
    }
  };

  consume(sponsored, "sponsored");
  consume(cosponsored, "cosponsored");

  const positions: DerivedPosition[] = [];
  for (const issue of ISSUES) {
    const count = countByIssue.get(issue.id) ?? 0;
    const prior = PARTY_PRIORS[issue.id]?.[pk] ?? 0;
    const text = textDirection(issue.id, titlesByIssue.get(issue.id) ?? []);

    // Blend the transparent party prior with real bill-language signal.
    let position: number;
    if (text !== null) {
      position = 0.55 * prior + 0.45 * (text * 2);
    } else {
      position = prior;
    }
    position = Math.max(-2, Math.min(2, position));

    // Confidence rises with the amount of real legislative activity on the issue.
    const activityConfidence = Math.min(0.55, count * 0.07);
    const confidence = count > 0 ? 0.4 + activityConfidence : 0.3;

    const summary = buildPositionSummary(issue.name, count, position);
    positions.push({
      issueId: issue.id,
      issueName: issue.name,
      position: Math.round(position * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      summary,
      sourceCount: count,
    });
  }

  // Keep the most recent, issue-tagged records (cap to keep storage reasonable).
  records.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const trimmed = records.slice(0, 18);

  return { positions, records: trimmed };
}

function buildPositionSummary(
  issueName: string,
  count: number,
  position: number,
): string {
  const strength =
    Math.abs(position) >= 1.3
      ? "strongly"
      : Math.abs(position) >= 0.5
        ? "moderately"
        : "slightly";
  if (count === 0) {
    return `No direct legislative activity found on ${issueName.toLowerCase()}; this estimate uses a transparent party-based baseline only.`;
  }
  return `Backed ${count} ${count === 1 ? "bill" : "bills"} touching ${issueName.toLowerCase()}; their record and party lean ${strength} in this direction.`;
}

export function parseMember(member: RawMember): {
  level: "senate" | "house" | null;
  district: string | null;
} {
  const terms = member.terms?.item ?? [];
  const last = terms[terms.length - 1];
  const chamber = (last?.chamber ?? "").toLowerCase();
  let level: "senate" | "house" | null = null;
  if (chamber.includes("senate")) level = "senate";
  else if (chamber.includes("house")) level = "house";
  const district =
    member.district !== null && member.district !== undefined && level === "house"
      ? String(member.district)
      : null;
  return { level, district };
}

export function formatName(name: string): string {
  // Congress returns "Last, First"; present as "First Last".
  if (name.includes(",")) {
    const [last, first] = name.split(",").map((s) => s.trim());
    return `${first} ${last}`.trim();
  }
  return name;
}

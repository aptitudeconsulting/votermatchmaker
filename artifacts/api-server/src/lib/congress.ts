import { POLICY_AREA_MAP, SUBJECT_MAP, ISSUES } from "../data/political";

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

interface LegislatorRecord {
  id?: { bioguide?: string };
  terms?: { type?: string; start?: string; end?: string }[];
}

/**
 * Fetches the public @unitedstates/congress-legislators "current" dataset and
 * returns a map of bioguideId → the current term's end date (YYYY-MM-DD).
 *
 * Congress.gov itself does not expose a usable term-end / Senate-class signal
 * (its member terms are split per-Congress and omit endYear for the in-progress
 * term), so this authoritative dataset is what tells us when each member's seat
 * is next contested. Degrades to an empty map on any failure.
 */
export async function fetchTermEndByBioguide(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await fetch(
      "https://unitedstates.github.io/congress-legislators/legislators-current.json",
    );
    if (!res.ok) return out;
    const data = (await res.json()) as LegislatorRecord[];
    for (const p of data) {
      const bioguide = p.id?.bioguide;
      const terms = p.terms ?? [];
      const last = terms[terms.length - 1];
      if (bioguide && last?.end) out.set(bioguide, last.end);
    }
  } catch {
    return out;
  }
  return out;
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8217;|&rsquo;|&#x2019;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetches the latest official CRS summary text for a bill, with HTML stripped.
 * Returns null when no summary exists or the request fails (degrade silently).
 */
export async function fetchBillSummary(
  congress: number,
  billType: string,
  billNumber: string,
  apiKey: string,
): Promise<string | null> {
  const t = billType.toLowerCase();
  try {
    const data = await apiGet<{
      summaries?: { text?: string; updateDate?: string; actionDate?: string }[];
    }>(`/bill/${congress}/${t}/${billNumber}/summaries`, apiKey);
    const sums = data.summaries ?? [];
    if (sums.length === 0) return null;
    sums.sort((a, b) =>
      (b.updateDate ?? b.actionDate ?? "").localeCompare(
        a.updateDate ?? a.actionDate ?? "",
      ),
    );
    const text = stripHtml(sums[0]?.text ?? "");
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
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

/**
 * Buckets a bill into one of our canonical issues using Congress's OWN metadata:
 * first the curated legislative-subjects vocabulary (which uniquely captures guns
 * and abortion), then the broader policyArea as a fallback. Bill titles are never
 * used — "titles are marketing." Returns null when nothing matches.
 *
 * `subjects` is the list of legislative-subject term names (may be empty; the
 * sponsored/cosponsored list endpoint only carries policyArea, so the subject
 * refinement happens later in the enrichment pass which fetches per-bill subjects).
 */
export function billToIssue(
  policyArea: string | null,
  subjects: string[] = [],
): string | null {
  if (subjects.length > 0) {
    const lowered = subjects.map((s) => s.toLowerCase());
    // Priority order in SUBJECT_MAP puts the issues with no dedicated policyArea
    // (guns, abortion) first, so they win over a broader bucket.
    for (const { issueId, terms } of SUBJECT_MAP) {
      if (terms.some((t) => lowered.some((s) => s.includes(t)))) return issueId;
    }
  }
  if (policyArea && POLICY_AREA_MAP[policyArea]) return POLICY_AREA_MAP[policyArea];
  return null;
}

/**
 * Buckets a candidate's sponsored/cosponsored bills into RECORDS only. Positions
 * are NOT computed here — there are no party priors. Each record's preliminary
 * issue comes from the bill's policyArea; the enrichment pass later refines it
 * with the bill's legislative subjects and derives a direction from the CRS
 * summary. Records with no mappable policyArea are kept (issueId null) so the
 * enrichment pass can still classify them from subjects + summary.
 */
export function deriveRecords(
  member: RawMember,
  sponsored: RawBill[],
  cosponsored: RawBill[],
): DerivedRecord[] {
  const records: DerivedRecord[] = [];

  const consume = (bills: RawBill[], kind: "sponsored" | "cosponsored") => {
    for (const bill of bills) {
      const issueId = billToIssue(bill.policyArea?.name ?? null);
      const billNumber =
        bill.type && bill.number ? `${bill.type} ${bill.number}` : null;
      records.push({
        id: `${member.bioguideId}:${kind}:${bill.type ?? "X"}${bill.number ?? Math.random().toString(36).slice(2, 7)}:${bill.congress ?? 0}`,
        title: bill.title ?? "Untitled legislation",
        kind,
        issueId,
        issueName: issueId ? (ISSUE_NAME_BY_ID.get(issueId) ?? null) : null,
        date: bill.introducedDate ?? null,
        billNumber,
        congress: bill.congress ?? null,
        url: publicBillUrl(bill),
      });
    }
  };

  consume(sponsored, "sponsored");
  consume(cosponsored, "cosponsored");

  // Keep the most recent records (cap to keep storage + enrichment reasonable).
  records.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return records.slice(0, 40);
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

// ---------------------------------------------------------------------------
// House roll-call votes — the actual voting record.
// ---------------------------------------------------------------------------

export interface RawHouseVote {
  rollCallNumber: number;
  legislationType?: string;
  legislationNumber?: string;
  voteQuestion?: string;
  result?: string;
  startDate?: string;
}

export interface RawMemberVote {
  bioguideId: string;
  voteCast: string; // "Yea" | "Nay" | "Present" | "Not Voting"
}

/** Lists all House roll-call votes for a (congress, session). */
export async function fetchHouseVoteList(
  congress: number,
  session: number,
  apiKey: string,
): Promise<RawHouseVote[]> {
  const out: RawHouseVote[] = [];
  let offset = 0;
  const limit = 250;
  for (let i = 0; i < 12; i++) {
    const data = await apiGet<{
      houseRollCallVotes?: {
        rollCallNumber: number;
        legislationType?: string;
        legislationNumber?: string;
        voteQuestion?: string;
        result?: string;
        startDate?: string;
      }[];
    }>(`/house-vote/${congress}/${session}?limit=${limit}&offset=${offset}`, apiKey);
    const batch = data.houseRollCallVotes ?? [];
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    await sleep(250);
  }
  return out;
}

/**
 * Fetches one House roll call's detail — notably the `voteQuestion`, which the
 * list endpoint omits and which is needed to tell substantive passage votes
 * apart from procedural motions.
 */
export async function fetchHouseVoteDetail(
  congress: number,
  session: number,
  rollCallNumber: number,
  apiKey: string,
): Promise<{ voteQuestion: string | null; result: string | null } | null> {
  try {
    const data = await apiGet<{
      houseRollCallVote?: { voteQuestion?: string; result?: string };
    }>(`/house-vote/${congress}/${session}/${rollCallNumber}`, apiKey);
    const v = data.houseRollCallVote;
    if (!v) return null;
    return {
      voteQuestion: v.voteQuestion ?? null,
      result: v.result ?? null,
    };
  } catch {
    return null;
  }
}

/** Per-member Yea/Nay for one House roll call. */
export async function fetchHouseVoteMembers(
  congress: number,
  session: number,
  rollCallNumber: number,
  apiKey: string,
): Promise<RawMemberVote[]> {
  const data = await apiGet<{
    houseRollCallVoteMemberVotes?: {
      results?: { bioguideID?: string; voteCast?: string }[];
    };
  }>(`/house-vote/${congress}/${session}/${rollCallNumber}/members`, apiKey);
  const results = data.houseRollCallVoteMemberVotes?.results ?? [];
  return results
    .filter((r) => r.bioguideID && r.voteCast)
    .map((r) => ({ bioguideId: r.bioguideID!, voteCast: r.voteCast! }));
}

/** How far a bill advanced, derived from its latest-action text. */
export type ActionStatus =
  | "introduced"
  | "advanced"
  | "passed"
  | "law"
  | "failed";

/** Classifies a bill's latest-action text into a coarse advancement status. */
export function deriveActionStatus(latestActionText: string | null): ActionStatus {
  const t = (latestActionText ?? "").toLowerCase();
  if (!t) return "introduced";
  if (/became (public|private) law|signed by president|enacted/.test(t))
    return "law";
  if (/failed|rejected|motion to table agreed|veto sustained|not agreed/.test(t))
    return "failed";
  if (/passed|agreed to in (house|senate)|on passage|resolving differences/.test(t))
    return "passed";
  if (
    /reported|placed on .*calendar|ordered to be reported|committee|markup|cloture|received in the (house|senate)/.test(
      t,
    )
  )
    return "advanced";
  return "introduced";
}

export interface BillDetail {
  title: string;
  policyArea: string | null;
  actionStatus: ActionStatus;
}

/**
 * Fetches a bill's title, policy area, and advancement status (from its latest
 * action). Used both to map a voted bill to an issue and to weight evidence by
 * how far the bill actually got. Returns null on failure (degrade silently).
 */
export async function fetchBillDetail(
  congress: number,
  billType: string,
  billNumber: string,
  apiKey: string,
): Promise<BillDetail | null> {
  const t = billType.toLowerCase();
  try {
    const data = await apiGet<{
      bill?: {
        title?: string;
        policyArea?: { name?: string };
        latestAction?: { text?: string };
      };
    }>(`/bill/${congress}/${t}/${billNumber}`, apiKey);
    const title = data.bill?.title ?? "";
    if (!title) return null;
    return {
      title,
      policyArea: data.bill?.policyArea?.name ?? null,
      actionStatus: deriveActionStatus(data.bill?.latestAction?.text ?? null),
    };
  } catch {
    return null;
  }
}

/**
 * Fetches a bill's legislative subjects (Congress's curated controlled
 * vocabulary), used for reliable issue bucketing. Returns [] on failure.
 */
export async function fetchBillSubjects(
  congress: number,
  billType: string,
  billNumber: string,
  apiKey: string,
): Promise<string[]> {
  const t = billType.toLowerCase();
  try {
    const data = await apiGet<{
      subjects?: { legislativeSubjects?: { name?: string }[] };
    }>(`/bill/${congress}/${t}/${billNumber}/subjects?limit=250`, apiKey);
    const subs = data.subjects?.legislativeSubjects ?? [];
    return subs
      .map((s) => s.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
  } catch {
    return [];
  }
}

export function publicBillUrlFrom(
  congress: number,
  type: string,
  number: string,
): string | null {
  return publicBillUrl({ congress, type, number });
}

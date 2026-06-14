// ---------------------------------------------------------------------------
// Senate roll-call votes — the actual Senate voting record.
//
// The Senate, unlike the House, does NOT expose roll-call votes through the
// Congress.gov API. Its authoritative machine-readable source is the official
// senate.gov LIS XML feeds. We use those as the primary source, and fall back
// to Voteview (UCLA's DW-NOMINATE project) CSV exports when senate.gov is
// unreachable or empty.
//
// Both sources only tell us HOW each member voted on a measure; the measure's
// issue + direction still come from its neutral CRS summary via the shared
// two-pass classifier (see classify.ts), exactly like the House sync.
// ---------------------------------------------------------------------------

const SENATE_BASE = "https://www.senate.gov/legislative/LIS";
const VOTEVIEW_BASE = "https://voteview.com/static/data/out";

// senate.gov rejects requests with no/empty User-Agent.
const UA = "VoterCompass/1.0 (+https://votermatchmaker civic data sync)";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url: string, attempt = 0): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(1500 * (attempt + 1));
      return fetchText(url, attempt + 1);
    }
    if (!res.ok) return null;
    return await res.text();
  } catch {
    if (attempt < 3) {
      await sleep(1000 * (attempt + 1));
      return fetchText(url, attempt + 1);
    }
    return null;
  }
}

// --- tiny XML helpers (the senate.gov feeds are simple, flat, no namespaces) --

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** First inner text of <name>…</name> within `xml`, decoded; null if absent. */
function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeXml(m[1]) : null;
}

/** Raw inner bodies of every <name>…</name> block within `xml`. */
function blocks(xml: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

// ---------------------------------------------------------------------------
// Shared shapes (source-agnostic so the sync can treat both feeds uniformly).
// ---------------------------------------------------------------------------

/** A Senate roll call reduced to what we need: identity, question, and which
 *  law-making measure (if any) it was a vote on. `billType` is Congress.gov
 *  style ("hr"|"s"|"hjres"|"sjres") or null when the vote was not on a bill or
 *  joint resolution that can become law (nominations, treaties, simple/concurrent
 *  resolutions, motions to proceed, etc.). */
export interface SenateRollCall {
  source: "senate.gov" | "voteview";
  voteNumber: number;
  session: number;
  question: string | null;
  result: string | null;
  date: string | null;
  billType: string | null;
  billNumber: string | null;
}

/** One senator's recorded vote, already resolved to a bioguide id (the id our
 *  candidate rows key off). Members we cannot crosswalk are dropped upstream. */
export interface SenateMemberVote {
  bioguideId: string;
  voteCast: string; // "Yea" | "Nay" | "Present" | "Not Voting"
}

const LAWMAKING_BILL_TYPES: Record<string, string> = {
  HR: "hr",
  S: "s",
  HJRES: "hjres",
  SJRES: "sjres",
};

/**
 * Parses a measure label (e.g. "S.J.Res. 1", "H.R. 1968", "S. 5", "PN378",
 * "HR1968") into a Congress.gov bill type + number, but ONLY for measures that
 * can become law (bills + joint resolutions). Everything else — nominations,
 * treaties, simple/concurrent resolutions, amendments — returns nulls so it is
 * skipped (a procedural / non-binding vote cannot establish a policy stance).
 */
export function parseMeasure(label: string | null | undefined): {
  billType: string | null;
  billNumber: string | null;
} {
  if (!label) return { billType: null, billNumber: null };
  const cleaned = label.replace(/\./g, "").replace(/\s+/g, "").toUpperCase();
  const m = cleaned.match(/^(HJRES|SJRES|HR|S)(\d+)$/);
  if (!m) return { billType: null, billNumber: null };
  return { billType: LAWMAKING_BILL_TYPES[m[1]] ?? null, billNumber: m[2] };
}

/**
 * True when a Senate roll-call question is a SUBSTANTIVE final vote on a measure
 * (passing the bill / agreeing to the joint resolution / conference report or
 * motion to concur) rather than a procedural step (cloture, motion to proceed,
 * tabling, amendments, nominations). Only final passage tells us where a senator
 * actually stands on the bill.
 */
export function isSenatePassageQuestion(
  question: string | null | undefined,
): boolean {
  if (!question) return false;
  const q = question.toLowerCase();
  const procedural =
    /cloture|motion to proceed|motion to discharge|motion to refer|motion to recommit|motion to table|to table|previous question|the journal|quorum|point of order|sustaining the ruling|reconsider|nomination|confirmation|on the amendment|adjourn/;
  if (procedural.test(q)) return false;
  return /on passage|passage of the bill|on the joint resolution|agreeing to the joint resolution|on the bill|on the conference report|conference report|to concur|concur in the/.test(
    q,
  );
}

// ---------------------------------------------------------------------------
// Primary source: senate.gov official LIS XML.
// ---------------------------------------------------------------------------

/**
 * Builds a LIS member id → bioguide id crosswalk from the public
 * congress-legislators "current" dataset. senate.gov vote XML identifies
 * senators only by their LIS id, so this is required to map a recorded vote
 * back to one of our candidate rows. Degrades to an empty map on failure.
 */
export async function buildLisToBioguide(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await fetch(
      "https://unitedstates.github.io/congress-legislators/legislators-current.json",
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) return out;
    const data = (await res.json()) as { id?: { lis?: string; bioguide?: string } }[];
    for (const p of data) {
      const lis = p.id?.lis;
      const bioguide = p.id?.bioguide;
      if (lis && bioguide) out.set(lis, bioguide);
    }
  } catch {
    return out;
  }
  return out;
}

/**
 * Lists all Senate roll-call votes for a (congress, session) from the official
 * senate.gov vote_menu XML. The menu's `<issue>` already names the measure, so
 * we can parse the bill identity here without a per-roll detail call.
 * Returns [] on any failure (so the caller can fall back to Voteview).
 */
export async function fetchSenateVoteList(
  congress: number,
  session: number,
): Promise<SenateRollCall[]> {
  const url = `${SENATE_BASE}/roll_call_lists/vote_menu_${congress}_${session}.xml`;
  const xml = await fetchText(url);
  if (!xml) return [];
  const out: SenateRollCall[] = [];
  for (const v of blocks(xml, "vote")) {
    const num = parseInt(tag(v, "vote_number") ?? "", 10);
    if (!Number.isFinite(num)) continue;
    const { billType, billNumber } = parseMeasure(tag(v, "issue"));
    out.push({
      source: "senate.gov",
      voteNumber: num,
      session,
      question: tag(v, "question"),
      result: tag(v, "result"),
      date: tag(v, "vote_date"),
      billType,
      billNumber,
    });
  }
  return out;
}

/**
 * Fetches the per-member Yea/Nay for one Senate roll call from senate.gov's
 * per-vote XML, resolving each LIS id to a bioguide via `lisToBioguide`.
 * Members that cannot be crosswalked are dropped. Returns [] on failure.
 */
export async function fetchSenateVoteMembers(
  congress: number,
  session: number,
  voteNumber: number,
  lisToBioguide: Map<string, string>,
): Promise<SenateMemberVote[]> {
  const padded = String(voteNumber).padStart(5, "0");
  const url = `${SENATE_BASE}/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${padded}.xml`;
  const xml = await fetchText(url);
  if (!xml) return [];
  const membersBlock = blocks(xml, "members")[0] ?? "";
  const out: SenateMemberVote[] = [];
  for (const m of blocks(membersBlock, "member")) {
    const lis = tag(m, "lis_member_id");
    const voteCast = tag(m, "vote_cast");
    if (!lis || !voteCast) continue;
    const bioguideId = lisToBioguide.get(lis);
    if (!bioguideId) continue;
    out.push({ bioguideId, voteCast });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fallback source: Voteview (UCLA) CSV exports.
// ---------------------------------------------------------------------------

/** Minimal RFC-4180-ish CSV parser (handles quotes + embedded newlines). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0];
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === "") continue;
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      rec[h] = cells[idx] ?? "";
    });
    out.push(rec);
  }
  return out;
}

/** Voteview cast_code → our voteCast string. */
function castCodeToVote(code: string): string {
  switch (code) {
    case "1":
    case "2":
    case "3":
      return "Yea";
    case "4":
    case "5":
    case "6":
      return "Nay";
    case "7":
    case "8":
      return "Present";
    default:
      return "Not Voting";
  }
}

export interface VoteviewSenateData {
  rollCalls: SenateRollCall[];
  membersByRoll: Map<number, SenateMemberVote[]>;
}

/**
 * Loads a full Senate Congress from Voteview (rollcalls + members + per-member
 * votes, three CSV files) and shapes it like the senate.gov path so the sync is
 * source-agnostic. icpsr → bioguide comes from Voteview's own members file.
 * Returns empty data on any failure.
 */
export async function fetchVoteviewSenate(
  congress: number,
  sessions: number[],
): Promise<VoteviewSenateData> {
  const empty: VoteviewSenateData = { rollCalls: [], membersByRoll: new Map() };
  const [rollText, memberText, voteText] = await Promise.all([
    fetchText(`${VOTEVIEW_BASE}/rollcalls/S${congress}_rollcalls.csv`),
    fetchText(`${VOTEVIEW_BASE}/members/S${congress}_members.csv`),
    fetchText(`${VOTEVIEW_BASE}/votes/S${congress}_votes.csv`),
  ]);
  if (!rollText || !memberText || !voteText) return empty;

  // icpsr → bioguide.
  const icpsrToBioguide = new Map<string, string>();
  for (const m of parseCsv(memberText)) {
    const icpsr = m.icpsr;
    const bioguide = m.bioguide_id;
    if (icpsr && bioguide) icpsrToBioguide.set(icpsr, bioguide);
  }

  const sessionSet = new Set(sessions.map(String));
  const rollCalls: SenateRollCall[] = [];
  const keptRolls = new Set<string>();
  for (const r of parseCsv(rollText)) {
    if (r.chamber && r.chamber.toLowerCase() !== "senate") continue;
    if (r.session && sessionSet.size > 0 && !sessionSet.has(r.session)) continue;
    const rollnumber = parseInt(r.rollnumber, 10);
    if (!Number.isFinite(rollnumber)) continue;
    const { billType, billNumber } = parseMeasure(r.bill_number);
    rollCalls.push({
      source: "voteview",
      voteNumber: rollnumber,
      session: r.session ? parseInt(r.session, 10) || 0 : 0,
      question: r.vote_question || r.vote_desc || null,
      result: r.vote_result || null,
      date: r.date || null,
      billType,
      billNumber,
    });
    keptRolls.add(String(rollnumber));
  }

  const membersByRoll = new Map<number, SenateMemberVote[]>();
  for (const v of parseCsv(voteText)) {
    if (v.chamber && v.chamber.toLowerCase() !== "senate") continue;
    if (!keptRolls.has(v.rollnumber)) continue;
    const bioguideId = icpsrToBioguide.get(v.icpsr);
    if (!bioguideId) continue;
    const rollnumber = parseInt(v.rollnumber, 10);
    const list = membersByRoll.get(rollnumber) ?? [];
    list.push({ bioguideId, voteCast: castCodeToVote(v.cast_code) });
    membersByRoll.set(rollnumber, list);
  }

  return { rollCalls, membersByRoll };
}

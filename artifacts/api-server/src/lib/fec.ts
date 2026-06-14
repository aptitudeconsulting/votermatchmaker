import { logger } from "./logger";
import {
  classifyName,
  isNoiseEmployer,
  isConduit,
  isSelfCommittee,
  DONOR_SECTORS,
  type DonorSector,
} from "../data/donors";

// Server-side FEC (api.open.fec.gov) client + bioguide→FEC-ID crosswalk.
//
// The whole feature degrades silently: no FEC_API_KEY, no crosswalk match, or no
// classifiable money → callers get `null` and the app behaves exactly as before.
// All sector signals are DERIVED from contributor/employer names (the FEC has no
// industry codes) and are surfaced to users as such, with FEC attribution.

const FEC_BASE = "https://api.open.fec.gov/v1";
const CROSSWALK_URL =
  "https://unitedstates.github.io/congress-legislators/legislators-current.json";

/** How many top employer aggregates / committee receipts to classify per cycle. */
const TOP_EMPLOYERS = 100;
const TOP_COMMITTEE_RECEIPTS = 100;

export interface DonorCategory {
  sector: string;
  label: string;
  issueId: string;
  direction: 1 | -1;
  total: number;
  contributorCount: number;
}

export interface DonorIssueSignal {
  issueId: string;
  /** Signed lean on the issue's -2..+2 axis. */
  lean: number;
  /** 0..1 confidence from classified dollar volume. */
  confidence: number;
  classifiedTotal: number;
  topSectorLabel: string | null;
}

export interface DonorProfile {
  fecCandidateIds: string[];
  categories: DonorCategory[];
  signals: DonorIssueSignal[];
  classifiedTotal: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function apiKey(): string | null {
  const k = process.env.FEC_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

async function fecGet<T>(
  path: string,
  params: Record<string, string | number | string[]>,
  key: string,
  attempt = 0,
): Promise<T | null> {
  const url = new URL(`${FEC_BASE}${path}`);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      for (const item of v) url.searchParams.append(k, String(item));
    } else {
      url.searchParams.set(k, String(v));
    }
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 4) {
        await sleep(2000 * (attempt + 1));
        return fecGet<T>(path, params, key, attempt + 1);
      }
      logger.warn({ status: res.status, path }, "FEC request failed (retries exhausted)");
      return null;
    }
    if (!res.ok) {
      logger.warn({ status: res.status, path }, "FEC request not ok");
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    if (attempt < 2) {
      await sleep(1500 * (attempt + 1));
      return fecGet<T>(path, params, key, attempt + 1);
    }
    logger.warn({ err, path }, "FEC request threw");
    return null;
  }
}

// ---- Crosswalk -------------------------------------------------------------

interface LegislatorEntry {
  id?: { bioguide?: string; fec?: string[] };
}

export type FecCrosswalk = Map<string, string[]>;

/** Fetch the public bioguide→FEC-ID crosswalk once. Returns empty map on failure. */
export async function loadFecCrosswalk(): Promise<FecCrosswalk> {
  const map: FecCrosswalk = new Map();
  try {
    const res = await fetch(CROSSWALK_URL, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      logger.warn({ status: res.status }, "FEC crosswalk fetch not ok");
      return map;
    }
    const data = (await res.json()) as LegislatorEntry[];
    for (const entry of data) {
      const bioguide = entry.id?.bioguide;
      const fec = entry.id?.fec;
      if (bioguide && Array.isArray(fec) && fec.length) map.set(bioguide, fec);
    }
  } catch (err) {
    logger.warn({ err }, "FEC crosswalk fetch threw");
  }
  return map;
}

// ---- FEC API shapes --------------------------------------------------------

interface CommitteeRow {
  committee_id?: string;
  designation?: string; // P principal, A authorized, J joint, D leadership, U unauthorized
  name?: string;
}

interface ByEmployerRow {
  employer?: string;
  total?: number;
  count?: number;
}

interface ScheduleARow {
  contributor_name?: string;
  contributor_committee_id?: string | null;
  contribution_receipt_amount?: number;
}

/**
 * Resolve a member's own authorized campaign committees (money flows TO these)
 * and collect every committee name tied to the member so self/joint transfers can
 * be excluded from the contributor side.
 */
async function resolveCommittees(
  fecIds: string[],
  key: string,
): Promise<{ committeeIds: string[]; selfNames: string[] }> {
  const committeeIds = new Set<string>();
  const selfNames: string[] = [];
  for (const fecId of fecIds) {
    const data = await fecGet<{ results?: CommitteeRow[] }>(
      `/candidate/${fecId}/committees/`,
      { per_page: 50 },
      key,
    );
    for (const c of data?.results ?? []) {
      if (c.name) selfNames.push(c.name);
      // Money raised by the candidate flows into Principal / Authorized committees.
      if ((c.designation === "P" || c.designation === "A") && c.committee_id) {
        committeeIds.add(c.committee_id);
      }
    }
    await sleep(250);
  }
  return { committeeIds: [...committeeIds], selfNames };
}

/** Top itemized individual donors aggregated by employer for one committee+cycle. */
async function fetchByEmployer(
  committeeId: string,
  cycle: number,
  key: string,
): Promise<ByEmployerRow[]> {
  const data = await fecGet<{ results?: ByEmployerRow[] }>(
    `/schedules/schedule_a/by_employer/`,
    { committee_id: committeeId, cycle, per_page: TOP_EMPLOYERS, sort: "-total" },
    key,
  );
  return data?.results ?? [];
}

/** Top committee/PAC receipts for one committee+cycle (excludes individuals). */
async function fetchCommitteeReceipts(
  committeeId: string,
  cycle: number,
  key: string,
): Promise<ScheduleARow[]> {
  const data = await fecGet<{ results?: ScheduleARow[] }>(
    `/schedules/schedule_a/`,
    {
      committee_id: committeeId,
      two_year_transaction_period: cycle,
      is_individual: "false",
      per_page: TOP_COMMITTEE_RECEIPTS,
      sort: "-contribution_receipt_amount",
    },
    key,
  );
  return data?.results ?? [];
}

export interface SectorAccum {
  sector: DonorSector;
  total: number;
  count: number;
}

/**
 * Pure per-issue reduction: turn classified per-sector dollar accumulators into
 * signed leans + confidences on each issue's -2..+2 axis. Extracted from
 * `buildDonorProfile` so the dollar-weighting / lean / confidence-cap /
 * dominant-sector math is testable without hitting the FEC network.
 *
 * For each issue:
 *  - lean = (Σ direction·dollars / Σ dollars) · 2, so opposing sectors net out by
 *    dollar weight; rounded to 2 decimals on the -2..+2 axis.
 *  - confidence = min(0.5, issueTotal / 100000), so it saturates (caps at 0.5)
 *    around ~$50k of classified money; rounded to 2 decimals.
 *  - topSectorLabel = label of the highest-dollar sector on the issue.
 */
export function aggregateDonorSignals(accums: SectorAccum[]): DonorIssueSignal[] {
  const byIssue = new Map<string, SectorAccum[]>();
  for (const a of accums) {
    const arr = byIssue.get(a.sector.issueId) ?? [];
    arr.push(a);
    byIssue.set(a.sector.issueId, arr);
  }

  const signals: DonorIssueSignal[] = [];
  for (const [issueId, arr] of byIssue) {
    const issueTotal = arr.reduce((s, a) => s + a.total, 0);
    if (!(issueTotal > 0)) continue;
    // Weighted mean of sector directions in [-1, 1], scaled to the -2..+2 axis.
    const weightedDir =
      arr.reduce((s, a) => s + a.sector.direction * a.total, 0) / issueTotal;
    const lean = Math.round(weightedDir * 2 * 100) / 100;
    const dominant = [...arr].sort((a, b) => b.total - a.total)[0];
    // Confidence saturates around ~$50k of classified money on the issue.
    const confidence = Math.round(Math.min(0.5, issueTotal / 100000) * 100) / 100;
    signals.push({
      issueId,
      lean,
      confidence,
      classifiedTotal: Math.round(issueTotal),
      topSectorLabel: dominant?.sector.label ?? null,
    });
  }
  return signals;
}

function defaultCycle(): number {
  // FEC reports on two-year cycles ending in even years.
  const y = new Date().getFullYear();
  return y % 2 === 0 ? y : y + 1;
}

/**
 * Build a donor profile for one member: resolve committees, pull classifiable
 * receipts (external committee money + itemized individuals by employer), map
 * names to sectors, and aggregate into display categories + per-issue signals.
 * Returns null when there is no FEC key, no committees, or no classifiable money.
 */
export async function buildDonorProfile(
  bioguideId: string,
  crosswalk: FecCrosswalk,
  opts: { cycles?: number[] } = {},
): Promise<DonorProfile | null> {
  const key = apiKey();
  if (!key) return null;

  const fecIds = crosswalk.get(bioguideId);
  if (!fecIds || fecIds.length === 0) return null;

  const { committeeIds, selfNames } = await resolveCommittees(fecIds, key);
  if (committeeIds.length === 0) return null;

  const surnames = selfNames
    .flatMap((n) => n.toLowerCase().split(/[^a-z]+/))
    .filter((w) => w.length >= 4);

  const cycles = opts.cycles ?? [defaultCycle()];
  const bySector = new Map<string, SectorAccum>();

  const add = (sector: DonorSector, amount: number, contributors: number) => {
    if (!(amount > 0)) return;
    const cur = bySector.get(sector.key) ?? { sector, total: 0, count: 0 };
    cur.total += amount;
    cur.count += contributors;
    bySector.set(sector.key, cur);
  };

  for (const committeeId of committeeIds) {
    for (const cycle of cycles) {
      // External committee / PAC money.
      const receipts = await fetchCommitteeReceipts(committeeId, cycle, key);
      for (const r of receipts) {
        const name = r.contributor_name ?? "";
        if (!name) continue;
        if (isConduit(name) || isSelfCommittee(name, surnames)) continue;
        const sector = classifyName(name);
        if (sector) add(sector, r.contribution_receipt_amount ?? 0, 1);
      }
      await sleep(300);

      // Itemized individual donors aggregated by employer.
      const employers = await fetchByEmployer(committeeId, cycle, key);
      for (const e of employers) {
        const employer = e.employer ?? "";
        if (!employer || isNoiseEmployer(employer)) continue;
        const sector = classifyName(employer);
        if (sector) add(sector, e.total ?? 0, e.count ?? 1);
      }
      await sleep(300);
    }
  }

  if (bySector.size === 0) return null;

  const accums = [...bySector.values()];
  const classifiedTotal = accums.reduce((s, a) => s + a.total, 0);
  if (!(classifiedTotal > 0)) return null;

  const categories: DonorCategory[] = accums
    .sort((a, b) => b.total - a.total)
    .map((a) => ({
      sector: a.sector.key,
      label: a.sector.label,
      issueId: a.sector.issueId,
      direction: a.sector.direction,
      total: Math.round(a.total),
      contributorCount: a.count,
    }));

  // Per-issue signals: combine sector directions weighted by dollars.
  const signals = aggregateDonorSignals(accums);

  return {
    fecCandidateIds: fecIds,
    categories,
    signals,
    classifiedTotal: Math.round(classifiedTotal),
  };
}

/** Exposed for documentation/methodology surfaces. */
export const DONOR_SECTOR_COUNT = DONOR_SECTORS.length;

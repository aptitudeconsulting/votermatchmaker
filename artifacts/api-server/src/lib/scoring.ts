import type { PositionEvidence } from "@workspace/db";

/**
 * Scoring engine v2 — pure aggregation.
 *
 * Candidate positions are built ONLY from per-bill stances classified from each
 * bill's neutral CRS summary (issue + direction + confidence). There are no party
 * priors and no title-keyword guesses. When the surviving evidence is too thin or
 * too contradictory, the issue is flagged `insufficient` and the UI says so
 * honestly rather than inventing a number.
 */

/** One classified contributing bill feeding an aggregate position. */
export interface ClassifiedRecord {
  recordId: string;
  issueId: string;
  /** -1 / 0 / +1 on the issue axis (0 = touched but no clear direction). */
  direction: number;
  /** 0..1 confidence from the two-pass classifier. */
  confidence: number;
  /** "sponsored" | "cosponsored" — sponsored is the stronger signal. */
  kind: string;
  /** "introduced" | "advanced" | "passed" | "law" | "failed" | null. */
  actionStatus: string | null;
  omnibus: boolean;
  billNumber: string | null;
  title: string;
  url: string | null;
  date: string | null;
  rationale: string;
}

export interface AggregatedPosition {
  issueId: string;
  position: number;
  confidence: number;
  sourceCount: number;
  insufficient: boolean;
  summary: string;
  evidence: PositionEvidence[];
}

const EVIDENCE_WEIGHT: Record<string, number> = {
  sponsored: 1,
  cosponsored: 0.5,
};

// How far a bill advanced. Bills that became law or passed a chamber are far
// stronger evidence of a real commitment than a bill merely introduced for a
// press release (a "messaging" bill), which is down-weighted.
const ADVANCEMENT_WEIGHT: Record<string, number> = {
  law: 1.5,
  passed: 1.3,
  advanced: 1.1,
  introduced: 0.85,
  failed: 0.8,
};

const OMNIBUS_PENALTY = 0.5;

/** Below this confidence we say "insufficient record to assess". */
export const CONFIDENCE_THRESHOLD = 0.35;
/** Minimum summed evidence weight (directional) before we assess a direction. */
export const MIN_TOTAL_WEIGHT = 0.9;
/** A position this close to neutral is treated as no clear lean. */
export const MIN_ABS_POSITION = 0.25;
/** Full-confidence directional evidence mass. */
const FULL_WEIGHT = 3;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function recordWeight(r: ClassifiedRecord): number {
  const ev = EVIDENCE_WEIGHT[r.kind] ?? 0.5;
  const adv = r.actionStatus ? (ADVANCEMENT_WEIGHT[r.actionStatus] ?? 1) : 1;
  const clarity = Math.max(0.1, r.confidence);
  const omni = r.omnibus ? OMNIBUS_PENALTY : 1;
  return ev * adv * clarity * omni;
}

function toEvidence(r: ClassifiedRecord): PositionEvidence {
  return {
    recordId: r.recordId,
    billNumber: r.billNumber,
    title: r.title,
    url: r.url,
    kind: r.kind,
    direction: r.direction,
    rationale: r.rationale,
    date: r.date,
  };
}

/**
 * Aggregate per-bill stances into one position per issue, with an honest
 * insufficient-record flag and clickable receipts. Pure and deterministic.
 */
export function aggregateStancePositions(
  records: ClassifiedRecord[],
): AggregatedPosition[] {
  const byIssue = new Map<string, ClassifiedRecord[]>();
  for (const r of records) {
    if (!r.issueId) continue;
    const arr = byIssue.get(r.issueId) ?? [];
    arr.push(r);
    byIssue.set(r.issueId, arr);
  }

  const out: AggregatedPosition[] = [];
  for (const [issueId, group] of byIssue) {
    const directional = group.filter((r) => r.direction !== 0);

    let numer = 0;
    let denom = 0;
    let claritySum = 0;
    for (const r of directional) {
      const w = recordWeight(r);
      numer += w * r.direction;
      denom += w;
      claritySum += Math.max(0.1, r.confidence);
    }

    const meanDir = denom > 0 ? numer / denom : 0;
    const position = clamp(meanDir * 2, -2, 2);
    // Agreement: how one-directional the evidence is (0 = split, 1 = unanimous).
    const agreement = denom > 0 ? Math.abs(numer) / denom : 0;
    const volumeConf = clamp(denom / FULL_WEIGHT, 0, 1);
    const meanClarity =
      directional.length > 0 ? claritySum / directional.length : 0;
    const confidence = clamp(
      (0.35 + 0.65 * volumeConf) * agreement * (0.55 + 0.45 * meanClarity),
      0,
      1,
    );

    const insufficient =
      directional.length === 0 ||
      denom < MIN_TOTAL_WEIGHT ||
      confidence < CONFIDENCE_THRESHOLD ||
      Math.abs(position) < MIN_ABS_POSITION;

    // Receipts: strongest contributing bills first. Prefer directional ones.
    const ranked = [...group].sort((a, b) => {
      const ad = a.direction !== 0 ? 1 : 0;
      const bd = b.direction !== 0 ? 1 : 0;
      if (ad !== bd) return bd - ad;
      return recordWeight(b) - recordWeight(a);
    });
    const evidence = ranked.slice(0, 6).map(toEvidence);

    const summary = insufficient
      ? `Insufficient legislative record to assess a clear position (${group.length} related ${group.length === 1 ? "bill" : "bills"} found).`
      : `Derived from ${directional.length} directional ${directional.length === 1 ? "bill" : "bills"} in this candidate's legislative record.`;

    out.push({
      issueId,
      position: insufficient ? 0 : position,
      confidence,
      sourceCount: group.length,
      insufficient,
      summary,
      evidence,
    });
  }

  return out;
}

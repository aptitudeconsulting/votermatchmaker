/**
 * Re-election timing derived from a member's current term-end date.
 *
 * U.S. federal general elections are held in November of even years. A seat
 * whose term ends at the start of a new Congress (~Jan 3 of an odd year) was
 * last contested the prior November (the even year before). Mid-term / special
 * vacancies end mid-year and are contested in November of that same year.
 */

/** The next (or current) general-election year: the upcoming even year. */
export function nextGeneralElectionYear(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  if (year % 2 === 0) {
    // Once December of an even year arrives, that November vote is past.
    return now.getUTCMonth() >= 11 ? year + 2 : year;
  }
  return year + 1;
}

export interface ReelectionInfo {
  /** True when this seat is contested in the current/upcoming general election. */
  upForReelection: boolean;
  /** The November (even) year this seat is next contested, or null if unknown. */
  electionYear: number | null;
}

export function computeReelection(
  termEnd: string | null | undefined,
  now: Date = new Date(),
): ReelectionInfo {
  if (!termEnd) return { upForReelection: false, electionYear: null };
  const end = new Date(`${termEnd}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) {
    return { upForReelection: false, electionYear: null };
  }
  const endYear = end.getUTCFullYear();
  // Terms ending in January start a new Congress → contested the prior November.
  const electionYear = end.getUTCMonth() === 0 ? endYear - 1 : endYear;
  return {
    upForReelection: electionYear === nextGeneralElectionYear(now),
    electionYear,
  };
}

import type { VoteExample } from "@workspace/db";

/**
 * True when a House roll-call question is a SUBSTANTIVE vote on legislation
 * (passing/agreeing/concurring) rather than a procedural motion (previous
 * question, recommit, table, adjourn, journal, quorum, electing the speaker).
 * Only substantive votes tell us where a member actually stands on a bill.
 */
export function isSubstantivePassageVote(question: string | undefined): boolean {
  if (!question) return false;
  const q = question.toLowerCase();
  const procedural =
    /previous question|recommit|table|adjourn|the journal|quorum|elect.* speaker|credentials|de la cruz/;
  if (procedural.test(q)) return false;
  return /pass|concur|agree to the resolution|agreeing to the resolution|adopt/.test(
    q,
  );
}

/** A single member's recorded vote on one issue-tagged, directional bill. */
export interface VoteEvent {
  candidateId: string;
  issueId: string;
  /** Sign of the bill's directional language on the issue axis (+1 / -1). */
  direction: number;
  voteCast: string; // "Yea" | "Nay" | "Present" | "Not Voting"
  billNumber: string;
  title: string;
  url: string | null;
  date: string | null;
}

export interface AggregatedVoteSignal {
  candidateId: string;
  issueId: string;
  position: number;
  voteCount: number;
  agreeShare: number;
  examples: VoteExample[];
}

/**
 * Converts a recorded vote into a directional contribution on the issue axis:
 * a Yea endorses the bill's direction, a Nay opposes it. Present / Not Voting
 * carry no directional signal. Returns +1 (toward the issue's "+" pole), -1
 * (toward the "-" pole), or null (not directional).
 */
export function voteContribution(
  voteCast: string,
  direction: number,
): number | null {
  const v = voteCast.toLowerCase();
  if (v === "yea" || v === "aye" || v === "yes") return direction;
  if (v === "nay" || v === "no") return -direction;
  return null;
}

const MAX_EXAMPLES = 3;

/**
 * Aggregates many member vote events into one vote-derived position per
 * (candidate, issue). Position maps the member's mean directional agreement
 * (-1..+1) onto the internal -2..+2 axis; agreeShare is how lopsided the record
 * is; examples are the most recent illustrative votes.
 */
export function aggregateVoteSignals(
  events: VoteEvent[],
): AggregatedVoteSignal[] {
  interface Acc {
    support: number;
    oppose: number;
    examples: (VoteExample & { _date: string })[];
  }
  const byKey = new Map<string, Acc>();

  for (const e of events) {
    const contribution = voteContribution(e.voteCast, e.direction);
    if (contribution === null) continue;
    const key = `${e.candidateId}::${e.issueId}`;
    let acc = byKey.get(key);
    if (!acc) {
      acc = { support: 0, oppose: 0, examples: [] };
      byKey.set(key, acc);
    }
    if (contribution > 0) acc.support++;
    else acc.oppose++;
    acc.examples.push({
      billNumber: e.billNumber,
      title: e.title,
      url: e.url,
      voteCast: e.voteCast,
      date: e.date,
      aligns: contribution > 0,
      _date: e.date ?? "",
    });
  }

  const out: AggregatedVoteSignal[] = [];
  for (const [key, acc] of byKey) {
    const [candidateId, issueId] = key.split("::");
    const count = acc.support + acc.oppose;
    if (count === 0) continue;
    const position =
      Math.max(-2, Math.min(2, ((acc.support - acc.oppose) / count) * 2));
    const agreeShare = Math.max(acc.support, acc.oppose) / count;
    const examples = acc.examples
      .sort((a, b) => b._date.localeCompare(a._date))
      .slice(0, MAX_EXAMPLES)
      .map(({ _date, ...rest }) => rest);
    out.push({
      candidateId,
      issueId,
      position: Math.round(position * 100) / 100,
      voteCount: count,
      agreeShare: Math.round(agreeShare * 100) / 100,
      examples,
    });
  }
  return out;
}

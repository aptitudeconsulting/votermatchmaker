export interface VoterStanceInput {
  issueId: string;
  issueName: string;
  position: number;
  importance: number;
}

export interface CandidatePositionInput {
  issueId: string;
  issueName: string;
  position: number;
  confidence: number;
  summary: string;
  /**
   * True when the candidate's record is too thin/contradictory to assess a
   * direction. Insufficient positions are NOT scored — we never guess (or fall
   * back to a party prior), so the issue simply doesn't count toward the match.
   */
  insufficient?: boolean;
}

/** Donor evidence for one issue. Adjusts confidence and raises tension flags only. */
export interface DonorSignalInput {
  issueId: string;
  /** Signed donor lean on the -2..+2 axis. */
  lean: number;
  /** 0..1 confidence from classified dollar volume. */
  confidence: number;
  classifiedTotal: number;
  topSectorLabel: string | null;
}

/**
 * Roll-call vote evidence for one issue — the candidate's ACTUAL voting record.
 * Unlike donor signals, votes MOVE the position: they are the strongest form of
 * legislative behavior, so they dominate the sponsorship/party-prior base.
 */
export interface VoteSignalInput {
  issueId: string;
  /** Vote-derived position on the -2..+2 axis. */
  position: number;
  /** Number of directional floor votes behind the signal. */
  voteCount: number;
}

export interface IssueBreakdown {
  issueId: string;
  issueName: string;
  voterPosition: number;
  voterImportance: number;
  candidatePosition: number;
  candidateConfidence: number;
  alignment: number;
  summary: string | null;
  /** Number of actual floor votes behind the candidate's position (0 when none). */
  voteCount: number;
  /** True when donor money clearly contradicts the legislative-derived position. */
  donorTension: boolean;
  /** One-line, factual explanation of the tension (record says X, money leans Y). */
  donorNote: string | null;
  /** Signed donor lean on the -2..+2 axis, when donor data exists. */
  donorLean: number | null;
}

export interface MatchComputation {
  score: number;
  grade: string;
  coverage: number;
  breakdown: IssueBreakdown[];
  topAgreements: IssueBreakdown[];
  topDisagreements: IssueBreakdown[];
  sharedPriorityCount: number;
  donorTensionCount: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Signed alignment in [-1, 1]: 1 = identical, 0 = one step apart, -1 = opposite. */
function signedAlignment(voterPos: number, candidatePos: number): number {
  const diff = Math.abs(voterPos - candidatePos); // 0..4
  return clamp(1 - diff / 2, -1, 1);
}

export function scoreToGrade(score: number): string {
  if (score >= 93) return "A+";
  if (score >= 88) return "A";
  if (score >= 83) return "A-";
  if (score >= 78) return "B+";
  if (score >= 73) return "B";
  if (score >= 68) return "B-";
  if (score >= 63) return "C+";
  if (score >= 58) return "C";
  if (score >= 53) return "C-";
  if (score >= 45) return "D";
  return "F";
}

/**
 * Adjust a position's confidence using donor evidence. Donor money that agrees in
 * SIGN with the candidate's legislation-derived position modestly raises
 * confidence (so the issue weighs a bit more); money that points the opposite way
 * lowers confidence (a money-muddied position weighs less) and raises a tension
 * flag. Positions themselves are never moved.
 */
export function applyDonorEvidence(
  candidatePosition: number,
  baseConfidence: number,
  donor: DonorSignalInput | undefined,
  issueName: string,
): { confidence: number; donorTension: boolean; donorNote: string | null; donorLean: number | null } {
  if (!donor || !(donor.classifiedTotal > 0) || donor.confidence <= 0) {
    return { confidence: baseConfidence, donorTension: false, donorNote: null, donorLean: null };
  }
  const posSign = Math.sign(candidatePosition);
  const donorSign = Math.sign(donor.lean);
  // Only meaningful when both sides take a clear, opposite-or-aligned direction.
  if (posSign === 0 || donorSign === 0 || Math.abs(donor.lean) < 0.3) {
    return { confidence: baseConfidence, donorTension: false, donorNote: null, donorLean: donor.lean };
  }

  if (donorSign === posSign) {
    // Confirming money: nudge confidence up, capped at 1.
    const confidence = Math.min(1, baseConfidence + donor.confidence * 0.4);
    return { confidence, donorTension: false, donorNote: null, donorLean: donor.lean };
  }

  // Contradicting money: discount confidence and flag a neutral tension.
  const confidence = Math.max(0.05, baseConfidence * (1 - donor.confidence));
  const dollars = `$${Math.round(donor.classifiedTotal).toLocaleString("en-US")}`;
  const sector = donor.topSectorLabel ?? "their largest classified donors";
  const note = `Their record leans one way on ${issueName.toLowerCase()}, but ${dollars} in classified donations (led by ${sector}) leans the other way.`;
  return { confidence, donorTension: true, donorNote: note, donorLean: donor.lean };
}

/**
 * Blends a candidate's ACTUAL roll-call voting record into their base position
 * (which comes from sponsorship + party prior + bill-title language). Votes are
 * the strongest evidence, so they take an increasing share of the blend as the
 * vote count grows (up to ~70%), and they raise confidence. With no votes the
 * base position is returned unchanged. Returns the rounded blended position and
 * confidence plus the vote count for display.
 */
export function applyVoteEvidence(
  basePosition: number,
  baseConfidence: number,
  vote: VoteSignalInput | undefined,
): { position: number; confidence: number; voteCount: number } {
  if (!vote || vote.voteCount <= 0) {
    return { position: basePosition, confidence: baseConfidence, voteCount: 0 };
  }
  const w = Math.min(0.7, vote.voteCount * 0.12);
  const position = clamp(w * vote.position + (1 - w) * basePosition, -2, 2);
  const confidence = Math.min(
    1,
    baseConfidence + Math.min(0.35, vote.voteCount * 0.04),
  );
  return {
    position: Math.round(position * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    voteCount: vote.voteCount,
  };
}

export function computeMatch(
  voterStances: VoterStanceInput[],
  candidatePositions: CandidatePositionInput[],
  donorSignals: DonorSignalInput[] = [],
  voteSignals: VoteSignalInput[] = [],
): MatchComputation {
  const positionByIssue = new Map(
    candidatePositions.map((p) => [p.issueId, p]),
  );
  const donorByIssue = new Map(donorSignals.map((d) => [d.issueId, d]));
  const voteByIssue = new Map(voteSignals.map((v) => [v.issueId, v]));

  const breakdown: IssueBreakdown[] = [];
  let weightedAlignSum = 0;
  let weightSum = 0;
  let totalImportance = 0;
  let coveredImportance = 0;

  for (const stance of voterStances) {
    if (stance.importance <= 0) continue;
    totalImportance += stance.importance;

    const cand = positionByIssue.get(stance.issueId);
    // An insufficient (or missing) position is honestly not scored — but if the
    // candidate has an ACTUAL roll-call record on this issue, votes alone can
    // still establish a position.
    const vote = voteByIssue.get(stance.issueId);
    if ((!cand || cand.insufficient) && !(vote && vote.voteCount > 0)) continue;
    const basePosition = cand && !cand.insufficient ? cand.position : 0;
    const baseConfidence = cand && !cand.insufficient ? cand.confidence : 0.3;
    const {
      position: votedPosition,
      confidence: votedConfidence,
      voteCount,
    } = applyVoteEvidence(basePosition, baseConfidence, vote);

    const donor = donorByIssue.get(stance.issueId);
    const { confidence: effConfidence, donorTension, donorNote, donorLean } =
      applyDonorEvidence(votedPosition, votedConfidence, donor, stance.issueName);

    const alignment = signedAlignment(stance.position, votedPosition);
    const align01 = (alignment + 1) / 2; // 0..1
    const weight = stance.importance * effConfidence;

    weightedAlignSum += weight * align01;
    weightSum += weight;
    coveredImportance += stance.importance * effConfidence;

    breakdown.push({
      issueId: stance.issueId,
      issueName: stance.issueName,
      voterPosition: stance.position,
      voterImportance: stance.importance,
      candidatePosition: votedPosition,
      candidateConfidence: effConfidence,
      alignment,
      summary:
        (cand && !cand.insufficient ? cand.summary : null) ||
        (vote && vote.voteCount > 0
          ? `Derived from ${vote.voteCount} House floor vote${vote.voteCount === 1 ? "" : "s"} on ${stance.issueName.toLowerCase()}.`
          : null),
      voteCount,
      donorTension,
      donorNote,
      donorLean,
    });
  }

  const score = weightSum > 0 ? (weightedAlignSum / weightSum) * 100 : 0;
  const coverage = totalImportance > 0 ? coveredImportance / totalImportance : 0;

  const byAlignment = [...breakdown].sort((a, b) => b.alignment - a.alignment);
  const topAgreements = byAlignment
    .filter((b) => b.alignment > 0.2)
    .slice(0, 3);
  const topDisagreements = [...byAlignment]
    .reverse()
    .filter((b) => b.alignment < 0.5)
    .slice(0, 3);

  const sharedPriorityCount = breakdown.filter(
    (b) => b.voterImportance >= 3 && b.alignment >= 0.5,
  ).length;

  const donorTensionCount = breakdown.filter((b) => b.donorTension).length;

  return {
    score: Math.round(score),
    grade: scoreToGrade(score),
    coverage,
    breakdown: breakdown.sort(
      (a, b) =>
        b.voterImportance - a.voterImportance || b.alignment - a.alignment,
    ),
    topAgreements,
    topDisagreements,
    sharedPriorityCount,
    donorTensionCount,
  };
}

export function buildMatchSummary(
  candidateName: string,
  result: MatchComputation,
): string {
  if (result.breakdown.length === 0) {
    return `We don't yet have enough of your priorities to assess ${candidateName}. Answer a few more questions to sharpen this match.`;
  }
  const agreeNames = result.topAgreements.map((b) => b.issueName);
  const disagreeNames = result.topDisagreements
    .filter((b) => b.alignment < 0.2)
    .map((b) => b.issueName);

  const parts: string[] = [];
  if (result.score >= 75) {
    if (agreeNames.length) {
      parts.push(
        `Strong alignment with your views on ${joinNames(agreeNames)}.`,
      );
    } else {
      parts.push("Broadly aligned with your priorities.");
    }
    if (disagreeNames.length) {
      parts.push(`You differ most on ${joinNames(disagreeNames)}.`);
    }
  } else if (result.score >= 55) {
    if (agreeNames.length) {
      parts.push(`Common ground on ${joinNames(agreeNames)}`);
    } else {
      parts.push("A mixed match");
    }
    if (disagreeNames.length) {
      parts.push(`with real differences on ${joinNames(disagreeNames)}.`);
    } else {
      parts.push("with some differences across your priorities.");
    }
  } else {
    if (disagreeNames.length) {
      parts.push(
        `Diverges from you on ${joinNames(disagreeNames)}`,
      );
    } else {
      parts.push("Limited alignment with your priorities");
    }
    if (agreeNames.length) {
      parts.push(`though you do agree on ${joinNames(agreeNames)}.`);
    } else {
      parts.push(".");
    }
  }
  return parts.join(" ").replace(" .", ".");
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

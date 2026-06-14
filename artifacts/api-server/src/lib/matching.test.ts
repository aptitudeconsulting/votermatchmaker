import { describe, it, expect } from "vitest";
import {
  applyDonorEvidence,
  applyVoteEvidence,
  computeMatch,
  scoreToGrade,
  type DonorSignalInput,
  type VoteSignalInput,
  type VoterStanceInput,
  type CandidatePositionInput,
} from "./matching";

function donor(overrides: Partial<DonorSignalInput> = {}): DonorSignalInput {
  return {
    issueId: "climate",
    lean: 0,
    confidence: 0.5,
    classifiedTotal: 50000,
    topSectorLabel: "Fossil fuel & oil/gas",
    ...overrides,
  };
}

describe("applyDonorEvidence", () => {
  it("raises confidence when donor money agrees in sign with the position", () => {
    const base = 0.5;
    const result = applyDonorEvidence(
      2, // candidate leans + on the axis
      base,
      donor({ lean: 1.5, confidence: 0.5 }), // money also leans +
      "Climate",
    );
    expect(result.confidence).toBeGreaterThan(base);
    expect(result.confidence).toBe(0.5 + 0.5 * 0.4);
    expect(result.donorTension).toBe(false);
    expect(result.donorNote).toBeNull();
    expect(result.donorLean).toBe(1.5);
  });

  it("caps confidence at 1 when agreeing money would push it over", () => {
    const result = applyDonorEvidence(
      2,
      0.95,
      donor({ lean: 1.5, confidence: 0.5 }), // +0.2 nudge would exceed 1
      "Climate",
    );
    expect(result.confidence).toBe(1);
    expect(result.donorTension).toBe(false);
  });

  it("lowers confidence, flags tension, and writes a note when money contradicts", () => {
    const base = 0.6;
    const result = applyDonorEvidence(
      2, // record leans +
      base,
      donor({ lean: -1.5, confidence: 0.5, classifiedTotal: 80000 }), // money leans -
      "Climate",
    );
    expect(result.confidence).toBeLessThan(base);
    expect(result.confidence).toBe(Math.max(0.05, base * (1 - 0.5)));
    expect(result.donorTension).toBe(true);
    expect(result.donorNote).toContain("climate");
    expect(result.donorNote).toContain("$80,000");
    expect(result.donorNote).toContain("Fossil fuel & oil/gas");
    expect(result.donorLean).toBe(-1.5);
  });

  it("floors discounted confidence at 0.05 even when donor confidence is 1", () => {
    const result = applyDonorEvidence(
      2,
      0.6,
      donor({ lean: -1.5, confidence: 1 }),
      "Climate",
    );
    expect(result.confidence).toBe(0.05);
    expect(result.donorTension).toBe(true);
  });

  it("falls back to a generic donor descriptor when no top sector label exists", () => {
    const result = applyDonorEvidence(
      2,
      0.6,
      donor({ lean: -1.5, confidence: 0.5, topSectorLabel: null }),
      "Climate",
    );
    expect(result.donorNote).toContain("their largest classified donors");
  });

  it("does nothing when there is no donor evidence", () => {
    const result = applyDonorEvidence(2, 0.6, undefined, "Climate");
    expect(result).toEqual({
      confidence: 0.6,
      donorTension: false,
      donorNote: null,
      donorLean: null,
    });
  });

  it("does nothing when classified total is zero", () => {
    const result = applyDonorEvidence(
      2,
      0.6,
      donor({ lean: -1.5, classifiedTotal: 0 }),
      "Climate",
    );
    expect(result.confidence).toBe(0.6);
    expect(result.donorTension).toBe(false);
    expect(result.donorNote).toBeNull();
  });

  it("does nothing when donor confidence is zero", () => {
    const result = applyDonorEvidence(
      2,
      0.6,
      donor({ lean: -1.5, confidence: 0 }),
      "Climate",
    );
    expect(result.confidence).toBe(0.6);
    expect(result.donorTension).toBe(false);
    expect(result.donorNote).toBeNull();
  });

  it("does nothing when the candidate position is neutral (sign 0)", () => {
    const result = applyDonorEvidence(
      0, // no clear legislative direction
      0.6,
      donor({ lean: -1.5, confidence: 0.5 }),
      "Climate",
    );
    expect(result.confidence).toBe(0.6);
    expect(result.donorTension).toBe(false);
    expect(result.donorNote).toBeNull();
    // donorLean is still surfaced even when it cannot act.
    expect(result.donorLean).toBe(-1.5);
  });

  it("does nothing when the donor lean is neutral (sign 0)", () => {
    const result = applyDonorEvidence(
      2,
      0.6,
      donor({ lean: 0, confidence: 0.5 }),
      "Climate",
    );
    expect(result.confidence).toBe(0.6);
    expect(result.donorTension).toBe(false);
    expect(result.donorNote).toBeNull();
  });

  it("ignores weak donor leans below the 0.3 magnitude threshold", () => {
    const result = applyDonorEvidence(
      2,
      0.6,
      donor({ lean: -0.2, confidence: 0.5 }), // opposite sign but too weak
      "Climate",
    );
    expect(result.confidence).toBe(0.6);
    expect(result.donorTension).toBe(false);
    expect(result.donorNote).toBeNull();
    expect(result.donorLean).toBe(-0.2);
  });
});

describe("computeMatch donor invariants", () => {
  const voter: VoterStanceInput[] = [
    { issueId: "climate", issueName: "Climate", position: 2, importance: 4 },
  ];
  const positions: CandidatePositionInput[] = [
    {
      issueId: "climate",
      issueName: "Climate",
      position: 2,
      confidence: 0.5,
      summary: "Sponsored clean-energy bills.",
    },
  ];

  it("never moves the candidate position, regardless of contradicting money", () => {
    const result = computeMatch(voter, positions, [
      donor({ issueId: "climate", lean: -2, confidence: 1, classifiedTotal: 90000 }),
    ]);
    expect(result.breakdown[0].candidatePosition).toBe(2);
    expect(result.donorTensionCount).toBe(1);
    expect(result.breakdown[0].donorTension).toBe(true);
  });

  it("agreeing money raises effective confidence but leaves position untouched", () => {
    const result = computeMatch(voter, positions, [
      donor({ issueId: "climate", lean: 2, confidence: 0.5, classifiedTotal: 90000 }),
    ]);
    expect(result.breakdown[0].candidatePosition).toBe(2);
    expect(result.breakdown[0].candidateConfidence).toBeGreaterThan(0.5);
    expect(result.donorTensionCount).toBe(0);
  });

  it("produces no tension and no confidence change without donor signals", () => {
    const result = computeMatch(voter, positions, []);
    expect(result.breakdown[0].candidateConfidence).toBe(0.5);
    expect(result.breakdown[0].donorTension).toBe(false);
    expect(result.breakdown[0].donorLean).toBeNull();
    expect(result.donorTensionCount).toBe(0);
  });
});

function vote(overrides: Partial<VoteSignalInput> = {}): VoteSignalInput {
  return { issueId: "climate", position: -2, voteCount: 6, ...overrides };
}

describe("applyVoteEvidence", () => {
  it("returns the base position unchanged when there are no votes", () => {
    const r = applyVoteEvidence(1.5, 0.4, undefined);
    expect(r.position).toBe(1.5);
    expect(r.confidence).toBe(0.4);
    expect(r.voteCount).toBe(0);
  });

  it("moves the position toward the voting record and raises confidence", () => {
    // base says +2, but the actual record (6 votes) says -2.
    const r = applyVoteEvidence(2, 0.4, vote({ position: -2, voteCount: 6 }));
    // w = min(0.7, 6*0.12) = 0.7 → 0.7*-2 + 0.3*2 = -0.8
    expect(r.position).toBeCloseTo(-0.8, 5);
    expect(r.confidence).toBeCloseTo(0.4 + 0.24, 5); // +min(0.35, 6*0.04)=+0.24
    expect(r.voteCount).toBe(6);
  });

  it("caps the vote weight at 0.7 and confidence boost at 0.35", () => {
    const r = applyVoteEvidence(2, 0.8, vote({ position: -2, voteCount: 50 }));
    expect(r.position).toBeCloseTo(-0.8, 5); // weight capped at 0.7
    expect(r.confidence).toBeCloseTo(1, 5); // 0.8 + capped 0.35 → clamped to 1
  });
});

describe("computeMatch vote evidence", () => {
  const voter: VoterStanceInput[] = [
    { issueId: "climate", issueName: "Climate", position: 2, importance: 4 },
  ];
  const positions: CandidatePositionInput[] = [
    {
      issueId: "climate",
      issueName: "Climate",
      position: 2,
      confidence: 0.5,
      summary: "Sponsored clean-energy bills.",
    },
  ];

  it("votes MOVE the candidate position (unlike donor money)", () => {
    const result = computeMatch(voter, positions, [], [
      vote({ issueId: "climate", position: -2, voteCount: 6 }),
    ]);
    expect(result.breakdown[0].candidatePosition).toBeCloseTo(-0.8, 5);
    expect(result.breakdown[0].voteCount).toBe(6);
  });

  it("leaves voteCount at 0 and position untouched without vote signals", () => {
    const result = computeMatch(voter, positions, [], []);
    expect(result.breakdown[0].candidatePosition).toBe(2);
    expect(result.breakdown[0].voteCount).toBe(0);
  });
});

describe("scoreToGrade", () => {
  it("maps each threshold to its letter grade", () => {
    expect(scoreToGrade(100)).toBe("A+");
    expect(scoreToGrade(93)).toBe("A+");
    expect(scoreToGrade(92)).toBe("A");
    expect(scoreToGrade(88)).toBe("A");
    expect(scoreToGrade(87)).toBe("A-");
    expect(scoreToGrade(83)).toBe("A-");
    expect(scoreToGrade(82)).toBe("B+");
    expect(scoreToGrade(78)).toBe("B+");
    expect(scoreToGrade(77)).toBe("B");
    expect(scoreToGrade(73)).toBe("B");
    expect(scoreToGrade(72)).toBe("B-");
    expect(scoreToGrade(68)).toBe("B-");
    expect(scoreToGrade(67)).toBe("C+");
    expect(scoreToGrade(63)).toBe("C+");
    expect(scoreToGrade(62)).toBe("C");
    expect(scoreToGrade(58)).toBe("C");
    expect(scoreToGrade(57)).toBe("C-");
    expect(scoreToGrade(53)).toBe("C-");
    expect(scoreToGrade(52)).toBe("D");
    expect(scoreToGrade(45)).toBe("D");
    expect(scoreToGrade(44)).toBe("F");
    expect(scoreToGrade(0)).toBe("F");
  });
});

describe("computeMatch scoring", () => {
  it("scores ~100 for perfect agreement on every issue", () => {
    const voter: VoterStanceInput[] = [
      { issueId: "climate", issueName: "Climate", position: 2, importance: 4 },
      { issueId: "guns", issueName: "Guns", position: -1, importance: 2 },
    ];
    const positions: CandidatePositionInput[] = [
      { issueId: "climate", issueName: "Climate", position: 2, confidence: 1, summary: "" },
      { issueId: "guns", issueName: "Guns", position: -1, confidence: 1, summary: "" },
    ];
    const result = computeMatch(voter, positions);
    expect(result.score).toBe(100);
    expect(result.grade).toBe("A+");
    expect(result.coverage).toBe(1);
  });

  it("scores low for opposite stances on every issue", () => {
    const voter: VoterStanceInput[] = [
      { issueId: "climate", issueName: "Climate", position: 2, importance: 4 },
    ];
    const positions: CandidatePositionInput[] = [
      { issueId: "climate", issueName: "Climate", position: -2, confidence: 1, summary: "" },
    ];
    const result = computeMatch(voter, positions);
    expect(result.score).toBe(0);
    expect(result.grade).toBe("F");
  });

  it("weights higher-importance issues more heavily in the score", () => {
    const aligned: CandidatePositionInput = {
      issueId: "a", issueName: "A", position: 2, confidence: 1, summary: "",
    };
    const opposed: CandidatePositionInput = {
      issueId: "b", issueName: "B", position: -2, confidence: 1, summary: "",
    };
    const positions = [aligned, opposed];

    // Agreement on the high-importance issue pulls the score up.
    const agreeOnImportant = computeMatch(
      [
        { issueId: "a", issueName: "A", position: 2, importance: 4 },
        { issueId: "b", issueName: "B", position: 2, importance: 1 },
      ],
      positions,
    );
    // Disagreement on the high-importance issue pulls the score down.
    const disagreeOnImportant = computeMatch(
      [
        { issueId: "a", issueName: "A", position: 2, importance: 1 },
        { issueId: "b", issueName: "B", position: 2, importance: 4 },
      ],
      positions,
    );
    expect(agreeOnImportant.score).toBe(80);
    expect(disagreeOnImportant.score).toBe(20);
    expect(agreeOnImportant.score).toBeGreaterThan(disagreeOnImportant.score);
  });

  it("weights higher-confidence positions more heavily in the score", () => {
    const voter: VoterStanceInput[] = [
      { issueId: "a", issueName: "A", position: 2, importance: 2 },
      { issueId: "b", issueName: "B", position: 2, importance: 2 },
    ];
    // A agrees, B is opposite. As B's confidence rises it drags the score down.
    const lowDisagreeConfidence = computeMatch(voter, [
      { issueId: "a", issueName: "A", position: 2, confidence: 1, summary: "" },
      { issueId: "b", issueName: "B", position: -2, confidence: 0.5, summary: "" },
    ]);
    const highDisagreeConfidence = computeMatch(voter, [
      { issueId: "a", issueName: "A", position: 2, confidence: 1, summary: "" },
      { issueId: "b", issueName: "B", position: -2, confidence: 1, summary: "" },
    ]);
    // weightedAlign = 2 (from A); weightSum = 2 + 1 -> 67, vs 2 + 2 -> 50.
    expect(lowDisagreeConfidence.score).toBe(67);
    expect(highDisagreeConfidence.score).toBe(50);
    expect(lowDisagreeConfidence.score).toBeGreaterThan(
      highDisagreeConfidence.score,
    );
  });

  it("reduces coverage when the candidate is missing positions the voter cares about", () => {
    const voter: VoterStanceInput[] = [
      { issueId: "a", issueName: "A", position: 2, importance: 4 },
      { issueId: "b", issueName: "B", position: 2, importance: 2 },
    ];
    // Only one of the two issues is covered, both at full confidence.
    const result = computeMatch(voter, [
      { issueId: "a", issueName: "A", position: 2, confidence: 1, summary: "" },
    ]);
    expect(result.coverage).toBeCloseTo(4 / 6, 5);
    expect(result.breakdown).toHaveLength(1);
  });

  it("ignores stances with non-positive importance", () => {
    const result = computeMatch(
      [
        { issueId: "a", issueName: "A", position: 2, importance: 4 },
        { issueId: "b", issueName: "B", position: 2, importance: 0 },
      ],
      [
        { issueId: "a", issueName: "A", position: 2, confidence: 1, summary: "" },
        { issueId: "b", issueName: "B", position: -2, confidence: 1, summary: "" },
      ],
    );
    // The zero-importance opposite issue must not appear or affect the score.
    expect(result.breakdown).toHaveLength(1);
    expect(result.score).toBe(100);
    expect(result.coverage).toBe(1);
  });

  it("returns a zero score, F grade, and zero coverage with no comparable issues", () => {
    const result = computeMatch(
      [{ issueId: "a", issueName: "A", position: 2, importance: 4 }],
      [],
    );
    expect(result.score).toBe(0);
    expect(result.grade).toBe("F");
    expect(result.coverage).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  it("selects top agreements and disagreements and counts shared priorities", () => {
    const voter: VoterStanceInput[] = [
      { issueId: "i1", issueName: "I1", position: 2, importance: 4 },
      { issueId: "i2", issueName: "I2", position: 2, importance: 3 },
      { issueId: "i3", issueName: "I3", position: 2, importance: 2 },
      { issueId: "i4", issueName: "I4", position: 2, importance: 4 },
    ];
    const positions: CandidatePositionInput[] = [
      { issueId: "i1", issueName: "I1", position: 2, confidence: 1, summary: "" }, // align 1
      { issueId: "i2", issueName: "I2", position: 1, confidence: 1, summary: "" }, // align 0.5
      { issueId: "i3", issueName: "I3", position: 0, confidence: 1, summary: "" }, // align 0
      { issueId: "i4", issueName: "I4", position: -2, confidence: 1, summary: "" }, // align -1
    ];
    const result = computeMatch(voter, positions);

    expect(result.topAgreements.map((b) => b.issueId)).toEqual(["i1", "i2"]);
    expect(result.topDisagreements.map((b) => b.issueId)).toEqual(["i4", "i3"]);
    // shared priorities: importance >= 3 AND alignment >= 0.5 -> i1 and i2 only.
    expect(result.sharedPriorityCount).toBe(2);
  });

  it("orders the breakdown by importance then alignment", () => {
    const voter: VoterStanceInput[] = [
      { issueId: "low", issueName: "Low", position: 2, importance: 1 },
      { issueId: "highAgree", issueName: "High Agree", position: 2, importance: 5 },
      { issueId: "highDisagree", issueName: "High Disagree", position: 2, importance: 5 },
    ];
    const positions: CandidatePositionInput[] = [
      { issueId: "low", issueName: "Low", position: 2, confidence: 1, summary: "" },
      { issueId: "highAgree", issueName: "High Agree", position: 2, confidence: 1, summary: "" },
      { issueId: "highDisagree", issueName: "High Disagree", position: -2, confidence: 1, summary: "" },
    ];
    const result = computeMatch(voter, positions);
    expect(result.breakdown.map((b) => b.issueId)).toEqual([
      "highAgree",
      "highDisagree",
      "low",
    ]);
  });
});

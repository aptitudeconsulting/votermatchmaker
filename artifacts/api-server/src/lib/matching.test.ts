import { describe, it, expect } from "vitest";
import {
  applyDonorEvidence,
  computeMatch,
  type DonorSignalInput,
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

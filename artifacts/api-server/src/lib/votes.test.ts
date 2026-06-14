import { describe, it, expect } from "vitest";
import {
  isSubstantivePassageVote,
  isSubstantiveLegislationType,
  voteContribution,
  aggregateVoteSignals,
  type VoteEvent,
} from "./votes";

describe("isSubstantivePassageVote", () => {
  it("accepts passage / concurrence / adoption questions", () => {
    expect(isSubstantivePassageVote("On Passage")).toBe(true);
    expect(isSubstantivePassageVote("On Motion to Concur in the Senate Amendment")).toBe(true);
    expect(isSubstantivePassageVote("On Agreeing to the Resolution")).toBe(true);
    expect(isSubstantivePassageVote("On Adopting the Resolution")).toBe(true);
  });

  it("rejects procedural motions", () => {
    expect(isSubstantivePassageVote("On Ordering the Previous Question")).toBe(false);
    expect(isSubstantivePassageVote("On Motion to Recommit")).toBe(false);
    expect(isSubstantivePassageVote("On Motion to Table")).toBe(false);
    expect(isSubstantivePassageVote("On Motion to Adjourn")).toBe(false);
    expect(isSubstantivePassageVote("On Approving the Journal")).toBe(false);
    expect(isSubstantivePassageVote(undefined)).toBe(false);
    expect(isSubstantivePassageVote("Quorum Call")).toBe(false);
  });
});

describe("isSubstantiveLegislationType", () => {
  it("accepts bills and joint resolutions (can become law)", () => {
    expect(isSubstantiveLegislationType("HR")).toBe(true);
    expect(isSubstantiveLegislationType("S")).toBe(true);
    expect(isSubstantiveLegislationType("HJRES")).toBe(true);
    expect(isSubstantiveLegislationType("SJRES")).toBe(true);
    expect(isSubstantiveLegislationType("hr")).toBe(true);
  });

  it("rejects simple/concurrent resolutions (rule-adoption + messaging)", () => {
    expect(isSubstantiveLegislationType("HRES")).toBe(false);
    expect(isSubstantiveLegislationType("HCONRES")).toBe(false);
    expect(isSubstantiveLegislationType("SRES")).toBe(false);
    expect(isSubstantiveLegislationType("SCONRES")).toBe(false);
    expect(isSubstantiveLegislationType(null)).toBe(false);
    expect(isSubstantiveLegislationType(undefined)).toBe(false);
  });
});

describe("voteContribution", () => {
  it("Yea endorses direction, Nay opposes it", () => {
    expect(voteContribution("Yea", 1)).toBe(1);
    expect(voteContribution("Nay", 1)).toBe(-1);
    expect(voteContribution("Yea", -1)).toBe(-1);
    expect(voteContribution("Nay", -1)).toBe(1);
  });

  it("non-directional votes return null", () => {
    expect(voteContribution("Present", 1)).toBeNull();
    expect(voteContribution("Not Voting", -1)).toBeNull();
  });
});

function ev(partial: Partial<VoteEvent> & Pick<VoteEvent, "voteCast" | "direction">): VoteEvent {
  return {
    candidateId: "congress-A",
    issueId: "climate",
    billNumber: "hr1",
    title: "A bill",
    url: null,
    date: "2025-01-01",
    ...partial,
  };
}

describe("aggregateVoteSignals", () => {
  it("maps a fully-aligned record to the issue's + pole", () => {
    const [sig] = aggregateVoteSignals([
      ev({ voteCast: "Yea", direction: 1, date: "2025-01-01" }),
      ev({ voteCast: "Yea", direction: 1, date: "2025-02-01" }),
    ]);
    expect(sig.candidateId).toBe("congress-A");
    expect(sig.issueId).toBe("climate");
    expect(sig.position).toBe(2);
    expect(sig.voteCount).toBe(2);
    expect(sig.agreeShare).toBe(1);
  });

  it("a split record lands near the middle", () => {
    const [sig] = aggregateVoteSignals([
      ev({ voteCast: "Yea", direction: 1 }),
      ev({ voteCast: "Nay", direction: 1 }),
    ]);
    expect(sig.position).toBe(0);
    expect(sig.agreeShare).toBe(0.5);
  });

  it("ignores Present / Not Voting in the count", () => {
    const sigs = aggregateVoteSignals([
      ev({ voteCast: "Yea", direction: 1 }),
      ev({ voteCast: "Present", direction: 1 }),
      ev({ voteCast: "Not Voting", direction: 1 }),
    ]);
    expect(sigs[0].voteCount).toBe(1);
  });

  it("keeps at most 3 examples, most recent first", () => {
    const [sig] = aggregateVoteSignals([
      ev({ voteCast: "Yea", direction: 1, date: "2025-01-01" }),
      ev({ voteCast: "Yea", direction: 1, date: "2025-03-01" }),
      ev({ voteCast: "Nay", direction: 1, date: "2025-05-01" }),
      ev({ voteCast: "Yea", direction: 1, date: "2025-02-01" }),
    ]);
    expect(sig.examples).toHaveLength(3);
    expect(sig.examples[0].date).toBe("2025-05-01");
    expect(sig.examples[0].aligns).toBe(false);
  });

  it("separates signals by candidate and issue", () => {
    const sigs = aggregateVoteSignals([
      ev({ candidateId: "congress-A", issueId: "climate", voteCast: "Yea", direction: 1 }),
      ev({ candidateId: "congress-B", issueId: "climate", voteCast: "Nay", direction: 1 }),
      ev({ candidateId: "congress-A", issueId: "guns", voteCast: "Yea", direction: -1 }),
    ]);
    expect(sigs).toHaveLength(3);
  });
});

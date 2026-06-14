import { describe, it, expect } from "vitest";
import {
  aggregateStancePositions,
  CONFIDENCE_THRESHOLD,
  type ClassifiedRecord,
} from "./scoring";

function rec(overrides: Partial<ClassifiedRecord> = {}): ClassifiedRecord {
  return {
    recordId: Math.random().toString(36).slice(2),
    issueId: "guns",
    direction: 1,
    confidence: 0.9,
    kind: "sponsored",
    actionStatus: "passed",
    omnibus: false,
    billNumber: "HR 1",
    title: "A bill",
    url: "https://example.com",
    date: "2025-01-01",
    rationale: "Does a concrete thing.",
    ...overrides,
  };
}

describe("aggregateStancePositions", () => {
  it("returns no positions for an empty record set", () => {
    expect(aggregateStancePositions([])).toEqual([]);
  });

  it("derives a clear directional position from several agreeing strong bills", () => {
    const out = aggregateStancePositions([
      rec({ direction: 1 }),
      rec({ direction: 1 }),
      rec({ direction: 1 }),
    ]);
    expect(out).toHaveLength(1);
    const p = out[0]!;
    expect(p.issueId).toBe("guns");
    expect(p.insufficient).toBe(false);
    expect(p.position).toBeGreaterThan(0);
    expect(p.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });

  it("flags insufficient when a single thin bill is the only evidence", () => {
    const out = aggregateStancePositions([
      rec({ kind: "cosponsored", confidence: 0.3, actionStatus: "introduced" }),
    ]);
    const p = out[0]!;
    expect(p.insufficient).toBe(true);
    // Insufficient positions never invent a number.
    expect(p.position).toBe(0);
  });

  it("flags insufficient when evidence is evenly contradictory", () => {
    const out = aggregateStancePositions([
      rec({ direction: 1 }),
      rec({ direction: -1 }),
      rec({ direction: 1 }),
      rec({ direction: -1 }),
    ]);
    const p = out[0]!;
    expect(p.insufficient).toBe(true);
  });

  it("never counts a touched-but-non-directional bill toward direction", () => {
    const out = aggregateStancePositions([
      rec({ direction: 0, confidence: 0.2 }),
      rec({ direction: 0, confidence: 0.2 }),
    ]);
    const p = out[0]!;
    expect(p.insufficient).toBe(true);
    expect(p.sourceCount).toBe(2);
  });

  it("down-weights omnibus bills via the penalty", () => {
    const clean = aggregateStancePositions([
      rec({ direction: 1 }),
      rec({ direction: 1 }),
    ])[0]!;
    const omni = aggregateStancePositions([
      rec({ direction: 1, omnibus: true }),
      rec({ direction: 1, omnibus: true }),
    ])[0]!;
    expect(omni.confidence).toBeLessThan(clean.confidence);
  });

  it("weights bills that became law above bills merely introduced", () => {
    const law = aggregateStancePositions([
      rec({ direction: 1, actionStatus: "law" }),
      rec({ direction: 1, actionStatus: "law" }),
    ])[0]!;
    const introduced = aggregateStancePositions([
      rec({ direction: 1, actionStatus: "introduced" }),
      rec({ direction: 1, actionStatus: "introduced" }),
    ])[0]!;
    expect(law.confidence).toBeGreaterThan(introduced.confidence);
  });

  it("emits clickable receipts, directional ones first, capped at 6", () => {
    const records = [
      rec({ direction: 0, title: "Neutral" }),
      ...Array.from({ length: 8 }, (_, i) =>
        rec({ direction: 1, title: `Directional ${i}` }),
      ),
    ];
    const p = aggregateStancePositions(records)[0]!;
    expect(p.evidence.length).toBe(6);
    expect(p.evidence[0]!.direction).toBe(1);
    expect(p.sourceCount).toBe(9);
  });

  it("buckets records into separate issues", () => {
    const out = aggregateStancePositions([
      rec({ issueId: "guns", direction: 1 }),
      rec({ issueId: "guns", direction: 1 }),
      rec({ issueId: "climate", direction: -1 }),
      rec({ issueId: "climate", direction: -1 }),
    ]);
    expect(out.map((p) => p.issueId).sort()).toEqual(["climate", "guns"]);
  });
});

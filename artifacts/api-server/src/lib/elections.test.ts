import { describe, it, expect } from "vitest";
import { computeReelection, nextGeneralElectionYear } from "./elections";

describe("nextGeneralElectionYear", () => {
  it("returns the current year in an even year before December", () => {
    expect(nextGeneralElectionYear(new Date("2026-06-14T00:00:00Z"))).toBe(2026);
    expect(nextGeneralElectionYear(new Date("2026-01-01T00:00:00Z"))).toBe(2026);
    expect(nextGeneralElectionYear(new Date("2026-11-30T00:00:00Z"))).toBe(2026);
  });

  it("advances to the next even year once the cycle is past (December)", () => {
    expect(nextGeneralElectionYear(new Date("2026-12-01T00:00:00Z"))).toBe(2028);
  });

  it("rounds odd years up to the next even year", () => {
    expect(nextGeneralElectionYear(new Date("2025-03-01T00:00:00Z"))).toBe(2026);
    expect(nextGeneralElectionYear(new Date("2027-09-01T00:00:00Z"))).toBe(2028);
  });
});

describe("computeReelection", () => {
  const now = new Date("2026-06-14T00:00:00Z");

  it("returns no signal when term end is missing or unparseable", () => {
    expect(computeReelection(null, now)).toEqual({
      upForReelection: false,
      electionYear: null,
    });
    expect(computeReelection("", now)).toEqual({
      upForReelection: false,
      electionYear: null,
    });
    expect(computeReelection("not-a-date", now)).toEqual({
      upForReelection: false,
      electionYear: null,
    });
  });

  it("maps a January term-end to the prior November election", () => {
    // All current House seats + Senate Class II end Jan 3, 2027 → contested Nov 2026.
    expect(computeReelection("2027-01-03", now)).toEqual({
      upForReelection: true,
      electionYear: 2026,
    });
  });

  it("maps a mid-year special vacancy to that same year's election", () => {
    // Appointed senators serving until a 2026 special election.
    expect(computeReelection("2026-11-03", now)).toEqual({
      upForReelection: true,
      electionYear: 2026,
    });
  });

  it("flags future Senate classes as not up in the current cycle", () => {
    // Class III ends Jan 2029 → 2028; Class I ends Jan 2031 → 2030.
    expect(computeReelection("2029-01-03", now)).toEqual({
      upForReelection: false,
      electionYear: 2028,
    });
    expect(computeReelection("2031-01-03", now)).toEqual({
      upForReelection: false,
      electionYear: 2030,
    });
  });

  it("tracks the cycle as time advances", () => {
    // The same Class III seat becomes "up" once 2028 is the current cycle.
    expect(
      computeReelection("2029-01-03", new Date("2028-05-01T00:00:00Z")),
    ).toEqual({ upForReelection: true, electionYear: 2028 });
  });
});

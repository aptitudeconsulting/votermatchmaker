import { describe, it, expect } from "vitest";
import {
  classifyName,
  isNoiseEmployer,
  isConduit,
  isSelfCommittee,
  DONOR_SECTORS,
} from "./donors";

describe("isNoiseEmployer", () => {
  it("treats empty/blank names as noise", () => {
    expect(isNoiseEmployer("")).toBe(true);
    expect(isNoiseEmployer("   ")).toBe(true);
  });

  it("matches exact noise employers case-insensitively", () => {
    expect(isNoiseEmployer("RETIRED")).toBe(true);
    expect(isNoiseEmployer("retired")).toBe(true);
    expect(isNoiseEmployer("Not Employed")).toBe(true);
    expect(isNoiseEmployer("self-employed")).toBe(true);
    expect(isNoiseEmployer("N/A")).toBe(true);
    expect(isNoiseEmployer("homemaker")).toBe(true);
  });

  it("matches noise employers used as a prefix", () => {
    expect(isNoiseEmployer("retired teacher")).toBe(true);
    expect(isNoiseEmployer("self employed consultant")).toBe(true);
  });

  it("only matches noise words as a whole leading token, not an arbitrary substring", () => {
    // "nationwide" starts with the letters "na" but not the token "na ".
    expect(isNoiseEmployer("Nationwide Insurance")).toBe(false);
    // "student union" contains "student" but not as the leading token.
    expect(isNoiseEmployer("MIT Student Union")).toBe(false);
    expect(isNoiseEmployer("Exxon Mobil")).toBe(false);
  });
});

describe("isConduit", () => {
  it("flags pass-through conduits anywhere in the name", () => {
    expect(isConduit("ActBlue")).toBe(true);
    expect(isConduit("WinRed")).toBe(true);
    expect(isConduit("Earmarked via ActBlue")).toBe(true);
    expect(isConduit("Democracy Engine LLC")).toBe(true);
  });

  it("does not flag ordinary committees", () => {
    expect(isConduit("Lockheed Martin Employees PAC")).toBe(false);
  });
});

describe("isSelfCommittee", () => {
  it("flags generic self/joint/leadership committee phrasing", () => {
    expect(isSelfCommittee("Smith Victory Fund")).toBe(true);
    expect(isSelfCommittee("Friends of Jane Doe")).toBe(true);
    expect(isSelfCommittee("Doe for Congress")).toBe(true);
    expect(isSelfCommittee("Committee to Re-Elect the Member")).toBe(true);
    expect(isSelfCommittee("Some Leadership PAC")).toBe(true);
  });

  it("flags committees containing the member's surname (>= 4 chars)", () => {
    expect(isSelfCommittee("Warren Action Committee", ["warren"])).toBe(true);
    expect(isSelfCommittee("WARREN ACTION COMMITTEE", ["Warren"])).toBe(true);
  });

  it("ignores short surnames to avoid false matches", () => {
    expect(isSelfCommittee("Lee Industries PAC", ["lee"])).toBe(false);
  });

  it("does not flag an unrelated outside committee", () => {
    expect(isSelfCommittee("National Association of Realtors PAC", ["doe"])).toBe(
      false,
    );
  });
});

describe("classifyName exclusions", () => {
  it("returns null for noise employers", () => {
    expect(classifyName("RETIRED")).toBeNull();
    expect(classifyName("Not Employed")).toBeNull();
    expect(classifyName("")).toBeNull();
  });

  it("returns null for conduits even if they would otherwise match nothing", () => {
    expect(classifyName("ActBlue")).toBeNull();
    expect(classifyName("WinRed")).toBeNull();
  });

  it("returns null for an unrecognized employer", () => {
    expect(classifyName("Joe's Corner Diner")).toBeNull();
  });
});

describe("classifyName matching", () => {
  it("classifies a fossil-fuel employer to the climate sector with - direction", () => {
    const sector = classifyName("Exxon Mobil Corporation");
    expect(sector?.key).toBe("fossil-energy");
    expect(sector?.issueId).toBe("climate");
    expect(sector?.direction).toBe(-1);
  });

  it("classifies a clean-energy employer to the climate sector with + direction", () => {
    const sector = classifyName("Sunrun Solar");
    expect(sector?.issueId).toBe("climate");
    expect(sector?.direction).toBe(1);
  });

  it("classifies a labor union to the labor sector", () => {
    const sector = classifyName("SEIU Local 1000");
    expect(sector?.issueId).toBe("labor");
    expect(sector?.direction).toBe(1);
  });

  it("matches keywords case-insensitively", () => {
    expect(classifyName("GOLDMAN SACHS")?.key).toBe("finance");
    expect(classifyName("goldman sachs")?.key).toBe("finance");
  });

  it("returns the first matching sector in declaration order", () => {
    const sector = classifyName("Exxon");
    const firstClimate = DONOR_SECTORS.find((s) => s.issueId === "climate");
    expect(sector?.key).toBe(firstClimate?.key);
  });
});

describe("DONOR_SECTORS integrity", () => {
  it("every sector direction is a +1 or -1 sign", () => {
    for (const s of DONOR_SECTORS) {
      expect(Math.abs(s.direction)).toBe(1);
    }
  });

  it("keywords are stored lowercased so substring matching is case-insensitive", () => {
    for (const s of DONOR_SECTORS) {
      for (const kw of s.keywords) {
        expect(kw).toBe(kw.toLowerCase());
      }
    }
  });
});

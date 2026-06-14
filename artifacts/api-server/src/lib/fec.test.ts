import { describe, it, expect } from "vitest";
import { aggregateDonorSignals, type SectorAccum } from "./fec";
import type { DonorSector } from "../data/donors";

function sector(overrides: Partial<DonorSector> = {}): DonorSector {
  return {
    key: "fossil-energy",
    label: "Fossil fuel & oil/gas",
    issueId: "climate",
    direction: -1,
    keywords: [],
    ...overrides,
  };
}

function accum(
  overrides: Omit<Partial<SectorAccum>, "sector"> & { sector?: Partial<DonorSector> } = {},
): SectorAccum {
  const { sector: sectorOverrides, ...rest } = overrides;
  return {
    sector: sector(sectorOverrides),
    total: 10000,
    count: 1,
    ...rest,
  };
}

describe("aggregateDonorSignals", () => {
  it("scales a single-sector issue's direction onto the -2..+2 axis", () => {
    const signals = aggregateDonorSignals([
      accum({ sector: { direction: -1, issueId: "climate" }, total: 10000 }),
    ]);
    expect(signals).toHaveLength(1);
    expect(signals[0].issueId).toBe("climate");
    expect(signals[0].lean).toBe(-2);
    expect(signals[0].classifiedTotal).toBe(10000);
  });

  it("nets opposing sectors out by dollar weight", () => {
    // $30k toward "-" and $10k toward "+" on the same issue.
    // weightedDir = (-1*30000 + 1*10000) / 40000 = -0.5 → lean = -1.0
    const signals = aggregateDonorSignals([
      accum({ sector: { key: "fossil", direction: -1, issueId: "climate" }, total: 30000 }),
      accum({ sector: { key: "renewables", direction: 1, issueId: "climate", label: "Renewables" }, total: 10000 }),
    ]);
    expect(signals).toHaveLength(1);
    expect(signals[0].lean).toBe(-1);
    expect(signals[0].classifiedTotal).toBe(40000);
  });

  it("nets exactly opposing equal-dollar sectors to a neutral lean", () => {
    const signals = aggregateDonorSignals([
      accum({ sector: { key: "fossil", direction: -1, issueId: "climate" }, total: 25000 }),
      accum({ sector: { key: "renewables", direction: 1, issueId: "climate", label: "Renewables" }, total: 25000 }),
    ]);
    expect(signals[0].lean).toBe(0);
  });

  it("confidence scales linearly below the saturation point", () => {
    // $25k / 100000 = 0.25
    const signals = aggregateDonorSignals([
      accum({ total: 25000 }),
    ]);
    expect(signals[0].confidence).toBe(0.25);
  });

  it("confidence caps at 0.5 around ~$50k of classified money", () => {
    // exactly $50k → 0.5
    const atCap = aggregateDonorSignals([accum({ total: 50000 })]);
    expect(atCap[0].confidence).toBe(0.5);

    // well above $50k still caps at 0.5
    const overCap = aggregateDonorSignals([accum({ total: 500000 })]);
    expect(overCap[0].confidence).toBe(0.5);
  });

  it("picks the highest-dollar sector as topSectorLabel", () => {
    const signals = aggregateDonorSignals([
      accum({ sector: { key: "renewables", direction: 1, issueId: "climate", label: "Renewables" }, total: 10000 }),
      accum({ sector: { key: "fossil", direction: -1, issueId: "climate", label: "Fossil fuel & oil/gas" }, total: 40000 }),
    ]);
    expect(signals[0].topSectorLabel).toBe("Fossil fuel & oil/gas");
  });

  it("separates accumulators by issue", () => {
    const signals = aggregateDonorSignals([
      accum({ sector: { key: "fossil", direction: -1, issueId: "climate", label: "Fossil fuel & oil/gas" }, total: 20000 }),
      accum({ sector: { key: "guns", direction: 1, issueId: "guns", label: "Firearms industry" }, total: 30000 }),
    ]);
    expect(signals).toHaveLength(2);
    const climate = signals.find((s) => s.issueId === "climate")!;
    const guns = signals.find((s) => s.issueId === "guns")!;
    expect(climate.lean).toBe(-2);
    expect(climate.classifiedTotal).toBe(20000);
    expect(guns.lean).toBe(2);
    expect(guns.classifiedTotal).toBe(30000);
  });

  it("rounds lean to 2 decimals on the axis", () => {
    // weightedDir = (-1*10000 + 1*20000)/30000 = 0.3333.. → *2 = 0.6667 → 0.67
    const signals = aggregateDonorSignals([
      accum({ sector: { key: "fossil", direction: -1, issueId: "climate" }, total: 10000 }),
      accum({ sector: { key: "renewables", direction: 1, issueId: "climate", label: "Renewables" }, total: 20000 }),
    ]);
    expect(signals[0].lean).toBe(0.67);
  });

  it("rounds classifiedTotal to whole dollars", () => {
    const signals = aggregateDonorSignals([accum({ total: 12345.67 })]);
    expect(signals[0].classifiedTotal).toBe(12346);
  });

  it("skips issues whose dollars net to zero or below", () => {
    const signals = aggregateDonorSignals([
      accum({ total: 0 }),
    ]);
    expect(signals).toHaveLength(0);
  });

  it("returns no signals for an empty accumulator list", () => {
    expect(aggregateDonorSignals([])).toEqual([]);
  });
});

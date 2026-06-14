import { describe, it, expect } from "vitest";
import { ISSUES, QUESTIONS, ISSUE_POLES } from "./political";

describe("onboarding questions stay balanced and non-partisan", () => {
  it("every question is a balanced 3-option choice with values {2,0,-2}", () => {
    for (const q of QUESTIONS) {
      expect(q.kind, `${q.id} kind`).toBe("choice");
      const values = q.options.map((o) => o.value).sort((a, b) => a - b);
      expect(values, `${q.id} option values`).toEqual([-2, 0, 2]);
      for (const opt of q.options) {
        expect(opt.label?.length, `${q.id} option label`).toBeGreaterThan(0);
        expect(opt.description?.length, `${q.id} option description`).toBeGreaterThan(0);
      }
    }
  });

  it("every question maps to a known issue", () => {
    const issueIds = new Set(ISSUES.map((i) => i.id));
    for (const q of QUESTIONS) {
      expect(issueIds.has(q.issueId), `${q.id} -> ${q.issueId}`).toBe(true);
    }
  });

  it("every issue has both poles described for the matching axis", () => {
    for (const issue of ISSUES) {
      const poles = ISSUE_POLES[issue.id];
      expect(poles, `${issue.id} poles`).toBeDefined();
      expect(poles.plus.length).toBeGreaterThan(0);
      expect(poles.minus.length).toBeGreaterThan(0);
    }
  });
});

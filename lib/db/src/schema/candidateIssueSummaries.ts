import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Cache for the AI-generated plain-language summary of a candidate's legislative
 * record on a single issue. Generated on demand from the issue's classified
 * bills (CRS summaries + rationales) and cached so we only pay the LLM once per
 * (candidate, issue). Keyed by (candidateId, issueId).
 */
export const candidateIssueSummariesTable = pgTable(
  "candidate_issue_summaries",
  {
    candidateId: text("candidate_id").notNull(),
    issueId: text("issue_id").notNull(),
    summary: text("summary").notNull(),
    model: text("model"),
    generatedAt: text("generated_at").notNull(),
  },
  (t) => [
    uniqueIndex("candidate_issue_summaries_candidate_issue_idx").on(
      t.candidateId,
      t.issueId,
    ),
  ],
);

export type CandidateIssueSummary =
  typeof candidateIssueSummariesTable.$inferSelect;
export type InsertCandidateIssueSummary =
  typeof candidateIssueSummariesTable.$inferInsert;

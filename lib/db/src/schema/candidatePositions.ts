import {
  pgTable,
  text,
  real,
  integer,
  serial,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const candidatePositionsTable = pgTable(
  "candidate_positions",
  {
    id: serial("id").primaryKey(),
    candidateId: text("candidate_id").notNull(),
    issueId: text("issue_id").notNull(),
    position: real("position").notNull(),
    confidence: real("confidence").notNull(),
    summary: text("summary").notNull().default(""),
    sourceCount: integer("source_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("candidate_positions_candidate_issue_idx").on(
      t.candidateId,
      t.issueId,
    ),
  ],
);

export type CandidatePosition = typeof candidatePositionsTable.$inferSelect;
export type InsertCandidatePosition =
  typeof candidatePositionsTable.$inferInsert;

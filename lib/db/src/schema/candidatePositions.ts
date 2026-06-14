import {
  pgTable,
  text,
  real,
  integer,
  serial,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * One clickable "receipt" behind a candidate's derived position: the specific
 * bill or vote that contributed, with a one-line rationale (quoting the neutral
 * CRS summary for bills, or describing the floor vote). `direction` is on the
 * issue's internal axis (+1 toward the "+" pole, -1 toward the "-" pole).
 */
export interface PositionEvidence {
  recordId: string;
  billNumber: string | null;
  title: string;
  url: string | null;
  /** "sponsored" | "cosponsored" | "vote" */
  kind: string;
  direction: number;
  rationale: string;
  date: string | null;
}

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
    /**
     * True when the record is too thin to assess a direction with confidence.
     * The UI shows "Insufficient record to assess" rather than guessing — we
     * never fall back to a party prior.
     */
    insufficient: boolean("insufficient").notNull().default(false),
    /** The specific contributing bills/votes shown as receipts in the UI. */
    evidence: jsonb("evidence").$type<PositionEvidence[]>().notNull().default([]),
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

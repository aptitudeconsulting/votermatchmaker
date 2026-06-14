import {
  pgTable,
  text,
  real,
  integer,
  serial,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Display-facing donor categories per candidate (the "Who funds them" section).
 * Each row is a derived sector with its classified dollar total. Sourced to FEC;
 * categories are inferred from contributor/employer names, not FEC industry codes.
 */
export const candidateDonorCategoriesTable = pgTable(
  "candidate_donor_categories",
  {
    id: serial("id").primaryKey(),
    candidateId: text("candidate_id").notNull(),
    sector: text("sector").notNull(),
    label: text("label").notNull(),
    issueId: text("issue_id").notNull(),
    /** Sign on the issue's -2..+2 axis (+1 / -1). */
    direction: integer("direction").notNull(),
    /** Classified dollars attributed to this sector. */
    total: real("total").notNull().default(0),
    contributorCount: integer("contributor_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("candidate_donor_categories_candidate_sector_idx").on(
      t.candidateId,
      t.sector,
    ),
  ],
);

/**
 * Per-issue donor signal used for scoring and tension detection. `lean` is a
 * signed value on the issue's -2..+2 axis derived from sector directions weighted
 * by dollars; `confidence` reflects classified dollar volume. Positions are never
 * derived from this — it only nudges confidence and raises tension flags.
 */
export const candidateDonorSignalsTable = pgTable(
  "candidate_donor_signals",
  {
    id: serial("id").primaryKey(),
    candidateId: text("candidate_id").notNull(),
    issueId: text("issue_id").notNull(),
    /** Signed donor lean on the -2..+2 axis. */
    lean: real("lean").notNull(),
    /** 0..1 confidence in the donor signal, from classified dollar volume. */
    confidence: real("confidence").notNull(),
    /** Classified dollars informing this issue. */
    classifiedTotal: real("classified_total").notNull().default(0),
    /** Label of the dominant sector for a one-line explanation. */
    topSectorLabel: text("top_sector_label"),
  },
  (t) => [
    uniqueIndex("candidate_donor_signals_candidate_issue_idx").on(
      t.candidateId,
      t.issueId,
    ),
  ],
);

export type CandidateDonorCategory =
  typeof candidateDonorCategoriesTable.$inferSelect;
export type InsertCandidateDonorCategory =
  typeof candidateDonorCategoriesTable.$inferInsert;
export type CandidateDonorSignal =
  typeof candidateDonorSignalsTable.$inferSelect;
export type InsertCandidateDonorSignal =
  typeof candidateDonorSignalsTable.$inferInsert;

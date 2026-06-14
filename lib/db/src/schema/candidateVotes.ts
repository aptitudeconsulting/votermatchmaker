import {
  pgTable,
  text,
  real,
  integer,
  serial,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * One illustrative floor vote behind a candidate's vote-derived issue position.
 * `voteCast` is the member's recorded vote ("Yea" / "Nay"); `aligns` is true when
 * that vote pushed toward the issue's "+" pole (i.e. agreed with the bill's
 * directional language).
 */
export interface VoteExample {
  billNumber: string;
  title: string;
  url: string | null;
  voteCast: string;
  date: string | null;
  aligns: boolean;
}

/**
 * Per candidate, per issue, the position DERIVED FROM ACTUAL HOUSE ROLL-CALL
 * VOTES (a member's recorded Yea/Nay on bills mapped to an issue + direction).
 * This is the strongest legislative-behavior signal; at read time it is blended
 * into (and dominates) the sponsorship/party-prior base position. House members
 * only — Senate has no roll-call ingest yet, so it stays sponsorship-derived.
 */
export const candidateVoteSignalsTable = pgTable(
  "candidate_vote_signals",
  {
    id: serial("id").primaryKey(),
    candidateId: text("candidate_id").notNull(),
    issueId: text("issue_id").notNull(),
    /** Vote-derived position on the internal -2..+2 axis. */
    position: real("position").notNull(),
    /** Number of directional floor votes behind this signal. */
    voteCount: integer("vote_count").notNull().default(0),
    /** Share (0..1) of those votes that fell in the majority direction. */
    agreeShare: real("agree_share").notNull().default(0),
    examples: jsonb("examples").$type<VoteExample[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex("candidate_vote_signals_candidate_issue_idx").on(
      t.candidateId,
      t.issueId,
    ),
  ],
);

export type CandidateVoteSignal = typeof candidateVoteSignalsTable.$inferSelect;
export type InsertCandidateVoteSignal =
  typeof candidateVoteSignalsTable.$inferInsert;

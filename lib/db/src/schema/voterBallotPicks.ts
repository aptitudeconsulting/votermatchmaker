import { pgTable, text, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const voterBallotPicksTable = pgTable(
  "voter_ballot_picks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    candidateId: text("candidate_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("voter_ballot_picks_user_candidate_idx").on(t.userId, t.candidateId)],
);

export type VoterBallotPick = typeof voterBallotPicksTable.$inferSelect;
export type InsertVoterBallotPick = typeof voterBallotPicksTable.$inferInsert;

import { pgTable, text, real, serial, uniqueIndex } from "drizzle-orm/pg-core";

export const voterStancesTable = pgTable(
  "voter_stances",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    issueId: text("issue_id").notNull(),
    position: real("position").notNull(),
    importance: real("importance").notNull().default(2),
    source: text("source").notNull().default("onboarding"),
  },
  (t) => [uniqueIndex("voter_stances_user_issue_idx").on(t.userId, t.issueId)],
);

export type VoterStance = typeof voterStancesTable.$inferSelect;
export type InsertVoterStance = typeof voterStancesTable.$inferInsert;

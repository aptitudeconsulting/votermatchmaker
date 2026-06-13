import { pgTable, text, real, serial, uniqueIndex } from "drizzle-orm/pg-core";

export const voterAnswersTable = pgTable(
  "voter_answers",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    questionId: text("question_id").notNull(),
    issueId: text("issue_id").notNull(),
    value: real("value").notNull(),
  },
  (t) => [
    uniqueIndex("voter_answers_user_question_idx").on(t.userId, t.questionId),
  ],
);

export type VoterAnswer = typeof voterAnswersTable.$inferSelect;
export type InsertVoterAnswer = typeof voterAnswersTable.$inferInsert;

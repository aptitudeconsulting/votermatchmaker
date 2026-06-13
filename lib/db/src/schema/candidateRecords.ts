import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const candidateRecordsTable = pgTable("candidate_records", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  issueId: text("issue_id"),
  date: text("date"),
  billNumber: text("bill_number"),
  congress: integer("congress"),
  url: text("url"),
  summary: text("summary"),
});

export type CandidateRecord = typeof candidateRecordsTable.$inferSelect;
export type InsertCandidateRecord = typeof candidateRecordsTable.$inferInsert;

import { pgTable, text, integer, jsonb } from "drizzle-orm/pg-core";

export type QuestionOption = {
  value: number;
  label: string;
  description?: string | null;
};

export const questionsTable = pgTable("questions", {
  id: text("id").primaryKey(),
  issueId: text("issue_id").notNull(),
  prompt: text("prompt").notNull(),
  helpText: text("help_text"),
  kind: text("kind").notNull().default("scale"),
  displayOrder: integer("display_order").notNull().default(0),
  options: jsonb("options").$type<QuestionOption[]>().notNull(),
});

export type Question = typeof questionsTable.$inferSelect;
export type InsertQuestion = typeof questionsTable.$inferInsert;

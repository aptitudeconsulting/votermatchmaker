import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const issuesTable = pgTable("issues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortLabel: text("short_label").notNull(),
  description: text("description").notNull(),
  icon: text("icon"),
  displayOrder: integer("display_order").notNull().default(0),
});

export type Issue = typeof issuesTable.$inferSelect;
export type InsertIssue = typeof issuesTable.$inferInsert;

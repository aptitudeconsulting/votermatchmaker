import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const votersTable = pgTable("voters", {
  userId: text("user_id").primaryKey(),
  zip: text("zip"),
  address: text("address"),
  state: text("state"),
  stateName: text("state_name"),
  district: text("district"),
  completedOnboarding: boolean("completed_onboarding").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Voter = typeof votersTable.$inferSelect;
export type InsertVoter = typeof votersTable.$inferInsert;

import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const candidatesTable = pgTable("candidates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  party: text("party"),
  level: text("level").notNull(),
  state: text("state"),
  stateName: text("state_name"),
  district: text("district"),
  currentRole: text("current_role").notNull(),
  incumbent: boolean("incumbent").notNull().default(true),
  photoUrl: text("photo_url"),
  bioguideId: text("bioguide_id"),
  dataSource: text("data_source").notNull().default("congress.gov"),
  isSample: boolean("is_sample").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Candidate = typeof candidatesTable.$inferSelect;
export type InsertCandidate = typeof candidatesTable.$inferInsert;

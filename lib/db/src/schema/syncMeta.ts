import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const syncMetaTable = pgTable("sync_meta", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SyncMeta = typeof syncMetaTable.$inferSelect;

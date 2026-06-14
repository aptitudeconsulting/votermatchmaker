import { pgTable, text, integer, jsonb } from "drizzle-orm/pg-core";

/**
 * One AI-extracted notable provision found inside a bill a candidate backed.
 * `direction` is on the issue's internal axis (+1 toward the issue's "+" pole,
 * -1 toward the "-" pole, 0 unclear). `unrelated` is true when the provision's
 * subject appears unrelated to the bill's main purpose (a rider/earmark-like
 * attachment). Provisions are AI-generated from the official CRS summary.
 */
export interface ProvisionItem {
  text: string;
  issueId: string | null;
  direction: number;
  unrelated: boolean;
}

export const candidateRecordEnrichmentTable = pgTable(
  "candidate_record_enrichment",
  {
    recordId: text("record_id").primaryKey(),
    candidateId: text("candidate_id").notNull(),
    billNumber: text("bill_number"),
    congress: integer("congress"),
    billTitle: text("bill_title"),
    issueId: text("issue_id"),
    url: text("url"),
    /** Official CRS summary text (not AI-generated). */
    summary: text("summary"),
    /** AI-extracted notable provisions. */
    provisions: jsonb("provisions").$type<ProvisionItem[]>(),
    enrichedAt: text("enriched_at"),
  },
);

export type CandidateRecordEnrichment =
  typeof candidateRecordEnrichmentTable.$inferSelect;
export type InsertCandidateRecordEnrichment =
  typeof candidateRecordEnrichmentTable.$inferInsert;

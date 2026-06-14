import { pgTable, text, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";

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
    /** Congress's legislative subjects controlled vocabulary for this bill. */
    subjects: jsonb("subjects").$type<string[]>(),
    /** Where the bill got to: "introduced" | "advanced" | "passed" | "law" | "failed". */
    actionStatus: text("action_status"),
    /** AI-extracted notable provisions. */
    provisions: jsonb("provisions").$type<ProvisionItem[]>(),
    // --- v2 scoring classification (CRS-summary → stance) ---
    /** Issue id the AI assigned from the neutral CRS summary (constrained to taxonomy). */
    classifiedIssueId: text("classified_issue_id"),
    /** Stance direction on the issue axis: +1 toward "+" pole, -1 toward "-", 0 unclear. */
    direction: real("direction"),
    /** 0..1 AI confidence in the stance classification (after the refutation pass). */
    dirConfidence: real("dir_confidence"),
    /** One-sentence, summary-grounded rationale for the stance (shown as a receipt). */
    rationale: text("rationale"),
    /** True when the bill spans many subjects (omnibus) — handled with a penalty. */
    omnibus: boolean("omnibus"),
    enrichedAt: text("enriched_at"),
  },
);

export type CandidateRecordEnrichment =
  typeof candidateRecordEnrichmentTable.$inferSelect;
export type InsertCandidateRecordEnrichment =
  typeof candidateRecordEnrichmentTable.$inferInsert;

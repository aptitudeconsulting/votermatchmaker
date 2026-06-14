---
name: FEC donor signals
description: How FEC campaign-finance donor data is sourced, classified, and used as a second signal in Voter Compass.
---

FEC donor data is a SECOND, independent values signal alongside the legislation-derived positions.

**Hard rules (product-defining, do not violate):**
- Donor money NEVER moves a candidate position. Positions stay legislation-derived. Donor data only
  (a) nudges a position's match *confidence* up when donor lean agrees in sign and down when it
  contradicts, and (b) raises a neutral "donor tension" flag with a factual one-line note.
- Never coded as left/right or by party. The internal -2..+2 axis sign is the only thing compared.
- Federal candidates only (level senate/house, not sample/local).
- Degrade silently: no `FEC_API_KEY`, crosswalk miss, or no classifiable money → `null`, app unchanged.

**Why the classification is approximate:** the FEC has NO industry/sector field. Sectors are derived by
matching keyword substrings against contributor/employer names (`data/donors.ts`). Always surface this
to users with FEC attribution; it is a transparency signal, not ground truth.

**Data-sourcing pipeline (`lib/fec.ts` `buildDonorProfile`):**
- Crosswalk: `legislators-current.json` `id.fec[]` (bioguide→FEC ids). ~536/537 members have one.
- Resolve committees via `/candidate/{fecId}/committees/`; money flows TO designation **P** (principal)
  and **A** (authorized). Collect ALL committee names (incl J/D) to derive surnames for self-exclusion.
- Two contributor sources per committee+cycle:
  1. External PACs: `/schedules/schedule_a/?committee_id&two_year_transaction_period&is_individual=false&sort=-contribution_receipt_amount`
  2. Itemized individuals aggregated by employer: `/schedules/schedule_a/by_employer/?committee_id&cycle&sort=-total`
- **Itemized individuals are dominated by noise employers** (NOT EMPLOYED / RETIRED / SELF EMPLOYED /
  HOMEMADE etc.) — filter them. Exclude conduits (ActBlue/WinRed) and the member's own committees
  (self/joint/leadership keywords + surname match) from the contributor side, or you classify
  self-transfers as outside money.

**Confidence model:** per-issue donor confidence saturates ~$50k classified at 0.5 (intentionally
capped below legislative confidence so money never dominates the record). Tension fires only when
both signs are clear, opposite, and |donor lean| ≥ 0.3.

**Operational:** run via the "FEC Sync" workflow (`sync:fec`), not bash (bash bg jobs get reaped).
Resumable: candidates without donor rows are processed first; `FEC_SYNC_LIMIT` caps a batch.

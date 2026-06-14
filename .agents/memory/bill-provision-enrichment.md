---
name: Bill provision enrichment (CRS summaries + AI riders)
description: Durable decisions for the "what's in the bills they backed" provision-surfacing feature.
---

## CRS summaries lag bill introduction — enrich OLDEST tracked bills, not newest
Congress.gov `/bill/{c}/{type}/{num}/summaries` is empty for most just-introduced bills; CRS publishes summaries weeks-to-months later. The enrichment script picks each candidate's **oldest** tracked sponsored bills (records are capped to the 18 most recent), because newest-first selection had a ~0% summary hit-rate (current-congress bills). Typical hit-rate is roughly 1-in-4 even oldest-first.
**Why:** a smoke test storing newest-first produced 4 rows with 0 summaries.
**How to apply:** if yield is low, lower expectations or widen the per-candidate window — don't assume the fetcher is broken (it works fine on older/passed bills).

## Don't persist null-summary rows; resumability skips by row presence
`enrichProvisions` only inserts a row when a CRS summary exists. Bills with no summary yet are skipped (not stored), so a later run retries them once CRS publishes. Re-fetching a summary is cheap (one Congress.gov call, no AI); the expensive AI extraction only runs when a summary is present.
**How to apply:** never write a placeholder/null enrichment row "to mark processed" — it would freeze out bills that get summarized later.

## Enrichment is a separate table keyed by deterministic recordId
Stored in `candidate_record_enrichment` (not on `candidate_records`) keyed by the deterministic record id `${bioguideId}:${kind}:${type}${number}:${congress}`, so it survives the Congress-sync delete+insert of `candidate_records`.
**Consistency rule:** the match-detail route filters enrichment rows to the candidate's **current** `candidate_records.id` set before building `provisionFlags`, so the match page never flags a provision the candidate-detail page no longer shows (records get trimmed to 18).

## Internal axis must not leak as partisan in provision UI
Provision `direction` (+1/-1 on the internal -2..+2 axis) is used ONLY for voter-relative conflict detection ("Conflicts with your values"). It is never rendered as left/right or party-coded, consistent with the project-wide axis rule. Provisions never move candidate positions — they are an additive display/flag signal, like FEC donor data.

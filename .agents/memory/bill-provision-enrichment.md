---
name: Bill provision enrichment + v2 scoring engine
description: Durable decisions for enrichProvisions — both the v2 position-scoring pipeline and the "what's in the bills they backed" provision feature.
---

## v2 scoring: positions come ONLY from the LLM classifier, never from heuristics
Candidate `candidate_positions` are derived ONLY from the two-pass (propose→refute) CRS-summary classifier in `classify.ts`, via `classified_issue_id`/`direction`/`dir_confidence`. The policyArea+subject bucketing (`billToIssue`) is DISPLAY METADATA ONLY (the `issue_id` column) and must NEVER be used to set `classified_issue_id` — i.e. no `stance.issueId ?? bucketIssue` fallback.
**Why:** the v2 brief drops ALL party priors / title-keyword / lexicon heuristics; a code review caught a fallback that let heuristically-bucketed bills enter scored positions, re-introducing a prior.
**How to apply:** when the classifier returns a null issue, leave `classified_issue_id` null so the bill contributes zero scored evidence (it can still surface as a provision/receipt).

## Sufficiency + position use DIRECTIONAL records only
In `scoring.ts`, `position`, `denom`, and the `insufficient` flag are computed only over records with `direction !== 0`. Non-directional classified rows (`direction:0`) never move a position and never tip insufficient→sufficient; they only appear as receipts and in `sourceCount`.
**How to apply:** to audit/clean classified rows, ones with `direction=0 AND dir_confidence=0` are non-contributing (and were the old fallback signature) — safe to delete; they get reprocessed (resumable).

## candidate_positions must hold ONLY v2 rows; recompute runs at END of a run
`sync.ts` no longer writes positions — the enrich recompute (`delete+insert` per candidate) is the SOLE writer. It runs only AFTER the full classify pass (positions don't change mid-run), and ends every run with a global purge that deletes positions for any candidate with zero classified evidence (eliminates pre-v2 prior-based rows so the system never serves a mixed v1/v2 view).
**Why:** legacy prior-based positions otherwise persist for candidates a run didn't touch.

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

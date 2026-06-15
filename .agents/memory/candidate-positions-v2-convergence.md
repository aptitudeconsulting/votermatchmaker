---
name: candidate_positions v1→v2 convergence
description: Why the enrich pipeline must recompute ALL enriched candidates, not just this-run's, to purge stale prior-based positions.
---

# candidate_positions must converge to a v2-only projection

`candidate_positions` is meant to hold ONLY v2 (classifier-derived, non-partisan) rows.
The enrich job (`enrichProvisions.ts`) is the sole writer.

**Rule:** after enrichment, recompute positions for EVERY candidate that has any
classified enrichment (`selectDistinct candidateId where classifiedIssueId IS NOT NULL`),
then purge positions for everyone not in that scored set. Do NOT recompute only the
candidates "affected" (enriched) in the current run.

**Why:** the original code recomputed only `affected`, so a candidate enriched in a
PRIOR run that wasn't re-touched kept its stale v1 rows forever, and the purge only
deleted candidates with NO classified enrichment. Result observed: 84% of rows (1,496
of 1,787) were leftover v1 "their record and party lean strongly in this direction"
prior-based rows with impossible source_counts (121/222) — they both violated the
non-partisan principle AND were disconnected from the CRS detail the AI-summary route
reads, so summaries returned "Not enough bill detail" even on issues showing "24 bills".

**How to apply:** any time positions are derived from enrichment, make the recompute a
deterministic function of the FULL current classified-enrichment set so re-runs converge
and old rows can never linger. The v1 "party lean" generator code no longer exists, and
the base Congress `sync` does not write positions — so a single corrected enrich run is
enough to clean the whole table.

**Gotcha:** records cap at ~40 bills/candidate, so `PROVISIONS_PER_CANDIDATE=40` enriches
essentially everything; the default of 4 only samples a sliver and leaves most issues
without the CRS detail the AI summary needs. recompute failures are logged+skipped (not
fatal), so a candidate whose recompute repeatedly throws can retain stale rows.

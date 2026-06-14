---
name: Public LLM-backed endpoints — cost containment
description: Pattern for guarding a public, paid-LLM-on-cache-miss endpoint against cost fan-out
---

Any public endpoint that triggers a paid LLM call on a cache miss must be guarded against duplicate/concurrent generations, not just cached after the fact.

**Why:** A public endpoint (no auth) with cache-first + generate-on-miss still fans out into multiple paid LLM calls when several requests for the same uncached key arrive concurrently (each sees an empty cache before the first write lands).

**How to apply:**
- Cache the result keyed by the natural identity (e.g. candidateId+issueId) so steady-state is one call ever.
- Add an in-process single-flight map (`Map<key, Promise<result>>`, delete in `.finally`) so concurrent misses for the same key share one generation.
- Make the generator itself cheap on no-evidence: filter inputs and return null BEFORE calling the model, so empty/no-data keys never cost anything (negative caching then isn't required).
- Voter Compass example: `GET /candidates/{id}/positions/{issueId}/summary` in `routes/candidates.ts` + `lib/issueSummary.ts`.

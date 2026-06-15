# Memory Index

- [Generated image optimization](generated-image-optimization.md) — AI image gen emits huge PNGs; downscale+WebP via `magick` before shipping to web.
- [GitHub push auth](github-push-auth.md) — fine-grained PATs need Contents:Read+write; API reads can pass while git push 403s.
- [Google Civic ballot data](google-civic-ballot.md) — voterinfo often 400s even with a valid key; treat as no_election and degrade to the resource hub.
- [Clerk e2e testing](clerk-e2e-testing.md) — authenticated e2e/sign-up flows need testClerkAuth:true or Turnstile blocks them.
- [FEC donor signals](fec-donor-signals.md) — second independent signal; adjusts confidence + tension flags only, never moves positions; sectors derived from name keywords, not FEC codes.
- [House roll-call votes](house-rollcall-votes.md) — actual floor votes MOVE House positions; voteQuestion only in per-roll detail endpoint; must gate to HR/S/HJRES/SJRES or rule-adoption votes leak in.
- [Bill provision enrichment + v2 scoring](bill-provision-enrichment.md) — v2 positions come ONLY from the LLM CRS classifier (no heuristic/prior fallback); directional rows only move positions; enrich is sole positions writer + purges legacy; CRS lags so enrich OLDEST bills.
- [Post-merge codegen staleness](post-merge-codegen-staleness.md) — missing @workspace/api-client-react exports after a task merge mean stale generated client; run codegen + typecheck:libs, don't edit app code.
- [pnpm install reaping](pnpm-install-reaping.md) — backgrounded installs get reaped; run `pnpm install --offline --ignore-scripts` foreground so it finishes in one bash call.
- [candidate_positions v1→v2 convergence](candidate-positions-v2-convergence.md) — enrich must recompute ALL classified-enrichment candidates (not just this-run's) or stale party-prior v1 rows linger forever.
- [Orval conditional useQuery](orval-conditional-usequery.md) — generated React Query hooks called conditionally (enabled/skip) REQUIRE an explicit queryKey via the getXxxQueryKey helper, or TS errors.
- [API integration tests](api-integration-tests.md) — boot real `app` on `listen(0)` + `fetch`; MUST `pool.end()` in afterAll or vitest hangs; assert `items.length===min(total,limit)`, never couple to row counts.
- [Public LLM endpoint cost](public-llm-endpoint-cost.md) — paid-LLM-on-cache-miss public endpoints need single-flight + null-before-call, not just after-the-fact caching.
- [Re-election / term-end data](reelection-term-data.md) — Congress.gov lacks usable term-end/Senate-class; use congress-legislators dataset; COALESCE term_end on upsert so a fetch outage can't null it.
- [Orval codegen timing](codegen-orval-timing.md) — zod codegen step takes ~115s and harness kills it (-1), wiping api-zod/generated; run orval with a `timeout 115` guard, typecheck separately.

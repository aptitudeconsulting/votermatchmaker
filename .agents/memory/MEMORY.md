# Memory Index

- [Generated image optimization](generated-image-optimization.md) — AI image gen emits huge PNGs; downscale+WebP via `magick` before shipping to web.
- [GitHub push auth](github-push-auth.md) — fine-grained PATs need Contents:Read+write; API reads can pass while git push 403s.
- [Google Civic ballot data](google-civic-ballot.md) — voterinfo often 400s even with a valid key; treat as no_election and degrade to the resource hub.
- [Clerk e2e testing](clerk-e2e-testing.md) — authenticated e2e/sign-up flows need testClerkAuth:true or Turnstile blocks them.
- [FEC donor signals](fec-donor-signals.md) — second independent signal; adjusts confidence + tension flags only, never moves positions; sectors derived from name keywords, not FEC codes.
- [Bill provision enrichment](bill-provision-enrichment.md) — CRS summaries lag introduction so enrich OLDEST tracked bills; never persist null-summary rows; separate recordId-keyed table; direction never shown partisan.
- [Post-merge codegen staleness](post-merge-codegen-staleness.md) — missing @workspace/api-client-react exports after a task merge mean stale generated client; run codegen + typecheck:libs, don't edit app code.
- [pnpm install reaping](pnpm-install-reaping.md) — backgrounded installs get reaped; run `pnpm install --offline --ignore-scripts` foreground so it finishes in one bash call.

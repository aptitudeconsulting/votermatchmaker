---
name: Clerk e2e testing
description: How to run authenticated end-to-end tests against a Clerk-protected app.
---

Authenticated e2e tests (sign-up / sign-in flows, or testing pages behind requireAuth) must pass `testClerkAuth: true` to the testing subagent.

**Why:** without it, Clerk's sign-up renders a Cloudflare Turnstile challenge that an automated browser cannot solve, so the test fails before reaching the app. `testClerkAuth: true` bypasses Turnstile via Clerk testing credentials.

**How to apply:** any time a test needs an authenticated session in this app, set `testClerkAuth: true`. Omitting it on a public-only page is fine; omitting it on a protected flow will fail at the Turnstile step.

---
name: API integration tests (api-server)
description: How to write HTTP-level integration tests against the real Express app, and the data-coupling/teardown pitfalls.
---

# API integration tests (api-server)

The api-server has no supertest dependency. To test a route end-to-end, import the real
`app` (default export of `src/app.ts` — it is importable without side effects; Clerk middleware
is lazy and the pg pool reads `DATABASE_URL` from env), boot it on an ephemeral port with
`app.listen(0)`, read the assigned port from `server.address()`, and hit it with global `fetch`.

**Teardown is mandatory or vitest hangs.** In `afterAll`, `server.close()` AND `await pool.end()`
(pool is exported from `@workspace/db`). Without `pool.end()` the open pg pool keeps the process
alive and vitest warns/hangs. **Why:** this is an open-handle leak, not a test-logic bug.
**How to apply:** if integration coverage grows across multiple files, centralize the
server+pool lifecycle in a shared setup so one file's `pool.end()` doesn't kill another's queries.

**Don't couple assertions to dataset size.** Tests run against the live dev DB (row counts drift
as syncs run). Assert invariants, not magic numbers: the page-size invariant is
`items.length === Math.min(total, limit)` — never `items.length === total` (that silently assumes
the dataset is smaller than the limit and breaks once it isn't). Derive search fragments from a
returned row rather than hardcoding a person's name.

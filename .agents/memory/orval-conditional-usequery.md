---
name: Orval conditional useQuery
description: Generated React Query hooks called conditionally need an explicit queryKey.
---

When a generated Orval React Query hook (e.g. `useGetMyVoteFeed`, `useGetStatsStances`) is called conditionally — gated behind `enabled` / a "skip" condition, or with optional/undefined params — you must pass an explicit `queryKey` built from the generated `getXxxQueryKey(...)` helper inside the hook's `query` options. Without it, TypeScript errors and the cache key can collide or go stale.

**Why:** Orval's generated hooks infer the query key from required args; conditional/optional usage breaks that inference, so the key must be supplied manually to keep typing sound and caching correct.

**How to apply:** Import the `getXxxQueryKey` helper from the same generated module and set `query: { enabled, queryKey: getXxxQueryKey(args) }`. Applies to any of the generated hooks in `lib/api-client-react/src/generated/`.

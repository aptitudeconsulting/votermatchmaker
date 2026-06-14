---
name: post-merge codegen staleness
description: Why typecheck breaks on @workspace/api-client-react exports right after a task merge, and how to fix it.
---

After a task merge that extends the OpenAPI spec (`lib/api-spec/openapi.yaml`), the generated client (`@workspace/api-client-react`) and its built declarations can be stale, producing typecheck errors like "has no exported member 'X'" or "Property 'y' does not exist on type" in the web app — even though the spec already contains the new fields.

**Why:** The merge brings in the spec change but the generated output / compiled lib `.d.ts` may not be regenerated/rebuilt in this environment. The errors look like they came from your own edit but are unrelated.

**How to apply:** Don't chase the errors in app code. Regenerate, then rebuild lib declarations:
- `pnpm --filter @workspace/api-spec run codegen`
- `pnpm run typecheck:libs`
Then re-run the app typecheck. (Mirrors the pnpm-workspace rule: missing `@workspace/*` exports usually mean stale lib declarations, not bad imports.)

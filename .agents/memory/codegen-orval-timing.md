---
name: Orval codegen timing
description: Why `pnpm --filter @workspace/api-spec run codegen` appears to hang/fail and how to run it reliably.
---

The `codegen` script runs `orval` then `pnpm -w run typecheck:libs`. Orval's **zod target** generation alone takes ~110-115s after it prints "zod Cleaning output folder" — the client-react target finishes in seconds.

**Why this bites:** the bash harness kills long commands and returns exit `-1` with no output. Because orval `clean: true` deletes the output dir *before* regenerating, a killed run leaves `lib/api-zod/src/generated/` (and `types/`) empty/broken — looking like codegen wiped the files.

**How to apply:**
- Don't assume codegen failed just because the tool returned `-1`. Re-run and verify generated files exist.
- Run orval directly with a guard so it exits cleanly: `cd lib/api-spec && timeout 115 node_modules/.bin/orval --config ./orval.config.ts` (needs ~115s; 90s is not enough for the zod step).
- Run `pnpm -w run typecheck:libs` separately afterward.
- Leaf-artifact `tsc --noEmit` cold builds are also slow (~100s+); run the hoisted binary `../../node_modules/.bin/tsc -p tsconfig.json --noEmit` with a `timeout` guard, and a second run is fast (incremental .tsbuildinfo cache).

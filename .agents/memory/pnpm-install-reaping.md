---
name: pnpm install must finish in one tool call
description: Why backgrounded pnpm installs fail here and how to make an install complete within a single bash call.
---

# pnpm install must finish within one bash tool call

Backgrounded shell processes (even `setsid`/`nohup`/`disown`, log redirected to a
file) are **reaped the moment the bash tool call returns** in this environment —
the detached `pnpm install` dies mid-link and its log stays empty. The replit.md
gotchas note the same thing for the long `sync` script.

A full `pnpm add` / `pnpm install` across this whole workspace routinely exceeds
the ~120s bash wrapper timeout (network + build scripts for esbuild/msw/@swc/
unrs-resolver), so it gets killed at the link phase: the package lands in
`node_modules/.pnpm/` but no bin symlink is created and the per-package
`node_modules` isn't populated.

**How to apply:** add the dependency to the package's `package.json` manually,
then run `pnpm install --offline --ignore-scripts` in the **foreground** (not
backgrounded). With packages already in the store this finishes in ~60s, well
under the timeout, and creates the bin links. Skipping scripts is safe when the
prebuilt native deps are already present (you're not changing them). It may take
two passes — the first warms/links most packages, the second completes. Verify
with `ls <pkg>/node_modules/.bin/<bin>` before trying to run the tool.

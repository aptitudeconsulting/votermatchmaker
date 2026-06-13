# Voter Compass

A non-partisan tool that matches voters to candidates by comparing the voter's ranked values against candidate positions derived from real Congress.gov legislative records. Tagline: "Find candidates who vote your values."

It also provides a ZIP-based non-partisan Ballot feature: an always-on curated hub of official/non-partisan voting resources, plus live ballot measures via the Google Civic Information API when `GOOGLE_CIVIC_API_KEY` is set.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/common-ground run dev` — run the web app (Vite)
- `pnpm --filter @workspace/api-server run seed` — seed issues, questions, and sample local candidates
- `pnpm --filter @workspace/api-server run sync` — pull current members of Congress + their legislative records from Congress.gov (long-running; run as a workflow, not via bash, or it gets reaped)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `CONGRESS_API_KEY`, Clerk keys (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`); optional `GOOGLE_CIVIC_API_KEY` for live ballot measures
- Public mirror of all project files: https://github.com/aptitudeconsulting/votermatchmaker (push with a token that has Contents:write — see memory)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Drizzle ORM (PostgreSQL), Zod (`zod/v4`) validation
- Web: React + Vite, wouter routing, TanStack Query, shadcn/ui, Tailwind
- Auth: Clerk (Replit-managed), cookie-based on the web client (no Bearer tokens)
- API codegen: Orval (React Query hooks + Zod schemas) from the OpenAPI spec

## Where things live

- DB schema: `lib/db/src/schema.ts` (tables: candidates, candidate_positions, candidate_records, issues, questions, voters, voter_answers, voter_stances, sync_meta)
- API contract (source of truth): `lib/api-spec/` → generated hooks/types in `lib/api-client-react/src/generated/`
- API routes: `artifacts/api-server/src/routes/` (candidates, matches, profile, issues, questions, stats)
- Issue + question seed data: `artifacts/api-server/src/data/political.ts`
- Congress.gov sync: `artifacts/api-server/src/scripts/sync.ts`
- Web pages: `artifacts/common-ground/src/pages/`; shared civic UI in `src/components/civic.tsx`; helpers in `src/lib/issue-meta.tsx` and `src/lib/invalidate.ts`

## Architecture decisions

- Issue positions use an internal numeric axis (-2..+2) that is never shown as left/right or party-coded — it exists only so voter and candidate stances can be compared as coordinates.
- Candidate positions are *derived* from sponsored/cosponsored legislation (policyArea → issue mapping), not from campaign statements; each position carries a confidence based on evidence volume.
- Candidate id format is `congress-{bioguideId}` for real members; sample local races use seeded ids.
- Generated mutation hooks do NOT invalidate queries — `useInvalidateVoterData()` (`src/lib/invalidate.ts`) invalidates all `/api/me/*` queries after profile-changing mutations.

## Product

- Voters sign up, enter a ZIP, and complete progressive onboarding (location → values questions → prioritize top issues) that builds a ranked issues graph.
- The tool scores and grades each candidate match with an explainable per-issue breakdown (agreement, position scale, confidence).
- Scope: US Congress (synced live) plus a few sample local races. Candidate browsing is public; matches/profile require sign-in.

## Gotchas

- The `sync` script makes ~1000+ sequential Congress.gov calls and runs for several minutes — run it as a workflow. Background bash processes get reaped when the tool call returns, even with `setsid`/`nohup`.
- The api-server `dev` script builds once with no watch — restart the workflow after server code changes.
- Do not change the OpenAPI `info.title`; it controls generated filenames.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

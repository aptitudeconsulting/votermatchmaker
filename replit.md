# Voter Compass

A non-partisan tool that matches voters to candidates by comparing the voter's ranked values against candidate positions derived from real Congress.gov legislative records. Tagline: "Find candidates who vote your values."

It also provides a ZIP-based non-partisan Ballot feature: an always-on curated hub of official/non-partisan voting resources, plus live ballot measures via the Google Civic Information API when `GOOGLE_CIVIC_API_KEY` is set.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/common-ground run dev` — run the web app (Vite)
- `pnpm --filter @workspace/api-server run seed` — seed issues, questions, and sample local candidates
- `pnpm --filter @workspace/api-server run sync` — pull current members of Congress + their legislative records from Congress.gov (long-running; run as a workflow, not via bash, or it gets reaped). Production variant: `sync:prod` (runs bundled `dist/scripts/sync.mjs`, no `tsx`/devDeps needed) — use as a Scheduled Deployment run command to populate the prod DB.
- `pnpm --filter @workspace/api-server run sync:votes` — pull ACTUAL House roll-call votes and derive vote-based issue positions for each House member (run as the "House Votes Sync" workflow; long-running ~several minutes; resumable-ish via `VOTES_LIMIT`, tunable via `VOTES_CONGRESS`/`VOTES_SESSIONS`; degrades silently with no `CONGRESS_API_KEY`). Production variant: `sync:votes:prod` (runs bundled `dist/scripts/syncVotes.mjs`).
- `pnpm --filter @workspace/api-server run sync:senate-votes` — pull ACTUAL Senate roll-call votes (the Senate has NO Congress.gov votes API, so this reads official senate.gov LIS XML with a Voteview/UCLA CSV fallback) and derive vote-based issue positions for each senator (run as the "Senate Votes Sync" workflow; long-running; tunable via `SENATE_VOTES_CONGRESS`/`SENATE_VOTES_SESSIONS`/`SENATE_VOTES_LIMIT`, force the fallback with `SENATE_VOTES_SOURCE=voteview`; degrades silently with no `CONGRESS_API_KEY`). Production variant: `sync:senate-votes:prod` (runs bundled `dist/scripts/syncSenateVotes.mjs`).
- `pnpm --filter @workspace/api-server run sync:fec` — pull FEC campaign-finance donor signals for federal candidates (run as the "FEC Sync" workflow; supports `FEC_SYNC_LIMIT` for resumable batches; degrades silently with no `FEC_API_KEY`)
- `pnpm --filter @workspace/api-server run enrich` — fetch official CRS bill summaries + AI-extract notable/unrelated provisions for each candidate's bills (run as the "Provisions Sync" workflow; resumable via `PROVISIONS_LIMIT`/`PROVISIONS_PER_CANDIDATE`; degrades silently with no OpenAI integration or `CONGRESS_API_KEY`). Production variant: `enrich:prod` (runs bundled `dist/scripts/enrichProvisions.mjs`) — `enrich` is the sole writer of v2 issue positions, so a Scheduled Deployment running it is what populates prod candidate positions.
- `pnpm --filter @workspace/api-server run sync:fec:prod` — production variant of the FEC sync that runs the bundled `dist/scripts/syncFec.mjs` (no `tsx`/devDeps needed). Use this as the run command for a recurring Scheduled Deployment so donor data stays fresh through the cycle.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `CONGRESS_API_KEY`, Clerk keys (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`); optional `GOOGLE_CIVIC_API_KEY` for live ballot measures, optional `FEC_API_KEY` for donor signals, optional OpenAI AI integration (`AI_INTEGRATIONS_OPENAI_*`) for bill-provision enrichment
- Public mirror of all project files: https://github.com/aptitudeconsulting/votermatchmaker (push with a token that has Contents:write — see memory)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Drizzle ORM (PostgreSQL), Zod (`zod/v4`) validation
- Web: React + Vite, wouter routing, TanStack Query, shadcn/ui, Tailwind
- Auth: Clerk (Replit-managed), cookie-based on the web client (no Bearer tokens)
- API codegen: Orval (React Query hooks + Zod schemas) from the OpenAPI spec

## Where things live

- DB schema: `lib/db/src/schema/*.ts` (tables: candidates, candidate_positions, candidate_records, candidate_record_enrichment, candidate_issue_summaries, candidate_donor_categories, candidate_donor_signals, candidate_vote_signals, issues, questions, voters, voter_answers, voter_stances, voter_ballot_picks, sync_meta)
- House roll-call votes: pure aggregation in `artifacts/api-server/src/lib/votes.ts` (`isSubstantivePassageVote`, `isSubstantiveLegislationType`, `aggregateVoteSignals`); Congress fetch helpers `fetchHouseVoteList`/`fetchHouseVoteDetail`/`fetchHouseVoteMembers` in `src/lib/congress.ts`; sync in `src/scripts/syncVotes.ts`; stored in `candidate_vote_signals` (position, voteCount, agreeShare, example votes jsonb); blended into positions at read time by `applyVoteEvidence` in `src/lib/matching.ts`
- Senate roll-call votes: the Senate has NO Congress.gov votes API, so `artifacts/api-server/src/lib/senate.ts` reads the official senate.gov LIS XML (`fetchSenateVoteList`/`fetchSenateVoteMembers`, member ids resolved via a LIS→bioguide crosswalk from congress-legislators) with a Voteview/UCLA CSV fallback (`fetchVoteviewSenate`, icpsr→bioguide from Voteview's own members file). Issue + direction still come from each bill's CRS summary via the shared `classifyBillStance` (classify.ts); sync in `src/scripts/syncSenateVotes.ts` reuses `aggregateVoteSignals` and writes the same `candidate_vote_signals` table (scoped to senators so it never clobbers the House sync).
- Bill provisions: AI extraction in `artifacts/api-server/src/lib/provisions.ts` (grounded by `ISSUE_POLES` in `political.ts`); CRS summary fetch `fetchBillSummary` in `src/lib/congress.ts`; enrichment in `src/scripts/enrichProvisions.ts`; stored in `candidate_record_enrichment` keyed by deterministic recordId so it survives the Congress-sync delete+insert
- FEC donor signals: classification dict in `artifacts/api-server/src/data/donors.ts`; FEC client + crosswalk + `buildDonorProfile` in `src/lib/fec.ts`; sync in `src/scripts/syncFec.ts`
- AI issue-record summaries: `artifacts/api-server/src/lib/issueSummary.ts` (`generateIssueRecordSummary`, OpenAI gpt-5.4, strictly non-partisan prompt grounded ONLY in the bills' CRS summaries/rationales; returns null with no usable evidence or no OpenAI integration). Served by `GET /candidates/{id}/positions/{issueId}/summary` in `routes/candidates.ts` — cache-first read of `candidate_issue_summaries` (PK candidateId+issueId), generate+store on miss, with an in-process single-flight map to coalesce concurrent misses (public endpoint → avoid paid-call fan-out). Web: lazy `RecordSummary` expander in `pages/candidate-detail.tsx` (`useGetCandidateIssueSummary`, fetch on click, with AI disclosure).
- API contract (source of truth): `lib/api-spec/` → generated hooks/types in `lib/api-client-react/src/generated/`
- API routes: `artifacts/api-server/src/routes/` (candidates, matches, profile, issues, questions, stats, ballot)
- My Ballot + civic feed (auth-gated, in `routes/ballot.ts`): `voter_ballot_picks` table (`lib/db/src/schema/voterBallotPicks.ts`); CRUD at `/me/ballot/picks` (GET/POST) + `/me/ballot/picks/{candidateId}` (DELETE). `GET /me/vote-feed` builds an in-app activity feed of recent floor votes from the SAVED candidates only (flattens `candidate_vote_signals.examples`, sorts by date desc, caps at 40 — no email infra). Web: `components/save-to-ballot.tsx` (save button), saved-picks + print view + `CivicActionBand` (static official register/check/polling links) in `pages/ballot.tsx`, notification `VoteFeedBell` in `components/layout.tsx` (localStorage `vc:vote-feed:last-seen` unread dot).
- Anonymized "how you compare": `GET /stats/stances` (public, in `routes/stats.ts`) returns per-issue mean of `voter_stances.position` + voterCount, WITHHELD below `MIN_AGGREGATE_VOTERS` (5) so no individual stance leaks. Web: `HowYouCompare` panel on `pages/profile.tsx` (reuses `IssueCompass`, never partisan).
- Side-by-side compare: public `pages/compare.tsx` (pick 2–3 candidates, match score/grade + per-issue matrix); shared `lib/use-debounce.ts`; "Compare" nav entry + MatchCard affordance.
- Shareable results: `components/share-results.tsx` (Web Share API + clipboard fallback, screenshot-friendly top-3 card) atop the matches list.
- Issue + question seed data: `artifacts/api-server/src/data/political.ts`
- Congress.gov sync: `artifacts/api-server/src/scripts/sync.ts`
- Web pages: `artifacts/common-ground/src/pages/` (incl. public `methodology.tsx` — data sources + how positions/votes/donor/AI signals work, linked from the footer); shared civic UI in `src/components/civic.tsx`; helpers in `src/lib/issue-meta.tsx` and `src/lib/invalidate.ts`
- `GET /candidates` returns `{ items, total }` (not a bare array) so the browse page can show "Showing X of N" + "Load more"; the page debounces search (300ms) and syncs `level`/`q` to the URL via wouter `useSearchParams` (matches page syncs `level` too). Vote-derived copy is chamber-neutral ("floor votes", not "House floor votes") since senators share the same code path. Contract is guarded by `artifacts/api-server/src/routes/candidates.integration.test.ts` (boots the real Express `app` on an ephemeral port, hits `/api/candidates` via `fetch`, asserts `{items,total}` shape + `level`/`q` filters reflected in both items and total); run with `pnpm --filter @workspace/api-server run test`.

## Architecture decisions

- Issue positions use an internal numeric axis (-2..+2) that is never shown as left/right or party-coded — it exists only so voter and candidate stances can be compared as coordinates.
- Candidate positions are *derived* from sponsored/cosponsored legislation (policyArea → issue mapping), not from campaign statements; each position carries a confidence based on evidence volume.
- Both chambers get a THIRD evidence layer: ACTUAL roll-call votes. Unlike donor signals (which only adjust confidence), votes MOVE positions — `applyVoteEvidence` blends the vote-derived position into the sponsorship base at read time (weight scales with vote volume, capped ~0.7) and raises confidence. House votes come from Congress.gov; Senate votes come from senate.gov LIS XML (Voteview fallback) since the Senate has no Congress.gov votes API. Only substantive passage votes on real legislation (HR/S/HJRES/SJRES) count — procedural, cloture, motion-to-proceed, and rule-adoption votes are excluded.
- Candidate id format is `congress-{bioguideId}` for real members; sample local races use seeded ids.
- Generated mutation hooks do NOT invalidate queries — `useInvalidateVoterData()` (`src/lib/invalidate.ts`) invalidates all `/api/me/*` queries after profile-changing mutations.
- Bill provisions ("what's in the bills they backed") are a THIRD, additive signal derived from each bill's official CRS summary via AI. They never move positions; they surface specific notable/unrelated (rider/earmark-like) provisions on the candidate detail page (with source links + AI disclosure) and flag provisions whose internal-axis direction opposes the signed-in voter's stance on the match page. The internal direction is only used for voter-relative conflict detection and is never shown as left/right.
- FEC donor data is a SECOND, independent signal: it never moves a position (positions stay legislation-derived). Donor money only (a) raises/lowers a position's match *confidence* when it agrees/contradicts in sign, and (b) raises a neutral "donor tension" flag. Sectors are *derived* from contributor/employer name keywords (the FEC has no industry codes), so they are approximate and surfaced with FEC attribution. Federal candidates only; everything degrades silently with no FEC key / crosswalk miss / no classifiable money.
- The community "how you compare" aggregate (`/stats/stances`) is privacy-preserving by construction: it is the ONLY place voter stances are exposed, always as a per-issue mean over the internal axis, and any issue with fewer than `MIN_AGGREGATE_VOTERS` (5) contributors is withheld so a single voter's position can't be reverse-engineered. It is framed purely descriptively ("everyone's average"), never as normal-vs-not or left/right.

## Product

- Voters sign up, enter a ZIP, and complete progressive onboarding (location → values questions → prioritize top issues) that builds a ranked issues graph.
- The tool scores and grades each candidate match with an explainable per-issue breakdown (agreement, position scale, confidence).
- Scope: US Congress (synced live) plus a few sample local races. Candidate browsing is public; matches/profile require sign-in.

## Gotchas

- The `sync` script makes ~1000+ sequential Congress.gov calls and runs for several minutes — run it as a workflow. Background bash processes get reaped when the tool call returns, even with `setsid`/`nohup`.
- The api-server `dev` script builds once with no watch — restart the workflow after server code changes.
- House votes sync has two Congress.gov gotchas: (1) `voteQuestion` is NOT in the `/house-vote/{c}/{s}` list endpoint — it lives only in the per-roll DETAIL endpoint `/house-vote/{c}/{s}/{roll}` (`houseRollCallVote`), so the sync fetches detail per roll call before filtering substantive votes; (2) you MUST gate on legislation type (HR/S/HJRES/SJRES) — rule-adoption votes are simple resolutions whose question "On Agreeing to the Resolution" passes the substantive-question filter, and a rule's title quotes the bills it queues, so it would be mis-mapped to an issue and counted as a real policy vote. Members endpoint key is `houseRollCallVoteMemberVotes.results` with `bioguideID` (capital ID) + `voteCast`.
- FEC `sync:fec` resolves a member's authorized committees (designation P/A), then classifies top committee receipts + itemized individuals by employer. Itemized individuals are dominated by noise employers (NOT EMPLOYED/RETIRED/SELF) — they must be filtered. Conduits (ActBlue/WinRed) and the member's own committees are excluded from the contributor side. Run it as the "FEC Sync" workflow (long-running; ~1-3s/candidate).
- Donor freshness: the FEC sync writes `last_fec_sync` / `fec_sync_status` / `fec_sync_progress` to `sync_meta`. `GET /api/stats/overview` surfaces `fecLastSyncedAt` + `fecSyncStatus`, and the web home page shows a "Donor funding data updated …" line (hidden until the first FEC sync runs).
- Keeping donor data fresh on a schedule: set up a Replit **Scheduled Deployment** (Deployments pane → Scheduled — the deployment *type* can only be chosen in the UI, not in code). Build command `pnpm --filter @workspace/api-server run build`, run command `pnpm --filter @workspace/api-server run sync:fec:prod`. Add `FEC_API_KEY` (and optionally `FEC_SYNC_LIMIT` for resumable batches) to the deployment's secrets. Suggested cadence: weekly off-cycle, daily near an election. The job is resumable and rate-limit friendly, so a small `FEC_SYNC_LIMIT` per run still makes steady progress.
- Do not change the OpenAPI `info.title`; it controls generated filenames.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

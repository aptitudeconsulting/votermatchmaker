---
name: House roll-call vote signals
description: How actual House floor votes are ingested and blended into candidate positions, plus the two Congress.gov API quirks that bite.
---

House members' issue positions blend ACTUAL roll-call votes (not just sponsorship). Votes are a third evidence layer that MOVES positions (unlike donor signals, which only nudge confidence). Blended at read time in the routes from a separate `candidate_vote_signals` table, so the votes sync stays decoupled from the Congress sync (mirrors the donor loader pattern). House only — Senate stays sponsorship-derived.

## Two Congress.gov house-vote API quirks (the expensive lessons)

1. **`voteQuestion` is NOT in the list endpoint.** `/house-vote/{congress}/{session}` returns only legislationType/Number, result, rollCallNumber, startDate. The `voteQuestion` (needed to tell substantive passage from procedural motions) lives ONLY in the per-roll DETAIL endpoint `/house-vote/{c}/{s}/{roll}` under key `houseRollCallVote`. So the sync must fetch detail per roll call before the substantive-question filter — the first build filtered everything out ("0 interpretable roll calls") because it read a non-existent list field.
   - Members endpoint: key `houseRollCallVoteMemberVotes.results`, fields `bioguideID` (capital ID) + `voteCast`.

2. **Filter to legislation that can become law (HR/S/HJRES/SJRES); exclude HRES/HCONRES/SRES/SCONRES.** Rule-adoption votes are simple resolutions whose question is "On Agreeing to the Resolution" — which PASSES the substantive-question regex. Worse, a rule's title quotes the bills it queues for floor debate, so `billIssueAndDirection` mis-maps it to an issue and counts a procedural rule vote as a real policy vote. The legislation-type gate (`isSubstantiveLegislationType` in `votes.ts`) is what keeps procedural noise out.
   **Why:** spotted Aderholt's "climate" examples containing `HRES1174 "Providing for consideration of the bill..."`. **How to apply:** any future expansion of vote ingestion must keep both the question filter AND the legislation-type gate; HJRES/SJRES (e.g. CRA disapprovals) are legitimate substantive law and stay in.

## Operational

The sync fetches detail per roll call → it's ~600 detail calls + member rosters for 119th, several minutes. Run it as the "House Votes Sync" workflow (bash gets reaped). Writes `last_votes_sync` / `votes_sync_status` / `votes_sync_progress` to `sync_meta`. Resumable-ish via `VOTES_LIMIT`; tunable via `VOTES_CONGRESS` / `VOTES_SESSIONS`.

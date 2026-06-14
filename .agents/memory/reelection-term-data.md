---
name: Re-election / term-end data
description: Where "up for re-election" data comes from and the non-obvious pitfalls deriving it.
---

# Re-election timing for members of Congress

Congress.gov does NOT expose a usable term-end or Senate-class signal: its
member `terms` are split per-Congress (2-year chunks) and OMIT `endYear` for the
in-progress term. So you cannot tell when a seat is next contested from
Congress.gov alone.

**Authoritative source:** the public `@unitedstates/congress-legislators`
dataset — `https://unitedstates.github.io/congress-legislators/legislators-current.json`.
Each legislator's LAST `terms[]` entry has the real election-term `start`/`end`
dates (Senate entries span the full 6 years, not per-Congress) plus Senate
`class`. Map by `id.bioguide`.

**Election-year math** (general elections are November of even years):
- A term ending ~January of an odd year started a new Congress → it was
  contested the prior November → `electionYear = endYear - 1`.
- A mid-year special vacancy end (e.g. an appointed senator's `2026-11-03`) is
  contested that same year → `electionYear = endYear`.
- Implemented as: `electionYear = endMonth === January ? endYear-1 : endYear`,
  then `upForReelection = electionYear === nextGeneralElectionYear(now)`.

**Why the destructive-null pitfall matters:** the dataset fetch degrades to an
empty map on failure. A naive full-sync upsert then writes `term_end = null` for
every member, silently wiping the whole re-election signal on one transient
outage.
**How to apply:** on conflict, COALESCE to the existing value
(`termEnd ?? sql\`${candidatesTable.termEnd}\``) so a miss/empty-map preserves
what's already stored. A separate fast `sync:terms` script repopulates term_end
without re-running the multi-minute full Congress sync.

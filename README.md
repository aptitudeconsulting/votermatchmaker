# Voter Compass

**Find candidates who vote your values.**

Voter Compass is a non-partisan civic tool that matches voters to candidates by comparing a voter's ranked values against candidate positions *derived from real Congress.gov legislative records* — not campaign slogans or attack ads.

It also includes a ZIP-based **Ballot** feature: an always-on hub of official, non-partisan voting resources, plus live ballot measures via the Google Civic Information API when configured.

> ⚖️ **Non-partisan by design.** Issue positions use an internal numeric axis that is *never* shown as left/right or coded by party. It exists only so a voter's stance and a candidate's derived stance can be compared as coordinates.

---

## How it works

1. **You build a values profile.** Sign up, enter your ZIP, and complete a short progressive onboarding (location → values questions → prioritize your top issues). This produces a ranked "issues graph."
2. **Candidate positions are derived from legislation.** For each member of Congress, positions are inferred from the bills they sponsor and cosponsor (Congress.gov `policyArea` → issue mapping, plus a transparent directional model). Each position carries a *confidence* based on how much evidence backs it.
3. **You get an explainable match.** Every candidate is scored and graded with a per-issue breakdown: agreement, position scale, and confidence — so you can see *why* a match landed where it did.
4. **A second, independent signal: donor money.** Optional FEC campaign-finance data never moves a candidate's position. It only (a) raises or lowers a position's match *confidence* when donor money agrees or contradicts the legislative record, and (b) raises a neutral "donor tension" flag. Donor sectors are approximate (derived from contributor/employer name keywords) and always surfaced with FEC attribution.

**Scope:** US Congress (synced live from Congress.gov) plus a few sample local races. Candidate browsing is public; personalized matches and your profile require sign-in.

---

## Tech stack

- **Monorepo:** pnpm workspaces, Node.js 24, TypeScript 5.9
- **API:** Express 5 + Drizzle ORM (PostgreSQL), Zod validation
- **Web:** React + Vite, wouter routing, TanStack Query, shadcn/ui, Tailwind
- **Auth:** Clerk (cookie-based on the web client)
- **API contract:** OpenAPI is the source of truth; React Query hooks + Zod schemas are generated with Orval

## Repository layout

```
artifacts/
  common-ground/    Web app (React + Vite) — "Voter Compass"
  api-server/       Express + Drizzle API server, Congress.gov & FEC sync scripts
  mockup-sandbox/   Component preview sandbox (development only)
lib/
  db/               Drizzle schema + client
  api-spec/         OpenAPI spec (source of truth for the API contract)
  api-client-react/ Generated React Query hooks + Zod schemas
```

## Getting started

### Prerequisites

- Node.js 24 and [pnpm](https://pnpm.io/)
- A PostgreSQL database (`DATABASE_URL`)
- A [Congress.gov API key](https://api.congress.gov/) (`CONGRESS_API_KEY`)
- Clerk keys: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- *Optional:* `GOOGLE_CIVIC_API_KEY` (live ballot measures), `FEC_API_KEY` (donor signals)

### Install & set up

```bash
pnpm install
pnpm --filter @workspace/db run push        # push the schema to your database
pnpm --filter @workspace/api-server run seed # seed issues, questions, sample local candidates
```

### Run

```bash
pnpm --filter @workspace/api-server run dev      # API server
pnpm --filter @workspace/common-ground run dev   # web app (Vite)
```

### Sync real data (long-running)

```bash
pnpm --filter @workspace/api-server run sync      # members of Congress + legislative records
pnpm --filter @workspace/api-server run sync:fec  # FEC donor signals (needs FEC_API_KEY)
```

> The `sync` script makes ~1000+ sequential Congress.gov calls and runs for several minutes — run it as a long-lived process, not a quick shell command.

### Useful commands

```bash
pnpm run typecheck                                  # full typecheck across all packages
pnpm --filter @workspace/api-spec run codegen       # regenerate API hooks + Zod schemas from OpenAPI
```

## How candidate positions are derived (methodology)

- Each issue has an internal axis from `-2` to `+2`. The orientation is arbitrary and never labeled left/right.
- A candidate's position on an issue blends a transparent per-party directional prior with a signal read from the *language of the bills they back* (titles are scanned against an issue lexicon). Bills are mapped to issues via the Congress.gov `policyArea` controlled vocabulary, with keyword overrides for issues that lack a dedicated policy area (e.g. guns, abortion).
- Confidence grows with the volume of relevant legislative evidence.
- This is a heuristic model, disclosed to users as methodology — it is meant to be transparent and explainable, not a definitive scorecard.

## Contributing

This is a public mirror of an actively developed project. Issues and discussion are welcome. Please keep all contributions consistent with the project's strict non-partisan framing.

## License

See repository settings for license details.

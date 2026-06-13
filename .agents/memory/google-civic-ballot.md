---
name: Google Civic ballot data
description: Behavior of the Google Civic voterInfoQuery endpoint and how the Ballot feature degrades.
---

The Google Civic Information `voterinfo` endpoint frequently returns HTTP 400 even with a valid API key — e.g. when there is no address-level election for the queried address, or the address is too coarse (bare ZIP like 20001).

**Why:** voterinfo requires a resolvable address tied to an active election; many valid keys + valid ZIPs simply have no election data, surfaced as 400/404 rather than an empty 200.

**How to apply:** treat 400/404 (and missing key) as "no live data" — map to a `no_election` / `no_key` / `error` reason and fall back to the always-on curated non-partisan resource hub. Never surface the raw upstream error to the user. The `elections` endpoint returning 200 is the right way to validate the key itself.

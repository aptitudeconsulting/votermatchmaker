import type { Candidate } from "@workspace/db";

export function toCandidate(row: Candidate) {
  return {
    id: row.id,
    name: row.name,
    party: row.party ?? null,
    level: row.level as "senate" | "house" | "local",
    state: row.state ?? null,
    stateName: row.stateName ?? null,
    district: row.district ?? null,
    currentRole: row.currentRole,
    incumbent: row.incumbent,
    photoUrl: row.photoUrl ?? null,
    bioguideId: row.bioguideId ?? null,
    dataSource: row.dataSource as "congress.gov" | "sample",
    isSample: row.isSample,
  };
}

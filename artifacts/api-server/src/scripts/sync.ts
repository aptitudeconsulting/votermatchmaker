import { eq, sql } from "drizzle-orm";
import {
  db,
  pool,
  candidatesTable,
  candidateRecordsTable,
  syncMetaTable,
} from "@workspace/db";
import {
  fetchAllCurrentMembers,
  fetchMemberBills,
  fetchTermEndByBioguide,
  deriveRecords,
  parseMember,
  formatName,
  type RawMember,
  type RawBill,
} from "../lib/congress";
import { STATE_CODE_BY_NAME } from "../lib/geo";
import { logger } from "../lib/logger";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function stateCodeFor(member: RawMember): {
  state: string | null;
  stateName: string | null;
} {
  const raw = (member.state ?? "").trim();
  if (!raw) return { state: null, stateName: null };
  if (raw.length === 2) return { state: raw.toUpperCase(), stateName: raw };
  const code = STATE_CODE_BY_NAME[raw.toLowerCase()];
  return { state: code ?? null, stateName: raw };
}

async function upsertCandidate(
  member: RawMember,
  termEnd: string | null,
): Promise<boolean> {
  const { level, district } = parseMember(member);
  if (!level) return false;
  const { state, stateName } = stateCodeFor(member);
  const id = `congress-${member.bioguideId}`;
  const role =
    level === "senate"
      ? `U.S. Senator${stateName ? ` for ${stateName}` : ""}`
      : `U.S. Representative${stateName ? ` for ${stateName}${district ? `, District ${district}` : ""}` : ""}`;

  await db
    .insert(candidatesTable)
    .values({
      id,
      name: formatName(member.name),
      party: member.partyName ?? null,
      level,
      state,
      stateName,
      district,
      currentRole: role,
      incumbent: true,
      photoUrl: member.depiction?.imageUrl ?? null,
      bioguideId: member.bioguideId,
      termEnd,
      dataSource: "congress.gov",
      isSample: false,
    })
    .onConflictDoUpdate({
      target: candidatesTable.id,
      set: {
        name: formatName(member.name),
        party: member.partyName ?? null,
        level,
        state,
        stateName,
        district,
        currentRole: role,
        photoUrl: member.depiction?.imageUrl ?? null,
        // Preserve an existing term_end when this run has no value for the
        // member (e.g. the external dataset fetch failed / had a miss) so a
        // transient outage can't wipe the re-election signal.
        termEnd: termEnd ?? sql`${candidatesTable.termEnd}`,
      },
    });
  return true;
}

async function syncRecords(member: RawMember, apiKey: string) {
  const id = `congress-${member.bioguideId}`;
  let sponsored: RawBill[] = [];
  let cosponsored: RawBill[] = [];
  try {
    sponsored = await fetchMemberBills(member.bioguideId, "sponsored", apiKey);
    cosponsored = await fetchMemberBills(
      member.bioguideId,
      "cosponsored",
      apiKey,
    );
  } catch (err) {
    logger.warn({ err, bioguideId: member.bioguideId }, "bill fetch failed");
  }

  // v2 scoring: sync only stores the raw legislative RECORD. Positions are
  // derived later by the enrichment/classification pass from each bill's neutral
  // CRS summary — there are no party priors here.
  const records = deriveRecords(member, sponsored, cosponsored);

  await db
    .delete(candidateRecordsTable)
    .where(eq(candidateRecordsTable.candidateId, id));
  if (records.length > 0) {
    await db.insert(candidateRecordsTable).values(
      records.map((r) => ({
        id: r.id,
        candidateId: id,
        title: r.title,
        kind: r.kind,
        issueId: r.issueId,
        date: r.date,
        billNumber: r.billNumber,
        congress: r.congress,
        url: r.url,
        summary: null,
      })),
    );
  }
}

async function setMeta(key: string, value: string) {
  await db
    .insert(syncMetaTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMetaTable.key, set: { value } });
}

async function main() {
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) {
    logger.error("CONGRESS_API_KEY is not set; cannot sync Congress data.");
    process.exit(1);
  }

  await setMeta("sync_status", "running");
  logger.info("Fetching current members of Congress…");
  const members = await fetchAllCurrentMembers(apiKey);
  logger.info(`Fetched ${members.length} members`);

  const termEndByBioguide = await fetchTermEndByBioguide();
  if (termEndByBioguide.size === 0) {
    logger.warn(
      "No term-end dates fetched; preserving existing term_end values (re-election signal unchanged this run).",
    );
  } else {
    logger.info(`Loaded term-end dates for ${termEndByBioguide.size} members`);
  }

  let saved = 0;
  const valid: RawMember[] = [];
  for (const m of members) {
    const termEnd = termEndByBioguide.get(m.bioguideId) ?? null;
    if (await upsertCandidate(m, termEnd)) {
      valid.push(m);
      saved++;
    }
  }
  logger.info(`Upserted ${saved} candidates; storing legislative records…`);

  let processed = 0;
  for (const m of valid) {
    await syncRecords(m, apiKey);
    processed++;
    if (processed % 25 === 0) {
      logger.info(`Stored records for ${processed}/${valid.length}`);
      await setMeta("sync_progress", `${processed}/${valid.length}`);
    }
    await sleep(120);
  }

  await setMeta("last_full_sync", new Date().toISOString());
  await setMeta("sync_status", "complete");
  await setMeta("sync_progress", `${processed}/${valid.length}`);
  logger.info(`Sync complete: ${processed} members processed.`);
  await pool.end();
}

main().catch((err) => {
  logger.error(err, "Sync failed");
  process.exit(1);
});

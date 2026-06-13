import { eq } from "drizzle-orm";
import {
  db,
  pool,
  candidatesTable,
  candidatePositionsTable,
  candidateRecordsTable,
  syncMetaTable,
} from "@workspace/db";
import {
  fetchAllCurrentMembers,
  fetchMemberBills,
  derivePositions,
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

async function upsertCandidate(member: RawMember): Promise<boolean> {
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
      },
    });
  return true;
}

async function syncPositions(member: RawMember, apiKey: string) {
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

  const { positions, records } = derivePositions(member, sponsored, cosponsored);

  await db
    .delete(candidatePositionsTable)
    .where(eq(candidatePositionsTable.candidateId, id));
  await db.insert(candidatePositionsTable).values(
    positions.map((p) => ({
      candidateId: id,
      issueId: p.issueId,
      position: p.position,
      confidence: p.confidence,
      summary: p.summary,
      sourceCount: p.sourceCount,
    })),
  );

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

  let saved = 0;
  const valid: RawMember[] = [];
  for (const m of members) {
    if (await upsertCandidate(m)) {
      valid.push(m);
      saved++;
    }
  }
  logger.info(`Upserted ${saved} candidates; deriving positions…`);

  let processed = 0;
  for (const m of valid) {
    await syncPositions(m, apiKey);
    processed++;
    if (processed % 25 === 0) {
      logger.info(`Derived positions for ${processed}/${valid.length}`);
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

import { eq, and, inArray, isNotNull } from "drizzle-orm";
import {
  db,
  pool,
  candidatesTable,
  candidateDonorCategoriesTable,
  candidateDonorSignalsTable,
  syncMetaTable,
} from "@workspace/db";
import { loadFecCrosswalk, buildDonorProfile, type DonorProfile } from "../lib/fec";
import { logger } from "../lib/logger";

// Pulls FEC campaign-finance data for federal candidates and writes derived donor
// categories + per-issue signals. Designed to run as the "FEC Sync" workflow.
//
// Degrades silently: no FEC_API_KEY → exits 0 without touching data. Resumable via
// FEC_SYNC_LIMIT (process N candidates per run, oldest-synced first).

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function setMeta(key: string, value: string) {
  await db
    .insert(syncMetaTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMetaTable.key, set: { value } });
}

async function writeProfile(candidateId: string, profile: DonorProfile) {
  await db
    .delete(candidateDonorCategoriesTable)
    .where(eq(candidateDonorCategoriesTable.candidateId, candidateId));
  if (profile.categories.length > 0) {
    await db.insert(candidateDonorCategoriesTable).values(
      profile.categories.map((c) => ({
        candidateId,
        sector: c.sector,
        label: c.label,
        issueId: c.issueId,
        direction: c.direction,
        total: c.total,
        contributorCount: c.contributorCount,
      })),
    );
  }

  await db
    .delete(candidateDonorSignalsTable)
    .where(eq(candidateDonorSignalsTable.candidateId, candidateId));
  if (profile.signals.length > 0) {
    await db.insert(candidateDonorSignalsTable).values(
      profile.signals.map((s) => ({
        candidateId,
        issueId: s.issueId,
        lean: s.lean,
        confidence: s.confidence,
        classifiedTotal: s.classifiedTotal,
        topSectorLabel: s.topSectorLabel,
      })),
    );
  }
}

async function main() {
  if (!process.env.FEC_API_KEY || !process.env.FEC_API_KEY.trim()) {
    logger.warn("FEC_API_KEY is not set; skipping FEC sync (feature degrades silently).");
    await pool.end();
    return;
  }

  const limit = process.env.FEC_SYNC_LIMIT
    ? Math.max(1, parseInt(process.env.FEC_SYNC_LIMIT, 10) || 0)
    : undefined;

  await setMeta("fec_sync_status", "running");
  logger.info("Loading bioguide→FEC crosswalk…");
  const crosswalk = await loadFecCrosswalk();
  if (crosswalk.size === 0) {
    logger.warn("FEC crosswalk empty; aborting FEC sync.");
    await setMeta("fec_sync_status", "error");
    await pool.end();
    return;
  }
  logger.info(`Crosswalk has ${crosswalk.size} legislators.`);

  // Federal, non-sample candidates with a bioguide id.
  const candidates = await db
    .select()
    .from(candidatesTable)
    .where(
      and(
        eq(candidatesTable.isSample, false),
        inArray(candidatesTable.level, ["senate", "house"]),
        isNotNull(candidatesTable.bioguideId),
      ),
    );

  // Resumable: those without donor rows yet come first.
  const existing = await db
    .select({ candidateId: candidateDonorCategoriesTable.candidateId })
    .from(candidateDonorCategoriesTable);
  const hasData = new Set(existing.map((e) => e.candidateId));
  const ordered = [...candidates].sort((a, b) => {
    const av = hasData.has(a.id) ? 1 : 0;
    const bv = hasData.has(b.id) ? 1 : 0;
    return av - bv;
  });
  const batch = limit ? ordered.slice(0, limit) : ordered;

  logger.info(`Processing ${batch.length} of ${candidates.length} federal candidates…`);

  let processed = 0;
  let withData = 0;
  for (const c of batch) {
    if (!c.bioguideId) continue;
    try {
      const profile = await buildDonorProfile(c.bioguideId, crosswalk);
      if (profile) {
        await writeProfile(c.id, profile);
        withData++;
      }
    } catch (err) {
      logger.warn({ err, candidateId: c.id }, "FEC profile build failed; skipping");
    }
    processed++;
    if (processed % 10 === 0) {
      logger.info(`FEC: ${processed}/${batch.length} (${withData} with data)`);
      await setMeta("fec_sync_progress", `${processed}/${batch.length}`);
    }
    await sleep(400);
  }

  await setMeta("last_fec_sync", new Date().toISOString());
  await setMeta("fec_sync_status", "complete");
  await setMeta("fec_sync_progress", `${processed}/${batch.length}`);
  logger.info(`FEC sync complete: ${processed} processed, ${withData} with classified donor data.`);
  await pool.end();
}

main().catch((err) => {
  logger.error(err, "FEC sync failed");
  process.exit(1);
});

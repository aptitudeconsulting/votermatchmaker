import { sql } from "drizzle-orm";
import { db, pool, candidatesTable } from "@workspace/db";
import { fetchTermEndByBioguide } from "../lib/congress";
import { logger } from "../lib/logger";

/**
 * Fast, standalone refresh of each member's current term-end date from the
 * public congress-legislators dataset. Lets us populate / update the
 * `term_end` column (which drives the "up for re-election" signal) without
 * re-running the long full Congress sync. Safe to re-run anytime.
 */
async function main() {
  const termEndByBioguide = await fetchTermEndByBioguide();
  if (termEndByBioguide.size === 0) {
    logger.error("No term-end data fetched; aborting without changes.");
    process.exit(1);
  }
  logger.info(`Fetched term-end dates for ${termEndByBioguide.size} members`);

  let updated = 0;
  for (const [bioguide, termEnd] of termEndByBioguide) {
    const res = await db
      .update(candidatesTable)
      .set({ termEnd })
      .where(sql`${candidatesTable.bioguideId} = ${bioguide}`);
    updated += res.rowCount ?? 0;
  }

  logger.info(`Updated term_end for ${updated} candidates.`);
  await pool.end();
}

main().catch((err) => {
  logger.error(err, "Term sync failed");
  process.exit(1);
});

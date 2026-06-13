import { eq } from "drizzle-orm";
import {
  db,
  pool,
  issuesTable,
  questionsTable,
  candidatesTable,
  candidatePositionsTable,
  candidateRecordsTable,
} from "@workspace/db";
import { ISSUES, QUESTIONS } from "../data/political";
import { SAMPLE_CANDIDATES } from "../data/sampleCandidates";
import { logger } from "../lib/logger";

async function seedIssues() {
  for (const issue of ISSUES) {
    await db
      .insert(issuesTable)
      .values(issue)
      .onConflictDoUpdate({
        target: issuesTable.id,
        set: {
          name: issue.name,
          shortLabel: issue.shortLabel,
          description: issue.description,
          icon: issue.icon ?? null,
          displayOrder: issue.displayOrder ?? 0,
        },
      });
  }
  logger.info(`Seeded ${ISSUES.length} issues`);
}

async function seedQuestions() {
  for (const q of QUESTIONS) {
    await db
      .insert(questionsTable)
      .values(q)
      .onConflictDoUpdate({
        target: questionsTable.id,
        set: {
          issueId: q.issueId,
          prompt: q.prompt,
          helpText: q.helpText ?? null,
          kind: q.kind ?? "scale",
          displayOrder: q.displayOrder ?? 0,
          options: q.options,
        },
      });
  }
  logger.info(`Seeded ${QUESTIONS.length} questions`);
}

async function seedSampleCandidates() {
  for (const c of SAMPLE_CANDIDATES) {
    await db
      .insert(candidatesTable)
      .values({
        id: c.id,
        name: c.name,
        party: c.party,
        level: c.level,
        state: c.state,
        stateName: c.stateName,
        district: c.district,
        currentRole: c.currentRole,
        incumbent: c.incumbent,
        photoUrl: null,
        bioguideId: null,
        dataSource: "sample",
        isSample: true,
      })
      .onConflictDoUpdate({
        target: candidatesTable.id,
        set: {
          name: c.name,
          currentRole: c.currentRole,
          state: c.state,
          stateName: c.stateName,
          district: c.district,
          dataSource: "sample",
          isSample: true,
        },
      });

    await db
      .delete(candidatePositionsTable)
      .where(eq(candidatePositionsTable.candidateId, c.id));
    await db.insert(candidatePositionsTable).values(
      c.positions.map((p) => ({
        candidateId: c.id,
        issueId: p.issueId,
        position: p.position,
        confidence: p.confidence,
        summary: p.summary,
        sourceCount: 1,
      })),
    );

    await db
      .delete(candidateRecordsTable)
      .where(eq(candidateRecordsTable.candidateId, c.id));
    await db.insert(candidateRecordsTable).values(
      c.records.map((r, idx) => ({
        id: `${c.id}:statement:${idx}`,
        candidateId: c.id,
        title: r.title,
        kind: "statement",
        issueId: r.issueId,
        date: null,
        billNumber: null,
        congress: null,
        url: null,
        summary: r.summary,
      })),
    );
  }
  logger.info(`Seeded ${SAMPLE_CANDIDATES.length} sample candidates`);
}

async function main() {
  logger.info("Seeding reference data…");
  await seedIssues();
  await seedQuestions();
  await seedSampleCandidates();
  logger.info("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});

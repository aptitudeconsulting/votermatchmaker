import { notInArray } from "drizzle-orm";
import {
  db,
  pool,
  issuesTable,
  questionsTable,
  voterAnswersTable,
} from "@workspace/db";
import { ISSUES, QUESTIONS } from "../data/political";
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
  const keepIds = QUESTIONS.map((q) => q.id);
  await db.delete(voterAnswersTable).where(notInArray(voterAnswersTable.questionId, keepIds));
  await db.delete(questionsTable).where(notInArray(questionsTable.id, keepIds));
  logger.info(`Seeded ${QUESTIONS.length} questions`);
}

async function main() {
  logger.info("Seeding reference data…");
  await seedIssues();
  await seedQuestions();
  logger.info("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});

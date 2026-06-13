import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, issuesTable, questionsTable } from "@workspace/db";
import { ListIssuesResponse, ListQuestionsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/issues", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(issuesTable)
    .orderBy(asc(issuesTable.displayOrder));
  const data = ListIssuesResponse.parse(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      shortLabel: r.shortLabel,
      description: r.description,
      icon: r.icon ?? null,
    })),
  );
  res.json(data);
});

router.get("/questions", async (req, res): Promise<void> => {
  const issueId = typeof req.query.issueId === "string" ? req.query.issueId : null;

  const issues = await db.select().from(issuesTable);
  const issueName = new Map(issues.map((i) => [i.id, i.name]));

  const rows = issueId
    ? await db
        .select()
        .from(questionsTable)
        .where(eq(questionsTable.issueId, issueId))
        .orderBy(asc(questionsTable.displayOrder))
    : await db
        .select()
        .from(questionsTable)
        .orderBy(asc(questionsTable.displayOrder));

  const data = ListQuestionsResponse.parse(
    rows.map((r) => ({
      id: r.id,
      issueId: r.issueId,
      issueName: issueName.get(r.issueId) ?? r.issueId,
      prompt: r.prompt,
      helpText: r.helpText ?? null,
      kind: r.kind as "scale" | "choice",
      order: r.displayOrder,
      options: r.options.map((o) => ({
        value: o.value,
        label: o.label,
        description: o.description ?? null,
      })),
    })),
  );
  res.json(data);
});

export default router;

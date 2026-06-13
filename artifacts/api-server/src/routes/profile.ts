import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  votersTable,
  voterStancesTable,
  voterAnswersTable,
  type Voter,
} from "@workspace/db";
import {
  GetMyProfileResponse,
  UpdateMyLocationBody,
  UpdateMyLocationResponse,
  SubmitAnswersBody,
  SubmitAnswersResponse,
  UpdateMyStanceBody,
  UpdateMyStanceResponse,
  ResetMyProfileResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { zipToState } from "../lib/geo";
import { ISSUES, QUESTIONS } from "../data/political";

const router: IRouter = Router();
router.use(requireAuth);

const ISSUE_NAME = new Map(ISSUES.map((i) => [i.id, i.name]));
const QUESTION_ISSUE = new Map(QUESTIONS.map((q) => [q.id, q.issueId]));

async function getOrCreateVoter(userId: string): Promise<Voter> {
  const [existing] = await db
    .select()
    .from(votersTable)
    .where(eq(votersTable.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(votersTable)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [row] = await db
    .select()
    .from(votersTable)
    .where(eq(votersTable.userId, userId));
  return row;
}

async function buildProfile(userId: string) {
  const voter = await getOrCreateVoter(userId);
  const stances = await db
    .select()
    .from(voterStancesTable)
    .where(eq(voterStancesTable.userId, userId));
  const answers = await db
    .select()
    .from(voterAnswersTable)
    .where(eq(voterAnswersTable.userId, userId));

  return {
    hasProfile: true,
    completedOnboarding: voter.completedOnboarding,
    location: {
      zip: voter.zip ?? null,
      address: voter.address ?? null,
      state: voter.state ?? null,
      stateName: voter.stateName ?? null,
      district: voter.district ?? null,
    },
    stances: stances
      .sort((a, b) => b.importance - a.importance)
      .map((s) => ({
        issueId: s.issueId,
        issueName: ISSUE_NAME.get(s.issueId) ?? s.issueId,
        position: s.position,
        importance: s.importance,
        source: s.source as "onboarding" | "manual",
      })),
    answeredCount: answers.length,
    totalQuestions: QUESTIONS.length,
    updatedAt: voter.updatedAt?.toISOString() ?? null,
  };
}

router.get("/me/profile", async (req: AuthedRequest, res): Promise<void> => {
  const data = GetMyProfileResponse.parse(await buildProfile(req.userId!));
  res.json(data);
});

router.put("/me/location", async (req: AuthedRequest, res): Promise<void> => {
  const body = UpdateMyLocationBody.parse(req.body);
  const geo = zipToState(body.zip);
  await getOrCreateVoter(req.userId!);
  await db
    .update(votersTable)
    .set({
      zip: body.zip ?? null,
      address: body.address ?? null,
      state: geo?.state ?? null,
      stateName: geo?.stateName ?? null,
      district: null,
    })
    .where(eq(votersTable.userId, req.userId!));
  const data = UpdateMyLocationResponse.parse(await buildProfile(req.userId!));
  res.json(data);
});

router.post("/me/answers", async (req: AuthedRequest, res): Promise<void> => {
  const body = SubmitAnswersBody.parse(req.body);
  const userId = req.userId!;
  await getOrCreateVoter(userId);

  for (const answer of body.answers) {
    const issueId = QUESTION_ISSUE.get(answer.questionId);
    if (!issueId) continue;
    await db
      .insert(voterAnswersTable)
      .values({ userId, questionId: answer.questionId, issueId, value: answer.value })
      .onConflictDoUpdate({
        target: [voterAnswersTable.userId, voterAnswersTable.questionId],
        set: { value: answer.value },
      });
  }

  // Recompute stances as the mean of each issue's answers, preserving any
  // manually-set importance the voter already chose.
  const allAnswers = await db
    .select()
    .from(voterAnswersTable)
    .where(eq(voterAnswersTable.userId, userId));
  const existingStances = await db
    .select()
    .from(voterStancesTable)
    .where(eq(voterStancesTable.userId, userId));
  const importanceByIssue = new Map(
    existingStances.map((s) => [s.issueId, s.importance]),
  );

  const byIssue = new Map<string, number[]>();
  for (const a of allAnswers) {
    const arr = byIssue.get(a.issueId) ?? [];
    arr.push(a.value);
    byIssue.set(a.issueId, arr);
  }

  for (const [issueId, values] of byIssue) {
    const position = values.reduce((s, v) => s + v, 0) / values.length;
    await db
      .insert(voterStancesTable)
      .values({
        userId,
        issueId,
        position,
        importance: importanceByIssue.get(issueId) ?? 2,
        source: "onboarding",
      })
      .onConflictDoUpdate({
        target: [voterStancesTable.userId, voterStancesTable.issueId],
        set: { position },
      });
  }

  if (body.completeOnboarding) {
    await db
      .update(votersTable)
      .set({ completedOnboarding: true })
      .where(eq(votersTable.userId, userId));
  }

  const data = SubmitAnswersResponse.parse(await buildProfile(userId));
  res.json(data);
});

router.patch(
  "/me/stances/:issueId",
  async (req: AuthedRequest, res): Promise<void> => {
    const body = UpdateMyStanceBody.parse(req.body);
    const userId = req.userId!;
    const issueId = String(req.params.issueId);
    if (!ISSUE_NAME.has(issueId)) {
      res.status(400).json({ error: "Unknown issue" });
      return;
    }
    await getOrCreateVoter(userId);

    const [existing] = await db
      .select()
      .from(voterStancesTable)
      .where(
        and(
          eq(voterStancesTable.userId, userId),
          eq(voterStancesTable.issueId, issueId),
        ),
      );

    const position = body.position ?? existing?.position ?? 0;
    const importance = body.importance ?? existing?.importance ?? 2;

    await db
      .insert(voterStancesTable)
      .values({ userId, issueId, position, importance, source: "manual" })
      .onConflictDoUpdate({
        target: [voterStancesTable.userId, voterStancesTable.issueId],
        set: { position, importance, source: "manual" },
      });

    const data = UpdateMyStanceResponse.parse({
      issueId,
      issueName: ISSUE_NAME.get(issueId)!,
      position,
      importance,
      source: "manual",
    });
    res.json(data);
  },
);

router.post("/me/reset", async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  await db.delete(voterAnswersTable).where(eq(voterAnswersTable.userId, userId));
  await db.delete(voterStancesTable).where(eq(voterStancesTable.userId, userId));
  await db
    .update(votersTable)
    .set({ completedOnboarding: false })
    .where(eq(votersTable.userId, userId));
  const data = ResetMyProfileResponse.parse(await buildProfile(userId));
  res.json(data);
});

export default router;

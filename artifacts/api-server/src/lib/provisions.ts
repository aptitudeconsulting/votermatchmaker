import { openai } from "@workspace/integrations-openai-ai-server";
import type { ProvisionItem } from "@workspace/db";
import { ISSUES, ISSUE_POLES } from "../data/political";

const VALID_ISSUE_IDS = new Set(ISSUES.map((i) => i.id));

const ISSUE_GUIDE = ISSUES.map((i) => {
  const poles = ISSUE_POLES[i.id];
  return `- ${i.id} (${i.name}): +1 means ${poles.plus}; -1 means ${poles.minus}`;
}).join("\n");

const SYSTEM_PROMPT = `You are a careful, strictly non-partisan legislative analyst. You read the official summary of a U.S. bill and identify notable, concrete provisions a curious voter might want to know about — especially provisions whose subject appears unrelated to the bill's main purpose (riders, earmarks, or attached measures).

Rules:
- Use ONLY information present in the provided summary. Never speculate, infer hidden intent, or add outside knowledge.
- Be factual and neutral. Do not use partisan, loaded, or judgmental language, and never say a provision is good or bad.
- A "provision" is a concrete thing the bill does: an appropriation/earmark, a new program, a rule change, a mandate, or a directive. Describe it plainly in one sentence.
- Map each provision to at most one policy issue id from the provided list, or null if none clearly fits.
- "direction" expresses which pole of that issue's axis the provision moves toward, using the provided pole definitions: 1 toward the "+1" description, -1 toward the "-1" description, 0 if genuinely neutral or unclear. Use 0 when issueId is null.
- "unrelated" is true ONLY when the provision's subject is clearly different from what the bill's title and main summary are about.
- Return the 0 to 5 most notable provisions. Prefer provisions that are specific (named dollar amounts, named programs, named beneficiaries) and provisions that look unrelated to the bill's main subject. If the summary is too thin to identify concrete provisions, return an empty list.`;

function clampDirection(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

function parseProvisions(raw: string): ProvisionItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const list =
    parsed && typeof parsed === "object" && "provisions" in parsed
      ? (parsed as { provisions?: unknown }).provisions
      : parsed;
  if (!Array.isArray(list)) return [];

  const out: ProvisionItem[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const text = typeof e.text === "string" ? e.text.trim() : "";
    if (text.length < 8) continue;
    const issueIdRaw = typeof e.issueId === "string" ? e.issueId : null;
    const issueId =
      issueIdRaw && VALID_ISSUE_IDS.has(issueIdRaw) ? issueIdRaw : null;
    const direction = issueId ? clampDirection(e.direction) : 0;
    const unrelated = e.unrelated === true;
    out.push({ text, issueId, direction, unrelated });
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Uses the OpenAI integration to extract notable/unrelated provisions from a
 * bill's official CRS summary, grounded on our internal issue axis. Returns an
 * empty list when the summary is too thin. Throws on API failure so the caller's
 * batch retry/backoff can handle it.
 */
export async function extractProvisions(
  billTitle: string,
  summary: string,
): Promise<ProvisionItem[]> {
  const trimmed = (summary ?? "").trim();
  if (trimmed.length < 60) return [];

  const userPrompt = `Bill title: ${billTitle}

Official summary:
${trimmed.slice(0, 6000)}

Policy issues and their axis poles:
${ISSUE_GUIDE}

Respond with JSON of exactly this shape:
{"provisions":[{"text":"string","issueId":"one of the issue ids above or null","direction":-1,"unrelated":false}]}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return parseProvisions(raw);
}

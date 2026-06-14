import { openai } from "@workspace/integrations-openai-ai-server";

/** One classified bill feeding the issue-record summary. */
export interface SummaryBill {
  billNumber: string | null;
  title: string;
  /** "sponsored" | "cosponsored". */
  kind: string;
  /** Official CRS summary text (may be null/empty). */
  summary: string | null;
  /** One-line stance rationale grounded in the CRS summary. */
  rationale: string | null;
  /** "introduced" | "advanced" | "passed" | "law" | "failed" | null. */
  actionStatus: string | null;
}

const SYSTEM_PROMPT = `You are a careful, strictly non-partisan legislative analyst. You are given the bills a single member of Congress sponsored or cosponsored that relate to ONE policy issue, each with its official Congressional Research Service (CRS) summary. Write a short plain-language summary of what these bills, taken together, show about the member's legislative activity on this issue.

Rules:
- Use ONLY information present in the provided bills and summaries. Never speculate, infer hidden intent, or add outside knowledge.
- Be factual and neutral. Do not use partisan, loaded, or judgmental language, and never say the record is good or bad, strong or weak.
- Do not predict how they would vote or describe them as left/right, progressive/conservative, or pro/anti anything.
- Focus on concrete themes: what the bills would actually do (programs, funding, rules, mandates). Group related bills when it helps.
- Write 2 to 4 sentences in a single paragraph. No headings, no lists, no preamble like "These bills".`;

/**
 * Generate a short, neutral plain-language summary of a candidate's legislative
 * record on one issue from the issue's classified bills. Returns null when there
 * is no usable evidence. Throws on API failure so the caller can decide how to
 * surface it (we treat failures as "temporarily unavailable").
 */
export async function generateIssueRecordSummary(
  issueName: string,
  bills: SummaryBill[],
): Promise<string | null> {
  const usable = bills.filter(
    (b) => (b.summary && b.summary.trim().length > 40) || (b.rationale && b.rationale.trim().length > 8),
  );
  if (usable.length === 0) return null;

  const billBlocks = usable
    .slice(0, 12)
    .map((b, i) => {
      const head = [b.billNumber, b.title].filter(Boolean).join(" — ");
      const meta = [b.kind, b.actionStatus].filter(Boolean).join(", ");
      const body = (b.summary && b.summary.trim()) || b.rationale || "";
      return `Bill ${i + 1}: ${head}${meta ? ` (${meta})` : ""}\n${body.slice(0, 1200)}`;
    })
    .join("\n\n");

  const userPrompt = `Policy issue: ${issueName}

Bills this member sponsored or cosponsored on this issue:
${billBlocks}

Write the 2-4 sentence neutral summary now.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim() ?? "";
  return text.length > 0 ? text : null;
}

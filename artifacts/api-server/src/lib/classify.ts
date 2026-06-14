import { openai } from "@workspace/integrations-openai-ai-server";
import { ISSUES, ISSUE_POLES } from "../data/political";

const VALID_ISSUE_IDS = new Set(ISSUES.map((i) => i.id));

const ISSUE_GUIDE = ISSUES.map((i) => {
  const poles = ISSUE_POLES[i.id];
  return `- ${i.id} (${i.name}): +1 means ${poles.plus}; -1 means ${poles.minus}`;
}).join("\n");

/**
 * The stance a single bill demonstrates, derived ONLY from its neutral CRS
 * summary (never the title or any party assumption). `direction` is on the
 * issue's internal axis: +1 toward the "+" pole, -1 toward the "-" pole, 0 when
 * the summary does not clearly cut either way. `rationale` is one sentence that
 * quotes/paraphrases the summary so the call is auditable. `omnibus` is true when
 * the bill spans many unrelated subjects (handled with a confidence penalty).
 */
export interface BillStance {
  issueId: string | null;
  direction: number;
  confidence: number;
  rationale: string;
  omnibus: boolean;
}

const NEUTRAL: BillStance = {
  issueId: null,
  direction: 0,
  confidence: 0,
  rationale: "",
  omnibus: false,
};

const CLASSIFY_SYSTEM = `You are a careful, strictly non-partisan legislative analyst. You read the OFFICIAL nonpartisan summary of a U.S. bill and decide which single policy value it most demonstrates, and which way it cuts on that value's axis.

Rules:
- Use ONLY information in the provided summary. Never use the title's spin, outside knowledge, or party assumptions.
- Pick exactly one issue id from the provided list whose axis the bill most clearly moves, or null if none fits.
- "direction": +1 if the bill moves toward that issue's "+1" description, -1 toward the "-1" description, 0 if the summary is genuinely ambiguous or only procedural. Use the provided pole definitions literally.
- "confidence": 0..1, how clearly the summary supports the direction. Be conservative; thin or purely administrative summaries deserve low confidence.
- "rationale": ONE factual sentence, grounded in the summary, naming the concrete thing the bill does. No loaded or judgmental language; never say a bill is good or bad.
- "omnibus": true ONLY when the summary describes many unrelated major subjects (an omnibus/appropriations package), which makes a single direction unreliable.`;

const REFUTE_SYSTEM = `You are a skeptical fact-checker auditing a colleague's classification of a U.S. bill. You are given the bill's official summary and a proposed { issueId, direction, rationale }. Your job is to try to REFUTE it.

Rules:
- Use ONLY the summary. Decide whether the summary genuinely supports BOTH the chosen issue AND the chosen direction (per the pole definitions).
- "supported": true only if the summary clearly backs the classification; false if it is a stretch, ambiguous, purely procedural, or about a different issue.
- "correctedDirection": if the issue is right but the direction is backwards, give the correct -1/+1; otherwise repeat the proposed direction.
- "confidence": your 0..1 confidence in the FINAL (possibly corrected) classification after this scrutiny.`;

function clampDir(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

function clamp01(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Parses the first-pass classification JSON. Exported for tests. */
export function parseStance(raw: string): BillStance {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...NEUTRAL };
  }
  if (!parsed || typeof parsed !== "object") return { ...NEUTRAL };
  const e = parsed as Record<string, unknown>;
  const issueIdRaw = typeof e.issueId === "string" ? e.issueId : null;
  const issueId =
    issueIdRaw && VALID_ISSUE_IDS.has(issueIdRaw) ? issueIdRaw : null;
  const direction = issueId ? clampDir(e.direction) : 0;
  const confidence = issueId ? clamp01(e.confidence) : 0;
  const rationale = typeof e.rationale === "string" ? e.rationale.trim() : "";
  const omnibus = e.omnibus === true;
  return { issueId, direction, confidence, rationale, omnibus };
}

interface RefuteResult {
  supported: boolean;
  correctedDirection: number;
  confidence: number;
}

/** Parses the refutation-pass JSON. Exported for tests. */
export function parseRefutation(raw: string, proposedDir: number): RefuteResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { supported: false, correctedDirection: proposedDir, confidence: 0 };
  }
  if (!parsed || typeof parsed !== "object") {
    return { supported: false, correctedDirection: proposedDir, confidence: 0 };
  }
  const e = parsed as Record<string, unknown>;
  const supported = e.supported === true;
  const correctedDirection =
    e.correctedDirection === undefined
      ? proposedDir
      : clampDir(e.correctedDirection) || proposedDir;
  const confidence = clamp01(e.confidence);
  return { supported, correctedDirection, confidence };
}

export interface ClassifyInput {
  title: string;
  summary: string;
  subjects?: string[];
}

/**
 * Two-pass, summary-grounded stance classification. Pass 1 proposes a
 * {issue, direction, confidence, rationale}; pass 2 tries to refute it. Only
 * classifications that survive scrutiny keep their confidence — refuted ones are
 * collapsed to a neutral, non-directional result so they cannot move a position.
 * Throws on API failure so the caller's batch retry/backoff handles it.
 */
export async function classifyBillStance(
  input: ClassifyInput,
): Promise<BillStance> {
  const summary = (input.summary ?? "").trim();
  if (summary.length < 60) return { ...NEUTRAL };

  const subjectLine =
    input.subjects && input.subjects.length
      ? `\nCongress's legislative subjects for this bill: ${input.subjects.slice(0, 25).join("; ")}`
      : "";

  const userPrompt = `Bill title (for reference only — do NOT classify from the title): ${input.title}
${subjectLine}

Official nonpartisan summary:
${summary.slice(0, 6000)}

Policy issues and their axis poles:
${ISSUE_GUIDE}

Respond with JSON of exactly this shape:
{"issueId":"one of the issue ids above or null","direction":-1,"confidence":0.0,"rationale":"one sentence grounded in the summary","omnibus":false}`;

  const first = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CLASSIFY_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });
  const stance = parseStance(first.choices[0]?.message?.content ?? "{}");
  if (!stance.issueId || stance.direction === 0) {
    return stance.issueId ? { ...stance, confidence: Math.min(stance.confidence, 0.3) } : stance;
  }

  // Refutation pass — try to knock it down.
  const poles = ISSUE_POLES[stance.issueId];
  const refutePrompt = `Official summary:
${summary.slice(0, 6000)}

Proposed classification:
- issue: ${stance.issueId}
- direction: ${stance.direction} (+1 means ${poles.plus}; -1 means ${poles.minus})
- rationale: ${stance.rationale}

Respond with JSON of exactly this shape:
{"supported":true,"correctedDirection":${stance.direction},"confidence":0.0}`;

  const second = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 512,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: REFUTE_SYSTEM },
      { role: "user", content: refutePrompt },
    ],
  });
  const refute = parseRefutation(
    second.choices[0]?.message?.content ?? "{}",
    stance.direction,
  );

  if (!refute.supported) {
    // Did not survive scrutiny — keep it auditable but non-directional.
    return {
      issueId: stance.issueId,
      direction: 0,
      confidence: Math.min(stance.confidence, refute.confidence, 0.25),
      rationale: stance.rationale,
      omnibus: stance.omnibus,
    };
  }

  return {
    issueId: stance.issueId,
    direction: refute.correctedDirection || stance.direction,
    // Final confidence is the more conservative of the two passes.
    confidence: Math.min(stance.confidence, refute.confidence || stance.confidence),
    rationale: stance.rationale,
    omnibus: stance.omnibus,
  };
}

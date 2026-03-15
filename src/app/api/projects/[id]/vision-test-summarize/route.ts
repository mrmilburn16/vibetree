import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireProjectAuth } from "@/lib/apiProjectAuth";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 800;

const SUMMARIZE_PROMPT = `You are a QA summarizer. Below are step-by-step observations from an automated app test. Summarize them into this exact format (use the section headers and structure). Output only the summary, no other text.

Format:
[Claude Vision] Features tested: [feature] (working/FAILED), [feature] (working/FAILED)
Features NOT tested: [list any visible features that were never reached]
Issues: [detailed description of each issue including what was tried, what was expected, what actually happened]
Recommendation: [one sentence on what needs fixing or if app is ready]

Infer which features were tested and whether they worked from the step observations and issues. List any feature that was visible but not tested under "Features NOT tested".`;

/**
 * POST /api/projects/[id]/vision-test-summarize
 * Body: { steps: Array<{ observation?: string; issues_found?: string[] }> }
 * Returns { summary: string } from a single text-only Claude call (no images).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectAuth(request, projectId);
  if (auth instanceof NextResponse) return auth;
  const apiKey = process.env.ANTHROPIC_VISION_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });
  }

  let body: { steps?: Array<{ observation?: string; issues_found?: string[] }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const steps = Array.isArray(body.steps) ? body.steps : [];
  const stepsText = steps
    .map(
      (s, i) =>
        `Step ${i + 1}: ${s.observation ?? "—"}${(s.issues_found?.length ?? 0) > 0 ? `. Issues: ${(s.issues_found ?? []).join("; ")}` : ""}.`
    )
    .join("\n");

  const userMessage = `${SUMMARIZE_PROMPT}

Steps:
${stepsText || "No steps."}`;

  try {
    const client = new Anthropic({
      apiKey,
      defaultHeaders: { "anthropic-beta": "prompt-caching-2024-07-31" },
    });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: userMessage }],
    });

    const usage = (response as { usage?: { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } }).usage;
    if (usage) {
      console.log(
        `Tokens - input: ${usage.input_tokens ?? 0}, cache_read: ${usage.cache_read_input_tokens ?? 0}, cache_creation: ${usage.cache_creation_input_tokens ?? 0}`,
      );
    }
    const text =
      (response.content as Array<{ type: string; text?: string }>)?.find((b) => b.type === "text")?.text ?? "";
    const summary = text.trim();
    return NextResponse.json({ summary: summary || "[Claude Vision] No summary generated." });
  } catch (e) {
    console.error("[vision-test-summarize]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Summarize failed", detail: message }, { status: 502 });
  }
}

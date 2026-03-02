import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireProjectAuth } from "@/lib/apiProjectAuth";

const VISION_MODEL = "claude-sonnet-4-6";
const VISION_MAX_TOKENS = 1000;

const SYSTEM_PROMPT_BASE = `You are a mobile app QA tester controlling an iPhone simulator. Your job is to explore and test every feature of the app shown in the screenshots.

Return action "done" only when you have genuinely tested every visible and reachable feature, or the app is completely broken and untestable.

When you return action "done", you MUST include evidence-based scores. Derive them from your testing—do not pick arbitrary numbers.

functionalityScore (1-5):
- 5: Every feature tested and working perfectly
- 4: Most features working, 1 minor issue
- 3: Some features working, some broken or untested
- 2: Major features broken
- 1: App barely works or crashes

overallScore (1-100): Calculate from evidence:
- Start at 100
- Subtract 10 for every feature that could not be tested
- Subtract 15 for every feature that was tested and found broken
- Subtract 5 for every visual issue found
- Minimum score is 10

Include "score_calculation" in your done response: a short explanation of how you applied the formula (e.g. "100 - 10×2 untested - 15×1 broken - 5×0 visual = 65"). List "features_that_could_not_be_tested" and count broken features and visual issues from your "issues_found" and observations.

When you return action "done", you MUST include "qa_notes" in this exact structure (use the section headers and format as shown):

Features tested: [feature] (working/FAILED), [feature] (working/FAILED)
Features NOT tested: [list any visible features that were never reached]
Issues: [detailed description of each issue including what was tried, what was expected, what actually happened]
Recommendation: [one sentence on what needs fixing or if app is ready]

You must list every feature you saw but could not test under "Features NOT tested" and explain why. The Features NOT tested section cannot be blank.

TAP_TARGET_INSTRUCTION_PLACEHOLDER

Respond in JSON only with no other text:
{
  "action": "tap" | "type" | "keypress" | "swipe" | "scroll" | "done",
  TAP_TARGET_JSON_PLACEHOLDER
  "text": string (required for type only),
  "key": string (required for keypress only; use "return" for Enter/Return key),
  "direction": "up" | "down" | "left" | "right" (required for swipe and scroll only),
  "observation": "describe exactly what you see on screen right now in 1-2 sentences",
  "testing": "describe what you are testing with this specific action",
  "result_of_last_action": "describe what happened after the last action, or null if this is the first action",
  "issues_found": [{"description": "human readable description of the issue", "issue_type": "broken_button" | "keyboard_blocking" | "coordinate_miss" | "feature_untested" | "app_crash" | "wrong_state" | "visual_bug" | "slow_response" | "other"}]. Empty array if none. Every issue must have description and issue_type.",
  "features_tested_so_far": ["running list of everything you have successfully tested"],
  "confidence": number 0-100,
  (when action is "done" only: "functionalityScore": number 1-5, "overallScore": number 1-100, "features_that_could_not_be_tested": ["features you could not reach or test"], "score_calculation": "brief explanation of how you computed overallScore from the formula", "qa_notes": "Features tested: ... | Features NOT tested: ... | Issues: ... | Recommendation: ...")
}

When you return done, always include functionalityScore, overallScore, score_calculation, features_that_could_not_be_tested, and qa_notes in the exact formats specified.`;

const TAP_INSTRUCTION_ELEMENTS = `For tap actions, ALWAYS use element selectors. Return "target": { "elementText": "exact visible text" } for buttons/labels (e.g. "+", "Add task", "Allow") or "target": { "elementLabel": "accessibility label" } when the element has an accessibility label. Do not use x,y coordinates. Match text exactly as shown in the UI tree.`;

const TAP_INSTRUCTION_COORDINATES = `For tap actions, return "x" and "y" at the top level of your JSON with coordinates in the image pixel space (x 0 to image width, y 0 to image height).`;

const TAP_JSON_ELEMENTS = `"target": { "elementText": "exact visible text" } or { "elementLabel": "accessibility label" } (required for tap),`;
const TAP_JSON_COORDINATES = `"x": number 0-375, "y": number 0-812 (for tap),`;

function buildSystemPrompt(tapMode: "coordinates" | "elements"): string {
  const tapInstruction = tapMode === "elements" ? TAP_INSTRUCTION_ELEMENTS : TAP_INSTRUCTION_COORDINATES;
  const tapJson = tapMode === "elements" ? TAP_JSON_ELEMENTS : TAP_JSON_COORDINATES;
  return SYSTEM_PROMPT_BASE
    .replace("TAP_TARGET_INSTRUCTION_PLACEHOLDER", tapInstruction)
    .replace("TAP_TARGET_JSON_PLACEHOLDER", tapJson);
}

export type VisionMessage = { role: "user" | "assistant"; content: Anthropic.MessageParam["content"] };

export type VisionIssueType =
  | "broken_button"
  | "keyboard_blocking"
  | "coordinate_miss"
  | "feature_untested"
  | "app_crash"
  | "wrong_state"
  | "visual_bug"
  | "slow_response"
  | "other";

export interface VisionStepRequest {
  /** Full conversation history: alternating user (screenshot + text) and assistant (JSON) turns. */
  messages: VisionMessage[];
  /** "elements" = use elementText/elementLabel; "coordinates" = use x,y. Default "elements". */
  tapMode?: "coordinates" | "elements";
}

export interface VisionStepResponse {
  action: "tap" | "type" | "keypress" | "swipe" | "scroll" | "done";
  target?: { text?: string; elementText?: string; elementLabel?: string; x?: number; y?: number };
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  direction?: "up" | "down" | "left" | "right";
  observation?: string;
  testing?: string;
  result_of_last_action?: string | null;
  issues_found?: Array<{ description: string; issue_type: VisionIssueType }> | string[];
  features_tested_so_far?: string[];
  /** When action is "done": 1-5 from evidence-based rubric. */
  functionalityScore?: number;
  /** When action is "done": 1-100 from formula (100 - 10×untested - 15×broken - 5×visual, min 10). */
  overallScore?: number;
  /** When action is "done": features that could not be reached or tested. */
  features_that_could_not_be_tested?: string[];
  /** When action is "done": explanation of how overallScore was calculated. */
  score_calculation?: string;
  /** When action is "done": QA notes in required structure (Features tested / Features NOT tested / Issues / Recommendation). */
  qa_notes?: string;
  confidence?: number;
  input_tokens?: number;
  output_tokens?: number;
  /** Assistant message content to append to client-side messages for next request. */
  assistantContent?: Anthropic.MessageParam["content"];
}

function extractJsonFromResponse(text: string): string {
  const trimmed = text.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock?.[1]) return codeBlock[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/**
 * POST /api/projects/[id]/vision-test-step
 * Accepts full messages array (multi-turn conversation), forwards to Anthropic, returns parsed action + assistant content.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  const auth = await requireProjectAuth(request, projectId);
  if (auth instanceof NextResponse) return auth;

  const apiKey = process.env.ANTHROPIC_VISION_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_VISION_API_KEY or ANTHROPIC_API_KEY not set" }, { status: 503 });
  }

  let body: VisionStepRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, tapMode: rawTapMode } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required and must be non-empty" }, { status: 400 });
  }
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.role !== "user") {
    return NextResponse.json({ error: "Last message must be from user" }, { status: 400 });
  }
  const tapMode = rawTapMode === "coordinates" ? "coordinates" : "elements";

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: VISION_MAX_TOKENS,
      system: buildSystemPrompt(tapMode),
      messages: messages as Anthropic.MessageParam[],
    });

    const rawText =
      (response.content as Array<{ type: string; text?: string }>)
        ?.find((b) => b.type === "text")
        ?.text ?? "";
    console.log("[vision-test] Claude raw response:", rawText);
    const jsonStr = extractJsonFromResponse(rawText);
    const parsed = JSON.parse(jsonStr) as VisionStepResponse;

    if (!parsed.action) {
      return NextResponse.json({ error: "Claude response missing action" }, { status: 502 });
    }

    const action = parsed.action as VisionStepResponse["action"];
    const t = parsed.target as { text?: string; elementText?: string; elementLabel?: string; x?: number; y?: number } | undefined;
    const hasTapElement = t && (typeof t.elementText === "string" && t.elementText.length > 0 || typeof t.elementLabel === "string" && t.elementLabel.length > 0 || typeof t.text === "string" && t.text.length > 0);
    const hasTapCoords = typeof parsed.x === "number" && typeof parsed.y === "number" || t && typeof t.x === "number" && typeof t.y === "number";
    if (action === "tap" && !hasTapElement && !hasTapCoords) {
      return NextResponse.json({ error: "tap action requires target.elementText, target.elementLabel, or x,y coordinates" }, { status: 502 });
    }
    if (action === "type" && typeof parsed.text !== "string") {
      return NextResponse.json({ error: "type action requires text" }, { status: 502 });
    }
    if (action === "keypress" && typeof parsed.key !== "string") {
      return NextResponse.json({ error: "keypress action requires key" }, { status: 502 });
    }
    if ((action === "swipe" || action === "scroll") && !parsed.direction) {
      return NextResponse.json({ error: "swipe/scroll action requires direction" }, { status: 502 });
    }

    const VALID_ISSUE_TYPES: VisionIssueType[] = ["broken_button", "keyboard_blocking", "coordinate_miss", "feature_untested", "app_crash", "wrong_state", "visual_bug", "slow_response", "other"];
    const rawIssues = parsed.issues_found ?? [];
    const issues_found = Array.isArray(rawIssues)
      ? rawIssues.map((item) => {
          if (typeof item === "string") {
            return { description: item, issue_type: "other" as VisionIssueType };
          }
          const obj = item as { description?: string; issue_type?: string };
          const issue_type = typeof obj.issue_type === "string" && VALID_ISSUE_TYPES.includes(obj.issue_type as VisionIssueType) ? (obj.issue_type as VisionIssueType) : "other";
          return { description: typeof obj.description === "string" ? obj.description : String(item), issue_type };
        })
      : [];

    const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
    const input_tokens = typeof usage?.input_tokens === "number" ? usage.input_tokens : 0;
    const output_tokens = typeof usage?.output_tokens === "number" ? usage.output_tokens : 0;

    return NextResponse.json({
      ...parsed,
      issues_found,
      input_tokens,
      output_tokens,
      assistantContent: response.content,
    });
  } catch (e) {
    console.error("[vision-test-step]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Vision step failed", detail: message },
      { status: 502 }
    );
  }
}

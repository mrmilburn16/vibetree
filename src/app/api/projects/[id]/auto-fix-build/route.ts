import { NextResponse } from "next/server";
import {
  getBuildJob,
  createBuildJob,
  setBuildJobNextJob,
  setBuildJobErrorHistory,
  appendBuildJobLogs,
  setBuildJobAutoFixInProgress,
  appendBuildJobAutoFixLog,
  setBuildJobAutoFixLog,
} from "@/lib/buildJobs";
import { requireProjectAuth } from "@/lib/apiProjectAuth";
import { getProjectFromFirestore } from "@/lib/projectsFirestore";
import { fixSwiftCommonIssues } from "@/lib/llm/fixSwift";
import { preBuildLint } from "@/lib/preBuildLint";
import { setProjectFiles } from "@/lib/projectFileStore";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

type SwiftFile = { path: string; content: string };

const FIX_MODEL = "claude-sonnet-4-5-20250929";
const FIX_MAX_TOKENS = 32000;

const FIX_CACHE_CONTROL: { type: "ephemeral"; ttl?: "1h" } | undefined =
  process.env.CACHE_TTL === "off"
    ? undefined
    : process.env.CACHE_TTL === "5m"
      ? { type: "ephemeral" }
      : { type: "ephemeral", ttl: "1h" };
/** Timeout for the auto-fix Claude API call so a hung request eventually fails and we can move on. */
const AUTO_FIX_CLAUDE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
/** Max retries per attempt when Anthropic returns 529 overloaded_error. */
const MAX_OVERLOAD_RETRIES = 3;
/** Delay before retrying after an overload (529) from Anthropic. */
const OVERLOAD_RETRY_DELAY_MS = 10_000;

/** True if the error is Anthropic overloaded_error (HTTP 529). Do not count as a failed attempt; retry after delay. */
function isOverloadError(e: unknown): boolean {
  if (e && typeof e === "object") {
    const status = (e as { status?: number }).status;
    if (status === 529) return true;
    const errBody = (e as { error?: { type?: string } }).error;
    if (errBody && typeof errBody === "object" && (errBody as { type?: string }).type === "overloaded_error")
      return true;
  }
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return msg.includes("529") || msg.includes("overloaded_error") || /overloaded/i.test(msg);
}

function requireRunnerAuth(request: Request): { ok: true } | { ok: false; response: Response } {
  const token = process.env.MAC_RUNNER_TOKEN;
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Runner auth not configured" }, { status: 503 }) };
  }
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1] || m[1] !== token) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true };
}

const FIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["explanation", "files"],
  properties: {
    explanation: { type: "string" },
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "content"],
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
      },
    },
  },
} as const;

/**
 * Normalize error strings for comparison (trim, collapse whitespace).
 * Returns a sorted array of normalized lines so two error sets can be compared.
 */
function normalizedErrorSignature(errors: string[]): string[] {
  return [...errors]
    .map((e) => e.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .sort();
}

/**
 * True if the same errors appeared on the previous attempt (no progress).
 */
function isRepeatedError(
  currentErrors: string[],
  errorHistory: Array<{ attempt: number; errors: string[] }> | undefined,
  currentAttempt: number
): boolean {
  if (currentErrors.length === 0) return false;
  const prevEntry = errorHistory?.find((e) => e.attempt === currentAttempt - 1);
  if (!prevEntry?.errors?.length) return false;
  const a = normalizedErrorSignature(currentErrors);
  const b = normalizedErrorSignature(prevEntry.errors);
  if (a.length !== b.length) return false;
  return a.every((line, i) => line === b[i]);
}

/**
 * Extract file names mentioned in compiler errors (e.g.
 * "Views/CardEditorSheet.swift:42:13: error: ...")
 */
function extractErrorFileNames(errors: string[]): Set<string> {
  const names = new Set<string>();
  for (const err of errors) {
    const m = err.match(/([A-Za-z0-9_/]+\.swift):\d+/);
    if (m?.[1]) {
      let p = m[1];
      if (p.startsWith("/")) {
        const idx = p.lastIndexOf("/Sources/");
        if (idx >= 0) p = p.slice(idx + "/Sources/".length);
        else {
          const parts = p.split("/");
          p = parts[parts.length - 1];
        }
      }
      names.add(p);
      const base = p.split("/").pop()!;
      names.add(base);
    }
  }
  return names;
}

/**
 * Build a compact type-signature summary of a Swift file so the LLM knows
 * what types, protocols, and public API surface exist without the full code.
 */
function buildTypeSummary(file: SwiftFile): string {
  const lines = file.content.split("\n");
  const sigs: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^(import |struct |class |enum |protocol |extension |@main|@Observable|@Model|func |var |let |case )/.test(trimmed) ||
      /^(public |private |internal |open |final )/.test(trimmed)
    ) {
      sigs.push(trimmed.replace(/\{.*$/, "").trim());
    }
  }
  return sigs.join("\n");
}

/**
 * Determine which files the LLM needs to see in full, and which ones
 * only need a type summary for context.
 */
function partitionFiles(
  allFiles: SwiftFile[],
  errorFileNames: Set<string>
): { fullFiles: SwiftFile[]; contextFiles: { path: string; summary: string }[] } {
  if (errorFileNames.size === 0) {
    return { fullFiles: allFiles, contextFiles: [] };
  }

  const fullFiles: SwiftFile[] = [];
  const contextFiles: { path: string; summary: string }[] = [];

  for (const f of allFiles) {
    const baseName = f.path.split("/").pop() ?? f.path;
    if (errorFileNames.has(f.path) || errorFileNames.has(baseName)) {
      fullFiles.push(f);
    } else {
      contextFiles.push({ path: f.path, summary: buildTypeSummary(f) });
    }
  }

  if (fullFiles.length === 0) {
    return { fullFiles: allFiles, contextFiles: [] };
  }

  return { fullFiles, contextFiles };
}

const AUTO_FIX_SYSTEM_PROMPT = `You are a Swift compiler-error repair specialist. Your ONLY job is to fix compilation errors in an existing SwiftUI iOS project so it builds successfully with xcodebuild.

Rules:
1. Fix ONLY what is broken. Do NOT change app behavior, styling, or architecture.
2. Common Swift/SwiftUI errors and their fixes:
   - "Cannot find type 'X' in scope": add missing import (SwiftUI, Foundation, UIKit, AppIntents, WidgetKit, Combine) or ensure the type is defined. Check if there's a typo.
   - "unknown attribute 'Published'": Add "import Combine" at the top of the file. @Published is defined in Combine, not SwiftUI.
   - "Cannot find type 'XIntent' in scope" in a file under WidgetExtension/: the widget extension is a separate target and cannot see types from the main app. You MUST define the Intent type inside WidgetExtension/. Add a new file WidgetExtension/<Name>Intent.swift (e.g. WidgetExtension/VoiceNoteIntent.swift) that defines the App Intent struct conforming to WidgetConfigurationIntent or AppIntent, with import AppIntents. If the same Intent exists in the main app, copy its definition into WidgetExtension/ so the widget target can see it.
   - "Cannot find type 'XAttributes' in scope" (e.g. FocusTimerAttributes) in a file in the main app (ViewModels/, Views/, etc.): the ActivityAttributes struct MUST be in the main app target, not in WidgetExtension/. If it exists in WidgetExtension/, move it out. Create or move it to "LiveActivity/<Name>Attributes.swift" (e.g. LiveActivity/FocusTimerAttributes.swift) or "Models/<Name>Attributes.swift". Never define ActivityAttributes in WidgetExtension/ — the main app cannot see types there. The widget extension should only reference the type in ActivityConfiguration(for:); the Attributes file must live in LiveActivity/ or Models/ so the main app compiles it.
   - ".containerBackground(for: .dynamicIsland)" or "dynamicIsland" / ContainerBackgroundPlacement: .dynamicIsland does not exist. Remove any .containerBackground(for: .dynamicIsland) modifier. Dynamic Island UI must use only the ActivityConfiguration dynamicIsland: parameter with the DynamicIsland result builder (DynamicIslandExpandedRegion, compactLeading, compactTrailing, minimal).
   - "Extra trailing closure passed in call" or "contextual closure type" (trailing closure misuse): Remove the trailing closure and use explicit parameter labels. BarMark/LineMark/AreaMark/PointMark do NOT take trailing closures; use modifiers like .foregroundStyle(...), .annotation { }, etc. after the initializer.
   - "Value of type 'X' has no member 'Y'" / "has no member": (1) If Y is accentColor, use Color("AccentColor") or .tint(Color("AccentColor")) — never Color.accentColor (that is not a valid static property on Color). (2) If X is NSAttributedString.Key, use .foregroundColor not .foregroundStyle. (3) Otherwise use the correct API for that type (check SwiftUI/UIKit docs) or fix a typo; add missing import if the type is from another module.
   - "type 'Theme' has no member 'accentColor'" or "type 'HapticPattern' has no member 'accentColor'" or "type 'BeatPattern' has no member 'accentColor'" or "type 'ShapeStyle' has no member 'accentColor'": Use Color("AccentColor") or .tint(Color("AccentColor")) — never Color.accentColor (it does not exist on Color). Do not use a custom type's .accentColor.
   - "type 'NSAttributedString.Key' has no member 'foregroundStyle'": Use NSAttributedString.Key.foregroundColor (not .foregroundStyle). .foregroundStyle is a SwiftUI modifier; for attributed strings use .foregroundColor.
   - "generic parameter 'C' could not be inferred": Often with ForEach—provide an explicit id (e.g. ForEach(items, id: \\.id)) or use ForEach(array.indices, id: \\.self) and subscript the array. Ensure the collection type is clear.
   - "cannot find type 'UIView' in scope": Add "import UIKit" at the top. UIView is from UIKit; SwiftUI does not re-export it in all contexts.
   - "cannot find type 'Context' in scope": Context in makeUIView(context: Context) comes from SwiftUI (UIViewRepresentable). Add "import SwiftUI". For TimelineProvider use "import WidgetKit" and qualify as TimelineProvider.Context if needed.
   - "cannot find 'colorcolorcolor' in scope": LLM typo (Color repeated). Replace colorcolorcolor with Color.primary (or the intended semantic color, e.g. Color("AccentColor")).
   - "for-in loop requires 'AsyncStream<...>' to conform to 'Sequence'": AsyncStream is async. Use "for await item in stream" not "for item in stream".
   - "generic struct 'StateObject' requires that 'X' conform to 'ObservableObject'": The type passed to @StateObject must conform to ObservableObject. Add ": ObservableObject" to the class declaration and ensure it has @Published properties or an objectWillChange publisher.
   - "cannot convert value of type '[X]' to expected argument type 'Binding<C>'": ForEach expects a collection and id, or a Binding. Use ForEach(items, id: \\.id) { item in ... } not ForEach($items) with a plain array. For mutable list use ForEach(items.indices, id: \\.self) { i in ... } with $items[i] if needed.
   - "Missing return in closure": Add explicit return statement.
   - "cannot find type 'WidgetDataBridge' in scope" or "cannot find type 'SharedModel' in scope" or similar in a WidgetExtension/ file where the type is a shared data model: the widget extension is a separate compile target and CANNOT see types defined only in the main app. Move the shared type to "SharedModels/<TypeName>.swift" (e.g. SharedModels/WidgetDataBridge.swift) so the build system compiles it for both targets. Also ensure runtime data flows through App Groups: use UserDefaults(suiteName: "group.com.bundleid") to write from the main app and read from the widget's TimelineProvider; define the suite name constant in SharedModels/AppGroup.swift.
   - "Cannot find type 'UTType' in scope" or "Cannot find 'UTType' in scope": Add "import UniformTypeIdentifiers" at the top of the file. UTType is defined in the UniformTypeIdentifiers framework (iOS 14+) and is required for UIDocumentPickerViewController(forOpeningContentTypes:).
   - "Cannot find type 'AVAudioPlayerNode' in scope" or "Cannot find type 'AVAudioMixerNode' in scope" or "Cannot find type 'AVAudioUnitEQ' in scope" or "Cannot find type 'AVAudioPCMBuffer' in scope" or "Cannot find type 'AVAudioFile' in scope": Add "import AVFoundation" at the top of the file. All AVAudio* types are in AVFoundation.
   - AVAudioEngine node connection errors ("node is not attached", "required condition is false" at engine.connect, or similar AVAudioEngine assertion failures): Ensure all nodes are attached with engine.attach(node) BEFORE any engine.connect() calls. The mandatory order is: (1) engine.attach(playerNode), engine.attach(mixerNode), etc. for every node, then (2) engine.connect(playerNode, to: mixerNode, format: nil), etc. If you see connect before attach, reorder to fix.
   - "value of type 'AVAudioPlayerNode' has no member 'nodeTime'" or "cannot convert value of type 'UInt64' to expected argument type 'AVAudioTime?'" on a scheduleBuffer/scheduleFile call: The 'at:' parameter of schedule(buffer:at:options:) and schedule(file:at:options:) takes AVAudioTime?, not a UInt64. Fix by: (1) passing nil to play immediately, or (2) passing AVAudioTime(hostTime: mach_absolute_time()) to schedule at current time. Never call playerNode.nodeTime(forHostTime:) — that method does not exist.
   - "value of type 'GraphicsContext' has no member 'foregroundStyle'" or "cannot call value of non-function type" referencing .foregroundStyle inside a Canvas closure or Shape path(in:) body: .foregroundStyle is a SwiftUI view modifier and cannot be used inside a Canvas drawing closure or a Shape's path(in:) method. Fix by replacing any context.foregroundStyle(color) with context.fill(path, with: .color(color)) or context.stroke(path, with: .color(color), lineWidth: w). For Shape structs, remove .foregroundStyle from inside path(in:) and apply it as a modifier on the Shape's call site instead.
   - "cannot find 'AVAudioFramePosition' in scope" or "cannot find 'AVAudioFrameCount' in scope" or "cannot find 'AVAudioTime' in scope": Add "import AVFoundation" at the top of the file that contains the error. These types are in AVFoundation and are NOT automatically imported by SwiftUI.
   - "the compiler is unable to type-check this expression in reasonable time" in a View body: The view body is too complex. Extract sections into @ViewBuilder computed properties (e.g. private var headerSection: some View { ... }) or child view structs. Split the body into smaller pieces of no more than 20-25 lines each. Never put more than 3-4 chained modifiers inline in a complex view body.
   - "value of type 'AVAudioPlayerNode' has no member 'rate'": AVAudioPlayerNode does not expose a .rate property in all configurations. Replace with AVAudioUnitTimePitch: (1) Add let timePitch = AVAudioUnitTimePitch() as a property, (2) call engine.attach(timePitch) before connecting, (3) connect playerNode → timePitch → mixer instead of playerNode → mixer directly, (4) set timePitch.rate = value instead of playerNode.rate = value. Attach must happen before connect.
   - "cannot find type 'X' in scope" where X is NOT a system framework type (not UIKit, SwiftUI, Foundation, AVFoundation, CoreData, WidgetKit, etc.): This means a custom model/struct/class file is missing from the project. Do NOT just add an import — instead, CREATE the missing file with a complete definition. Read every error carefully to determine what properties and methods the missing type needs (e.g. if DJMixerViewModel references deck.isPlaying, deck.trackTitle, and deck.bpm, then DeckModel needs those properties). Generate a complete, compilable struct or class definition in a new file named after the type (e.g. "Models/DeckModel.swift"). Common examples of custom types that need their own file: DeckModel, TrackInfo, DeckState, PlayerState, SongInfo, MixSession. Return the newly created file alongside any other fixed files.
   - For any error not listed above: read the message carefully and apply the minimal fix (correct API name, add import, fix type conformance, or remove invalid syntax). Prefer the smallest change that resolves the error.
   - "Type 'X' does not conform to protocol 'Y'": Implement required protocol methods/properties. For NavigationLink(value:) and .navigationDestination(for:), the type MUST conform to Hashable. Add ": Hashable" to the struct/class declaration.
   - "Cannot convert value of type 'X' to expected type 'Y'": Use proper type conversion.
   - "$viewModel" without a property: Use viewModel (no $) unless binding a specific property like $viewModel.isRunning.
   - String interpolation escaping: Write .currency(code: "USD") not .currency(code: \\"USD\\").
   - "type '()' cannot conform to 'View'": A non-View statement (assignment, function call) is inside a SwiftUI body/content closure. Wrap it in an if/let or move it to .onAppear/.task.
   - "Multiple commands produce": Duplicate Swift files with the same name in different directories. Remove the duplicate.
   - "no exact matches in call to initializer": The initializer being called does not match any overload. Fix by: (1) Check the type's initializer signature (e.g. SwiftUI View init, or custom struct init). (2) Add missing parameters or use correct parameter labels. (3) If it's a SwiftUI View (e.g. ProgressView, Text), use the correct initializer—e.g. ProgressView() with no args, or ProgressView(value:total:) with two Binding or numeric args; Text("string") not Text(someWrongType). (4) Remove or replace extra arguments that don't match any initializer.
3. Every file you return must be COMPLETE (full file content, not just the changed parts).
4. Return ALL files that you modified. For files you didn't change, do NOT return them.
5. Preserve all imports, all types, all function signatures unless a signature itself is the error.
6. CRITICAL: Use the EXACT SAME file paths as the input. If a file is at "Models/Debt.swift", return it at "Models/Debt.swift" — never change it to "VibetreeApp/Models/Debt.swift" or any other path. Changing paths creates duplicate files that break the build.
7. Model types used with NavigationLink(value:label:) or .navigationDestination(for:destination:) MUST conform to Hashable. If the error mentions Hashable, add it to the type declaration.
8. While fixing compilation errors, apply these low-risk HIG quality improvements ONLY when they are one-line changes along the fix path (do NOT refactor unrelated code):
   - If you see Color.white or Color.black used as a background, replace with Color(.systemBackground) or Color(.secondarySystemBackground).
   - If you see Color.white or Color.black used for text, replace with Color.primary or Color.secondary.
   - If you see .system(size: N) for body-level text, prefer .font(.body) or the closest semantic style.
   - If you touch a Button with an Image(systemName:) and no text, add .accessibilityLabel("description") if missing.
   - If you see .animation(.linear, ...), prefer .animation(.easeInOut(duration: 0.25), ...).
   - Do NOT restyle entire views. These are surgical one-line improvements only.

Output: JSON { "explanation": "what you fixed", "files": [{ "path": "...", "content": "..." }] }`;

// The auto-fix system prompt is constant across all calls; variable content
// (compiler errors, file contents) is in the user message. Cache the system
// prompt so repeat attempts within the same build session are cheap.
const AUTO_FIX_SYSTEM_BLOCKS: Array<{ type: "text"; text: string; cache_control?: typeof FIX_CACHE_CONTROL }> = [
  { type: "text", text: AUTO_FIX_SYSTEM_PROMPT, ...(FIX_CACHE_CONTROL && { cache_control: FIX_CACHE_CONTROL }) },
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return Response.json({ error: "Project ID required" }, { status: 400 });
  const runnerAuth = requireRunnerAuth(request);
  if (runnerAuth.ok) {
    const project = await getProjectFromFirestore(projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    // Runner token accepted; no user session required. Project loaded for ownership check only.
  } else {
    const auth = await requireProjectAuth(request, projectId);
    if (auth instanceof NextResponse) return auth;
  }

  const body = await request.json().catch(() => ({}));
  const failedJobId = typeof body?.failedJobId === "string" ? body.failedJobId : "";
  if (!failedJobId) return Response.json({ error: "failedJobId required" }, { status: 400 });

  const failedJob = getBuildJob(failedJobId);
  if (!failedJob) return Response.json({ error: "Job not found" }, { status: 404 });
  if (failedJob.status !== "failed") return Response.json({ error: "Job is not in failed state" }, { status: 400 });
  if (failedJob.cancelled || failedJob.autoFixInProgress === false) {
    return Response.json({ cancelled: true, reason: "Build was cancelled by user" });
  }

  /** Re-check job; cancel sets autoFixInProgress = false so we can abort before LLM or before creating retry. */
  function wasCancelled(): boolean {
    const j = getBuildJob(failedJobId);
    return j ? j.autoFixInProgress === false : true;
  }

  const attempt = (failedJob.request.attempt ?? 1) + 1;
  const maxAttempts = failedJob.request.maxAttempts ?? 8;
  const userPrompt = failedJob.request.userPrompt;
  if (attempt > maxAttempts) {
    setBuildJobAutoFixInProgress(failedJobId, false);
    return Response.json({ gaveUp: true, reason: `Max attempts (${maxAttempts}) reached` });
  }

  const currentFiles: SwiftFile[] = failedJob.request.files ?? [];
  if (currentFiles.length === 0) {
    setBuildJobAutoFixInProgress(failedJobId, false);
    return Response.json({ gaveUp: true, reason: "No source files in job to fix" });
  }

  const errors = failedJob.compilerErrors ?? [];
  const logLines = failedJob.logs ?? [];
  if (errors.length === 0 && logLines.length === 0) {
    setBuildJobAutoFixInProgress(failedJobId, false);
    return Response.json({ gaveUp: true, reason: "No compiler errors or build log to fix" });
  }

  const currentAttempt = failedJob.request.attempt ?? 1;
  if (isRepeatedError(errors, failedJob.errorHistory, currentAttempt)) {
    setBuildJobAutoFixInProgress(failedJobId, false);
    appendBuildJobLogs(failedJobId, ["Repeated error — same errors as previous attempt; stopping to avoid loop."]);
    return Response.json({ gaveUp: true, reason: "Repeated error — auto-fix made no progress" });
  }

  const simplifyInstruction = attempt >= 4
    ? `\n\nIMPORTANT: This is attempt ${attempt} of ${maxAttempts}. Previous fixes have not resolved all errors. If you cannot fix an error cleanly, SIMPLIFY the code: remove the problematic feature entirely rather than continuing to fail. A simpler app that compiles is far better than a complex app that doesn't. Remove any feature that uses an API you're unsure about.`
    : "";

  appendBuildJobLogs(failedJobId, [`Auto-fixing with LLM (attempt ${attempt}/${maxAttempts})…`]);

  const errorFileNames = extractErrorFileNames(errors);
  const logErrorLines = logLines.filter(
    (l) => /\.swift:\d+.*error:/.test(l) || /error:/.test(l)
  );
  for (const l of logErrorLines) {
    const m = l.match(/([A-Za-z0-9_/]+\.swift):\d+/);
    if (m?.[1]) {
      const base = m[1].split("/").pop()!;
      errorFileNames.add(base);
      errorFileNames.add(m[1]);
    }
  }

  const sendAllFull = attempt >= 3;
  const { fullFiles, contextFiles } = sendAllFull
    ? { fullFiles: currentFiles, contextFiles: [] as { path: string; summary: string }[] }
    : partitionFiles(currentFiles, errorFileNames);
  appendBuildJobLogs(failedJobId, [
    `Files with errors: ${fullFiles.map((f) => f.path).join(", ")}`,
    `Context-only files: ${contextFiles.map((f) => f.path).join(", ") || "(none)"}`,
  ]);

  const errorSection = errors.length > 0
    ? `COMPILER ERRORS:\n${errors.join("\n")}`
    : "";
  const logErrorSection = logErrorLines.length > 0
    ? `\nADDITIONAL ERROR LINES FROM BUILD LOG:\n${logErrorLines.slice(-200).join("\n")}`
    : "";

  console.log("[auto-fix] attempt", attempt, "errors sent to LLM:", errorSection || "(none)");
  appendBuildJobLogs(failedJobId, ["--- Errors sent to LLM (attempt " + attempt + ") ---", errorSection, logErrorSection].filter(Boolean));

  const fullLogTail = logLines.length > 0
    ? `\nFULL BUILD LOG (last 200 lines):\n${logLines.slice(-200).join("\n")}`
    : "";

  const fullFilesSection = fullFiles
    .map((f) => `=== ${f.path} (FIX THIS FILE) ===\n${f.content}`)
    .join("\n\n");

  const contextSection = contextFiles.length > 0
    ? `\nOTHER PROJECT FILES (type signatures only — do NOT return these unless you need to fix them too):\n${contextFiles.map((f) => `--- ${f.path} ---\n${f.summary}`).join("\n\n")}`
    : "";

  const userPromptSection = userPrompt
    ? `\nORIGINAL USER REQUEST:\n"${userPrompt}"\nFix the code to match this intent while resolving all compilation errors.\n`
    : "";

  const prompt = `${errorSection}${logErrorSection}
${userPromptSection}
FILES THAT NEED FIXING:
${fullFilesSection}
${contextSection}
${fullLogTail}

Fix ALL the compilation errors listed above. Return the corrected files with their complete content.${simplifyInstruction}`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    setBuildJobAutoFixInProgress(failedJobId, false);
    return Response.json({ gaveUp: true, reason: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  try {
    const client = new Anthropic({
      apiKey,
      defaultHeaders: { "anthropic-beta": "prompt-caching-2024-07-31" },
    });

    async function callLLMStreaming(userPrompt: string): Promise<{ fixedFiles: SwiftFile[]; explanation: string; raw: string; stopReason: string }> {
      const stream = client.messages.stream({
        model: FIX_MODEL,
        max_tokens: FIX_MAX_TOKENS,
        system: AUTO_FIX_SYSTEM_BLOCKS as Parameters<typeof client.messages.stream>[0]["system"],
        output_config: { format: jsonSchemaOutputFormat(FIX_SCHEMA) },
        messages: [{ role: "user", content: userPrompt }],
      });
      const finalMessage = await stream.finalMessage();
      const usage = (finalMessage as { usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } }).usage;
      if (usage) {
        console.log(
          `Tokens - input: ${usage.input_tokens ?? 0}, cache_read: ${usage.cache_read_input_tokens ?? 0}, cache_creation: ${usage.cache_creation_input_tokens ?? 0}`,
        );
      }
      const parsedOutput = (finalMessage as unknown as { parsed_output?: unknown }).parsed_output;
      let fixedFiles: SwiftFile[] = [];
      let explanation = "";
      if (
        parsedOutput &&
        typeof parsedOutput === "object" &&
        Array.isArray((parsedOutput as Record<string, unknown>).files)
      ) {
        const po = parsedOutput as { explanation?: string; files: SwiftFile[] };
        fixedFiles = po.files.filter(
          (f) => typeof f?.path === "string" && typeof f?.content === "string"
        );
        explanation = po.explanation ?? "";
      }
      const msg = finalMessage as unknown as Record<string, unknown>;
      const textContent = Array.isArray(msg.content)
        ? (msg.content as Array<{ type: string; text?: string }>)
            .filter((b) => b.type === "text" && typeof b.text === "string")
            .map((b) => b.text)
            .join("")
        : "";
      return { fixedFiles, explanation, raw: textContent, stopReason: String(msg.stop_reason ?? "") };
    }

    /** Call LLM with up to MAX_OVERLOAD_RETRIES retries on 529 overloaded_error; does not count as a failed attempt. */
    async function callLLMWithOverloadRetry(userPrompt: string): Promise<{ fixedFiles: SwiftFile[]; explanation: string; raw: string; stopReason: string }> {
      let lastError: unknown;
      for (let overloadCount = 0; overloadCount <= MAX_OVERLOAD_RETRIES; overloadCount++) {
        try {
          return await callLLMStreaming(userPrompt);
        } catch (e) {
          lastError = e;
          if (!isOverloadError(e) || overloadCount === MAX_OVERLOAD_RETRIES) throw e;
          appendBuildJobLogs(failedJobId, ["Anthropic servers are busy, retrying in 10 seconds…"]);
          await new Promise((r) => setTimeout(r, OVERLOAD_RETRY_DELAY_MS));
        }
      }
      throw lastError;
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Auto-fix Claude request timed out after 5 minutes")), AUTO_FIX_CLAUDE_TIMEOUT_MS)
    );

    const run = async (): Promise<Response> => {
      if (wasCancelled()) {
        return Response.json({ cancelled: true, reason: "Auto-fix was cancelled by user" });
      }
      let result = await callLLMWithOverloadRetry(prompt);
    let fixedFiles = result.fixedFiles;
    let explanation = result.explanation;

    if (fixedFiles.length === 0) {
      appendBuildJobLogs(failedJobId, [
        `LLM returned no files. stop_reason=${result.stopReason}`,
        `Raw output preview: ${result.raw.slice(0, 200)}`,
      ]);
      if (wasCancelled()) {
        setBuildJobAutoFixInProgress(failedJobId, false);
        return Response.json({ cancelled: true, reason: "Auto-fix was cancelled by user" });
      }
      appendBuildJobLogs(failedJobId, ["Retrying with all files included…"]);
      const retryPrompt = `This Swift/SwiftUI project won't compile.\n\n${errorSection}\n\nHere are ALL the files:\n\n${currentFiles.map((f) => `=== ${f.path} ===\n${f.content}`).join("\n\n")}\n\nFix the compilation errors and return the corrected files.`;
      const retryResult = await callLLMWithOverloadRetry(retryPrompt);
      fixedFiles = retryResult.fixedFiles;
      explanation = retryResult.explanation;
    }

    if (fixedFiles.length === 0) {
      appendBuildJobLogs(failedJobId, ["LLM returned no files after retry."]);
      setBuildJobAutoFixInProgress(failedJobId, false);
      return Response.json({ gaveUp: true, reason: "LLM could not produce fixed files" });
    }

    appendBuildJobLogs(failedJobId, [
      `LLM explanation: ${explanation}`,
      `LLM returned ${fixedFiles.length} fixed file(s): ${fixedFiles.map((f) => f.path).join(", ")}`,
    ]);

    // Record this fix attempt in the job's auto-fix log so admin builds page can show what changed.
    appendBuildJobAutoFixLog(failedJobId, {
      attempt: currentAttempt,
      errors: errors.slice(0, 50), // cap to keep document size reasonable
      explanation,
      filesFixed: fixedFiles.map((f) => f.path),
    });

    if (wasCancelled()) {
      setBuildJobAutoFixInProgress(failedJobId, false);
      return Response.json({ cancelled: true, reason: "Auto-fix was cancelled by user" });
    }

    const fixedPathSet = new Set(fixedFiles.map((f) => f.path));
    const originalBasenames = new Set(currentFiles.map((f) => f.path.split("/").pop()!));

    const normalizedFixed = fixedFiles.map((f) => {
      const base = f.path.split("/").pop()!;
      if (!fixedPathSet.has(f.path) || currentFiles.some((o) => o.path === f.path)) return f;
      const origMatch = currentFiles.find((o) => o.path.split("/").pop() === base);
      if (origMatch && origMatch.path !== f.path) {
        return { ...f, path: origMatch.path };
      }
      return f;
    });

    const mergedFiles: SwiftFile[] = currentFiles.map((orig) => {
      const fixed = normalizedFixed.find((f) => f.path === orig.path);
      return fixed ?? orig;
    });
    for (const f of normalizedFixed) {
      if (!mergedFiles.find((m) => m.path === f.path)) {
        const base = f.path.split("/").pop()!;
        if (!originalBasenames.has(base)) {
          mergedFiles.push(f);
        }
      }
    }

    const corrected = fixSwiftCommonIssues(mergedFiles);

    const lintResult = preBuildLint(corrected);
    if (lintResult.autoFixCount > 0) {
      appendBuildJobLogs(failedJobId, [
        `Pre-build lint auto-fixed ${lintResult.autoFixCount} issue(s)`,
        ...lintResult.warnings.filter(w => w.autoFixed).map(w => `  Fixed: ${w.file}: ${w.message}`),
      ]);
    }
    const lintWarnings = lintResult.warnings.filter(w => !w.autoFixed);
    if (lintWarnings.length > 0) {
      appendBuildJobLogs(failedJobId, [
        `Pre-build lint warnings:`,
        ...lintWarnings.map(w => `  ${w.severity}: ${w.file}: ${w.message}`),
      ]);
    }

    appendBuildJobLogs(failedJobId, [
      `Merged: ${corrected.length} total files (${fixedPathSet.size} modified by LLM).`,
    ]);

    // Write the complete merged+fixed file set back to the project store so future
    // builds start from the correct full state (not the incomplete set that caused
    // the original failure). This is fire-and-forget — a write failure is non-fatal.
    setProjectFiles(failedJob.request.projectId, lintResult.files);

    if (wasCancelled()) {
      setBuildJobAutoFixInProgress(failedJobId, false);
      return Response.json({ cancelled: true, reason: "Auto-fix was cancelled by user" });
    }

    const retryJob = createBuildJob({
      projectId: failedJob.request.projectId,
      projectName: failedJob.request.projectName,
      bundleId: failedJob.request.bundleId,
      developmentTeam: failedJob.request.developmentTeam,
      files: lintResult.files,
      autoFix: true,
      attempt,
      maxAttempts,
      parentJobId: failedJobId,
      userPrompt: failedJob.request.userPrompt,
      outputType: failedJob.request.outputType,
    });

    const failedAttempt = failedJob.request.attempt ?? 1;
    const fullHistory = [
      ...(failedJob.errorHistory ?? []),
      { attempt: failedAttempt, errors: failedJob.compilerErrors ?? [] },
    ];
    setBuildJobErrorHistory(retryJob.id, fullHistory);

    // Copy accumulated auto-fix log (including the entry just appended) to the retry job,
    // so the final successful job carries the complete history for build-results reporting.
    const updatedFailedJob = getBuildJob(failedJobId);
    if (updatedFailedJob?.autoFixLog?.length) {
      setBuildJobAutoFixLog(retryJob.id, updatedFailedJob.autoFixLog);
    }

    setBuildJobNextJob(failedJobId, retryJob.id);
    appendBuildJobLogs(failedJobId, [`Created retry job ${retryJob.id} (attempt ${attempt}/${maxAttempts})`]);

    return Response.json({ retryJobId: retryJob.id, attempt, maxAttempts });
    };

    return await Promise.race([run(), timeoutPromise]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appendBuildJobLogs(failedJobId, [`LLM fix error: ${msg}`]);
    setBuildJobAutoFixInProgress(failedJobId, false);
    return Response.json({ gaveUp: true, reason: msg }, { status: 500 });
  }
}

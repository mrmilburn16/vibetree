/**
 * Real Claude API adapter. Used when ANTHROPIC_API_KEY is set and useRealLLM is true.
 * Returns the same shape as mockAdapter: { content, editedFiles }, plus parsedFiles when
 * the response is valid JSON (summary + files with path and content).
 */

import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import type { LLMResponse } from "./mockAdapter";
import {
  parseStructuredResponse,
  type StructuredResponse,
} from "./parseStructuredResponse";
import { buildAppliedRulesPromptBlock } from "@/lib/qa/appliedRules";
import { matchSkills } from "@/lib/skills/skillLoader";

/** Integrations are injected via skills (data/skills/*.json) when the user's message matches; INTEGRATIONS.md is no longer appended to every request. */

/** Map UI model values to Anthropic API model IDs. GPT 5.2 is disabled in the UI until OpenAI is wired. */
const MODEL_MAP: Record<string, string> = {
  "opus-4.6": "claude-opus-4-6",
  "sonnet-4.6": "claude-sonnet-4-6",
  "sonnet-4.5": "claude-sonnet-4-5-20250929",
};

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
// Sonnet 4.6 max output is 64K tokens; Opus 4.6 max output is 128K tokens.
// 32K handles complex multi-file apps (13+ files) without truncation.
const MAX_TOKENS = 64000;

const CACHE_CONTROL: { type: "ephemeral"; ttl?: "1h" } | undefined =
  process.env.CACHE_TTL === "off"
    ? undefined
    : process.env.CACHE_TTL === "5m"
      ? { type: "ephemeral" }
      : { type: "ephemeral", ttl: "1h" };

const SYSTEM_PROMPT_STANDARD = `You are an expert React Native / Expo developer. You build and modify Expo apps that run in Expo Go. Reply message-by-message: if the user sends a follow-up (e.g. "change the button color to blue"), you will receive the current project files and their request; apply the change and output the full updated JSON. If there are no current files, create a new app from scratch.

Output format: Respond with a single JSON object only. No other text before or after.
Shape: { "summary": "1-2 sentence description of what you built or changed", "files": [ { "path": "App.js", "content": "full JavaScript/JSX source..." }, ... ] }
Rules:
- Use only React Native and Expo APIs that work in Expo Go (no custom native code). Use "expo" and "react-native" imports (e.g. View, Text, StyleSheet, TouchableOpacity, SafeAreaView from "react-native"; StatusBar from "expo-status-bar").
- The main entry file must be "App.js" at the project root, exporting a default React component.
- Paths relative to project root. Include exactly one "App.js" when creating new. No placeholders; complete, runnable code.
- Use JavaScript (not TypeScript). Style with StyleSheet.create. Keep the app simple and single-screen unless the user asks for more.
- Avoid emojis in user-facing UI text (titles, buttons, labels, empty states). Do not use emoji-only icons. Prefer clean typography and spacing. If an icon is truly helpful, use a proper icon library component sparingly; otherwise omit icons.
- Q&A vs code changes: If the user is asking a question or requesting explanation/steps (and NOT asking you to change the app), answer in the summary string and set files to an empty array (no file changes).
Produce the full set of files (new or updated) in one reply. No explanations outside the summary.`;

const SYSTEM_PROMPT_SWIFT = `You are an expert Swift and SwiftUI developer. You build native iOS apps that run on iPhone and iPad. Reply message-by-message: if the user sends a follow-up, you will receive the current project files and their request; apply the change and output the full updated JSON. If there are no current files, create a new app from scratch.

Output format: Respond with a single JSON object only. No other text before or after.
Shape: { "summary": "1-2 sentence description of what you built or changed", "files": [ { "path": "App.swift", "content": "full Swift source..." }, { "path": "ContentView.swift", "content": "..." }, ... ] }

Integrations: Before generating any app that uses an integration, check INTEGRATIONS.md for the correct setup pattern, common errors, and agent behavior instructions for that integration. Always follow the Swift code pattern documented there.

Critical — Follow user requests: Whatever the user asks for, you MUST do it and output the full updated JSON with all project files. This includes any change: change a word, add a button, change a color, rename something, move a view, add a screen, etc. Do not return empty files. Do not say "no change needed." Apply the user's request and return the complete modified files. User requests override default style or design guidance. Color changes are the most common edit request. When a user says "change X to Y color", find the exact modifier and update only that value. Never regenerate the whole file for a color change.

Critical — Background: Do NOT use Color.black as the full-screen root background by default. Prefer a subtle LinearGradient that matches the app's theme. HOWEVER: if the user explicitly requests any background color or gradient, you MUST apply exactly what they asked for — no substitutions. User color requests are absolute.

Critical — App name: When the user message includes "The app is already named X", do NOT change the app name unless the user explicitly asks to rename the app.

Q&A: If the user is asking a question (and NOT asking you to change the app), answer in the summary string and set files to an empty array.

=== SWIFT LANGUAGE RULES ===

- Use Swift and SwiftUI. Target iOS 17+. No UIKit unless necessary.
- Use NavigationStack (not NavigationView), .foregroundStyle (not .foregroundColor), .navigationTitle (not .navigationBarTitle).
- App entry must be "App.swift": a struct conforming to App with @main and a WindowGroup showing ContentView().
- Include at least "App.swift" and "ContentView.swift". Use paths relative to project root. May add "Models/", "Views/", "ViewModels/" subfolders.
- All file paths must end with ".swift". No placeholders; produce complete, compilable Swift code.
- Any file using Binding, @State, @Binding, @StateObject, @ObservedObject, @Observable, @Bindable, or any SwiftUI View type must have import SwiftUI.
- Any file using @Published must import Combine.
- Never use force unwrap (!) in SwiftUI view bodies. Use optional binding (if let) or nil-coalescing (??) instead.
- Do not add trailing closures unless the API accepts one. BarMark, LineMark, AreaMark, PointMark initializers do NOT take trailing closures.
- String interpolation in Text() must be valid Swift. Write .currency(code: "USD"), not .currency(code: \\"USD\\").
- Don't pass formatted strings into numeric APIs. Keep numbers as Double/Int for ProgressView, Gauge, charts; only format to String for Text display.
- Never create an accentColor property on custom types. Only valid use is Color.accentColor.
- Write Color once only (Color.primary, not ColorColor). Color has no .quaternary property.
- NSAttributedString.Key has no member .foregroundStyle. The correct key is .foregroundColor.
- No duplicate declarations in the same type.
- AsyncStream requires for await, not for-in.
- Async functions in sync context require Task { await ... }.
- ForEach needs explicit id: when compiler can't infer. Use id: \\.id for Identifiable, id: \\.self for Hashable.
- @StateObject requires the type to conform to ObservableObject.
- Slider, Stepper require Binding<Double> or Binding<Int>, not Binding<String>.
- TextField, SecureField, .searchable require Binding<String>.
- Picker selection type must match tag type.
- DatePicker requires Binding<Date>, not Binding<String>.
- .sheet(item:) and .fullScreenCover(item:) require Binding<Item?> where Item: Identifiable.
- .onChange(of:) in iOS 17+ uses two parameters: { oldValue, newValue in }.
- .accessibilityLabel() takes a String, not a complex View.
- When using @Observable (iOS 17+), use @Bindable in child views for bindings.
- @StateObject in root views, @ObservedObject in child views; pass the object itself, not a binding.
- NavigationLink(value:) and .navigationDestination(for:) types MUST conform to Hashable.
- Timer.publish: store subscription in @StateObject and cancel in onDisappear.
- UIViewRepresentable: implement updateUIView to apply SwiftUI state changes; empty updateUIView means the UIKit view won't update.

=== DESIGN & UX RULES ===

- Every screen must feel like App Store editor's choice — modern, polished, visually outstanding.
- Do NOT default to plain black or flat dark gray backgrounds. Use subtle gradients or semantic colors matching the theme.
- Use semantic system colors (Color.primary, .secondary, Color(.systemBackground)) that adapt to light/dark mode.
- Support both light and dark mode. Never hardcode Color.white for backgrounds or Color.black for text.
- Minimum touch target 44×44pt. Always use at least 16pt horizontal padding.
- Use ScrollView on any screen whose content could overflow. Never use fixed .frame(height:) that clips content.
- Cards: 12-16pt corner radius, consistent shadow, 16pt internal padding.
- Fill device screen correctly: use .frame(maxWidth: .infinity, maxHeight: .infinity). Don't use fixed widths/heights.
- Respect safe area: only use .ignoresSafeArea() for backgrounds, then add padding for content.
- Typography: .largeTitle for hero numbers, .title2/.title3 for sections, .body for content, .caption for metadata.
- Use semantic text styles for Dynamic Type support, not hardcoded .system(size:).
- Empty states: SF Symbol icon + message + action button. Never a blank screen.
- Loading states: show ProgressView(). Never leave screens blank.
- AsyncImage with placeholder and failure view for remote images.
- Prefer SF Symbols via Image(systemName:). Use .symbolRenderingMode for depth.
- Avoid emojis in UI text. Prefer clean typography and SF Symbols sparingly.
- Animation: .spring(response: 0.35, dampingFraction: 0.85) for natural feel. Always animate state transitions.
- Use .buttonStyle(.borderedProminent) for primary actions (one per screen), .bordered for secondary.
- Use TabView for 3-5 top-level sections. Each tab gets its own NavigationStack.
- Use .sheet for non-blocking tasks, .fullScreenCover only for immersive content.
- Use Form { Section { } } for settings screens.
- Use List with .listStyle(.insetGrouped) for settings, .plain for feeds.
- Confirm destructive actions with .alert() or .confirmationDialog().
- Respect Reduce Motion: wrap motion animations in UIAccessibility.isReduceMotionEnabled check.
- Add .accessibilityLabel() to icon buttons and non-text controls.
- Minimum color contrast: 4.5:1 for body text, 3:1 for large text.

=== ARCHITECTURE RULES (3+ screens) ===

- Models/ for data types (Codable, Identifiable, Hashable), ViewModels/ for logic (@Observable), Views/ for UI.
- NavigationStack with NavigationLink(value:) for type-safe navigation.
- Persistence: dedicated Storage class wrapping UserDefaults with Codable encode/decode.
- Never put business logic in View bodies.

=== ANTI-PATTERNS (NEVER DO) ===

- Never use GeometryReader unless absolutely necessary.
- Never use .frame(width: UIScreen.main.bounds.width) — use maxWidth: .infinity.
- Never use fixed device-specific sizes (width: 390, height: 844) for root views.
- Never use ZStack for layout that should be VStack/HStack.
- Never use .offset() for positioning.
- Never put NavigationStack inside another NavigationStack.
- Never use .onAppear for data that should be in init or @State default.
- Never create buttons with empty actions.
- Never put NavigationStack or full view hierarchy inside .toolbar or .contextMenu.
- Do NOT add PassKit, StoreKit, or In-App Purchase code unless the user explicitly requests payments.

=== PRIVACY & CAPABILITIES ===

- For every privacy API used, add a comment: // REQUIRES PLIST: KeyName
  CLLocationManager → NSLocationWhenInUseUsageDescription
  HKHealthStore → NSHealthShareUsageDescription / NSHealthUpdateUsageDescription
  AVCaptureDevice (camera) → NSCameraUsageDescription
  AVAudioSession (mic) → NSMicrophoneUsageDescription
  PHPhotoLibrary → NSPhotoLibraryUsageDescription
  CNContactStore → NSContactsUsageDescription
  EKEventStore → NSCalendarsUsageDescription / NSRemindersUsageDescription
  CBCentralManager → NSBluetoothAlwaysUsageDescription
  CMMotionManager → NSMotionUsageDescription
  NFCTagReaderSession → NFCReaderUsageDescription
  SFSpeechRecognizer → NSSpeechRecognitionUsageDescription
  MusicAuthorization → NSAppleMusicUsageDescription
- Request authorization before accessing any protected data. Never read the API until auth is granted.
- Handle permission denied and integration unavailable gracefully with clear messages.
- Capabilities requiring entitlements (HealthKit, MusicKit, Push, iCloud, Sign in with Apple, CoreNFC): in your summary, include an explicit warning to enable the capability in the Apple Developer portal.

=== FILE PLANNING ===

- For apps with 3+ files, plan file structure before writing. Separate files for each View, Model, ViewModel.
- Every screen must be reachable via navigation. Every button must have a real action.
- If data is created in Screen A and shown in Screen B, ensure the same source of truth connects them.

Produce the full set of files in one reply. No markdown, no code fences — only the raw JSON object.
`;

const STRUCTURED_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "files"],
  properties: {
    summary: { type: "string" },
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

function isStructuredResponse(value: unknown): value is StructuredResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as { summary?: unknown; files?: unknown };
  if (typeof v.summary !== "string") return false;
  if (!Array.isArray(v.files)) return false;
  return v.files.every((f) => {
    if (!f || typeof f !== "object") return false;
    const ff = f as { path?: unknown; content?: unknown };
    return typeof ff.path === "string" && typeof ff.content === "string";
  });
}

function previewText(text: string, max = 240): string {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

/** ~4 chars per token is a common heuristic for English/code (Anthropic, OpenAI). */
export function estimatePromptTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4);
}

export interface SystemPromptTokenBreakdown {
  basePrompt: { chars: number; tokensEstimate: number };
  skillPromptBlock: { chars: number; tokensEstimate: number };
  qaRulesBlock: { chars: number; tokensEstimate: number };
  integrationsBlock: { chars: number; tokensEstimate: number };
  totalChars: number;
  totalTokensEstimate: number;
}

/**
 * Build the same system prompt as getClaudeResponse/getClaudeResponseStream and return
 * character counts and token estimates. Use for monitoring prompt size (e.g. logging or admin).
 */
export function getSystemPromptTokenBreakdown(options: {
  projectType: ProjectType;
  skillPromptBlock?: string;
}): SystemPromptTokenBreakdown {
  const basePrompt =
    options.projectType === "pro" ? SYSTEM_PROMPT_SWIFT : SYSTEM_PROMPT_STANDARD;
  const qaRulesBlock = buildAppliedRulesPromptBlock();
  const skillPromptBlock = options.skillPromptBlock ?? "";
  // Integrations are injected via skills only; no longer appended from INTEGRATIONS.md
  const integrationsBlock = "";

  const baseChars = basePrompt.length;
  const skillChars = skillPromptBlock.length;
  const qaChars = qaRulesBlock.length;
  const intChars = integrationsBlock.length;
  const totalChars = baseChars + skillChars + qaChars + intChars;

  return {
    basePrompt: { chars: baseChars, tokensEstimate: estimatePromptTokens(basePrompt) },
    skillPromptBlock: { chars: skillChars, tokensEstimate: estimatePromptTokens(skillPromptBlock) },
    qaRulesBlock: { chars: qaChars, tokensEstimate: estimatePromptTokens(qaRulesBlock) },
    integrationsBlock: { chars: intChars, tokensEstimate: estimatePromptTokens(integrationsBlock) },
    totalChars,
    totalTokensEstimate: estimatePromptTokens(
      basePrompt + skillPromptBlock + qaRulesBlock + integrationsBlock,
    ),
  };
}

export type ProjectType = "standard" | "pro";

export interface GetClaudeResponseOptions {
  /** Current project files; when present, the user message is treated as a follow-up (e.g. change color, add feature). */
  currentFiles?: Array<{ path: string; content: string }>;
  /** When "pro", use Swift/SwiftUI system prompt; otherwise use Standard (Expo). */
  projectType?: ProjectType;
  /** Extra system-prompt text generated by the skills system (appended after the base prompt). */
  skillPromptBlock?: string;
  /** When set with currentFiles, instructs the model to preserve this app name (do not rename unless user asks). */
  projectName?: string;
}

/**
 * Call Claude and return content + editedFiles (+ parsedFiles when response is valid JSON).
 * If currentFiles is provided, the user message is sent with that context so Claude can apply incremental changes.
 */
export async function getClaudeResponse(
  message: string,
  modelOption?: string,
  options?: GetClaudeResponseOptions
): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const model =
    modelOption && MODEL_MAP[modelOption]
      ? MODEL_MAP[modelOption]
      : DEFAULT_MODEL;

  const client = new Anthropic({ apiKey });

  let userContent: string;
  if (options?.currentFiles && options.currentFiles.length > 0) {
    const preserveName =
      options.projectType === "pro" &&
      options.projectName &&
      options.projectName.trim().length > 0
        ? `The app is already named "${options.projectName.trim()}". Do not change the app name, window title, or navigation title unless the user explicitly asks to rename the app.\n\n`
        : "";
    userContent = `${preserveName}Current project files (apply the user's request to these and output the full updated JSON):\n${JSON.stringify(options.currentFiles)}\n\nUser request: ${message}\n\nInstructions: Apply only what the user asked for. Return the complete updated file(s) with that change applied—full content for each file. Do not return the same content unchanged; the user must see their requested change in the app.`;
  } else {
    userContent = message;
  }

  const basePrompt =
    options?.projectType === "pro" ? SYSTEM_PROMPT_SWIFT : SYSTEM_PROMPT_STANDARD;
  const qaRulesBlock = buildAppliedRulesPromptBlock();
  const loaderSkillBlock = matchSkills(message);
  const skillPromptBlock = [options?.skillPromptBlock, loaderSkillBlock]
    .filter(Boolean)
    .join("\n\n");
  const systemPrompt = basePrompt + skillPromptBlock + qaRulesBlock;

  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    ...(CACHE_CONTROL && { cache_control: CACHE_CONTROL }),
    output_config: { format: jsonSchemaOutputFormat(STRUCTURED_OUTPUT_SCHEMA) },
    messages: [{ role: "user", content: userContent }],
  });

  const stopReason = (response as any)?.stop_reason ?? null;
  if (stopReason === "max_tokens") {
    console.warn(`[claudeAdapter] Claude hit max_tokens (${MAX_TOKENS}). Output was truncated.`);
  }

  try {
    const parsedOutput = (response as unknown as { parsed_output?: unknown }).parsed_output;
    const parsed: StructuredResponse = isStructuredResponse(parsedOutput)
      ? parsedOutput
      : parseStructuredResponse(
          extractTextFromContent((response as any).content)
        );
    const rawUsage = response.usage as unknown as Record<string, number> | undefined;
    const usage =
      rawUsage &&
      typeof rawUsage.input_tokens === "number" &&
      typeof rawUsage.output_tokens === "number"
        ? {
            input_tokens: rawUsage.input_tokens,
            output_tokens: rawUsage.output_tokens,
            cache_creation_input_tokens: rawUsage.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: rawUsage.cache_read_input_tokens ?? 0,
          }
        : undefined;
    return {
      content: parsed.summary,
      editedFiles: parsed.files.map((f) => f.path),
      parsedFiles: parsed.files,
      usage,
    };
  } catch (err) {
    const raw = previewText(extractTextFromContent((response as any).content ?? []));
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse structured output: ${detail}`);
  }
}

/**
 * Stream Claude response and call onProgress with live received character count
 * (client can approximate tokens as chars/4). Returns same shape as getClaudeResponse.
 */
async function getClaudeResponseStream(
  message: string,
  modelOption: string | undefined,
  options: GetClaudeResponseOptions | undefined,
  callbacks: {
    onProgress: (data: { receivedChars: number }) => void;
    onDiscoveredFilePath?: (path: string) => void;
  }
): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const model =
    modelOption && MODEL_MAP[modelOption]
      ? MODEL_MAP[modelOption]
      : DEFAULT_MODEL;

  const client = new Anthropic({ apiKey });

  let userContent: string;
  if (options?.currentFiles && options.currentFiles.length > 0) {
    const preserveName =
      options.projectType === "pro" &&
      options.projectName &&
      options.projectName.trim().length > 0
        ? `The app is already named "${options.projectName.trim()}". Do not change the app name, window title, or navigation title unless the user explicitly asks to rename the app.\n\n`
        : "";
    userContent = `${preserveName}Current project files (apply the user's request to these and output the full updated JSON):\n${JSON.stringify(options.currentFiles)}\n\nUser request: ${message}\n\nInstructions: Apply only what the user asked for. Return the complete updated file(s) with that change applied—full content for each file. Do not return the same content unchanged; the user must see their requested change in the app.`;
  } else {
    userContent = message;
  }

  const basePrompt =
    options?.projectType === "pro" ? SYSTEM_PROMPT_SWIFT : SYSTEM_PROMPT_STANDARD;
  const qaRulesBlock = buildAppliedRulesPromptBlock();
  const loaderSkillBlock = matchSkills(message);
  const skillPromptBlock = [options?.skillPromptBlock, loaderSkillBlock]
    .filter(Boolean)
    .join("\n\n");
  const systemPrompt = basePrompt + skillPromptBlock + qaRulesBlock;

  let lastReported = 0;
  const throttleChars = 80;
  let lastScannedLen = 0;
  const seenPaths = new Set<string>();

  const maybeScanForPaths = (textSnapshot: string) => {
    if (!callbacks.onDiscoveredFilePath) return;
    // Scan only the new tail to avoid quadratic work.
    const start = Math.max(0, lastScannedLen - 5000);
    const tail = textSnapshot.slice(start);
    lastScannedLen = textSnapshot.length;

    const re = /"path"\s*:\s*"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(tail))) {
      const p = m[1];
      if (!p) continue;
      if (options?.projectType === "pro") {
        if (!p.endsWith(".swift")) continue;
      } else {
        // Standard: allow common JS/TS paths too
        const ok = p.endsWith(".js") || p.endsWith(".jsx") || p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".json");
        if (!ok) continue;
      }
      if (seenPaths.has(p)) continue;
      seenPaths.add(p);
      callbacks.onDiscoveredFilePath(p);
    }
  };

  const stream = client.messages
    .stream({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      ...(CACHE_CONTROL && { cache_control: CACHE_CONTROL }),
      output_config: { format: jsonSchemaOutputFormat(STRUCTURED_OUTPUT_SCHEMA) },
      messages: [{ role: "user", content: userContent }],
    })
    .on("text", (_delta: string, textSnapshot: string) => {
      const len = textSnapshot.length;
      // File discovery (best-effort) for live UI updates.
      if (len - lastScannedLen >= 200) {
        maybeScanForPaths(textSnapshot);
      }
      if (len - lastReported >= throttleChars || len < 100) {
        lastReported = len;
        callbacks.onProgress({ receivedChars: len });
      }
    });

  const finalMessage = await stream.finalMessage();
  const stopReason = (finalMessage as any)?.stop_reason ?? null;
  if (stopReason === "max_tokens") {
    console.warn(`[claudeAdapter] Claude hit max_tokens (${MAX_TOKENS}). Output was truncated.`);
  }

  try {
    const parsedOutput = (finalMessage as unknown as { parsed_output?: unknown }).parsed_output;
    const parsed: StructuredResponse = isStructuredResponse(parsedOutput)
      ? parsedOutput
      : parseStructuredResponse(
          extractTextFromContent(
            Array.isArray((finalMessage as any).content) ? (finalMessage as any).content : []
          )
        );
    const rawUsage = finalMessage.usage as unknown as Record<string, number> | undefined;
    const usage =
      rawUsage &&
      typeof rawUsage.input_tokens === "number" &&
      typeof rawUsage.output_tokens === "number"
        ? {
            input_tokens: rawUsage.input_tokens,
            output_tokens: rawUsage.output_tokens,
            cache_creation_input_tokens: rawUsage.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: rawUsage.cache_read_input_tokens ?? 0,
          }
        : undefined;
    return {
      content: parsed.summary,
      editedFiles: parsed.files.map((f) => f.path),
      parsedFiles: parsed.files,
      usage,
    };
  } catch (err) {
    const raw = previewText(
      extractTextFromContent(
        Array.isArray((finalMessage as any).content) ? (finalMessage as any).content : []
      )
    );
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse structured output: ${detail}`);
  }
}

export { getClaudeResponseStream };

function extractTextFromContent(
  content: Array<{ type: string; text?: string }>
): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

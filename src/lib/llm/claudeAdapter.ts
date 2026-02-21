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

/** Map UI model values to Anthropic API model IDs. GPT 5.2 is disabled in the UI until OpenAI is wired. */
const MODEL_MAP: Record<string, string> = {
  "opus-4.6": "claude-opus-4-6",
  "sonnet-4.6": "claude-sonnet-4-6",
  "sonnet-4.5": "claude-sonnet-4-5-20250929",
};

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
// Higher cap reduces truncated/incomplete JSON responses for multi-file builds.
// Sonnet 4.6 max output is 64K tokens; Opus 4.6 max output is 128K tokens.
const MAX_TOKENS = 20000;

const SYSTEM_PROMPT_STANDARD = `You are an expert React Native / Expo developer. You build and modify Expo apps that run in Expo Go. Reply message-by-message: if the user sends a follow-up (e.g. "change the button color to blue"), you will receive the current project files and their request; apply the change and output the full updated JSON. If there are no current files, create a new app from scratch.

Output format: Respond with a single JSON object only. No other text before or after.
Shape: { "summary": "1-2 sentence description of what you built or changed", "files": [ { "path": "App.js", "content": "full JavaScript/JSX source..." }, ... ] }
Rules:
- Use only React Native and Expo APIs that work in Expo Go (no custom native code). Use "expo" and "react-native" imports (e.g. View, Text, StyleSheet, TouchableOpacity, SafeAreaView from "react-native"; StatusBar from "expo-status-bar").
- The main entry file must be "App.js" at the project root, exporting a default React component.
- Paths relative to project root. Include exactly one "App.js" when creating new. No placeholders; complete, runnable code.
- Use JavaScript (not TypeScript). Style with StyleSheet.create. Keep the app simple and single-screen unless the user asks for more.
- Avoid emojis in user-facing UI text (titles, buttons, labels, empty states). Do not use emoji-only icons. Prefer clean typography and spacing. If an icon is truly helpful, use a proper icon library component sparingly; otherwise omit icons.
Produce the full set of files (new or updated) in one reply. No explanations outside the summary.`;

const SYSTEM_PROMPT_SWIFT = `You are an expert Swift and SwiftUI developer. You build native iOS apps that run on iPhone and iPad. Reply message-by-message: if the user sends a follow-up (e.g. "change the button color to blue"), you will receive the current project files and their request; apply the change and output the full updated JSON. If there are no current files, create a new app from scratch.

Output format: Respond with a single JSON object only. No other text before or after.
Shape: { "summary": "1-2 sentence description of what you built or changed", "files": [ { "path": "App.swift", "content": "full Swift source..." }, { "path": "ContentView.swift", "content": "..." }, ... ] }

Rules:
- Use only Swift and SwiftUI. Target iOS 17+ by default. No UIKit unless necessary; prefer SwiftUI APIs.
- The app entry must be "App.swift" at the project root: a struct conforming to App with @main and a WindowGroup that shows the main view (e.g. ContentView()).
- Include at least "App.swift" and "ContentView.swift". Use paths relative to project root. You may add "Models/", "Views/", or "ViewModels/" subfolders (e.g. "Models/Item.swift", "Views/DetailView.swift").
- All file paths must end with ".swift". No placeholders; produce complete, compilable Swift code.
- Use modern Swift: SwiftUI View bodies, @State, @Binding, ObservableObject, or @Observable where appropriate. Prefer native controls (Text, Button, List, Form, NavigationStack, etc.) and system styling.
- SwiftUI correctness: Do not reference \`$viewModel\` as a standalone value. If you need bindings, bind individual properties (e.g. \`$viewModel.isRunning\`) or use iOS 17 Observation with \`@Observable\` + \`@Bindable\` explicitly. Prefer \`@StateObject\` in root views and \`@ObservedObject\` in child views; pass the object itself, not a binding.
- Live Activities: If the user asks for Live Activities, you MUST generate a WidgetKit extension implementation under a folder named exactly "WidgetExtension/" so the exporter can auto-create the extension target. Include at least:
  - "WidgetExtension/WidgetBundle.swift" with an \`@main\` \`WidgetBundle\`
  - "WidgetExtension/LiveActivityWidget.swift" with \`ActivityConfiguration(for: <YourAttributes>.self)\` and (if appropriate) Dynamic Island regions
  - Share the \`ActivityAttributes\` type from your main app (e.g. in "LiveActivity/<Name>Attributes.swift") by importing it and referencing it from the widget extension code.
- Design and UX: Every screen must feel like it was crafted by world-class product designers—modern, polished, and visually outstanding. Apply thoughtful spacing, clear hierarchy, excellent typography (e.g. .font(.title2), .fontWeight(.semibold), scale for readability), and subtle animations or transitions where they add clarity. Avoid generic or template-looking UI; aim for the level of care you would expect from an elite team of thousands of senior UI/UX designers with decades of combined experience. The result should feel like an App Store editor’s choice.
- Avoid emojis in user-facing UI text (titles, buttons, labels, empty states). Do not use emoji-only icons. Prefer clean typography. If an icon is genuinely helpful, prefer SF Symbols via Image(systemName:) and use them sparingly and intentionally (no “icon soup”).
- Keep the app simple and single-window unless the user asks for multiple screens or navigation. No explanations outside the summary.
- If the user asks for Liquid Glass, iOS 26 design, or glass effect: set deployment target to iOS 26 and use the real iOS 26 APIs like \`.glassEffect()\` (and GlassEffectContainer / \`.glassEffectID()\` where appropriate) so the UI matches the new design language.

Produce the full set of files (new or updated) in one reply. No markdown, no code fences around the JSON—only the raw JSON object.`;

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

export type ProjectType = "standard" | "pro";

export interface GetClaudeResponseOptions {
  /** Current project files; when present, the user message is treated as a follow-up (e.g. change color, add feature). */
  currentFiles?: Array<{ path: string; content: string }>;
  /** When "pro", use Swift/SwiftUI system prompt; otherwise use Standard (Expo). */
  projectType?: ProjectType;
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
    userContent = `Current project files (apply the user's request to these and output the full updated JSON):\n${JSON.stringify(options.currentFiles)}\n\nUser request: ${message}`;
  } else {
    userContent = message;
  }

  const systemPrompt =
    options?.projectType === "pro" ? SYSTEM_PROMPT_SWIFT : SYSTEM_PROMPT_STANDARD;

  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    output_config: { format: jsonSchemaOutputFormat(STRUCTURED_OUTPUT_SCHEMA) },
    messages: [{ role: "user", content: userContent }],
  });

  try {
    const parsedOutput = (response as unknown as { parsed_output?: unknown }).parsed_output;
    const parsed: StructuredResponse = isStructuredResponse(parsedOutput)
      ? parsedOutput
      : parseStructuredResponse(
          extractTextFromContent((response as any).content)
        );
    const usage =
      response.usage &&
      typeof response.usage.input_tokens === "number" &&
      typeof response.usage.output_tokens === "number"
        ? {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
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
    const reason = (response as any)?.stop_reason ?? null;
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid structured response (stop_reason=${String(reason)}): ${detail}. raw="${raw}"`);
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
    userContent = `Current project files (apply the user's request to these and output the full updated JSON):\n${JSON.stringify(options.currentFiles)}\n\nUser request: ${message}`;
  } else {
    userContent = message;
  }

  const systemPrompt =
    options?.projectType === "pro" ? SYSTEM_PROMPT_SWIFT : SYSTEM_PROMPT_STANDARD;

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

  try {
    const parsedOutput = (finalMessage as unknown as { parsed_output?: unknown }).parsed_output;
    const parsed: StructuredResponse = isStructuredResponse(parsedOutput)
      ? parsedOutput
      : parseStructuredResponse(
          extractTextFromContent(
            Array.isArray((finalMessage as any).content) ? (finalMessage as any).content : []
          )
        );
    const usage =
      finalMessage.usage &&
      typeof finalMessage.usage.input_tokens === "number" &&
      typeof finalMessage.usage.output_tokens === "number"
        ? {
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
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
    const reason = (finalMessage as any)?.stop_reason ?? null;
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid structured response (stop_reason=${String(reason)}): ${detail}. raw="${raw}"`);
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

/**
 * Ensures live stream events (phases like Starting…, Receiving code…, Writing N files…)
 * are sent by the API and displayed on iOS so the user sees progress during generation.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const STREAM_ROUTE = path.resolve(
  process.cwd(),
  "src/app/api/projects/[id]/message/stream/route.ts"
);
const IOS_CHAT_SERVICE = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Services/ChatService.swift"
);
const IOS_MESSAGE_BUBBLE = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Views/MessageBubbleView.swift"
);
const USE_CHAT = path.resolve(process.cwd(), "src/components/editor/useChat.ts");
const CHAT_MESSAGE_LIST = path.resolve(process.cwd(), "src/components/editor/ChatMessageList.tsx");

describe("Stream API: sends phase events for live status", () => {
  it("stream route sends type: phase with expected phase strings", () => {
    const content = fs.readFileSync(STREAM_ROUTE, "utf8");
    expect(content).toContain('type: "phase"');
    expect(content).toContain('enqueuePhase("starting_request")');
    expect(content).toContain("waiting_for_first_tokens");
    expect(content).toContain("receiving_output");
    expect(content).toContain('enqueuePhase("validating_structured_output")');
    expect(content).toContain('enqueuePhase("saving_files")');
  });

  it("stream route sends type: file with path so client can show actual file names in real time", () => {
    const content = fs.readFileSync(STREAM_ROUTE, "utf8");
    expect(content).toContain('type: "file"');
    expect(content).toContain("onDiscoveredFilePath");
    expect(content).toMatch(/type:\s*["']file["'].*path|path.*type:\s*["']file["']/s);
  });
});

describe("iOS: displays live phases and file progress", () => {
  it("ChatService creates assistant message with initial phase so status shows immediately", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(content).toMatch(/phase:\s*["']starting_request["']/);
    expect(content).toMatch(/phaseLabel.*starting_request|Self\.phaseLabel\(/);
  });

  it("ChatService updates message phase when processing phase events", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(content).toContain('eventType == "phase"');
    expect(content).toMatch(/messages\[idx\]\.phase\s*=/);
    expect(content).toMatch(/messages\[idx\]\.text\s*=.*buildLog/);
  });

  it("ChatService shows actual file names being written (e.g. App.swift, ContentView.swift) for file events", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(content).toContain("stream-files-progress-");
    expect(content).toMatch(/basenames|lastPathComponent|discoveredFiles.*joined|progressText.*filesPart/);
  });

  it("MessageBubbleView shows phase label when streaming", () => {
    const content = fs.readFileSync(IOS_MESSAGE_BUBBLE, "utf8");
    expect(content).toMatch(/message\.isStreaming.*message\.phase|phaseLabel\(phase\)/);
    expect(content).toContain("phaseLabel");
  });

  it("MessageBubbleView phaseLabel maps server phases to user-visible labels", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(content).toContain("Starting…");
    expect(content).toContain("Receiving code…");
    expect(content).toContain("Saving files…");
    expect(content).toContain("Waiting for first tokens…");
  });

  it("MessageBubbleView uses textPrimary for progress-style text so agent words are in line with white messages", () => {
    const content = fs.readFileSync(IOS_MESSAGE_BUBBLE, "utf8");
    expect(content).toMatch(/isProgressStyle|progressStyle/);
    expect(content).toMatch(/progressColor = Forest\.textPrimary|Forest\.textPrimary/);
  });

  it("MessageBubbleView shows one line per file with 'creating' or 'editing' prefix (grey text)", () => {
    const content = fs.readFileSync(IOS_MESSAGE_BUBBLE, "utf8");
    expect(content).toMatch(/creating.*basename|editing.*basename|Text\(.*verb.*basename/);
    expect(content).toMatch(/fileList.*VStack|ForEach.*files/);
    expect(content).toMatch(/lastPathComponent|basename/);
  });
});

describe("Web: shows actual code files and streaming content in real time", () => {
  it("useChat creates stream-file messages with 'Creating' or 'Editing' <basename> so user sees which files are being created or edited", () => {
    const content = fs.readFileSync(USE_CHAT, "utf8");
    expect(content).toContain('event.type === "file"');
    expect(content).toMatch(/Editing.*Creating|verb.*existing|Creating.*basename|content:.*Creating.*path|split\(["']\/["']\)\.pop\(\)/);
  });

  it("useChat progress line includes discovered file names (basenames) in real time", () => {
    const content = fs.readFileSync(USE_CHAT, "utf8");
    expect(content).toMatch(/discoveredFilePaths|basenames.*join|filesStr/);
  });

  it("ChatMessageList uses streamedContent for streaming message so content is shown in real time", () => {
    const content = fs.readFileSync(CHAT_MESSAGE_LIST, "utf8");
    expect(content).toMatch(/streamedContent|displayContent.*streamingThis \? streamedContent/);
  });

  it("StreamTodoCard shows step list with file names (e.g. App.swift) when streaming", () => {
    const content = fs.readFileSync(CHAT_MESSAGE_LIST, "utf8");
    expect(content).toMatch(/StreamTodoCard|getStreamBlock|Creating.*App\.swift|stepDisplayLabel/);
  });

  it("ChatMessageList does not show editedFiles list after Done (elapsedMs set) so files are not duplicated", () => {
    const content = fs.readFileSync(CHAT_MESSAGE_LIST, "utf8");
    expect(content).toMatch(/msg\.elapsedMs\s*==\s*null/);
    expect(content).toMatch(/editedFiles.*length.*streamingComplete.*elapsedMs/);
  });
});

describe("Web and iOS: Cursor-style stream behavior (both platforms)", () => {
  it("Web: Cursor-style phase labels (Planning next moves…, Thinking…, Finalizing, Done) and step animation", () => {
    const useChat = fs.readFileSync(USE_CHAT, "utf8");
    expect(useChat).toMatch(/Planning next moves|starting_request|Thinking|Finalizing|done_preview_updating.*Done/);
    const chatList = fs.readFileSync(CHAT_MESSAGE_LIST, "utf8");
    expect(chatList).toContain("animate-chat-step-in");
    expect(chatList).toMatch(/StreamTodoCard|getStreamBlock|isStepLine|stepStagger/);
  });

  it("Web: Cursor-style step dot (accent + pulse) and staggered step entrance", () => {
    const chatList = fs.readFileSync(CHAT_MESSAGE_LIST, "utf8");
    expect(chatList).toContain("chat-step-dot");
    expect(chatList).toMatch(/stepStagger.*assistantIndex\s*\*\s*50/);
    const globals = fs.readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain("chat-step-dot");
    expect(globals).toMatch(/chat-step-dot-pulse|\.chat-step-dot/);
    expect(globals).toMatch(/button-primary-bg|--button-primary-bg/);
  });

  it("iOS: phase labels and creating/editing file list (Starting…, Receiving code…, Validating output…, creating or editing basename)", () => {
    const chatService = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(chatService).toContain("Starting…");
    expect(chatService).toContain("Receiving code…");
    expect(chatService).toContain("Validating output…");
    expect(chatService).toContain("Saving files…");
    const bubble = fs.readFileSync(IOS_MESSAGE_BUBBLE, "utf8");
    expect(bubble).toMatch(/creating.*basename|editing.*basename|Text\(.*verb.*basename/);
    expect(bubble).toMatch(/fileList.*VStack|ForEach.*files/);
  });

  it("both platforms receive same stream API (phase + file events) so behavior stays in sync", () => {
    const route = fs.readFileSync(STREAM_ROUTE, "utf8");
    expect(route).toContain('enqueuePhase("starting_request")');
    expect(route).toContain('enqueuePhase("receiving_output")');
    expect(route).toContain('type: "file"');
    expect(route).toMatch(/onDiscoveredFilePath|discoveredFilePath/);
  });
});

describe("Live stream visible and files in chronological order", () => {
  it("iOS stream-files-progress message has editedFiles so it shows as full bubble (live stream)", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(content).toMatch(/editedFiles:\s*discoveredFiles\.isEmpty\s*\?\s*nil\s*:\s*discoveredFiles/);
    expect(content).toMatch(/progressMsg.*editedFiles|ChatMessage\([^)]*editedFiles/);
  });

  it("iOS final message uses discoveredFiles order for editedFiles (chronological top-down)", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(content).toMatch(/fileListOrder|discoveredFiles\.isEmpty \? editedFiles : discoveredFiles/);
  });

  it("Web orders editedFiles by discoveredFilePaths so list is chronological", () => {
    const content = fs.readFileSync(USE_CHAT, "utf8");
    expect(content).toMatch(/discoveredFilePaths\.length > 0/);
    expect(content).toMatch(/discoveredFilePaths\.filter.*editedFiles\.includes|editedFiles\.filter.*!discoveredFilePaths\.includes/);
  });
});

describe("Agent message alignment: step lines and white messages in line on web and iOS", () => {
  it("Web: step lines and assistant summary use same box and primary text color so agent words align with white messages", () => {
    const chatList = fs.readFileSync(CHAT_MESSAGE_LIST, "utf8");
    expect(chatList).toContain("chat-accent-full-box-v2");
    expect(chatList).toContain("assistantBoxClass");
    expect(chatList).toMatch(/isReasoning \|\| isStreamFile/);
    expect(chatList).toMatch(/text-\[var\(--text-primary\)\].*leading-relaxed relative/);
  });

  it("iOS: phase label and build log use textPrimary so agent words are in line with white agent messages", () => {
    const bubble = fs.readFileSync(IOS_MESSAGE_BUBBLE, "utf8");
    expect(bubble).toMatch(/phaseLabel.*Forest\.textPrimary|\.foregroundColor\(Forest\.textPrimary\)/);
    expect(bubble).toMatch(/progressColor = Forest\.textPrimary|progressColor.*textPrimary/);
  });
});

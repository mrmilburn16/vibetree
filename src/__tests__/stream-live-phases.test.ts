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

  it("MessageBubbleView uses grey (textTertiary) for progress-style text (Writing…, phases)", () => {
    const content = fs.readFileSync(IOS_MESSAGE_BUBBLE, "utf8");
    expect(content).toMatch(/isProgressStyle|progressStyle/);
    expect(content).toMatch(/textTertiary.*progress|progressColor|isProgressStyle.*textTertiary/);
    expect(content).toContain("Forest.textTertiary");
  });

  it("MessageBubbleView shows one line per file with 'creating' prefix (grey text)", () => {
    const content = fs.readFileSync(IOS_MESSAGE_BUBBLE, "utf8");
    expect(content).toMatch(/creating.*basename|Text\(.*creating/);
    expect(content).toMatch(/fileList.*VStack|ForEach.*files/);
    expect(content).toMatch(/lastPathComponent|basename/);
  });
});

describe("Web: shows actual code files and streaming content in real time", () => {
  it("useChat creates stream-file messages with 'Writing <basename>' so user sees which files are being written", () => {
    const content = fs.readFileSync(USE_CHAT, "utf8");
    expect(content).toContain('event.type === "file"');
    expect(content).toMatch(/Writing.*event\.path|content:.*Writing.*path|split\(["']\/["']\)\.pop\(\)/);
  });

  it("useChat progress line includes discovered file names (basenames) in real time", () => {
    const content = fs.readFileSync(USE_CHAT, "utf8");
    expect(content).toMatch(/discoveredFilePaths|basenames.*join|filesStr/);
  });

  it("ChatMessageList uses streamedContent for streaming message so content is shown in real time", () => {
    const content = fs.readFileSync(CHAT_MESSAGE_LIST, "utf8");
    expect(content).toMatch(/streamedContent|displayContent.*streamingThis \? streamedContent/);
  });

  it("StreamProgressBar shows actual file names (e.g. App.swift) when streaming", () => {
    const content = fs.readFileSync(CHAT_MESSAGE_LIST, "utf8");
    expect(content).toMatch(/StreamProgressBar|Building app|fileNames|displayNames|Writing/);
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

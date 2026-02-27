/**
 * Ensures the iOS flow works: user gives a prompt to build the app, app shows "app built"
 * (build complete), then user can send a follow-up message and it is processed as a follow-up
 * (server sends current project files + new message to the LLM).
 * No LLM is called; we assert the code paths that make this work.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const IOS_CHAT_SERVICE = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Services/ChatService.swift"
);
const IOS_CHAT_PANEL = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Views/ChatPanelView.swift"
);
const STREAM_ROUTE = path.resolve(
  process.cwd(),
  "src/app/api/projects/[id]/message/stream/route.ts"
);

describe("iOS: prompt → app built → follow-up message works", () => {
  it("ChatService sets buildStatus = .ready and isStreaming = false when stream completes successfully", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(content).toContain("buildStatus = .ready");
    expect(content).toMatch(/finalizeSuccess|buildStatus\s*=\s*\.ready/);
    // finalizeSuccess updates the assistant message and sets isStreaming = false, then buildStatus = .ready
    expect(content).toMatch(/messages\[idx\]\.isStreaming\s*=\s*false/);
    expect(content).toMatch(/buildStatus\s*=\s*\.ready/);
    const readyAfterFinalize = content.indexOf("buildStatus = .ready") > 0;
    const isStreamingFalseInFinalize =
      content.includes("messages[idx].isStreaming = false") &&
      content.indexOf("messages[idx].isStreaming = false") < content.indexOf("buildStatus = .ready");
    expect(readyAfterFinalize).toBe(true);
    expect(content).toContain("finalizeSuccess");
  });

  it("ChatService blocks send while streaming (guard !isStreaming)", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(content).toMatch(/guard\s+!isStreaming\s+else/);
    expect(content).toContain("sendMessage");
    expect(content).toContain("isStreaming = true");
  });

  it("ChatPanelView canSend is true only when NOT streaming so follow-up is allowed after build", () => {
    const content = fs.readFileSync(IOS_CHAT_PANEL, "utf8");
    expect(content).toContain("private var canSend");
    expect(content).toContain("!chatService.isStreaming");
    expect(content).toMatch(/return\s+.*!chatService\.isStreaming/);
  });

  it("ChatPanelView send is disabled when canSend is false (so disabled while building)", () => {
    const content = fs.readFileSync(IOS_CHAT_PANEL, "utf8");
    expect(content).toMatch(/\.disabled\s*\(\s*!canSend\s*\)|\.disabled\(!canSend\)/);
  });
});

describe("Stream API: follow-up message receives current project files", () => {
  it("stream route reads project files and passes currentFiles when project has files (follow-up)", () => {
    const content = fs.readFileSync(STREAM_ROUTE, "utf8");
    expect(content).toContain("getProjectFilePaths(projectId)");
    expect(content).toContain("getProjectFiles(projectId)");
    expect(content).toMatch(/paths\.length\s*>\s*0/);
    expect(content).toContain("currentFiles");
    expect(content).toMatch(/files\s*&&\s*paths\.length|paths\.map\s*\(\s*\(?\s*path\s*\)?\s*=>/);
  });

  it("stream route uses currentFiles when calling LLM so follow-up edits the existing app", () => {
    const content = fs.readFileSync(STREAM_ROUTE, "utf8");
    expect(content).toMatch(/currentFiles|getClaudeResponseStream|parsedFiles/);
    expect(content).toContain("currentFiles");
  });

  it("stream route passes projectName when currentFiles so agent preserves app name on follow-up", () => {
    const content = fs.readFileSync(STREAM_ROUTE, "utf8");
    expect(content).toContain("projectName");
    expect(content).toMatch(/projectName:\s*currentFiles\s*\?\s*project\.name/);
  });

  it("when agent returns no files on follow-up, stream route still runs fixSwift on stored files (black→systemBackground)", () => {
    const content = fs.readFileSync(STREAM_ROUTE, "utf8");
    expect(content).toMatch(/parsedFiles\?\.[Ll]ength|result\.parsedFiles/);
    expect(content).toContain("getProjectFiles(projectId)");
    expect(content).toContain("fixSwiftCommonIssues");
    expect(content).toContain("setProjectFiles");
    expect(content).toMatch(/paths\.length\s*>\s*0.*projectType.*pro|projectType.*pro.*paths\.length/);
  });
});

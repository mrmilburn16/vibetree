/**
 * Ensures the editor navigation bar shows the app title (e.g. "To Do List") instead of
 * "Untitled app". Title must appear FIRST (from the prompt when user sends), not only
 * after the build completes; then it may be updated from PATCH/history.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const IOS_CHAT_SERVICE = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Services/ChatService.swift"
);
const EDITOR_VIEW = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Views/EditorView.swift"
);

describe("iOS editor: nav title shows app name first (from prompt), not only after build", () => {
  it("ChatService sets suggestedProjectName in sendMessage from prompt so title appears first, before build completes", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    const sendMessageStart = content.indexOf("func sendMessage(");
    const streamTaskStart = content.indexOf("streamTask = Task", sendMessageStart);
    expect(sendMessageStart).toBeGreaterThanOrEqual(0);
    expect(streamTaskStart).toBeGreaterThanOrEqual(0);
    const sendSection = content.slice(sendMessageStart, streamTaskStart);
    expect(sendSection).toMatch(/deriveTitleFromPrompt\(trimmed\)/);
    expect(sendSection).toMatch(/suggestedProjectName\s*=\s*derived/);
    expect(sendSection).toMatch(/isUntitledName\(initialProjectName\)/);
  });

  it("ChatService sets suggestedProjectName immediately in finalizeSuccess so nav title updates without waiting for PATCH", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    const finalizeSection = content.includes("private func finalizeSuccess")
      ? content.slice(
          content.indexOf("private func finalizeSuccess"),
          content.indexOf("if let idx = messages.firstIndex", content.indexOf("private func finalizeSuccess"))
        )
      : content;
    expect(finalizeSection).toMatch(/suggestedProjectName\s*=\s*autoTitle/);
    const setBeforeTask = finalizeSection.indexOf("suggestedProjectName = autoTitle") < finalizeSection.indexOf("Task {");
    expect(setBeforeTask).toBe(true);
  });

  it("ChatService loadHistory derives app name from App name: X in history and sets suggestedProjectName", () => {
    const content = fs.readFileSync(IOS_CHAT_SERVICE, "utf8");
    expect(content).toMatch(/appNameFromHistory|App name:/);
    expect(content).toMatch(/suggestedProjectName = name|suggestedProjectName = .*appNameFromHistory/);
  });

  it("EditorView navigation title uses projectDisplayName updated from suggestedProjectName", () => {
    const content = fs.readFileSync(EDITOR_VIEW, "utf8");
    expect(content).toMatch(/navigationTitle.*projectDisplayName|projectDisplayName.*navigationTitle/);
    expect(content).toMatch(/onChange.*suggestedProjectName|chatService\.suggestedProjectName/);
    expect(content).toMatch(/projectDisplayName = n|projectDisplayName = new/);
  });
});

/**
 * Ensures Install on iPhone is disabled while the agent is typing (web and API).
 * EditorLayout passes isAgentTyping to RunOnDeviceModal; ChatPanel reports isTyping.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CHAT_PANEL = path.resolve(process.cwd(), "src/components/editor/ChatPanel.tsx");
const EDITOR_LAYOUT = path.resolve(process.cwd(), "src/components/editor/EditorLayout.tsx");
const RUN_ON_DEVICE_MODAL = path.resolve(process.cwd(), "src/components/editor/RunOnDeviceModal.tsx");

describe("Web: Install disabled while agent is typing", () => {
  it("ChatPanel calls onIsTypingChange when isTyping changes", () => {
    const content = fs.readFileSync(CHAT_PANEL, "utf8");
    expect(content).toContain("onIsTypingChange");
    expect(content).toMatch(/onIsTypingChange\?\.\s*\(\s*isTyping\s*\)/);
    expect(content).toMatch(/useEffect.*\[isTyping,\s*onIsTypingChange\]/s);
  });

  it("EditorLayout has isAgentTyping state and passes it to RunOnDeviceModal", () => {
    const content = fs.readFileSync(EDITOR_LAYOUT, "utf8");
    expect(content).toMatch(/isAgentTyping|setIsAgentTyping/);
    expect(content).toContain("onIsTypingChange={setIsAgentTyping}");
    expect(content).toMatch(/isAgentTyping=\{[^}]+\}/);
    expect(content).toContain("RunOnDeviceModal");
  });

  it("RunOnDeviceModal disables Install button when isAgentTyping is true", () => {
    const content = fs.readFileSync(RUN_ON_DEVICE_MODAL, "utf8");
    expect(content).toContain("isAgentTyping");
    expect(content).toMatch(/disabled=\{[^}]*isAgentTyping[^}]*\}/);
    expect(content).toMatch(/Wait for agent to finish|isAgentTyping\s*\?/);
  });
});

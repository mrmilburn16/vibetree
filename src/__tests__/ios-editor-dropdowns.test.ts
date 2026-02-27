/**
 * Ensures iOS editor (ChatPanelView) dropdowns are centered and open inline,
 * and that tapping them triggers haptic feedback.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CHAT_PANEL = path.resolve(
  process.cwd(),
  "ios/VibeTreeCompanion/VibeTreeCompanion/Views/ChatPanelView.swift"
);

function read(): string {
  return fs.readFileSync(CHAT_PANEL, "utf8");
}

describe("iOS editor dropdowns: centered and haptic", () => {
  it("topToolbar centers the two dropdowns with Spacer after llmMenu", () => {
    const content = read();
    // Layout: buildStatus, Spacer, projectTypeMenu, llmMenu, Spacer, [cancel when streaming]
    expect(content).toMatch(/projectTypeMenu\s*\n\s*llmMenu\s*\n\s*Spacer/);
    expect(content).toContain("Spacer(minLength: Forest.space2)");
  });

  it("LLM overlay is centered (HStack with Spacers) so open dropdown is inline with buttons", () => {
    const content = read();
    expect(content).toMatch(/ZStack\(alignment:\s*\.top\)/);
    expect(content).toContain("llmDropdownList");
    expect(content).toMatch(/HStack\(spacing: 0\)[\s\S]*?Spacer[\s\S]*?llmDropdownList[\s\S]*?Spacer/);
  });

  it("dropdown open triggers haptic (triggerDropdownHaptic / HapticService.light)", () => {
    const content = read();
    expect(content).toMatch(/triggerDropdownHaptic|HapticService\.light/);
    expect(content).toMatch(/simultaneousGesture.*TapGesture.*triggerDropdownHaptic|triggerDropdownHaptic.*isLLMMenuOpen\.toggle/);
  });

  it("project type option tap triggers HapticService.selection (Pro/Standard)", () => {
    const content = read();
    expect(content).toMatch(/HapticService\.selection\(\)/);
    const projectTypeSection = content.slice(
      content.indexOf("ForEach(ProjectType.dropdownOrder"),
      content.indexOf("llmMenu:")
    );
    expect(projectTypeSection).toMatch(/HapticService\.selection\(\)/);
  });

  it("LLM option tap triggers HapticService.selection only for active options (!option.disabled)", () => {
    const content = read();
    const llmSection = content.slice(
      content.indexOf("private var llmDropdownList"),
      content.indexOf("// MARK: - Streaming Progress Bar")
    );
    expect(llmSection).toMatch(/if !option\.disabled/);
    expect(llmSection).toMatch(/HapticService\.selection\(\)/);
  });

  it("project type collapsed tap triggers haptic (simultaneousGesture TapGesture triggerDropdownHaptic)", () => {
    const content = read();
    const menuSection = content.slice(
      content.indexOf("private var projectTypeMenu"),
      content.indexOf("private var llmMenu:")
    );
    expect(menuSection).toMatch(/simultaneousGesture.*TapGesture.*triggerDropdownHaptic/);
    expect(menuSection).toMatch(/Pro \(Swift\)|Standard \(Expo\)/);
  });

  it("LLM dropdown width matches collapsed trigger (dropdownTriggerWidth, not full screen)", () => {
    const content = read();
    expect(content).toContain("dropdownTriggerWidth");
    const llmDropdownSection = content.slice(
      content.indexOf("private var llmDropdownList"),
      content.indexOf("// MARK: - Streaming Progress Bar")
    );
    expect(llmDropdownSection).toMatch(/frame.*dropdownTriggerWidth|maxWidth:.*dropdownTriggerWidth/);
  });
});

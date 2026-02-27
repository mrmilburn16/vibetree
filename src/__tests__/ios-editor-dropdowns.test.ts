/**
 * Ensures iOS editor (ChatPanelView) dropdowns open inline under the trigger
 * (same width, right under the current model view) and haptic feedback on tap.
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

describe("iOS editor dropdowns: inline under trigger and haptic", () => {
  it("topToolbar has projectTypeMenu and LLM trigger (ZStack with llmMenu) with Spacer", () => {
    const content = read();
    expect(content).toMatch(/projectTypeMenu/);
    expect(content).toMatch(/llmMenu/);
    expect(content).toContain("Spacer(minLength: Forest.space2)");
  });

  it("LLM dropdown is in body overlay with trigger frame so it draws on top and matches trigger width", () => {
    const content = read();
    expect(content).toMatch(/LLMTriggerFrameKey|llmTriggerFrame/);
    expect(content).toContain("llmDropdownList(width:");
    expect(content).toMatch(/zIndex\(1000\)/);
    expect(content).toMatch(/frame.*dropdownTriggerWidth|maxWidth:.*dropdownTriggerWidth|width:.*llmTriggerFrame\.width/);
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
      content.indexOf("private var llmMenu")
    );
    expect(projectTypeSection).toMatch(/HapticService\.selection\(\)/);
  });

  it("LLM option tap triggers HapticService.selection only for active options (!option.disabled)", () => {
    const content = read();
    const rowSection = content.slice(
      content.indexOf("private func llmDropdownRow"),
      content.indexOf("private func llmDropdownList") + 1
    );
    expect(rowSection).toMatch(/if !option\.disabled/);
    expect(rowSection).toMatch(/HapticService\.selection\(\)/);
  });

  it("project type collapsed tap triggers haptic (simultaneousGesture TapGesture triggerDropdownHaptic)", () => {
    const content = read();
    const menuSection = content.slice(
      content.indexOf("private var projectTypeMenu"),
      content.indexOf("private var llmMenu")
    );
    expect(menuSection).toMatch(/simultaneousGesture.*TapGesture.*triggerDropdownHaptic/);
    expect(menuSection).toMatch(/Pro \(Swift\)|Standard \(Expo\)/);
  });

  it("LLM dropdown width matches collapsed trigger (dropdownTriggerWidth or llmTriggerFrame.width)", () => {
    const content = read();
    expect(content).toContain("dropdownTriggerWidth");
    const llmDropdownSection = content.slice(
      content.indexOf("private func llmDropdownList"),
      content.indexOf("// MARK: - Streaming Progress Bar")
    );
    expect(llmDropdownSection).toMatch(/frame.*width:.*w|dropdownTriggerWidth|llmTriggerFrame\.width/);
  });
});

describe("iOS chat panel: scroll not blocked after follow-up (LLM overlay closes)", () => {
  it("sendIfPossible closes LLM menu so overlay does not block message list scroll", () => {
    const content = read();
    expect(content).toContain("sendIfPossible");
    expect(content).toMatch(/isLLMMenuOpen\s*=\s*false/);
    const sendSection = content.slice(
      content.indexOf("private func sendIfPossible"),
      content.indexOf("guard canSend") + 200
    );
    expect(sendSection).toMatch(/isLLMMenuOpen\s*=\s*false/);
  });

  it("onChange(isStreaming) closes LLM menu when streaming starts so overlay cannot block scroll", () => {
    const content = read();
    expect(content).toMatch(/onChange.*chatService\.isStreaming|onChange.*isStreaming/);
    expect(content).toMatch(/isStreaming.*isLLMMenuOpen\s*=\s*false|isLLMMenuOpen\s*=\s*false.*isStreaming/);
  });
});

describe("iOS chat input: select all, delete, copy, paste work without crashing", () => {
  it("TextField uses standard binding and has animation(nil) so select-all+delete and paste do not freeze", () => {
    const content = read();
    expect(content).toMatch(/TextField.*text:\s*\$\s*inputText/);
    expect(content).toContain('animation(nil, value: inputText)');
    const inputSection = content.slice(
      content.indexOf('private var inputPill'),
      content.indexOf('private var sendButton')
    );
    expect(inputSection).toMatch(/\.animation\s*\(\s*nil\s*,\s*value:\s*inputText\s*\)/);
  });

  it("Clear button is always in hierarchy (disabled when empty) so select-all+delete does not remove a view", () => {
    const content = read();
    const inputSection = content.slice(
      content.indexOf('private var inputPill'),
      content.indexOf('private var sendButton')
    );
    expect(inputSection).toContain('inputText = ""');
    expect(inputSection).toMatch(/\.disabled\s*\(\s*inputText\.isEmpty\s*\|\|\s*blockSendUntilPreflight\s*\)/);
    expect(inputSection).not.toMatch(/if\s+!\s*inputText\.isEmpty\s*\{\s*Button/);
  });

  it("No custom contextMenu on TextField so system Select All / Copy / Paste are available", () => {
    const content = read();
    const textFieldStart = content.indexOf('TextField("Describe your app');
    const textFieldEnd = content.indexOf('sendButton', textFieldStart);
    const textFieldBlock = content.slice(textFieldStart, textFieldEnd);
    expect(textFieldBlock).not.toMatch(/\.contextMenu\s*\(/);
  });

  it("inputText is @State so updates are main-actor safe", () => {
    const content = read();
    expect(content).toMatch(/@State\s+private\s+var\s+inputText\s*=\s*""/);
  });

  it("onChange caps inputText at maxChars so large paste does not hang", () => {
    const content = read();
    expect(content).toContain("maxChars");
    expect(content).toMatch(/onChange\s*\(\s*of:\s*inputText\s*\)/);
    expect(content).toMatch(/newValue\.count\s*>\s*maxChars|inputText\s*=\s*String\s*\(\s*newValue\.prefix/);
  });
});

describe("iOS Install button: disabled while agent is working", () => {
  const EDITOR_VIEW = path.resolve(process.cwd(), "ios/VibeTreeCompanion/VibeTreeCompanion/Views/EditorView.swift");
  const PRO_BUILD_PREVIEW = path.resolve(process.cwd(), "ios/VibeTreeCompanion/VibeTreeCompanion/Views/ProBuildPreviewView.swift");
  const INSTALL_SHEET = path.resolve(process.cwd(), "ios/VibeTreeCompanion/VibeTreeCompanion/Views/InstallOnDeviceSheet.swift");

  it("EditorView canInstall is true only when buildStatus is ready AND not streaming", () => {
    const content = fs.readFileSync(EDITOR_VIEW, "utf8");
    expect(content).toMatch(/canInstall|buildStatus.*\.ready/);
    expect(content).toMatch(/!chatService\.isStreaming|isStreaming.*false/);
    expect(content).toContain("return !chatService.isStreaming");
  });

  it("ProBuildPreviewView Install on Device button is disabled when installPolling or isStreaming", () => {
    const content = fs.readFileSync(PRO_BUILD_PREVIEW, "utf8");
    expect(content).toMatch(/\.disabled\s*\(\s*installPolling\s*\|\|\s*chatService\.isStreaming\s*\)/);
  });

  it("InstallOnDeviceSheet receives isAgentWorking and disables Install when true", () => {
    const content = fs.readFileSync(INSTALL_SHEET, "utf8");
    expect(content).toContain("isAgentWorking");
    expect(content).toMatch(/\.disabled\s*\(\s*isAgentWorking\s*\)/);
    expect(content).toMatch(/Wait for agent to finish|isAgentWorking \?/);
  });
});

describe("Web editor dropdown (DropdownSelect): inline under trigger, same width", () => {
  const DROPDOWN_SELECT = path.resolve(process.cwd(), "src/components/ui/DropdownSelect.tsx");

  it("open list has w-full and left-0 right-0 so it matches trigger width and sits directly under it", () => {
    const content = fs.readFileSync(DROPDOWN_SELECT, "utf8");
    expect(content).toContain("left-0");
    expect(content).toContain("right-0");
    expect(content).toContain("w-full");
    expect(content).toMatch(/min-w-\[160px\]/);
  });
});

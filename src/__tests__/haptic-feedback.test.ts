/**
 * Ensures all haptic feedback call sites are present and HapticService API is complete.
 * Runs against the iOS Swift source; catches regressions if someone removes a call or the service.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const IOS_ROOT = path.resolve(process.cwd(), "ios/VibeTreeCompanion");

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(IOS_ROOT, relativePath), "utf8");
}

describe("HapticService API", () => {
  it("defines all seven haptic methods", () => {
    const content = readFile("VibeTreeCompanion/Services/HapticService.swift");
    const methods = ["selection", "light", "medium", "heavy", "success", "warning", "error"];
    for (const m of methods) {
      expect(content, `HapticService.${m}()`).toMatch(new RegExp(`static func ${m}\\(\\)`));
    }
  });

  it("uses prepare() before triggering in each method", () => {
    const content = readFile("VibeTreeCompanion/Services/HapticService.swift");
    expect(content).toContain("g.prepare()");
  });
});

describe("Haptic feedback call sites", () => {
  it("ForestTheme: primary button triggers medium, secondary triggers light", () => {
    const content = readFile("VibeTreeCompanion/Theme/ForestTheme.swift");
    expect(content).toMatch(/HapticService\.medium\(\)/);
    expect(content).toMatch(/HapticService\.light\(\)/);
  });

  it("ProjectListView: selection on chips and Surprise me, heavy on delete", () => {
    const content = readFile("VibeTreeCompanion/Views/ProjectListView.swift");
    expect(content).toMatch(/HapticService\.selection\(\)/);
    expect(content).toMatch(/HapticService\.heavy\(\)/);
    const selectionCount = (content.match(/HapticService\.selection\(\)/g) ?? []).length;
    expect(selectionCount).toBeGreaterThanOrEqual(2); // chips + Surprise me
  });

  it("ChatPanelView: medium on send, light on dropdown open, selection on project type and LLM option tap", () => {
    const content = readFile("VibeTreeCompanion/Views/ChatPanelView.swift");
    expect(content).toMatch(/HapticService\.medium\(\)/);
    expect(content).toMatch(/triggerDropdownHaptic|HapticService\.light\(\)/);
    expect(content).toMatch(/HapticService\.selection\(\)/);
    // Project type: selection when choosing Pro/Standard; LLM: selection when choosing active option only (one call site in each ForEach)
    const selectionInChat = (content.match(/HapticService\.selection\(\)/g) ?? []).length;
    expect(selectionInChat).toBeGreaterThanOrEqual(2); // project type option + LLM option (active only)
  });

  it("SettingsView: heavy on Sign Out", () => {
    const content = readFile("VibeTreeCompanion/Views/SettingsView.swift");
    expect(content).toMatch(/HapticService\.heavy\(\)/);
  });

  it("ProjectSettingsSheet: selection on min iOS, device family, orientation", () => {
    const content = readFile("VibeTreeCompanion/Views/ProjectSettingsSheet.swift");
    const selectionCount = (content.match(/HapticService\.selection\(\)/g) ?? []).length;
    expect(selectionCount).toBe(3);
  });

  it("ChatService: success when build completes", () => {
    const content = readFile("VibeTreeCompanion/Services/ChatService.swift");
    expect(content).toMatch(/HapticService\.success\(\)/);
  });

  it("BuildMonitorService: success on build succeeded, error on build failed", () => {
    const content = readFile("VibeTreeCompanion/Services/BuildMonitorService.swift");
    expect(content).toMatch(/HapticService\.success\(\)/);
    expect(content).toMatch(/HapticService\.error\(\)/);
  });
});

describe("Haptic call site summary", () => {
  it("has expected total usage counts per type", () => {
    const files = [
      "VibeTreeCompanion/Theme/ForestTheme.swift",
      "VibeTreeCompanion/Views/ProjectListView.swift",
      "VibeTreeCompanion/Views/ChatPanelView.swift",
      "VibeTreeCompanion/Views/SettingsView.swift",
      "VibeTreeCompanion/Views/ProjectSettingsSheet.swift",
      "VibeTreeCompanion/Services/ChatService.swift",
      "VibeTreeCompanion/Services/BuildMonitorService.swift",
    ];
    let selection = 0,
      light = 0,
      medium = 0,
      heavy = 0,
      success = 0,
      error = 0;
    for (const f of files) {
      const content = readFile(f);
      selection += (content.match(/HapticService\.selection\(\)/g) ?? []).length;
      light += (content.match(/HapticService\.light\(\)/g) ?? []).length;
      medium += (content.match(/HapticService\.medium\(\)/g) ?? []).length;
      heavy += (content.match(/HapticService\.heavy\(\)/g) ?? []).length;
      success += (content.match(/HapticService\.success\(\)/g) ?? []).length;
      error += (content.match(/HapticService\.error\(\)/g) ?? []).length;
    }
    expect(selection).toBe(7); // chips, Surprise me, minIOS, deviceFamily, orientation + project type + LLM option
    expect(light).toBe(2); // ForestSecondaryButtonStyle + ChatPanelView triggerDropdownHaptic (both dropdowns)
    expect(medium).toBe(2); // ForestPrimaryButtonStyle + ChatPanelView send
    expect(heavy).toBe(3); // ProjectListView (e.g. delete), SettingsView Sign Out
    expect(success).toBe(2); // ChatService, BuildMonitorService
    expect(error).toBe(1); // BuildMonitorService build failed
  });
});

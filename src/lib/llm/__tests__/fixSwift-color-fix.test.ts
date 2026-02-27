/**
 * Ensures ColorColorColor / ColorColor (and lowercase) are fixed so builds succeed.
 * See: cannot find 'ColorColorColor' in scope.
 */
import { describe, it, expect } from "vitest";
import { fixSwiftCommonIssues, applyRuleBasedFixesFromBuild } from "../fixSwift";

describe("fixSwift: ColorColorColor and ColorColor fix", () => {
  it("fixSwiftCommonIssues replaces ColorColorColor with Color", () => {
    const files = [
      { path: "ContentView.swift", content: "Text(\"Hi\").foregroundStyle(ColorColorColor.primary)" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("Color.primary");
    expect(result[0].content).not.toContain("ColorColorColor");
  });

  it("fixSwiftCommonIssues replaces ColorColor with Color", () => {
    const files = [
      { path: "ContentView.swift", content: "ColorColor.blue" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toBe("Color.blue");
  });

  it("fixSwiftCommonIssues replaces all occurrences of ColorColorColor in a file", () => {
    const content = `
      .foregroundStyle(ColorColorColor.primary)
      .background(ColorColorColor(.systemBackground))
      .tint(ColorColorColor.accentColor)
    `;
    const files = [{ path: "ContentView.swift", content }];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).not.toMatch(/\bColorColorColor\b/);
    expect(result[0].content).toContain("Color.primary");
    expect(result[0].content).toContain("Color(.systemBackground)");
    expect(result[0].content).toContain("Color.accentColor");
  });

  it("fixSwiftCommonIssues fixes lowercase colorcolorcolor and colorcolor", () => {
    const files = [
      { path: "A.swift", content: "colorcolorcolor.primary and colorcolor.blue" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("Color.primary");
    expect(result[0].content).toContain("Color.blue");
    expect(result[0].content).not.toMatch(/\bcolorcolorcolor\b/);
    expect(result[0].content).not.toMatch(/\bcolorcolor\b/);
  });

  it("applyRuleBasedFixesFromBuild replaces ColorColorColor when compiler reports it", () => {
    const files = [
      { path: "ContentView.swift", content: "ColorColorColor.primary" },
    ];
    const errors = ["ContentView.swift:33:17: error: cannot find 'ColorColorColor' in scope"];
    const { files: result, changed } = applyRuleBasedFixesFromBuild(files, errors, []);
    expect(changed).toBe(true);
    expect(result[0].content).toContain("Color.primary");
    expect(result[0].content).not.toContain("ColorColorColor");
  });
});

describe("fixSwift: black background → system background", () => {
  it("replaces .background(Color.black) with .background(Color(.systemBackground))", () => {
    const files = [
      { path: "ContentView.swift", content: "var body: some View { VStack { }.background(Color.black) }" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain(".background(Color(.systemBackground))");
    expect(result[0].content).not.toContain(".background(Color.black)");
  });

  it("replaces .background { Color.black } with .background { Color(.systemBackground) }", () => {
    const files = [
      { path: "ContentView.swift", content: "VStack { }.background { Color.black }" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain(".background { Color(.systemBackground) }");
    expect(result[0].content).not.toContain("Color.black");
  });

  it("replaces ZStack { Color.black with ZStack { Color(.systemBackground) (full-screen black)", () => {
    const files = [
      { path: "ContentView.swift", content: "var body: some View { ZStack { Color.black\n.ignoresSafeArea()\nText(\"Hi\") } }" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("ZStack { Color(.systemBackground)");
    expect(result[0].content).toContain(".ignoresSafeArea()");
    expect(result[0].content).not.toMatch(/ZStack\s*\{\s*Color\.black\b/);
  });

  it("replaces Color.black.ignoresSafeArea() with Color(.systemBackground).ignoresSafeArea()", () => {
    const files = [
      { path: "ContentView.swift", content: "Color.black.ignoresSafeArea()" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("Color(.systemBackground).ignoresSafeArea()");
    expect(result[0].content).not.toContain("Color.black");
  });
});

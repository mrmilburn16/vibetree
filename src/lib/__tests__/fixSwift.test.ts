import { describe, it, expect } from "vitest";
import {
  fixSwiftCommonIssues,
  applyRuleBasedFixesFromBuild,
  type SwiftTextFile,
} from "../llm/fixSwift";

describe("fixSwiftCommonIssues", () => {
  it("returns non-Swift files unchanged", () => {
    const files = [{ path: "README.md", content: "hello" }];
    expect(fixSwiftCommonIssues(files)).toEqual(files);
  });

  it("replaces $viewModel with viewModel (no @Bindable)", () => {
    const files: SwiftTextFile[] = [
      { path: "View.swift", content: "let x = $viewModel" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("viewModel");
    expect(result[0].content).not.toContain("$viewModel");
  });

  it("preserves $viewModel when @Bindable is present", () => {
    const files: SwiftTextFile[] = [
      { path: "View.swift", content: "@Bindable var vm\nlet x = $viewModel" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("$viewModel");
  });

  it("replaces .accent with .accentColor", () => {
    const files: SwiftTextFile[] = [
      { path: "View.swift", content: "Color.accent" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain(".accentColor");
  });

  it("does not replace .accentColor with .accentColorColor", () => {
    const files: SwiftTextFile[] = [
      { path: "View.swift", content: "Color.accentColor" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toBe("import SwiftUI\nColor.accentColor");
  });

  it("auto-adds import SwiftUI when SwiftUI types are used", () => {
    const files: SwiftTextFile[] = [
      { path: "View.swift", content: "struct MyView: View { }" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("import SwiftUI");
  });

  it("does not duplicate import SwiftUI", () => {
    const files: SwiftTextFile[] = [
      {
        path: "View.swift",
        content: "import SwiftUI\nstruct MyView: View { }",
      },
    ];
    const result = fixSwiftCommonIssues(files);
    const imports = result[0].content.match(/import SwiftUI/g);
    expect(imports).toHaveLength(1);
  });

  it("auto-adds import Charts when chart types are used", () => {
    const files: SwiftTextFile[] = [
      { path: "ChartView.swift", content: "Chart { BarMark(x: .value(\"x\", 1)) }" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("import Charts");
  });

  it("replaces NavigationView with NavigationStack", () => {
    const files: SwiftTextFile[] = [
      { path: "View.swift", content: "NavigationView { Text(\"hi\") }" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("NavigationStack");
    expect(result[0].content).not.toContain("NavigationView");
  });

  it("replaces .navigationBarTitle with .navigationTitle", () => {
    const files: SwiftTextFile[] = [
      { path: "View.swift", content: ".navigationBarTitle(\"Home\")" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain(".navigationTitle");
  });

  it("replaces .foregroundColor with .foregroundStyle", () => {
    const files: SwiftTextFile[] = [
      { path: "View.swift", content: "Text(\"hi\").foregroundColor(.red)" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain(".foregroundStyle");
  });

  it("preserves NSAttributedString.Key.foregroundColor", () => {
    const files: SwiftTextFile[] = [
      {
        path: "Util.swift",
        content: "NSAttributedString.Key.foregroundColor",
      },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("NSAttributedString.Key.foregroundColor");
  });

  it("adds @main to App.swift when missing", () => {
    const files: SwiftTextFile[] = [
      { path: "App.swift", content: "import SwiftUI\nstruct MyApp: App { }" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("@main");
  });

  it("deduplicates imports", () => {
    const files: SwiftTextFile[] = [
      {
        path: "View.swift",
        content: "import SwiftUI\nimport SwiftUI\nstruct V: View {}",
      },
    ];
    const result = fixSwiftCommonIssues(files);
    const imports = result[0].content.match(/import SwiftUI/g);
    expect(imports).toHaveLength(1);
  });

  it("fixes string-in-numeric for ProgressView", () => {
    const files: SwiftTextFile[] = [
      { path: "View.swift", content: 'ProgressView(value: "0.5",' },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("ProgressView(value: 0.5,");
  });

  it("auto-adds import MapKit for Map usage", () => {
    const files: SwiftTextFile[] = [
      { path: "MapView.swift", content: "Map(coordinateRegion: $region)" },
    ];
    const result = fixSwiftCommonIssues(files);
    expect(result[0].content).toContain("import MapKit");
  });
});

describe("applyRuleBasedFixesFromBuild", () => {
  it("adds missing SwiftUI import based on compiler errors", () => {
    const files: SwiftTextFile[] = [
      { path: "MyView.swift", content: "struct V { }" },
    ];
    const errors = ["MyView.swift:1: Cannot find 'Color' in scope"];
    const { files: fixed, changed } = applyRuleBasedFixesFromBuild(
      files,
      errors,
      []
    );
    expect(changed).toBe(true);
    expect(fixed[0].content).toContain("import SwiftUI");
  });

  it("returns changed=false when nothing needs fixing", () => {
    const files: SwiftTextFile[] = [
      { path: "App.swift", content: "import SwiftUI\n@main\nstruct A: App {}" },
    ];
    const { changed } = applyRuleBasedFixesFromBuild(files, [], []);
    expect(changed).toBe(false);
  });
});

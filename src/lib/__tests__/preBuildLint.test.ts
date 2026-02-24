import { describe, it, expect } from "vitest";
import { preBuildLint, type SwiftFile } from "../preBuildLint";

describe("preBuildLint", () => {
  it("auto-adds import SwiftUI when missing", () => {
    const files: SwiftFile[] = [
      { path: "ContentView.swift", content: "struct ContentView: View {\n  var body: some View { Text(\"hi\") }\n}" },
    ];
    const result = preBuildLint(files);
    expect(result.files[0].content).toContain("import SwiftUI");
    expect(result.autoFixCount).toBe(1);
    expect(result.warnings.some((w) => w.autoFixed && w.file === "ContentView.swift")).toBe(true);
  });

  it("auto-adds @main to App.swift when missing", () => {
    const files: SwiftFile[] = [
      { path: "App.swift", content: "import SwiftUI\nstruct MyApp: App {\n  var body: some Scene { WindowGroup { Text(\"hi\") } }\n}" },
    ];
    const result = preBuildLint(files);
    expect(result.files[0].content).toContain("@main");
  });

  it("warns about missing WindowGroup in App struct", () => {
    const files: SwiftFile[] = [
      { path: "App.swift", content: "import SwiftUI\n@main\nstruct MyApp: App {\n  var body: some Scene { Text(\"hi\") }\n}" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings.some((w) => w.message.includes("WindowGroup"))).toBe(true);
  });

  it("warns about NavigationLink without NavigationStack", () => {
    const files: SwiftFile[] = [
      { path: "HomeView.swift", content: "struct HomeView: View {\n  var body: some View {\n    NavigationLink(\"Go\") { Text(\"Detail\") }\n  }\n}" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings.some((w) => w.message.includes("NavigationLink") && w.message.includes("NavigationStack"))).toBe(true);
  });

  it("does not warn if NavigationStack exists in another file", () => {
    const files: SwiftFile[] = [
      { path: "App.swift", content: "import SwiftUI\n@main\nstruct MyApp: App {\n  var body: some Scene { WindowGroup { NavigationStack { HomeView() } } }\n}" },
      { path: "HomeView.swift", content: "struct HomeView: View {\n  var body: some View {\n    NavigationLink(\"Go\") { Text(\"hi\") }\n  }\n}" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings.some((w) => w.file === "HomeView.swift" && w.message.includes("NavigationLink"))).toBe(false);
  });

  it("warns about empty Button actions", () => {
    const files: SwiftFile[] = [
      { path: "View.swift", content: "Button(\"Tap\") { }" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings.some((w) => w.message.includes("empty action"))).toBe(true);
  });

  it("warns about GeometryReader usage", () => {
    const files: SwiftFile[] = [
      { path: "View.swift", content: "struct V: View { var body: some View { GeometryReader { g in Text(\"hi\") } } }" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings.some((w) => w.message.includes("GeometryReader"))).toBe(true);
  });

  it("warns about UIScreen.main.bounds", () => {
    const files: SwiftFile[] = [
      { path: "View.swift", content: ".frame(width: UIScreen.main.bounds.width)" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings.some((w) => w.message.includes("UIScreen.main.bounds"))).toBe(true);
  });

  it("warns about multiple NavigationStack in one file", () => {
    const files: SwiftFile[] = [
      { path: "View.swift", content: "NavigationStack { Text(\"a\") }\nNavigationStack { Text(\"b\") }" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings.some((w) => w.message.includes("Multiple NavigationStack"))).toBe(true);
  });

  it("warns about .offset() usage", () => {
    const files: SwiftFile[] = [
      { path: "View.swift", content: "Text(\"hi\").offset(x: 10, y: 20)" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings.some((w) => w.message.includes(".offset()"))).toBe(true);
  });

  it("warns about orphaned view files", () => {
    const files: SwiftFile[] = [
      { path: "App.swift", content: "import SwiftUI\n@main\nstruct MyApp: App {\n  var body: some Scene { WindowGroup { ContentView() } }\n}" },
      { path: "ContentView.swift", content: "struct ContentView: View { var body: some View { Text(\"hi\") } }" },
      { path: "Views/OrphanedView.swift", content: "struct OrphanedView: View { var body: some View { Text(\"orphan\") } }" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings.some((w) => w.message.includes("OrphanedView") && w.message.includes("orphaned"))).toBe(true);
  });

  it("warns about TODO in action closures", () => {
    const files: SwiftFile[] = [
      { path: "View.swift", content: "Button(\"Save\") { // TODO implement }" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings.some((w) => w.message.includes("TODO/placeholder"))).toBe(true);
  });

  it("skips non-Swift files", () => {
    const files: SwiftFile[] = [
      { path: "README.md", content: "GeometryReader NavigationLink" },
    ];
    const result = preBuildLint(files);
    expect(result.warnings).toHaveLength(0);
  });
});

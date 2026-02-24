import { describe, it, expect } from "vitest";
import {
  estimateComplexity,
  getMultiPassConfig,
  buildArchitecturePrompt,
  buildSelfReviewPrompt,
  parseArchitecturePlan,
} from "../llm/multiPass";

describe("estimateComplexity", () => {
  it("classifies simple counter app as simple", () => {
    expect(estimateComplexity("Make a simple counter app")).toBe("simple");
  });

  it("classifies todo app with list and detail as medium", () => {
    expect(
      estimateComplexity("A todo app with a list view and detail editing form")
    ).toBe("medium");
  });

  it("classifies multi-screen app with tabs as hard", () => {
    expect(
      estimateComplexity(
        "A fitness tracker with tab bar, multiple screens, and data persistence"
      )
    ).toBe("hard");
  });

  it("classifies app with login and dashboard as hard", () => {
    expect(
      estimateComplexity(
        "An expense tracker with login screen, dashboard, and search/filter/sort"
      )
    ).toBe("hard");
  });

  it("classifies timer with features as medium", () => {
    expect(
      estimateComplexity("A timer app with stopwatch and countdown modes")
    ).toBe("medium");
  });

  it("classifies hello world as simple", () => {
    expect(estimateComplexity("Hello world")).toBe("simple");
  });
});

describe("getMultiPassConfig", () => {
  it("simple: skips architecture and self-review", () => {
    const config = getMultiPassConfig("simple");
    expect(config.skipArchitecturePass).toBe(true);
    expect(config.skipSelfReview).toBe(true);
  });

  it("medium: skips architecture but does self-review", () => {
    const config = getMultiPassConfig("medium");
    expect(config.skipArchitecturePass).toBe(true);
    expect(config.skipSelfReview).toBe(false);
  });

  it("hard: does both architecture and self-review", () => {
    const config = getMultiPassConfig("hard");
    expect(config.skipArchitecturePass).toBe(false);
    expect(config.skipSelfReview).toBe(false);
    expect(config.maxFiles).toBe(20);
  });
});

describe("buildArchitecturePrompt", () => {
  it("includes user prompt and swift extension for pro", () => {
    const prompt = buildArchitecturePrompt("Build a todo app", "pro");
    expect(prompt).toContain("Build a todo app");
    expect(prompt).toContain(".swift");
  });

  it("uses .js extension for standard", () => {
    const prompt = buildArchitecturePrompt("Build a todo app", "standard");
    expect(prompt).toContain(".js");
  });
});

describe("buildSelfReviewPrompt", () => {
  it("includes file contents", () => {
    const files = [
      { path: "App.swift", content: "import SwiftUI" },
      { path: "ContentView.swift", content: "struct ContentView: View {}" },
    ];
    const prompt = buildSelfReviewPrompt(files, "pro");
    expect(prompt).toContain("App.swift");
    expect(prompt).toContain("ContentView.swift");
    expect(prompt).toContain("SwiftUI");
  });

  it("mentions correct language for project type", () => {
    const swiftPrompt = buildSelfReviewPrompt([], "pro");
    expect(swiftPrompt).toContain("SwiftUI");

    const rnPrompt = buildSelfReviewPrompt([], "standard");
    expect(rnPrompt).toContain("React Native");
  });
});

describe("parseArchitecturePlan", () => {
  it("parses valid JSON plan", () => {
    const json = JSON.stringify({
      screens: ["Home", "Detail"],
      models: ["Item"],
      navigation: "stack",
      files: ["App.swift", "Views/HomeView.swift"],
    });
    const plan = parseArchitecturePlan(json);
    expect(plan).not.toBeNull();
    expect(plan!.screens).toEqual(["Home", "Detail"]);
    expect(plan!.navigation).toBe("stack");
    expect(plan!.files).toHaveLength(2);
  });

  it("handles markdown-wrapped JSON", () => {
    const json = "```json\n" + JSON.stringify({
      screens: ["Home"],
      models: [],
      navigation: "single",
      files: ["App.swift"],
    }) + "\n```";
    const plan = parseArchitecturePlan(json);
    expect(plan).not.toBeNull();
    expect(plan!.screens).toEqual(["Home"]);
  });

  it("returns null for invalid JSON", () => {
    expect(parseArchitecturePlan("not json")).toBeNull();
  });

  it("returns null for missing required fields", () => {
    expect(parseArchitecturePlan('{"screens": ["A"]}')).toBeNull();
  });
});

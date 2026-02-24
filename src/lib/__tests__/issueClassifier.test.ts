import { describe, it, expect } from "vitest";
import {
  classifyNotes,
  ALL_ISSUE_TAGS,
  getIssueSeverity,
} from "../qa/issueClassifier";

describe("classifyNotes", () => {
  it("returns empty array for empty input", () => {
    expect(classifyNotes("")).toEqual([]);
    expect(classifyNotes("   ")).toEqual([]);
  });

  it("detects layout overlap", () => {
    expect(classifyNotes("the menu overlaps the start button")).toContain(
      "layout_overlap"
    );
  });

  it("detects tap target issues", () => {
    expect(classifyNotes("button is too small to tap")).toContain("tap_targets");
  });

  it("detects safe area issues", () => {
    expect(classifyNotes("text is behind the notch")).toContain("safe_area");
  });

  it("detects tab bar overlap", () => {
    expect(classifyNotes("tab bar overlaps content")).toContain(
      "tabbar_overlap"
    );
  });

  it("detects broken navigation", () => {
    expect(classifyNotes("can't go back to the previous screen")).toContain(
      "broken_navigation"
    );
  });

  it("detects state not updating", () => {
    expect(classifyNotes("counter doesn't increment")).toContain(
      "state_not_updating"
    );
  });

  it("detects button not working", () => {
    expect(classifyNotes("nothing happens when I tap the save button")).toContain(
      "button_not_working"
    );
  });

  it("detects crash on launch", () => {
    expect(classifyNotes("app crashes immediately")).toContain("crash_on_launch");
  });

  it("detects dark mode issues", () => {
    expect(classifyNotes("can't read text in dark mode")).toContain(
      "dark_mode_issue"
    );
  });

  it("detects keyboard overlap", () => {
    expect(classifyNotes("keyboard covers the input field")).toContain(
      "keyboard_overlap"
    );
  });

  it("detects multiple issues from one note", () => {
    const tags = classifyNotes(
      "the tab bar overlaps the button and I can't scroll down"
    );
    expect(tags).toContain("tabbar_overlap");
    expect(tags).toContain("scroll_overflow");
  });

  it("deduplicates tags", () => {
    const tags = classifyNotes("overlap, overlapping elements, on top of button");
    const uniqueTags = [...new Set(tags)];
    expect(tags).toEqual(uniqueTags);
  });

  it("handles notes without matching issues", () => {
    expect(classifyNotes("the app looks great, no issues")).toEqual([]);
  });
});

describe("ALL_ISSUE_TAGS", () => {
  it("has at least 15 tags", () => {
    expect(ALL_ISSUE_TAGS.length).toBeGreaterThanOrEqual(15);
  });

  it("includes critical tags", () => {
    expect(ALL_ISSUE_TAGS).toContain("crash_on_launch");
    expect(ALL_ISSUE_TAGS).toContain("broken_navigation");
    expect(ALL_ISSUE_TAGS).toContain("button_not_working");
  });
});

describe("getIssueSeverity", () => {
  it("classifies crash_on_launch as critical", () => {
    expect(getIssueSeverity("crash_on_launch")).toBe("critical");
  });

  it("classifies layout_overlap as major", () => {
    expect(getIssueSeverity("layout_overlap")).toBe("major");
  });

  it("classifies animation_issue as minor", () => {
    expect(getIssueSeverity("animation_issue")).toBe("minor");
  });
});

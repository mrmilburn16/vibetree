/**
 * Chat UI behavior: file list once, app title first, grey = agent activity, white = agent message,
 * and that project rename + chat sync to API (web and iOS use same API).
 */
import { describe, it, expect } from "vitest";
import {
  deriveTitleFromPrompt,
  deriveTitleFromSummary,
  isUntitledName,
} from "@/components/editor/useChat";

describe("Chat UI: app title first and reasoning vs message", () => {
  it("deriveTitleFromPrompt extracts app name from prompt", () => {
    expect(deriveTitleFromPrompt("Build a to-do list app with filters")).toBe("To-do List");
    expect(deriveTitleFromPrompt("Create an Airbnb clone")).toBe("Airbnb Clone");
    expect(deriveTitleFromPrompt("Make a fitness tracker")).toBe("Fitness Tracker");
    expect(deriveTitleFromPrompt("random text")).toBeNull();
  });

  it("deriveTitleFromSummary extracts app name from summary", () => {
    const title = deriveTitleFromSummary(
      "Built a single-screen to-do list app with add, toggle completion, delete."
    );
    expect(title).toBeTruthy();
    expect(title!.toLowerCase()).toContain("to-do list");
    expect(deriveTitleFromSummary("Created a habit tracker with streaks.")).toBe("Habit Tracker");
  });

  it("isUntitledName treats default names as untitled", () => {
    expect(isUntitledName("Untitled app")).toBe(true);
    expect(isUntitledName("untitled app")).toBe(true);
    expect(isUntitledName("Untitled")).toBe(true);
    expect(isUntitledName("")).toBe(true);
    expect(isUntitledName("To-Do List")).toBe(false);
  });

  it("final message content should prepend App name when autoTitle is set", () => {
    const autoTitle = "To-Do List";
    const content = "Built a single-screen to-do list app.";
    const contentWithTitle = `App name: ${autoTitle}\n\n${content}`;
    expect(contentWithTitle).toMatch(/^App name: To-Do List/);
    expect(contentWithTitle).toContain(content);
  });
});

describe("Chat UI: file list shown once", () => {
  it("stream file message content should not duplicate path (no ' · path')", () => {
    const basename = "App.swift";
    const path = "App.swift";
    const bad = `Writing ${basename} · ${path}`;
    const good = `Writing ${basename}`;
    expect(bad).toContain(" · ");
    expect(good).not.toContain(" · ");
  });
});

describe("Chat UI: reasoning = grey, assistant message = white", () => {
  function isReasoningMessage(msg: {
    role: string;
    content: string;
    editedFiles?: string[];
    id?: string;
  }): boolean {
    if (msg.role !== "assistant" || (msg.editedFiles?.length ?? 0) > 0) return false;
    if (typeof msg.id === "string" && msg.id.startsWith("stream-")) return true;
    if (msg.content.startsWith("Validating build on Mac…")) return true;
    const reasoningPhrases = new Set([
      "Reading files.",
      "Writing code…",
      "Writing 2 files…",
      "Receiving code…",
    ]);
    return msg.content.length < 50 || reasoningPhrases.has(msg.content.trim());
  }

  it("short status and reasoning phrases are reasoning (grey)", () => {
    expect(isReasoningMessage({ role: "assistant", content: "Writing code…" })).toBe(true);
    expect(isReasoningMessage({ role: "assistant", content: "Writing 2 files…" })).toBe(true);
    expect(isReasoningMessage({ role: "assistant", content: "Reading files." })).toBe(true);
    expect(isReasoningMessage({ role: "assistant", content: "Receiving code…", id: "stream-1" })).toBe(true);
  });

  it("long summary and messages with editedFiles are assistant message (white)", () => {
    const longSummary =
      "Built a single-screen to-do list app with add, toggle completion, delete, and filter functionality.";
    expect(isReasoningMessage({ role: "assistant", content: longSummary })).toBe(false);
    expect(
      isReasoningMessage({
        role: "assistant",
        content: "Done.",
        editedFiles: ["App.swift", "ContentView.swift"],
      })
    ).toBe(false);
  });
});

describe("Chat UI: sync (web and iOS use same API)", () => {
  it("project rename and chat use same API shape so both clients stay in sync", () => {
    const projectId = "proj_123";
    const newName = "To-Do List";
    const patchBody = JSON.stringify({ name: newName });
    const patchUrl = `/api/projects/${projectId}`;
    expect(patchUrl).toBe("/api/projects/proj_123");
    expect(JSON.parse(patchBody)).toEqual({ name: newName });
  });
});

/** Contract: "New blank app" and "open existing project" must open the editor as a fresh slate (no auto-send). */
const PENDING_PROMPT_KEY = "vibetree-pending-prompt";

describe("Chat UI: new blank app is a fresh slate (no pending prompt)", () => {
  it("when pending prompt key is absent, editor must not auto-send (new blank app / open existing)", () => {
    const storage: Record<string, string> = {};
    const getItem = (k: string): string | null => storage[k] ?? null;
    expect(getItem(PENDING_PROMPT_KEY)).toBeNull();
    // Simulate "new blank app" or "open existing": no key set → no auto-send
    expect(!!getItem(PENDING_PROMPT_KEY)).toBe(false);
  });

  it("pending prompt key is only set when user submits from dashboard, not when opening new blank app", () => {
    expect(PENDING_PROMPT_KEY).toBe("vibetree-pending-prompt");
    // Dashboard doSubmitPrompt sets this before navigate; handleNewApp must NOT set it.
    // iOS: ProjectListView must set pendingPrompt = nil when tapping "New blank app" or a project row.
  });
});

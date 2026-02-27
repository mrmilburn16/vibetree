/**
 * Ensures the MusicKit skill instructs the agent to request authorization up front
 * and disable the Build Playlist button until authorized — so generated apps
 * can actually access Apple Music when the user tests them.
 */
import { describe, it, expect } from "vitest";
import { loadSkill } from "@/lib/skills/registry";

describe("MusicKit skill — authorization and playlist flow", () => {
  it("loads musickit skill", () => {
    const skill = loadSkill("musickit");
    expect(skill).not.toBeNull();
    expect(skill!.promptInjection).toBeDefined();
  });

  it("instructs to request authorization on screen appear (.onAppear or .task)", () => {
    const skill = loadSkill("musickit");
    expect(skill).not.toBeNull();
    const injection = skill!.promptInjection;
    expect(injection).toMatch(/\.onAppear|\.task/);
    expect(injection).toMatch(/authorization.*(screen|appear|load)|request.*up front|as soon as/i);
  });

  it("instructs to disable Build Playlist / Create and Play until authorized", () => {
    const skill = loadSkill("musickit");
    expect(skill).not.toBeNull();
    const injection = skill!.promptInjection;
    expect(injection).toMatch(/\.disabled.*isAuthorized|disabled until.*authorized/i);
    expect(injection).toMatch(/Build Playlist|Create and Play|search\/play button/i);
  });

  it("instructs to show Authorize Apple Music first when not authorized", () => {
    const skill = loadSkill("musickit");
    expect(skill).not.toBeNull();
    expect(skill!.promptInjection).toMatch(/Authorize Apple Music first|requestAuthorization/i);
  });

  it("does not tell the agent to use a developer token in app code", () => {
    const skill = loadSkill("musickit");
    expect(skill).not.toBeNull();
    const injection = skill!.promptInjection;
    expect(injection).toMatch(/ZERO code that requests.*developer token|do NOT use or request.*developer token/i);
  });

  it("lists Could not access Apple Music in commonErrors for fix guidance", () => {
    const skill = loadSkill("musickit");
    expect(skill).not.toBeNull();
    const errors = skill!.stats?.commonErrors ?? [];
    const hasAccessError = errors.some(
      (e) => typeof e === "string" && /Could not access Apple Music|Search failed/i.test(e)
    );
    expect(hasAccessError).toBe(true);
  });
});

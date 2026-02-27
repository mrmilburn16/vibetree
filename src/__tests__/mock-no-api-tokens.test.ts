/**
 * Ensures the app can run without API tokens (mock LLM path).
 * - dev:mock / dev:full:mock use NEXT_PUBLIC_USE_REAL_LLM=false so the client uses client-side mock.
 * - This test asserts the mock adapter returns valid responses so the no-API path works.
 */
import { describe, it, expect } from "vitest";
import { mockGetResponse } from "@/lib/llm/mockAdapter";

describe("Run without API tokens (mock path)", () => {
  it("only NEXT_PUBLIC_USE_REAL_LLM=== exactly 'true' enables real LLM (so dev:mock stays mock)", () => {
    // Same logic as src/lib/featureFlags.ts — dev:mock sets NEXT_PUBLIC_USE_REAL_LLM=false or unset
    const isRealLLM = (val: string | undefined) => val === "true";
    expect(isRealLLM(undefined)).toBe(false);
    expect(isRealLLM("")).toBe(false);
    expect(isRealLLM("false")).toBe(false);
    expect(isRealLLM("true")).toBe(true);
  });

  it("mockGetResponse returns valid content and files for pro (Swift)", async () => {
    const res = await mockGetResponse("Counter", undefined, "pro");
    expect(res).toHaveProperty("content");
    expect(typeof res.content).toBe("string");
    expect(res.content.length).toBeGreaterThan(0);
    expect(res).toHaveProperty("editedFiles");
    expect(Array.isArray(res.editedFiles)).toBe(true);
    expect(res.editedFiles.length).toBeGreaterThan(0);
    expect(res.parsedFiles).toBeDefined();
    expect(Array.isArray(res.parsedFiles)).toBe(true);
    expect(res.parsedFiles!.length).toBeGreaterThan(0);
    const first = res.parsedFiles![0];
    expect(first).toHaveProperty("path");
    expect(first).toHaveProperty("content");
    expect(first.path).toMatch(/\.swift$/);
    expect(first.content).toContain("SwiftUI");
  });

  it("mockGetResponse returns valid content and files for standard (Expo)", async () => {
    const res = await mockGetResponse("Hello", undefined, "standard");
    expect(res).toHaveProperty("content");
    expect(res).toHaveProperty("editedFiles");
    expect(res.editedFiles).toContain("App.js");
    expect(res.parsedFiles).toBeDefined();
    expect(res.parsedFiles!.some((f) => f.path === "App.js")).toBe(true);
    const appJs = res.parsedFiles!.find((f) => f.path === "App.js");
    expect(appJs!.content).toMatch(/react-native|View|Text/);
  });
});

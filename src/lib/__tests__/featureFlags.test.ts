import { describe, it, expect } from "vitest";

describe("featureFlags", () => {
  it("defaults to mock mode (no env vars set)", async () => {
    const orig = { ...process.env };
    delete process.env.NEXT_PUBLIC_USE_REAL_LLM;
    delete process.env.NEXT_PUBLIC_USE_REAL_MAC;

    // Re-import to get fresh evaluation
    const mod = await import("../featureFlags");
    expect(mod.featureFlags.useRealLLM).toBe(false);
    expect(mod.featureFlags.useRealMac).toBe(false);

    process.env = orig;
  });
});

import { describe, it, expect } from "vitest";
import { checkRateLimit, type RateLimitConfig } from "../rateLimit";

describe("checkRateLimit", () => {
  const config: RateLimitConfig = { maxRequests: 3, windowMs: 1000 };

  it("allows requests under the limit", () => {
    const key = `test_${Date.now()}_allow`;
    const r1 = checkRateLimit(key, config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it("blocks requests over the limit", () => {
    const key = `test_${Date.now()}_block`;
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const r4 = checkRateLimit(key, config);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.resetMs).toBeGreaterThan(0);
  });

  it("uses separate limits for different keys", () => {
    const key1 = `test_${Date.now()}_k1`;
    const key2 = `test_${Date.now()}_k2`;
    checkRateLimit(key1, config);
    checkRateLimit(key1, config);
    checkRateLimit(key1, config);
    const r1 = checkRateLimit(key1, config);
    const r2 = checkRateLimit(key2, config);
    expect(r1.allowed).toBe(false);
    expect(r2.allowed).toBe(true);
  });

  it("counts remaining correctly", () => {
    const key = `test_${Date.now()}_count`;
    const r1 = checkRateLimit(key, config);
    expect(r1.remaining).toBe(2);
    const r2 = checkRateLimit(key, config);
    expect(r2.remaining).toBe(1);
    const r3 = checkRateLimit(key, config);
    expect(r3.remaining).toBe(0);
  });
});

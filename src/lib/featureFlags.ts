/**
 * Feature flags — toggle real vs mock without code changes.
 * Set in env: NEXT_PUBLIC_USE_REAL_LLM=true, NEXT_PUBLIC_USE_REAL_MAC=true
 */

export const featureFlags = {
  useRealLLM: process.env.NEXT_PUBLIC_USE_REAL_LLM === "true",
  useRealMac: process.env.NEXT_PUBLIC_USE_REAL_MAC === "true",
};

/**
 * Estimate API cost from token usage. Uses current Anthropic list prices per million tokens.
 * Model option values match llm-options (e.g. "opus-4.6", "sonnet-4.6").
 *
 * Cache pricing: cache writes cost 1.25x (5m TTL) or 2x (1h TTL) the input price;
 * cache reads cost 0.1x the input price. The CACHE_TTL env var determines write cost.
 */

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** $ per 1M tokens: [input, output] */
const PRICE_PER_M: Record<string, [number, number]> = {
  "opus-4.6": [5, 25],
  "sonnet-4.6": [3, 15],
  "sonnet-4.5": [3, 15],
};

const DEFAULT_PRICE: [number, number] = [3, 15]; // Sonnet

const CACHE_WRITE_MULTIPLIER = process.env.CACHE_TTL === "5m" ? 1.25 : 2.0;
const CACHE_READ_MULTIPLIER = 0.1;

export function estimateCostUsd(
  modelOption: string | undefined,
  usage: TokenUsage
): number {
  const [inPerM, outPerM] =
    modelOption && PRICE_PER_M[modelOption]
      ? PRICE_PER_M[modelOption]
      : DEFAULT_PRICE;

  const inputCost = (usage.input_tokens / 1_000_000) * inPerM;
  const outputCost = (usage.output_tokens / 1_000_000) * outPerM;

  const cacheWriteCost =
    ((usage.cache_creation_input_tokens ?? 0) / 1_000_000) * inPerM * CACHE_WRITE_MULTIPLIER;
  const cacheReadCost =
    ((usage.cache_read_input_tokens ?? 0) / 1_000_000) * inPerM * CACHE_READ_MULTIPLIER;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

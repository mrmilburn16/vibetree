/**
 * Estimate API cost from token usage. Uses current Anthropic list prices per million tokens.
 * Model option values match llm-options (e.g. "opus-4.6", "sonnet-4.6").
 */

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

/** $ per 1M tokens: [input, output] */
const PRICE_PER_M: Record<string, [number, number]> = {
  "opus-4.6": [5, 25],
  "sonnet-4.6": [3, 15],
  "sonnet-4.5": [3, 15],
};

const DEFAULT_PRICE: [number, number] = [3, 15]; // Sonnet

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
  return inputCost + outputCost;
}

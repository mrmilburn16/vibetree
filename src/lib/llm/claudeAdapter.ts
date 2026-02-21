/**
 * Real Claude API adapter. Used when ANTHROPIC_API_KEY is set and useRealLLM is true.
 * Returns the same shape as mockAdapter: { content, editedFiles }.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMResponse } from "./mockAdapter";

/** Map UI model values to Anthropic API model IDs. GPT options fall back to Sonnet. */
const MODEL_MAP: Record<string, string> = {
  "opus-4.6": "claude-opus-4-6",
  "sonnet-4.6": "claude-sonnet-4-6",
  "sonnet-4.5": "claude-sonnet-4-5-20250929",
  "gpt-5.2": "claude-sonnet-4-5-20250929", // no OpenAI yet; fallback
};

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 4096;

/**
 * Call Claude and return content + editedFiles. editedFiles is empty for now
 * (could be extended with structured output or parsing later).
 */
export async function getClaudeResponse(
  message: string,
  modelOption?: string
): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const model =
    modelOption && MODEL_MAP[modelOption]
      ? MODEL_MAP[modelOption]
      : DEFAULT_MODEL;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: message }],
  });

  const content = extractTextFromContent(response.content);
  return {
    content: content || "(No text in response.)",
    editedFiles: [], // TODO: structured output or parse from response
  };
}

function extractTextFromContent(
  content: Array<{ type: string; text?: string }>
): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

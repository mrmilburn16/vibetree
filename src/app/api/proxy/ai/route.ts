/**
 * POST /api/proxy/ai
 * Proxies chat completion to Claude Sonnet. Used by generated apps (AI/coach/recommend features).
 * Auth: X-App-Token required. Body must include userId for credit deduction.
 * Body: { messages: [{role, content}], systemPrompt?: string, maxTokens?: number, userId: string }
 * Returns { response: string }. Deducts 0.30 credits per call; 402 if insufficient.
 * Owner bypass: if userId is in OWNER_USER_IDS or matches OWNER_USER_ID_HARDCODED, credit check and deduction are skipped.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCreditBalance, deductCredits } from "@/lib/userCreditsFirestore";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant. Always respond with a JSON object in this format: {\"response\": \"your message here\"}. Never respond with plain text, markdown, or code blocks outside of this JSON structure.";
const CREDITS_PER_CALL = 0.3;
const MAX_OUTPUT_TOKENS_CAP = 1000;
const MODEL = "claude-sonnet-4-6";

/** 5-minute prompt cache (ephemeral, no ttl). */
const CACHE_CONTROL_5M = { type: "ephemeral" as const };

function normalizeToken(s: string | undefined): string {
  return (s ?? "").replace(/\r\n?|\n/g, "").trim();
}

function isAppTokenValid(request: Request): boolean {
  const appToken =
    process.env.VIBETREE_APP_TOKEN && normalizeToken(process.env.VIBETREE_APP_TOKEN);
  const headerToken = normalizeToken(
    request.headers.get("x-app-token") ?? request.headers.get("X-App-Token") ?? ""
  );
  return Boolean(appToken && headerToken && headerToken === appToken);
}

type MessageParam = { role: string; content: string };

function parseMessages(raw: unknown): MessageParam[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is { role: string; content: string } =>
        m != null &&
        typeof m === "object" &&
        typeof (m as MessageParam).role === "string" &&
        typeof (m as MessageParam).content === "string"
    )
    .map((m) => ({ role: m.role, content: m.content }));
}

function extractAssistantText(content: Array<{ type?: string; text?: string }>): string {
  const block = content?.find((b) => b.type === "text");
  return (block && typeof block.text === "string" ? block.text : "").trim();
}

export async function POST(request: Request) {
  if (!isAppTokenValid(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    messages?: unknown;
    systemPrompt?: string;
    maxTokens?: number;
    userId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = parseMessages(body.messages);
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "Body must include messages (non-empty array of { role, content })" },
      { status: 400 }
    );
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json(
      { error: "Body must include userId for credit deduction" },
      { status: 400 }
    );
  }

  const ownerBypass = isProxyOwner(userId);
  if (!ownerBypass) {
    const balance = await getCreditBalance(userId);
    if (balance < CREDITS_PER_CALL) {
      return NextResponse.json(
        { error: "Insufficient credits", required: CREDITS_PER_CALL },
        { status: 402 }
      );
    }

    const deductResult = await deductCredits(userId, CREDITS_PER_CALL);
    if (!deductResult.ok) {
      return NextResponse.json(
        { error: deductResult.error ?? "Could not deduct credits" },
        { status: 402 }
      );
    }
  }

  const systemPrompt =
    typeof body.systemPrompt === "string" && body.systemPrompt.trim()
      ? body.systemPrompt.trim()
      : DEFAULT_SYSTEM_PROMPT;
  const maxTokens = Math.min(
    MAX_OUTPUT_TOKENS_CAP,
    typeof body.maxTokens === "number" && Number.isFinite(body.maxTokens) && body.maxTokens > 0
      ? Math.round(body.maxTokens)
      : 1024
  );

  const apiKey = process.env.ANTHROPIC_RUNTIME_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI proxy not configured: ANTHROPIC_RUNTIME_API_KEY is not set. Add it to .env.local for /api/proxy/ai." },
      { status: 503 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const userIndices = messages
      .map((m, i) => (m.role === "user" ? i : -1))
      .filter((i) => i >= 0);
    const moreThanTwoExchanges = userIndices.length > 2;
    const secondToLastUserIndex =
      moreThanTwoExchanges ? userIndices[userIndices.length - 2] : -1;

    const anthropicMessages = messages.map((m, i) => {
      const role = (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant";
      const useCacheControl =
        role === "user" && moreThanTwoExchanges && i === secondToLastUserIndex;
      const content =
        useCacheControl
          ? [{ type: "text" as const, text: m.content, cache_control: CACHE_CONTROL_5M }]
          : m.content;
      return { role, content };
    });

    const systemWithCache = [
      { type: "text" as const, text: systemPrompt, cache_control: CACHE_CONTROL_5M },
    ];

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemWithCache,
      messages: anthropicMessages,
    });

    let responseText = extractAssistantText(
      (response.content as Array<{ type?: string; text?: string }>) ?? []
    );
    responseText = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const inputTokens = (response.usage as { input_tokens?: number })?.input_tokens ?? 0;
    const outputTokens = (response.usage as { output_tokens?: number })?.output_tokens ?? 0;

    console.log("[proxy/ai] call", {
      userId,
      inputTokens,
      outputTokens,
      creditCost: ownerBypass ? 0 : CREDITS_PER_CALL,
      ownerBypass,
    });

    return NextResponse.json({ response: responseText });
  } catch (err) {
    console.error("[proxy/ai] Claude error", { userId, error: err });
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 502 }
    );
  }
}

/**
 * POST /api/proxy/ai
 * Proxies chat completion to Claude Sonnet. Used by generated apps (AI/coach/recommend features).
 *
 * Auth: X-App-Token header OR a valid Firebase session (cookie / Bearer token).
 * Billing: credits are deducted from the Firebase-verified user only. If no verified session
 * exists (app-token-only request), the body userId may be used for free-tier tracking but
 * never for credit deduction — the endpoint returns 401 once the free tier is exhausted.
 *
 * Body: { messages: [{role, content}], systemPrompt?: string, maxTokens?: number, userId?: string }
 *   userId is now optional; prefer session. Provided only as a tracking hint when no session.
 * Returns: { response: string }
 *
 * Credits per call: read live from the API marketplace registry (proxySlug "ai").
 * Falls back to 0.3 credits if the registry is unreachable.
 *
 * Credit safety: if Anthropic fails after credits are deducted, credits are refunded automatically.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCreditBalance, deductCredits, addCredits } from "@/lib/userCreditsFirestore";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";
import { logProxyCall } from "@/lib/proxyCallLog";
import { getProxyCreditsPerCall } from "@/lib/proxyBillingRate";
import { checkAndConsumeFreeTier } from "@/lib/proxyFreeTier";
import { resolveProxyAuth } from "@/lib/proxyAuth";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant. Always respond with a JSON object in this format: {\"response\": \"your message here\"}. Never respond with plain text, markdown, or code blocks outside of this JSON structure.";
/** Fallback rate used only if the registry/Firestore is completely unreachable. */
const CREDITS_PER_CALL_FALLBACK = 0.3;
const MAX_OUTPUT_TOKENS_CAP = 1000;
const MODEL = "claude-sonnet-4-6";

// Anthropic Sonnet pricing (USD per token)
const INPUT_PRICE_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 15 / 1_000_000;

/** 5-minute prompt cache (ephemeral, no ttl). */
const CACHE_CONTROL_5M = { type: "ephemeral" as const };

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
  const auth = await resolveProxyAuth(request);
  if (!auth.isAuthorized) {
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

  // userId for free-tier tracking: verified session preferred, body hint as fallback.
  const bodyUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  const trackingUserId = auth.verifiedUserId ?? bodyUserId;
  if (!trackingUserId) {
    return NextResponse.json(
      { error: "userId is required for free-tier tracking when no session is present" },
      { status: 400 }
    );
  }

  // Owner bypass only for verified session users — body userId cannot claim owner status.
  const ownerBypass = isProxyOwner(auth.verifiedUserId ?? "");

  // Check free tier first — if within the daily allowance, skip credit deduction.
  const freeTier = await checkAndConsumeFreeTier(
    trackingUserId,
    "ai",
    "anthropic-claude",
    ownerBypass
  );

  let creditsPerCall = 0;
  let creditsBilled = 0; // tracks how many were actually deducted (for refund on failure)

  if (!freeTier.isFree) {
    // Credits are needed — require a Firebase-verified session.
    if (!auth.verifiedUserId) {
      return NextResponse.json(
        { error: "Session required for credit billing" },
        { status: 401 }
      );
    }

    creditsPerCall = (await getProxyCreditsPerCall("ai")) || CREDITS_PER_CALL_FALLBACK;

    if (!ownerBypass) {
      const balance = await getCreditBalance(auth.verifiedUserId);
      if (balance < creditsPerCall) {
        return NextResponse.json(
          { error: "Insufficient credits", required: creditsPerCall },
          { status: 402 }
        );
      }

      const deductResult = await deductCredits(auth.verifiedUserId, creditsPerCall);
      if (!deductResult.ok) {
        return NextResponse.json(
          { error: deductResult.error ?? "Could not deduct credits" },
          { status: 402 }
        );
      }
      creditsBilled = creditsPerCall;
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
    // Refund credits before returning — the call never went out.
    if (creditsBilled > 0 && auth.verifiedUserId) {
      await addCredits(auth.verifiedUserId, creditsBilled).catch(() => {});
    }
    return NextResponse.json(
      {
        error:
          "AI proxy not configured: ANTHROPIC_RUNTIME_API_KEY is not set. Add it to .env.local for /api/proxy/ai.",
      },
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
    const actualCostUsd =
      inputTokens * INPUT_PRICE_PER_TOKEN + outputTokens * OUTPUT_PRICE_PER_TOKEN;

    if (freeTier.isFree) {
      console.log(
        `[proxy/ai] FREE (${freeTier.usedToday}/${freeTier.limitToday} used today)`,
        { userId: trackingUserId, inputTokens, outputTokens, actualCostUsd }
      );
    } else {
      console.log(
        `[proxy/ai] CHARGED ${ownerBypass ? 0 : creditsPerCall} credits (free limit exceeded: ${freeTier.usedToday}/${freeTier.limitToday} used today)`,
        { userId: trackingUserId, inputTokens, outputTokens, actualCostUsd, ownerBypass }
      );
    }

    logProxyCall({
      endpoint: "ai",
      userId: trackingUserId,
      actualCostUsd,
      chargedCredits: freeTier.isFree || ownerBypass ? 0 : creditsPerCall,
      meta: {
        inputTokens,
        outputTokens,
        model: MODEL,
        ownerBypass,
        freeTier: freeTier.isFree,
        freeTierUsed: freeTier.usedToday,
        freeTierLimit: freeTier.limitToday,
      },
    }).catch(() => {});

    return NextResponse.json({ response: responseText });
  } catch (err) {
    console.error("[proxy/ai] Claude error", { userId: trackingUserId, error: err });
    // Refund credits — the Anthropic call failed so the user got nothing.
    if (creditsBilled > 0 && auth.verifiedUserId) {
      await addCredits(auth.verifiedUserId, creditsBilled).catch((refundErr) => {
        console.error("[proxy/ai] credit refund failed", {
          userId: auth.verifiedUserId,
          amount: creditsBilled,
          error: refundErr,
        });
      });
    }
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 502 }
    );
  }
}

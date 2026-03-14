/**
 * POST /api/proxy/email
 * Sends an email via Resend on behalf of generated apps.
 * Auth: X-App-Token header required. Body must include userId for credit deduction.
 * Body: { to: string, subject: string, body?: string, html?: string, userId: string }
 * From address is always fixed to apps@vibetree.app — generated apps cannot override this.
 * Credits per call: read live from the API marketplace registry (proxySlug "email").
 * Rate limit: 50 emails per userId per day as a safety net on top of the credit system.
 * Owner bypass: if userId is in OWNER_USER_IDS or OWNER_USER_ID_HARDCODED, credits are skipped.
 * Returns: { success: true, messageId: string }
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getCreditBalance, deductCredits } from "@/lib/userCreditsFirestore";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";
import { logProxyCall } from "@/lib/proxyCallLog";
import { getProxyCreditsPerCall } from "@/lib/proxyBillingRate";
import { checkAndConsumeFreeTier } from "@/lib/proxyFreeTier";

/** Fixed sender — generated apps cannot customize this. */
const FROM_ADDRESS = "VibeTree Apps <apps@vibetree.app>";

/** Resend is effectively free at our usage volume. */
const ACTUAL_COST_USD = 0.0;

/** Fallback credits if Firestore registry is unreachable. */
const CREDITS_PER_CALL_FALLBACK = 0.1;

/**
 * Hard daily safety cap per userId (in-memory, separate from the free-tier counter).
 * Prevents a single user from sending unbounded emails even after credits run out
 * due to bugs or race conditions. Resets on server restart — intentionally loose.
 */
const HARD_DAILY_CAP = 50;
const HARD_CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

type RateLimitEntry = { timestamps: number[] };
const hardCapMap = new Map<string, RateLimitEntry>();

function isHardCapReached(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - HARD_CAP_WINDOW_MS;
  let entry = hardCapMap.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    hardCapMap.set(userId, entry);
  }
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  return entry.timestamps.length >= HARD_DAILY_CAP;
}

function recordHardCapRequest(userId: string): void {
  const now = Date.now();
  let entry = hardCapMap.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    hardCapMap.set(userId, entry);
  }
  entry.timestamps.push(now);
  const cutoff = now - HARD_CAP_WINDOW_MS;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
}

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  if (!isAppTokenValid(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    to?: unknown;
    subject?: unknown;
    body?: unknown;
    html?: unknown;
    userId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json(
      { error: "Body must include userId for credit deduction" },
      { status: 400 }
    );
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!to || !isValidEmail(to)) {
    return NextResponse.json(
      { error: "Body must include a valid 'to' email address" },
      { status: 400 }
    );
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  if (!subject) {
    return NextResponse.json(
      { error: "Body must include 'subject'" },
      { status: 400 }
    );
  }

  const textBody = typeof body.body === "string" ? body.body.trim() : "";
  const htmlBody = typeof body.html === "string" ? body.html.trim() : "";
  if (!textBody && !htmlBody) {
    return NextResponse.json(
      { error: "Body must include 'body' (plain text) or 'html' (HTML content)" },
      { status: 400 }
    );
  }

  // Hard safety cap — prevents unbounded sends regardless of credits or free tier.
  if (isHardCapReached(userId)) {
    return NextResponse.json(
      { error: "Daily email limit reached (50 per day). Try again tomorrow." },
      { status: 429 }
    );
  }

  const ownerBypass = isProxyOwner(userId);

  // Check free tier — first N emails/day are free (default 5, configurable from admin).
  const freeTier = await checkAndConsumeFreeTier(userId, "email", "resend-email", ownerBypass);

  let creditsPerCall = 0;
  if (!freeTier.isFree) {
    creditsPerCall = (await getProxyCreditsPerCall("email")) || CREDITS_PER_CALL_FALLBACK;

    if (!ownerBypass && creditsPerCall > 0) {
      const balance = await getCreditBalance(userId);
      if (balance < creditsPerCall) {
        return NextResponse.json(
          { error: "Insufficient credits", required: creditsPerCall },
          { status: 402 }
        );
      }
      const deductResult = await deductCredits(userId, creditsPerCall);
      if (!deductResult.ok) {
        return NextResponse.json(
          { error: deductResult.error ?? "Could not deduct credits" },
          { status: 402 }
        );
      }
    }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || apiKey === "re_your_key_here") {
    return NextResponse.json(
      {
        error:
          "Email proxy not configured: RESEND_API_KEY is not set. Add it to .env.local for /api/proxy/email.",
      },
      { status: 503 }
    );
  }

  try {
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send(
      htmlBody
        ? { from: FROM_ADDRESS, to, subject, html: htmlBody, ...(textBody ? { text: textBody } : {}) }
        : { from: FROM_ADDRESS, to, subject, text: textBody }
    );

    if (error || !data) {
      console.error("[proxy/email] Resend error", { userId, to, error });
      return NextResponse.json(
        { error: error?.message ?? "Email send failed" },
        { status: 502 }
      );
    }

    recordHardCapRequest(userId);

    if (freeTier.isFree) {
      console.log(
        `[proxy/email] FREE (${freeTier.usedToday}/${freeTier.limitToday} used today) sent to: ${to}`
      );
    } else {
      console.log(
        `[proxy/email] CHARGED ${ownerBypass ? 0 : creditsPerCall} credits (free limit exceeded: ${freeTier.usedToday}/${freeTier.limitToday} used today) sent to: ${to}, actualCost: $${ACTUAL_COST_USD.toFixed(2)}`
      );
    }

    logProxyCall({
      endpoint: "email",
      userId,
      actualCostUsd: ACTUAL_COST_USD,
      chargedCredits: freeTier.isFree || ownerBypass ? 0 : creditsPerCall,
      meta: {
        to,
        subject,
        ownerBypass,
        messageId: data.id,
        freeTier: freeTier.isFree,
        freeTierUsed: freeTier.usedToday,
        freeTierLimit: freeTier.limitToday,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, messageId: data.id });
  } catch (err) {
    console.error("[proxy/email] send error", { userId, to, error: err });
    return NextResponse.json(
      { error: "Email service unavailable. Please try again." },
      { status: 502 }
    );
  }
}

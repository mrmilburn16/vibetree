/**
 * POST /api/proxy/email
 * Sends an email via Resend on behalf of generated apps.
 *
 * Auth: X-App-Token header OR a valid Firebase session (cookie / Bearer token).
 * Billing: credits are deducted from the Firebase-verified user only. If no verified session
 * exists, the body userId may be used for free-tier tracking but not for credit deduction.
 *
 * Body: { to: string, subject: string, body?: string, html?: string, userId?: string }
 *   userId is now optional; prefer session. Provided only as a tracking hint when no session.
 * From address is always fixed to apps@vibetree.app — generated apps cannot override this.
 *
 * Credits per call: read live from the API marketplace registry (proxySlug "email").
 * Rate limit: 50 emails per tracking userId per day as a safety net on top of the credit system.
 *
 * Credit safety: if Resend fails after credits are deducted, credits are refunded automatically.
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getCreditBalance, deductCredits, addCredits } from "@/lib/userCreditsFirestore";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";
import { logProxyCall } from "@/lib/proxyCallLog";
import { getProxyCreditsPerCall } from "@/lib/proxyBillingRate";
import { checkAndConsumeFreeTier } from "@/lib/proxyFreeTier";
import { resolveProxyAuth } from "@/lib/proxyAuth";

/** Fixed sender — generated apps cannot customize this. */
const FROM_ADDRESS = "VibeTree Apps <apps@vibetree.app>";

/** Resend is effectively free at our usage volume. */
const ACTUAL_COST_USD = 0.0;

/** Fallback credits if Firestore registry is unreachable. */
const CREDITS_PER_CALL_FALLBACK = 0.1;

/**
 * Hard daily safety cap per tracking userId (in-memory, separate from the free-tier counter).
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const auth = await resolveProxyAuth(request);
  if (!auth.isAuthorized) {
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

  // userId for free-tier tracking: verified session preferred, body hint as fallback.
  const bodyUserId = typeof body.userId === "string" ? (body.userId as string).trim() : "";
  const trackingUserId = auth.verifiedUserId ?? bodyUserId;
  if (!trackingUserId) {
    return NextResponse.json(
      { error: "userId is required for free-tier tracking when no session is present" },
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
    return NextResponse.json({ error: "Body must include 'subject'" }, { status: 400 });
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
  if (isHardCapReached(trackingUserId)) {
    return NextResponse.json(
      { error: "Daily email limit reached (50 per day). Try again tomorrow." },
      { status: 429 }
    );
  }

  // Owner bypass only for verified session users — body userId cannot claim owner status.
  const ownerBypass = isProxyOwner(auth.verifiedUserId ?? "");

  // Check free tier — first N emails/day are free (default 5, configurable from admin).
  const freeTier = await checkAndConsumeFreeTier(
    trackingUserId,
    "email",
    "resend-email",
    ownerBypass
  );

  let creditsPerCall = 0;
  let creditsBilled = 0;

  if (!freeTier.isFree) {
    // Credits are needed — require a Firebase-verified session.
    if (!auth.verifiedUserId) {
      return NextResponse.json(
        { error: "Session required for credit billing" },
        { status: 401 }
      );
    }

    creditsPerCall = (await getProxyCreditsPerCall("email")) || CREDITS_PER_CALL_FALLBACK;

    if (!ownerBypass && creditsPerCall > 0) {
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

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || apiKey === "re_your_key_here") {
    if (creditsBilled > 0 && auth.verifiedUserId) {
      await addCredits(auth.verifiedUserId, creditsBilled).catch(() => {});
    }
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
        ? {
            from: FROM_ADDRESS,
            to,
            subject,
            html: htmlBody,
            ...(textBody ? { text: textBody } : {}),
          }
        : { from: FROM_ADDRESS, to, subject, text: textBody }
    );

    if (error || !data) {
      console.error("[proxy/email] Resend error", { userId: trackingUserId, to, error });
      // Resend rejected the send — refund credits.
      if (creditsBilled > 0 && auth.verifiedUserId) {
        await addCredits(auth.verifiedUserId, creditsBilled).catch((refundErr) => {
          console.error("[proxy/email] credit refund failed", {
            userId: auth.verifiedUserId,
            amount: creditsBilled,
            error: refundErr,
          });
        });
      }
      return NextResponse.json(
        { error: error?.message ?? "Email send failed" },
        { status: 502 }
      );
    }

    recordHardCapRequest(trackingUserId);

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
      userId: trackingUserId,
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
    console.error("[proxy/email] send error", { userId: trackingUserId, to, error: err });
    // Unexpected failure — refund credits.
    if (creditsBilled > 0 && auth.verifiedUserId) {
      await addCredits(auth.verifiedUserId, creditsBilled).catch((refundErr) => {
        console.error("[proxy/email] credit refund failed", {
          userId: auth.verifiedUserId,
          amount: creditsBilled,
          error: refundErr,
        });
      });
    }
    return NextResponse.json(
      { error: "Email service unavailable. Please try again." },
      { status: 502 }
    );
  }
}

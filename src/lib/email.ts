/**
 * Email sending via Resend.
 * Set RESEND_API_KEY in .env.local. If unset, emails are no-ops (dev mode).
 */

import { Resend } from "resend";

const DEFAULT_FROM = "VibeTree <onboarding@resend.dev>";
const TO_SUPPORT = "hello@vibetree.com";

function getFromEmail(): string {
  return process.env.EMAIL_FROM ?? DEFAULT_FROM;
}

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendContactFormEmail(opts: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; contact form email skipped");
    return { ok: true };
  }

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: TO_SUPPORT,
      replyTo: opts.email,
      subject: `[Contact] ${opts.subject || "General inquiry"} — ${opts.name}`,
      text: `From: ${opts.name} <${opts.email}>\nSubject: ${opts.subject || "General inquiry"}\n\n${opts.message}`,
    });
    return { ok: true };
  } catch (e) {
    console.error("[email] Contact form send failed:", e);
    return { ok: false, error: "Failed to send message" };
  }
}

export async function sendContactConfirmation(opts: { email: string; name: string }): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) return { ok: true };

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: opts.email,
      subject: "We received your message — VibeTree",
      text: `Hi ${opts.name || "there"},\n\nThanks for reaching out! We've received your message and will get back to you within 24 hours.\n\n— The VibeTree team`,
    });
    return { ok: true };
  } catch (e) {
    console.error("[email] Contact confirmation send failed:", e);
    return { ok: true }; // Don't fail the main flow if confirmation fails
  }
}

export async function sendWaitlistWelcome(opts: {
  email: string;
  name: string;
  position: number;
  referralCode: string;
}): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) return { ok: true };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vibetree.com";
  const referralUrl = `${baseUrl.replace(/\/$/, "")}/waitlist?ref=${opts.referralCode}`;

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: opts.email,
      subject: "You're on the list — VibeTree",
      text: `Hi ${opts.name || "there"},\n\nYou're on the VibeTree waitlist! Your position: #${opts.position}.\n\nShare your referral link to move up:\n${referralUrl}\n\nEach referral earns you 500 points. We'll email you when your spot is ready.\n\n— The VibeTree team`,
    });
    return { ok: true };
  } catch (e) {
    console.error("[email] Waitlist welcome send failed:", e);
    return { ok: true };
  }
}

import { NextRequest, NextResponse } from "next/server";

const RESEND_API_URL = "https://api.resend.com/emails";

// Rate limit: simple in-memory per projectId (reset hourly)
const rateLimit = new Map<string, number[]>();
const RATE_LIMIT_PER_HOUR = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(projectId: string): boolean {
  const now = Date.now();
  let timestamps = rateLimit.get(projectId) ?? [];
  timestamps = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_PER_HOUR) return false;
  timestamps.push(now);
  rateLimit.set(projectId, timestamps);
  return true;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email integration is not configured. Set RESEND_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      projectId: string;
      to: string;
      subject: string;
      text?: string;
      html?: string;
      from?: string;
    };

    const { projectId, to, subject, text, html, from } = body;

    if (!projectId || !to || !subject) {
      return NextResponse.json(
        { error: "projectId, to, and subject are required" },
        { status: 400 }
      );
    }

    const toTrimmed = String(to).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toTrimmed)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (!checkRateLimit(projectId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    const defaultFrom =
      process.env.RESEND_FROM ?? "Vibetree <onboarding@resend.dev>";
    const fromAddr = from?.trim() || defaultFrom;

    const payload: Record<string, unknown> = {
      from: fromAddr,
      to: [toTrimmed],
      subject: String(subject).trim(),
    };
    if (html) payload.html = html;
    else if (text) payload.text = text;
    else payload.text = "";

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg =
        (errData as { message?: string })?.message ?? res.statusText;
      console.error("[integrations/email/send]", res.status, errData);
      return NextResponse.json(
        { error: `Email failed: ${errMsg}` },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const data = (await res.json()) as { id?: string };
    return NextResponse.json({ success: true, id: data.id });
  } catch (e) {
    console.error("[integrations/email/send]", e);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}

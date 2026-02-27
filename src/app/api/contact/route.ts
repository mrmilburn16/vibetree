import { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/apiResponse";

const MAX_MESSAGE_LENGTH = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_SUBJECTS = ["general", "sales", "support", "feedback", "other", ""];

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name) return apiError("Name is required.");
  if (!email || !EMAIL_RE.test(email)) return apiError("A valid email is required.");
  if (!VALID_SUBJECTS.includes(subject)) return apiError("Invalid subject.");
  if (!message) return apiError("Message is required.");
  if (message.length > MAX_MESSAGE_LENGTH) return apiError("Message is too long.");

  const resendKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_EMAIL ?? "hello@vibetree.com";

  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Vibetree Contact <noreply@${process.env.RESEND_DOMAIN ?? "vibetree.com"}>`,
          to: [toEmail],
          reply_to: email,
          subject: `[Contact] ${subject || "General"} — ${name}`,
          text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject || "General"}\n\n${message}`,
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error("[contact] Resend error:", res.status, detail);
        return apiError("Failed to send message. Please try again.", 502);
      }
    } catch (err) {
      console.error("[contact] Resend request failed:", err);
      return apiError("Failed to send message. Please try again.", 502);
    }
  } else {
    console.log("[contact] No RESEND_API_KEY set — logging submission:");
    console.log(JSON.stringify({ name, email, subject, message, ts: new Date().toISOString() }));
  }

  return apiOk();
}

import { NextResponse } from "next/server";
import { sendContactFormEmail, sendContactConfirmation } from "@/lib/email";

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: Request) {
  let body: { name?: string; email?: string; subject?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "General inquiry";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  }

  const result = await sendContactFormEmail({ name, email, subject, message });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to send" }, { status: 500 });
  }

  await sendContactConfirmation({ email, name });

  return NextResponse.json({ success: true });
}

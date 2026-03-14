/** TEMPORARY TEST ENDPOINT — delete after verifying Resend works. */
import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || apiKey === "re_your_key_here") {
    return NextResponse.json({ error: "RESEND_API_KEY not set in .env.local" }, { status: 503 });
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: "VibeTree Apps <apps@vibetree.app>",
    to: "mrmilburn16@gmail.com",
    subject: "VibeTree Email Test",
    text: "If you see this, the email proxy works!",
  });

  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, data });
}

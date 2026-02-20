import { NextResponse } from "next/server";

/**
 * POST /api/projects/[id]/invite-testers
 * Invites external testers to TestFlight by email.
 * Mock: accepts emails and returns success. Replace with App Store Connect API (add testers, send invitation) when backend is ready.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  let body: { emails?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body.emails;
  const emails: string[] = [];
  if (Array.isArray(raw)) {
    for (const e of raw) {
      if (typeof e !== "string") continue;
      for (const part of e.split(/[\s,;]+/)) {
        const t = part.trim();
        if (t) emails.push(t);
      }
    }
  }

  if (emails.length === 0) {
    return NextResponse.json({ error: "At least one email is required" }, { status: 400 });
  }

  // Mock: in production, call App Store Connect API to add testers and send invitations
  return NextResponse.json({
    success: true,
    invited: emails.length,
    message: `Invitations will be sent to ${emails.length} tester(s). (Mock: wire to App Store Connect API.)`,
  });
}

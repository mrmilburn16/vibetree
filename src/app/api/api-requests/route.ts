import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addApiRequest } from "@/lib/apiRequestsFirestore";

/**
 * POST /api/api-requests
 * Body: { apiName: string }
 * Saves an API request for the authenticated user (userId, email, apiName, requestedAt, status: "pending").
 */
export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const apiName = typeof body?.apiName === "string" ? body.apiName.trim() : "";
  if (!apiName) {
    return NextResponse.json(
      { error: "apiName is required." },
      { status: 400 }
    );
  }

  const result = await addApiRequest(user.uid, user.email ?? null, apiName);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Failed to save request." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

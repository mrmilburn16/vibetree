import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getApiPreferences,
  setApiPreference,
  DEFAULT_API_PREFERENCES,
} from "@/lib/userApiPreferencesFirestore";

/**
 * GET /api/user/api-preferences
 * Returns the authenticated user's API enabled/disabled preferences.
 * Falls back to defaults if not authenticated.
 */
export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ preferences: DEFAULT_API_PREFERENCES });
  }
  const preferences = await getApiPreferences(user.uid);
  return NextResponse.json({ preferences });
}

/**
 * PATCH /api/user/api-preferences
 * Body: { apiId: string; enabled: boolean }
 * Saves the preference for a single API.
 */
export async function PATCH(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const apiId = typeof body?.apiId === "string" ? body.apiId.trim() : "";
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;

  if (!apiId || enabled === null) {
    return NextResponse.json(
      { error: "apiId (string) and enabled (boolean) are required." },
      { status: 400 }
    );
  }

  const result = await setApiPreference(user.uid, apiId, enabled);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, apiId, enabled });
}

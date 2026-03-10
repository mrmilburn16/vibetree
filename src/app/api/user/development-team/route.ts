import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getDevelopmentTeamId,
  setDevelopmentTeamId,
  isValidDevelopmentTeamId,
  normalizeDevelopmentTeamId,
} from "@/lib/userDevelopmentTeamFirestore";

/**
 * GET /api/user/development-team
 * Returns the authenticated user's saved Apple Developer Team ID.
 */
export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = await getDevelopmentTeamId(user.uid);
  // Temporary: verify team ID flow — log what Firestore returns for developmentTeamId
  console.log("[GET /api/user/development-team] Firestore developmentTeamId for uid:", user.uid, "->", teamId ?? "(null/empty)");
  return NextResponse.json({ developmentTeamId: teamId ?? "" });
}

/**
 * PATCH /api/user/development-team
 * Body: { developmentTeamId: string }
 * Validates (10-char alphanumeric) and saves to users/{userId}.
 */
export async function PATCH(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const raw = typeof body?.developmentTeamId === "string" ? body.developmentTeamId.trim() : "";
  if (!raw) {
    return NextResponse.json(
      { error: "Team ID must be exactly 10 letters or numbers. Find it in Apple Developer → Account → Membership details." },
      { status: 400 }
    );
  }
  if (!isValidDevelopmentTeamId(raw)) {
    return NextResponse.json(
      { error: "Team ID must be exactly 10 letters or numbers (e.g. from Apple Developer → Membership details)." },
      { status: 400 }
    );
  }
  const result = await setDevelopmentTeamId(user.uid, normalizeDevelopmentTeamId(raw));
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Failed to save." },
      { status: 500 }
    );
  }
  return NextResponse.json({ developmentTeamId: normalizeDevelopmentTeamId(raw) });
}

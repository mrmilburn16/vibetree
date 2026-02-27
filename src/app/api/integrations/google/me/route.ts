import { NextRequest, NextResponse } from "next/server";
import { getIntegrationToken } from "@/lib/integrationTokens";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  const userId = searchParams.get("userId") ?? undefined;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const token = await getIntegrationToken(projectId, "google", userId);
  if (!token) {
    return NextResponse.json(
      { error: "Google account not connected. Connect Google first for this project." },
      { status: 401 }
    );
  }

  const meta = token.meta as { googleId?: string; email?: string; name?: string } | undefined;
  return NextResponse.json({
    googleId: meta?.googleId ?? "",
    email: meta?.email ?? "",
    name: meta?.name ?? "",
  });
}

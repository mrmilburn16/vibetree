import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { setOAuthState } from "@/lib/oauthState";
import { getIntegrationsBaseUrl } from "@/lib/integrationsBaseUrl";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google integration is not configured. Set GOOGLE_CLIENT_ID." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  const userId = searchParams.get("userId") ?? undefined;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const baseUrl = getIntegrationsBaseUrl();
  const redirectUri = `${baseUrl}/api/integrations/google/callback`;

  const state = randomBytes(16).toString("hex");
  setOAuthState(state, {
    projectId,
    userId,
    provider: "google",
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}

import { NextRequest, NextResponse } from "next/server";
import { getOAuthState } from "@/lib/oauthState";
import { setIntegrationToken } from "@/lib/integrationTokens";
import { getIntegrationsBaseUrl } from "@/lib/integrationsBaseUrl";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${getIntegrationsBaseUrl()}/?error=integration_not_configured`
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${getIntegrationsBaseUrl()}/?error=google_oauth_denied&error_description=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${getIntegrationsBaseUrl()}/?error=missing_code_or_state`
    );
  }

  const oauthData = getOAuthState(state);
  if (!oauthData) {
    return NextResponse.redirect(
      `${getIntegrationsBaseUrl()}/?error=invalid_state`
    );
  }

  const baseUrl = getIntegrationsBaseUrl();
  const redirectUri = `${baseUrl}/api/integrations/google/callback`;

  const tokenBody = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("[integrations/google/callback] Token exchange failed:", tokenRes.status, errText);
    return NextResponse.redirect(
      `${getIntegrationsBaseUrl()}/?error=token_exchange_failed`
    );
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = tokenData.expires_in
    ? Date.now() + tokenData.expires_in * 1000
    : undefined;

  let googleId = "";
  let email = "";
  let name = "";

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (userRes.ok) {
    const userData = (await userRes.json()) as { id?: string; email?: string; name?: string };
    googleId = userData.id ?? "";
    email = userData.email ?? "";
    name = userData.name ?? "";
  }

  await setIntegrationToken({
    projectId: oauthData.projectId,
    userId: oauthData.userId,
    provider: "google",
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    meta: { googleId, email, name },
    updatedAt: Date.now(),
  });

  return NextResponse.redirect(
    `${getIntegrationsBaseUrl()}/?integrations=google_connected&projectId=${encodeURIComponent(oauthData.projectId)}`
  );
}

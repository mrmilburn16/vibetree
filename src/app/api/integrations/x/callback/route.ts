import { NextRequest, NextResponse } from "next/server";
import { getOAuthState } from "@/lib/oauthState";
import { setIntegrationToken } from "@/lib/integrationTokens";
import { getIntegrationsBaseUrl } from "@/lib/integrationsBaseUrl";

const TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

export async function GET(request: NextRequest) {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_ID_SECRET ?? process.env.TWITTER_CLIENT_SECRET;
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
      `${getIntegrationsBaseUrl()}/?error=x_oauth_denied&error_description=${encodeURIComponent(error)}`
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
  const redirectUri = `${baseUrl}/api/integrations/x/callback`;

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: oauthData.codeVerifier ?? "",
  });

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch(TWITTER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${authHeader}`,
    },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("[integrations/x/callback] Token exchange failed:", tokenRes.status, errText);
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

  await setIntegrationToken({
    projectId: oauthData.projectId,
    userId: oauthData.userId,
    provider: "x",
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    updatedAt: Date.now(),
  });

  return NextResponse.redirect(
    `${getIntegrationsBaseUrl()}/?integrations=x_connected&projectId=${encodeURIComponent(oauthData.projectId)}`
  );
}

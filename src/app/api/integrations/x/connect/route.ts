import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { setOAuthState } from "@/lib/oauthState";
import { getIntegrationsBaseUrl } from "@/lib/integrationsBaseUrl";

const TWITTER_AUTH_URL = "https://twitter.com/i/oauth2/authorize";

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: NextRequest) {
  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "X integration is not configured. Set TWITTER_CLIENT_ID." },
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
  const redirectUri = `${baseUrl}/api/integrations/x/callback`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = randomBytes(16).toString("hex");

  setOAuthState(state, {
    projectId,
    userId,
    codeVerifier,
    provider: "x",
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read tweet.write users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `${TWITTER_AUTH_URL}?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}

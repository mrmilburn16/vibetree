import { NextRequest, NextResponse } from "next/server";
import { getIntegrationToken } from "@/lib/integrationTokens";

const TWITTER_TWEET_URL = "https://api.twitter.com/2/tweets";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      projectId: string;
      userId?: string;
      text: string;
      mediaIds?: string[];
    };

    const { projectId, userId, text } = body;
    if (!projectId || typeof text !== "string") {
      return NextResponse.json(
        { error: "projectId and text are required" },
        { status: 400 }
      );
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "text cannot be empty" }, { status: 400 });
    }

    if (trimmed.length > 280) {
      return NextResponse.json(
        { error: "Tweet text must be 280 characters or less" },
        { status: 400 }
      );
    }

    const token = await getIntegrationToken(projectId, "x", userId);
    if (!token) {
      return NextResponse.json(
        { error: "X account not connected. Connect X first for this project." },
        { status: 401 }
      );
    }

    const payload: { text: string; media?: { media_ids: string[] } } = {
      text: trimmed,
    };
    if (body.mediaIds && body.mediaIds.length > 0) {
      payload.media = { media_ids: body.mediaIds };
    }

    const res = await fetch(TWITTER_TWEET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg =
        (errData as { detail?: string })?.detail ??
        (errData as { error?: string })?.error ??
        res.statusText;
      console.error("[integrations/x/post]", res.status, errData);
      return NextResponse.json(
        { error: `X API error: ${errMsg}` },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const data = (await res.json()) as { data?: { id: string } };
    return NextResponse.json({
      success: true,
      tweetId: data.data?.id,
    });
  } catch (e) {
    console.error("[integrations/x/post]", e);
    return NextResponse.json(
      { error: "Failed to post tweet" },
      { status: 500 }
    );
  }
}

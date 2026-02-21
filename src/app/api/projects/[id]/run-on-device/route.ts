import { NextResponse } from "next/server";
import { runExpoPreview } from "@/lib/expoPreview";

/**
 * GET /api/projects/[id]/run-on-device
 * Standard (Expo): runs expo start --tunnel, returns expoUrl for QR in Expo Go.
 * Pro (Swift): returns projectType "pro" and no expoUrl; client shows "Download source" CTA.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const projectType = url.searchParams.get("projectType") === "pro" ? "pro" : "standard";

  if (projectType === "pro") {
    return NextResponse.json({
      expoUrl: null,
      projectType: "pro",
      testFlightLink: null,
    });
  }

  const result = await runExpoPreview(id);

  if ("error" in result) {
    const status =
      result.code === "NO_FILES" || result.code === "NO_APP"
        ? 400
        : 503;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status }
    );
  }

  return NextResponse.json({
    expoUrl: result.expoUrl,
    projectType: "standard",
    testFlightLink: null,
  });
}

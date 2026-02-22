import { NextResponse } from "next/server";
import { runExpoPreview } from "@/lib/expoPreview";

/**
 * GET /api/projects/[id]/run-on-device
 * Standard (Expo): runs expo start --tunnel, returns expoUrl for QR in Expo Go.
 * Pro (Swift): returns projectType "pro" and no expoUrl; client shows "Download source" CTA.
 *
 * POST /api/projects/[id]/run-on-device
 * Body: { files?: Array<{ path: string; content: string }> }
 * When server has no files in memory, client can send files from localStorage so Expo still runs.
 */
async function handleRunOnDevice(
  id: string,
  projectType: "standard" | "pro",
  clientFiles?: Array<{ path: string; content: string }>
) {
  if (projectType === "pro") {
    return NextResponse.json({
      expoUrl: null,
      projectType: "pro",
      testFlightLink: null,
    });
  }

  const result = await runExpoPreview(id, clientFiles);

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
  return handleRunOnDevice(id, projectType);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }
  const url = new URL(request.url);
  const projectType = url.searchParams.get("projectType") === "pro" ? "pro" : "standard";
  let clientFiles: Array<{ path: string; content: string }> | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body?.files)) {
      clientFiles = body.files.filter(
        (f: unknown) =>
          f &&
          typeof f === "object" &&
          typeof (f as { path?: unknown }).path === "string" &&
          typeof (f as { content?: unknown }).content === "string"
      ) as Array<{ path: string; content: string }>;
    }
  } catch {
    // ignore
  }
  return handleRunOnDevice(id, projectType, clientFiles?.length ? clientFiles : undefined);
}

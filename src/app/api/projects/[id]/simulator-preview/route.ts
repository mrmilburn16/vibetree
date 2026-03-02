import { NextResponse } from "next/server";
import { getSimulatorFrame } from "@/lib/simulatorFrameStore";
import { requireProjectAuth } from "@/lib/apiProjectAuth";

/**
 * GET /api/projects/[id]/simulator-preview
 * Returns the latest simulator frame as PNG for the preview pane.
 * 404 when no frame has been posted yet, or when updatedAfter is provided and the stored frame is older (so the client can skip showing a stale "previous build" frame).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  const auth = await requireProjectAuth(request, projectId);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const updatedAfter = searchParams.get("updatedAfter");
  const updatedAfterMs = updatedAfter ? Number(updatedAfter) : 0;

  const frame = getSimulatorFrame(projectId);
  if (!frame) return new NextResponse(null, { status: 404 });
  // Client asks to skip frames older than this (e.g. timestamp when build went "live"); show loading until a fresh frame exists.
  if (updatedAfterMs > 0 && frame.updatedAt < updatedAfterMs) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(frame.buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

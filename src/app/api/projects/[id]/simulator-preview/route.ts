import { NextResponse } from "next/server";
import { getSimulatorFrame } from "@/lib/simulatorFrameStore";

/**
 * GET /api/projects/[id]/simulator-preview
 * Returns the latest simulator frame as JPEG for the preview pane.
 * 404 when no frame has been posted yet (e.g. simulator not started).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) return NextResponse.json({ error: "Missing project id" }, { status: 400 });

  const frame = getSimulatorFrame(projectId);
  if (!frame) return new NextResponse(null, { status: 404 });

  return new NextResponse(frame.buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

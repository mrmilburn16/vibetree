import { NextRequest, NextResponse } from "next/server";
import { getProjectIPA } from "@/lib/ipaStore";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const ipa = getProjectIPA(projectId);

  if (!ipa) {
    return NextResponse.json(
      { error: "No IPA available. Build with IPA output first." },
      { status: 404 }
    );
  }

  // NextResponse expects BodyInit; Buffer isn't typed as BodyInit in TS here.
  // Convert to Uint8Array so TypeScript + runtime both agree.
  const body = new Uint8Array(ipa);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="VibeTreeApp.ipa"`,
      "Content-Length": String(body.byteLength),
    },
  });
}

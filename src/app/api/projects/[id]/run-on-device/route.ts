import { NextResponse } from "next/server";

/**
 * GET /api/projects/[id]/run-on-device
 * Returns URLs for Expo Go and TestFlight so the Run on device modal can show QR codes and links.
 * Mock: returns placeholder URLs. Replace with real build pipeline (Expo server URL, TestFlight link) when backend is ready.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  // Mock: in production, trigger or look up build, then return real expoUrl and/or testFlightLink
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vibetree.vercel.app";
  const expoUrl = `exp://${baseUrl.replace(/^https?:\/\//, "")}/expo/${id}`;
  const testFlightLink = `https://testflight.apple.com/join/mock-${id.slice(0, 8)}`;

  return NextResponse.json({
    expoUrl,
    testFlightLink,
    // When backend is ready: include status "building" | "ready" and only return links when ready
  });
}

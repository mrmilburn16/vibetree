import { NextRequest, NextResponse } from "next/server";
import { runHealthChecksIfStale, getEffectiveStatus, loadStatus } from "@/lib/serviceStatus";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3001";
  const baseUrl = `${proto}://${host}`;

  const data = await runHealthChecksIfStale(baseUrl);

  const services = data.services.map((s) => ({
    id: s.id,
    name: s.name,
    status: getEffectiveStatus(s),
    message: s.overrideMessage,
    lastChecked: s.lastChecked,
  }));

  return NextResponse.json({
    services,
    globalMessage: data.globalMessage,
    allOperational: services.every((s) => s.status === "operational"),
  });
}

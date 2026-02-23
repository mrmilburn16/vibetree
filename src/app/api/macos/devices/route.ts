import { NextResponse } from "next/server";
import { getRunnerDevices } from "@/lib/runnerDevices";

export const runtime = "nodejs";

export async function GET() {
  const snap = getRunnerDevices();
  if (!snap) {
    return NextResponse.json({ connected: false, updatedAt: null, runnerId: null, physical: [], simulators: [] });
  }
  return NextResponse.json({ connected: true, ...snap });
}


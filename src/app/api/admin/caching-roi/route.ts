import { NextResponse } from "next/server";
import { getCachingROIStats } from "@/lib/llm/analyticsLog";

export const runtime = "nodejs";

export async function GET() {
  const stats = getCachingROIStats();
  return NextResponse.json(stats);
}

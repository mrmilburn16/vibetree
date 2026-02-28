import { NextResponse } from "next/server";
import { computeQAInsights } from "@/lib/qa/qaInsights";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const insights = await computeQAInsights();
    return NextResponse.json(insights);
  } catch (e) {
    console.error("[qa-insights] Failed:", e);
    return NextResponse.json({ error: "Failed to compute QA insights" }, { status: 500 });
  }
}

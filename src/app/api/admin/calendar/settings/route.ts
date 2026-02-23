import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/adminCalendarStore";

export async function GET() {
  return NextResponse.json({ settings: getSettings() });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const settings = updateSettings(body);
  return NextResponse.json({ settings });
}

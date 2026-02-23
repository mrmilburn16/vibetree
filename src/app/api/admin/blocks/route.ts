import { NextRequest, NextResponse } from "next/server";
import { getBlocks, createBlock } from "@/lib/adminCalendarStore";

export async function GET() {
  return NextResponse.json({ blocks: getBlocks() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.title || !body.type || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: "title, type, startTime, endTime required" }, { status: 400 });
  }
  const block = createBlock({
    title: body.title,
    type: body.type,
    startTime: body.startTime,
    endTime: body.endTime,
    recurring: body.recurring ?? "none",
    recurringDay: body.recurringDay,
    specificDate: body.specificDate,
  });
  return NextResponse.json({ block }, { status: 201 });
}

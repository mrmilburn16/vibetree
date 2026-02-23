import { NextRequest, NextResponse } from "next/server";
import { getTasks, createTask } from "@/lib/adminCalendarStore";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  let tasks = getTasks();
  if (status) tasks = tasks.filter((t) => t.status === status);
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const task = createTask(body);
  return NextResponse.json({ task }, { status: 201 });
}

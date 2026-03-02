import { NextRequest, NextResponse } from "next/server";
import { getTasks, createTask, getSettings, scheduleFromDueDate } from "@/lib/adminCalendarStore";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  let tasks = getTasks();
  if (status) tasks = tasks.filter((t) => t.status === status);
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });

  let input = { ...body };
  if (body.dueDate && String(body.dueDate).trim() && !body.scheduledStart) {
    const settings = getSettings();
    const mins = body.estimatedMinutes ?? 30;
    const { scheduledStart, scheduledEnd } = scheduleFromDueDate(body.dueDate, settings.workStart, mins);
    input = { ...input, scheduledStart, scheduledEnd };
  }
  const task = createTask(input);
  return NextResponse.json({ task }, { status: 201 });
}

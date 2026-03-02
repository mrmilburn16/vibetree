import { NextRequest, NextResponse } from "next/server";
import { updateTask, deleteTask, getTask, getSettings, scheduleFromDueDate } from "@/lib/adminCalendarStore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const existing = getTask(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  let updates = { ...body };
  const dueDate = body.dueDate !== undefined ? body.dueDate : existing.dueDate;
  const hasScheduled = existing.scheduledStart != null;
  const updatingSchedule = body.scheduledStart !== undefined;
  if (dueDate && String(dueDate).trim() && !hasScheduled && !updatingSchedule) {
    const settings = getSettings();
    const mins = body.estimatedMinutes ?? existing.estimatedMinutes;
    const { scheduledStart, scheduledEnd } = scheduleFromDueDate(dueDate, settings.workStart, mins);
    updates = { ...updates, scheduledStart, scheduledEnd };
  }
  const task = updateTask(id, updates);
  return NextResponse.json({ task });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deleteTask(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

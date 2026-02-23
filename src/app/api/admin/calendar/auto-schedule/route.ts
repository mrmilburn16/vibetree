import { NextRequest, NextResponse } from "next/server";
import { autoSchedule, updateTask } from "@/lib/adminCalendarStore";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const targetDate: string | undefined = body.date;
  const confirm: boolean = body.confirm === true;

  const result = autoSchedule(targetDate);

  if (confirm && result.scheduled.length > 0) {
    for (const s of result.scheduled) {
      updateTask(s.taskId, {
        scheduledStart: s.scheduledStart,
        scheduledEnd: s.scheduledEnd,
      });
    }
  }

  return NextResponse.json({
    scheduled: result.scheduled,
    overflow: result.overflow,
    confirmed: confirm,
  });
}

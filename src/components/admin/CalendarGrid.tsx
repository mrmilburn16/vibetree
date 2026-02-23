"use client";

import type { Task, TimeBlock } from "@/lib/adminCalendarStore";

const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-red-500/20 border-red-500/40 text-red-300",
  2: "bg-orange-500/20 border-orange-500/40 text-orange-300",
  3: "bg-[var(--button-primary-bg)]/20 border-[var(--button-primary-bg)]/40 text-[var(--link-default)]",
  4: "bg-sky-500/20 border-sky-500/40 text-sky-300",
  5: "bg-[var(--text-tertiary)]/10 border-[var(--border-default)] text-[var(--text-tertiary)]",
};

const BLOCK_STYLE = "bg-[var(--background-tertiary)] border-[var(--border-subtle)] text-[var(--text-tertiary)] opacity-70";

interface CalendarGridProps {
  weekDates: Date[];
  tasks: Task[];
  blocks: TimeBlock[];
  workStart: string;
  workEnd: string;
  slotMinutes: number;
  todayStr: string;
  onSlotClick: (date: string, time: string) => void;
  onTaskClick: (task: Task) => void;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateHeader(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getBlocksForDate(blocks: TimeBlock[], date: Date): Array<{ start: number; end: number; title: string; isDayOff: boolean }> {
  const dayOfWeek = date.getDay();
  const ds = dateStr(date);
  const result: Array<{ start: number; end: number; title: string; isDayOff: boolean }> = [];

  for (const b of blocks) {
    let applies = false;
    if (b.recurring === "daily") applies = true;
    else if (b.recurring === "weekdays" && dayOfWeek >= 1 && dayOfWeek <= 5) applies = true;
    else if (b.recurring === "weekly" && b.recurringDay === dayOfWeek) applies = true;
    else if (b.recurring === "none" && b.specificDate === ds) applies = true;

    if (applies) {
      if (b.type === "day-off") {
        result.push({ start: 0, end: 24 * 60, title: b.title, isDayOff: true });
      } else {
        result.push({ start: timeToMinutes(b.startTime), end: timeToMinutes(b.endTime), title: b.title, isDayOff: false });
      }
    }
  }
  return result;
}

export function CalendarGrid({
  weekDates,
  tasks,
  blocks,
  workStart,
  workEnd,
  slotMinutes,
  todayStr,
  onSlotClick,
  onTaskClick,
}: CalendarGridProps) {
  const startMin = timeToMinutes(workStart);
  const endMin = timeToMinutes(workEnd);
  const totalSlots = (endMin - startMin) / slotMinutes;
  const hourLabels: number[] = [];
  for (let m = startMin; m < endMin; m += 60) hourLabels.push(m);

  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)]">
      <div className="min-w-[700px]">
        {/* Header row */}
        <div className="grid border-b border-[var(--border-default)]" style={{ gridTemplateColumns: `60px repeat(${weekDates.length}, 1fr)` }}>
          <div className="p-2" />
          {weekDates.map((d) => {
            const ds = dateStr(d);
            const isToday = ds === todayStr;
            return (
              <div
                key={ds}
                className={`border-l border-[var(--border-default)] p-2 text-center text-xs font-medium ${
                  isToday ? "bg-[var(--button-primary-bg)]/10 text-[var(--link-default)]" : "text-[var(--text-secondary)]"
                }`}
              >
                {formatDateHeader(d)}
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="relative grid" style={{ gridTemplateColumns: `60px repeat(${weekDates.length}, 1fr)` }}>
          {/* Time labels column */}
          <div className="relative">
            {hourLabels.map((m) => (
              <div
                key={m}
                className="flex items-start justify-end pr-2 text-[10px] text-[var(--text-tertiary)]"
                style={{ height: `${(60 / slotMinutes) * 28}px` }}
              >
                {minutesToLabel(m)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((d) => {
            const ds = dateStr(d);
            const isToday = ds === todayStr;
            const dayBlocks = getBlocksForDate(blocks, d);
            const isDayOff = dayBlocks.some((b) => b.isDayOff);
            const dayTasks = tasks.filter(
              (t) => t.scheduledStart?.startsWith(ds) && t.status !== "done",
            );
            const doneTasks = tasks.filter(
              (t) => t.scheduledStart?.startsWith(ds) && t.status === "done",
            );

            return (
              <div
                key={ds}
                className={`relative border-l border-[var(--border-default)] ${isToday ? "bg-[var(--button-primary-bg)]/5" : ""} ${isDayOff ? "bg-[var(--background-tertiary)]/50" : ""}`}
                style={{ height: `${totalSlots * 28}px` }}
              >
                {/* Slot grid lines */}
                {Array.from({ length: totalSlots }).map((_, i) => (
                  <div
                    key={i}
                    className={`absolute w-full border-b ${i % (60 / slotMinutes) === 0 ? "border-[var(--border-default)]/50" : "border-[var(--border-subtle)]/20"} ${isDayOff ? "pointer-events-none" : "cursor-pointer hover:bg-[var(--background-tertiary)]/30"}`}
                    style={{ top: `${i * 28}px`, height: "28px" }}
                    onClick={() => {
                      if (isDayOff) return;
                      const mins = startMin + i * slotMinutes;
                      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
                      const mm = String(mins % 60).padStart(2, "0");
                      onSlotClick(ds, `${hh}:${mm}`);
                    }}
                  />
                ))}

                {/* Day-off overlay */}
                {isDayOff && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-[var(--radius-md)] bg-[var(--background-tertiary)] px-3 py-1 text-xs font-medium text-[var(--text-tertiary)]">
                      {dayBlocks.find((b) => b.isDayOff)?.title || "Day Off"}
                    </span>
                  </div>
                )}

                {/* Time blocks */}
                {!isDayOff &&
                  dayBlocks
                    .filter((b) => !b.isDayOff)
                    .map((b, i) => {
                      const top = ((b.start - startMin) / slotMinutes) * 28;
                      const height = ((b.end - b.start) / slotMinutes) * 28;
                      if (top < 0 || top >= totalSlots * 28) return null;
                      return (
                        <div
                          key={`block-${i}`}
                          className={`absolute left-0.5 right-0.5 z-10 flex items-center justify-center rounded-[var(--radius-sm)] border text-[10px] font-medium ${BLOCK_STYLE}`}
                          style={{ top: `${top}px`, height: `${Math.max(height, 14)}px` }}
                        >
                          {height >= 20 && b.title}
                        </div>
                      );
                    })}

                {/* Scheduled tasks */}
                {[...dayTasks, ...doneTasks].map((t) => {
                  const tStart = timeToMinutes(t.scheduledStart!.slice(11, 16));
                  const tEnd = timeToMinutes(t.scheduledEnd!.slice(11, 16));
                  const top = ((tStart - startMin) / slotMinutes) * 28;
                  const height = ((tEnd - tStart) / slotMinutes) * 28;
                  const isDone = t.status === "done";

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onTaskClick(t)}
                      className={`absolute left-0.5 right-0.5 z-20 flex flex-col justify-center overflow-hidden rounded-[var(--radius-sm)] border px-1.5 text-left transition-opacity hover:opacity-80 ${
                        isDone ? "opacity-50 line-through" : ""
                      } ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS[3]}`}
                      style={{ top: `${top}px`, height: `${Math.max(height, 14)}px` }}
                    >
                      <span className="truncate text-[10px] font-semibold leading-tight">{t.title}</span>
                      {height >= 36 && (
                        <span className="truncate text-[9px] opacity-70">
                          {t.estimatedMinutes}m · P{t.priority}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

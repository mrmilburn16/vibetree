import fs from "fs";
import path from "path";

/* ────────────────────────── Types ────────────────────────── */

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes: number;
  dueDate?: string;
  status: "todo" | "in-progress" | "done";
  category?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  aiPrioritized?: boolean;
  aiEstimated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeBlock {
  id: string;
  title: string;
  type: "lunch" | "break" | "meeting" | "day-off" | "focus" | "custom";
  startTime: string;
  endTime: string;
  recurring: "none" | "daily" | "weekdays" | "weekly";
  recurringDay?: number;
  specificDate?: string;
  createdAt: string;
}

export interface CalendarSettings {
  workStart: string;
  workEnd: string;
  slotMinutes: number;
  workDays: number[];
  bufferMinutes: number;
}

/* ────────────────────────── Paths ────────────────────────── */

const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_PATH = path.join(DATA_DIR, "admin-tasks.json");
const BLOCKS_PATH = path.join(DATA_DIR, "admin-blocks.json");
const SETTINGS_PATH = path.join(DATA_DIR, "admin-calendar-settings.json");

const DEFAULT_SETTINGS: CalendarSettings = {
  workStart: "09:00",
  workEnd: "17:00",
  slotMinutes: 15,
  workDays: [1, 2, 3, 4, 5],
  bufferMinutes: 5,
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(filepath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filepath)) return fallback;
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson<T>(filepath: string, data: T): void {
  ensureDataDir();
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ────────────────────────── Tasks ────────────────────────── */

export function getTasks(): Task[] {
  return readJson<Task[]>(TASKS_PATH, []);
}

export function getTask(id: string): Task | undefined {
  return getTasks().find((t) => t.id === id);
}

export function createTask(input: {
  title: string;
  description?: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes?: number;
  dueDate?: string;
  category?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}): Task {
  const tasks = getTasks();
  const now = new Date().toISOString();
  const task: Task = {
    id: genId("task"),
    title: input.title,
    description: input.description,
    priority: input.priority ?? 3,
    estimatedMinutes: input.estimatedMinutes ?? 30,
    dueDate: input.dueDate,
    status: "todo",
    category: input.category,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  writeJson(TASKS_PATH, tasks);
  return task;
}

export function updateTask(id: string, updates: Partial<Omit<Task, "id" | "createdAt">>): Task | undefined {
  const tasks = getTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return undefined;
  tasks[idx] = { ...tasks[idx], ...updates, updatedAt: new Date().toISOString() };
  writeJson(TASKS_PATH, tasks);
  return tasks[idx];
}

export function deleteTask(id: string): boolean {
  const tasks = getTasks();
  const filtered = tasks.filter((t) => t.id !== id);
  if (filtered.length === tasks.length) return false;
  writeJson(TASKS_PATH, filtered);
  return true;
}

/* ────────────────────────── Blocks ────────────────────────── */

export function getBlocks(): TimeBlock[] {
  return readJson<TimeBlock[]>(BLOCKS_PATH, []);
}

export function createBlock(input: {
  title: string;
  type: TimeBlock["type"];
  startTime: string;
  endTime: string;
  recurring: TimeBlock["recurring"];
  recurringDay?: number;
  specificDate?: string;
}): TimeBlock {
  const blocks = getBlocks();
  const block: TimeBlock = {
    id: genId("block"),
    title: input.title,
    type: input.type,
    startTime: input.startTime,
    endTime: input.endTime,
    recurring: input.recurring,
    recurringDay: input.recurringDay,
    specificDate: input.specificDate,
    createdAt: new Date().toISOString(),
  };
  blocks.push(block);
  writeJson(BLOCKS_PATH, blocks);
  return block;
}

export function deleteBlock(id: string): boolean {
  const blocks = getBlocks();
  const filtered = blocks.filter((b) => b.id !== id);
  if (filtered.length === blocks.length) return false;
  writeJson(BLOCKS_PATH, filtered);
  return true;
}

/* ────────────────────────── Settings ────────────────────────── */

export function getSettings(): CalendarSettings {
  return readJson<CalendarSettings>(SETTINGS_PATH, DEFAULT_SETTINGS);
}

export function updateSettings(updates: Partial<CalendarSettings>): CalendarSettings {
  const current = getSettings();
  const merged = { ...current, ...updates };
  writeJson(SETTINGS_PATH, merged);
  return merged;
}

/* ────────────────────────── Schedule from due date ────────────────────────── */

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Return scheduledStart/scheduledEnd for a task due on dueDate (YYYY-MM-DD) at work start time. */
export function scheduleFromDueDate(
  dueDate: string,
  workStart: string,
  estimatedMinutes: number
): { scheduledStart: string; scheduledEnd: string } {
  const startMins = timeToMinutes(workStart);
  const endMins = startMins + estimatedMinutes;
  return {
    scheduledStart: `${dueDate}T${minutesToTime(startMins)}:00`,
    scheduledEnd: `${dueDate}T${minutesToTime(endMins)}:00`,
  };
}

/* ────────────────────────── Auto-schedule ────────────────────────── */

function getBlocksForDate(blocks: TimeBlock[], date: Date): Array<{ start: number; end: number }> {
  const dayOfWeek = date.getDay();
  const dateStr = date.toISOString().split("T")[0];
  const result: Array<{ start: number; end: number }> = [];

  for (const b of blocks) {
    let applies = false;
    if (b.recurring === "daily") applies = true;
    else if (b.recurring === "weekdays" && dayOfWeek >= 1 && dayOfWeek <= 5) applies = true;
    else if (b.recurring === "weekly" && b.recurringDay === dayOfWeek) applies = true;
    else if (b.recurring === "none" && b.specificDate === dateStr) applies = true;

    if (applies) {
      if (b.type === "day-off") {
        result.push({ start: 0, end: 24 * 60 });
      } else {
        result.push({ start: timeToMinutes(b.startTime), end: timeToMinutes(b.endTime) });
      }
    }
  }
  return result;
}

export interface ScheduleProposal {
  taskId: string;
  scheduledStart: string;
  scheduledEnd: string;
  date: string;
}

export function autoSchedule(targetDate?: string): {
  scheduled: ScheduleProposal[];
  overflow: string[];
} {
  const settings = getSettings();
  const allTasks = getTasks();
  const blocks = getBlocks();

  const unscheduled = allTasks
    .filter((t) => t.status !== "done" && !t.scheduledStart)
    .sort((a, b) => a.priority - b.priority);

  if (unscheduled.length === 0) return { scheduled: [], overflow: [] };

  const workStart = timeToMinutes(settings.workStart);
  const workEnd = timeToMinutes(settings.workEnd);
  const buffer = settings.bufferMinutes;

  const scheduledTasks = allTasks.filter((t) => t.scheduledStart && t.status !== "done");

  const startDate = targetDate ? new Date(targetDate + "T00:00:00") : new Date();
  const scheduled: ScheduleProposal[] = [];
  const overflow: string[] = [];

  const maxDays = 14;
  let taskIdx = 0;

  for (let dayOffset = 0; dayOffset < maxDays && taskIdx < unscheduled.length; dayOffset++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    const dayOfWeek = date.getDay();

    if (!settings.workDays.includes(dayOfWeek)) continue;

    const dateStr = date.toISOString().split("T")[0];
    const dayBlocks = getBlocksForDate(blocks, date);

    if (dayBlocks.some((b) => b.start === 0 && b.end === 24 * 60)) continue;

    const occupied: Array<{ start: number; end: number }> = [
      ...dayBlocks,
      ...scheduledTasks
        .filter((t) => t.scheduledStart?.startsWith(dateStr))
        .map((t) => ({
          start: timeToMinutes(t.scheduledStart!.slice(11, 16)),
          end: timeToMinutes(t.scheduledEnd!.slice(11, 16)),
        })),
      ...scheduled
        .filter((s) => s.date === dateStr)
        .map((s) => ({
          start: timeToMinutes(s.scheduledStart.slice(11, 16)),
          end: timeToMinutes(s.scheduledEnd.slice(11, 16)),
        })),
    ].sort((a, b) => a.start - b.start);

    while (taskIdx < unscheduled.length) {
      const task = unscheduled[taskIdx];
      const needed = task.estimatedMinutes;
      let placed = false;

      let cursor = workStart;
      for (const occ of occupied) {
        if (cursor + needed + buffer <= occ.start && cursor + needed <= workEnd) {
          const endMin = cursor + needed;
          scheduled.push({
            taskId: task.id,
            date: dateStr,
            scheduledStart: `${dateStr}T${minutesToTime(cursor)}:00`,
            scheduledEnd: `${dateStr}T${minutesToTime(endMin)}:00`,
          });
          occupied.push({ start: cursor, end: endMin + buffer });
          occupied.sort((a, b) => a.start - b.start);
          placed = true;
          break;
        }
        cursor = Math.max(cursor, occ.end + buffer);
      }

      if (!placed && cursor + needed <= workEnd) {
        const endMin = cursor + needed;
        scheduled.push({
          taskId: task.id,
          date: dateStr,
          scheduledStart: `${dateStr}T${minutesToTime(cursor)}:00`,
          scheduledEnd: `${dateStr}T${minutesToTime(endMin)}:00`,
        });
        occupied.push({ start: cursor, end: endMin + buffer });
        occupied.sort((a, b) => a.start - b.start);
        placed = true;
      }

      if (placed) {
        taskIdx++;
      } else {
        break;
      }
    }
  }

  for (let i = taskIdx; i < unscheduled.length; i++) {
    overflow.push(unscheduled[i].id);
  }

  return { scheduled, overflow };
}

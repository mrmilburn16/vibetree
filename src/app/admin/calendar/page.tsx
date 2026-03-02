"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui";
import { CalendarGrid } from "@/components/admin/CalendarGrid";
import { TaskPanel } from "@/components/admin/TaskPanel";
import { TaskModal } from "@/components/admin/TaskModal";
import { BlockModal } from "@/components/admin/BlockModal";
import type { Task, TimeBlock, CalendarSettings } from "@/lib/adminCalendarStore";

/* ────────────────────────── Helpers ────────────────────────── */

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatWeekRange(dates: Date[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  const yearOpts: Intl.DateTimeFormatOptions = { ...opts, year: "numeric" };
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString(undefined, opts)} – ${last.toLocaleDateString(undefined, opts)}, ${first.getFullYear()}`;
  }
  return `${first.toLocaleDateString(undefined, opts)} – ${last.toLocaleDateString(undefined, yearOpts)}`;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ────────────────────────── Page ────────────────────────── */

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [settings, setSettings] = useState<CalendarSettings>({
    workStart: "09:00",
    workEnd: "17:00",
    slotMinutes: 15,
    workDays: [1, 2, 3, 4, 5],
    bufferMinutes: 5,
  });
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const weekDates = getWeekDates(weekStart);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [prefillTime, setPrefillTime] = useState<{ date: string; time: string } | undefined>();
  const [aiLoading, setAiLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  /* ── Data fetching ── */

  const fetchAll = useCallback(async () => {
    const [tasksRes, blocksRes, settingsRes] = await Promise.all([
      fetch("/api/admin/tasks").then((r) => r.json()),
      fetch("/api/admin/blocks").then((r) => r.json()),
      fetch("/api/admin/calendar/settings").then((r) => r.json()),
    ]);
    setTasks(tasksRes.tasks || []);
    setBlocks(blocksRes.blocks || []);
    if (settingsRes.settings) setSettings(settingsRes.settings);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ── Week navigation ── */

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const goToday = () => setWeekStart(getMonday(new Date()));

  /* ── Task CRUD ── */

  const handleSaveTask = async (data: Record<string, unknown>) => {
    if (editingTask) {
      await fetch(`/api/admin/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setTaskModalOpen(false);
    setEditingTask(null);
    setPrefillTime(undefined);
    fetchAll();
  };

  const handleDeleteTask = async () => {
    if (!editingTask) return;
    await fetch(`/api/admin/tasks/${editingTask.id}`, { method: "DELETE" });
    setTaskModalOpen(false);
    setEditingTask(null);
    fetchAll();
  };

  /* ── Block CRUD ── */

  const handleSaveBlock = async (data: Record<string, unknown>) => {
    await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBlockModalOpen(false);
    fetchAll();
  };

  /* ── Calendar interactions ── */

  const handleSlotClick = (date: string, time: string) => {
    setEditingTask(null);
    setPrefillTime({ date, time });
    setTaskModalOpen(true);
  };

  const handleTaskClick = (task: Task) => {
    setEditingTask(task);
    setPrefillTime(undefined);
    setTaskModalOpen(true);
  };

  /* ── AI Prioritize ── */

  const handleAiPrioritize = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/admin/calendar/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (res.ok) fetchAll();
    } finally {
      setAiLoading(false);
    }
  };

  /* ── Plan My Day ── */

  const handlePlanMyDay = async () => {
    setPlanLoading(true);
    try {
      const today = todayStr();
      const res = await fetch("/api/admin/calendar/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, confirm: true }),
      });
      if (res.ok) {
        fetchAll();
        setWeekStart(getMonday(new Date()));
      }
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[var(--button-primary-bg)]" aria-hidden />
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Calendar</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevWeek}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[180px] text-center text-sm font-medium text-[var(--text-primary)]">
              {formatWeekRange(weekDates)}
            </span>
            <button
              type="button"
              onClick={nextWeek}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
              aria-label="Next week"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <Button variant="ghost" onClick={goToday} className="text-xs">
              Today
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" onClick={() => setBlockModalOpen(true)} className="gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Add Block
            </Button>
            <Button
              onClick={() => {
                setEditingTask(null);
                setPrefillTime(undefined);
                setTaskModalOpen(true);
              }}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add Task
            </Button>
          </div>
        </div>

        {/* Main layout: calendar + task panel */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <CalendarGrid
            weekDates={weekDates}
            tasks={tasks}
            blocks={blocks}
            workStart={settings.workStart}
            workEnd={settings.workEnd}
            slotMinutes={settings.slotMinutes}
            todayStr={todayStr()}
            onSlotClick={handleSlotClick}
            onTaskClick={handleTaskClick}
          />

          <TaskPanel
            tasks={tasks}
            onAddTask={() => {
              setEditingTask(null);
              setPrefillTime(undefined);
              setTaskModalOpen(true);
            }}
            onTaskClick={handleTaskClick}
            onPlanMyDay={handlePlanMyDay}
            onAiPrioritize={handleAiPrioritize}
            aiLoading={aiLoading}
            planLoading={planLoading}
          />
        </div>
      </div>

      {/* Modals */}
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
          setPrefillTime(undefined);
        }}
        task={editingTask}
        onSave={handleSaveTask}
        onDelete={editingTask ? handleDeleteTask : undefined}
        prefillTime={prefillTime}
      />

      <BlockModal
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onSave={handleSaveBlock}
        prefillDate={todayStr()}
      />
    </div>
  );
}

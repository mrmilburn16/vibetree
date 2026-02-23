"use client";

import { Sparkles, CalendarPlus, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui";
import type { Task } from "@/lib/adminCalendarStore";

const P_BADGE: Record<number, { label: string; cls: string }> = {
  1: { label: "P1", cls: "bg-red-500/20 text-red-300" },
  2: { label: "P2", cls: "bg-orange-500/20 text-orange-300" },
  3: { label: "P3", cls: "bg-[var(--button-primary-bg)]/20 text-[var(--link-default)]" },
  4: { label: "P4", cls: "bg-sky-500/20 text-sky-300" },
  5: { label: "P5", cls: "bg-[var(--text-tertiary)]/10 text-[var(--text-tertiary)]" },
};

interface TaskPanelProps {
  tasks: Task[];
  onAddTask: () => void;
  onTaskClick: (task: Task) => void;
  onPlanMyDay: () => void;
  onAiPrioritize: () => void;
  aiLoading: boolean;
  planLoading: boolean;
}

export function TaskPanel({
  tasks,
  onAddTask,
  onTaskClick,
  onPlanMyDay,
  onAiPrioritize,
  aiLoading,
  planLoading,
}: TaskPanelProps) {
  const unscheduled = tasks
    .filter((t) => !t.scheduledStart && t.status !== "done")
    .sort((a, b) => a.priority - b.priority);

  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t) => t.status === "in-progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tasks</h3>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
          <span>{todoCount} todo</span>
          <span>·</span>
          <span>{inProgressCount} active</span>
          <span>·</span>
          <span>{doneCount} done</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onAddTask} className="gap-1.5 text-xs" variant="secondary">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add Task
        </Button>
        <Button
          onClick={onPlanMyDay}
          className="gap-1.5 text-xs"
          variant="secondary"
          disabled={unscheduled.length === 0 || planLoading}
        >
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
          {planLoading ? "Scheduling..." : "Plan My Day"}
        </Button>
        <Button
          onClick={onAiPrioritize}
          className="gap-1.5 text-xs"
          variant="secondary"
          disabled={todoCount === 0 || aiLoading}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {aiLoading ? "Analyzing..." : "AI Prioritize"}
        </Button>
      </div>

      {/* Unscheduled task list */}
      {unscheduled.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">
          No unscheduled tasks. Add a task or click "Plan My Day" after creating some.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Unscheduled ({unscheduled.length})
          </p>
          {unscheduled.map((task) => {
            const badge = P_BADGE[task.priority] || P_BADGE[3];
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onTaskClick(task)}
                className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left transition-colors hover:bg-[var(--background-tertiary)]"
              >
                <GripVertical className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]/40" aria-hidden />
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                  {badge.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-primary)]">
                  {task.title}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-[var(--text-tertiary)]">
                  {task.estimatedMinutes}m
                </span>
                {task.aiPrioritized && (
                  <Sparkles className="h-3 w-3 shrink-0 text-[var(--link-default)]/50" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

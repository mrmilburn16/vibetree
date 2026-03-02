"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button, DropdownSelect, DatePickerInput } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import type { Task } from "@/lib/adminCalendarStore";
import { Trash2 } from "lucide-react";

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "1", label: "P1: Critical" },
  { value: "2", label: "P2: Important" },
  { value: "3", label: "P3: Normal" },
  { value: "4", label: "P4: Low" },
  { value: "5", label: "P5: Backlog" },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "", label: "No category" },
  { value: "dev", label: "Development" },
  { value: "marketing", label: "Marketing" },
  { value: "design", label: "Design" },
  { value: "admin", label: "Admin" },
  { value: "content", label: "Content" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  onSave: (data: {
    title: string;
    description?: string;
    priority: number;
    estimatedMinutes: number;
    dueDate?: string;
    category?: string;
    status?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
  }) => void;
  onDelete?: () => void;
  prefillTime?: { date: string; time: string };
}

export function TaskModal({ isOpen, onClose, task, onSave, onDelete, prefillTime }: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("3");
  const [minutes, setMinutes] = useState(30);
  const [durationInput, setDurationInput] = useState("30");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("todo");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(String(task.priority));
      setMinutes(task.estimatedMinutes);
      setDurationInput(String(task.estimatedMinutes));
      setDueDate(task.dueDate || "");
      setCategory(task.category || "");
      setStatus(task.status);
    } else {
      setTitle("");
      setDescription("");
      setPriority("3");
      setMinutes(30);
      setDurationInput("30");
      setDueDate("");
      setCategory("");
      setStatus("todo");
    }
  }, [task, isOpen]);

  const getDurationMinutes = () => Math.max(15, parseInt(durationInput, 10) || 15);

  const handleSave = () => {
    if (!title.trim()) return;

    let scheduledStart: string | undefined;
    let scheduledEnd: string | undefined;

    const mins = getDurationMinutes();
    if (prefillTime && !task) {
      scheduledStart = `${prefillTime.date}T${prefillTime.time}:00`;
      const startMins = parseInt(prefillTime.time.split(":")[0]) * 60 + parseInt(prefillTime.time.split(":")[1]);
      const endMins = startMins + mins;
      const hh = String(Math.floor(endMins / 60)).padStart(2, "0");
      const mm = String(endMins % 60).padStart(2, "0");
      scheduledEnd = `${prefillTime.date}T${hh}:${mm}:00`;
    } else if (task) {
      scheduledStart = task.scheduledStart;
      scheduledEnd = task.scheduledEnd;
      if (scheduledStart && task.estimatedMinutes !== mins) {
        const startMins = parseInt(scheduledStart.slice(11, 13)) * 60 + parseInt(scheduledStart.slice(14, 16));
        const endMins = startMins + mins;
        const hh = String(Math.floor(endMins / 60)).padStart(2, "0");
        const mm = String(endMins % 60).padStart(2, "0");
        scheduledEnd = `${scheduledStart.slice(0, 10)}T${hh}:${mm}:00`;
      }
    }

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority: parseInt(priority),
      estimatedMinutes: mins,
      dueDate: dueDate || undefined,
      category: category || undefined,
      status,
      scheduledStart,
      scheduledEnd,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    // In description textarea, Enter inserts newline; don't save
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    e.preventDefault();
    if (title.trim()) handleSave();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? "Edit Task" : "New Task"}
      footer={
        <div className="flex w-full items-center gap-2">
          {task && onDelete && (
            <Button variant="ghost" onClick={onDelete} className="gap-1.5 text-[var(--semantic-error)]">
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim()}>Save</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4" onKeyDown={handleKeyDown}>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            autoFocus
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]/50 focus:border-[var(--button-primary-bg)] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details..."
            rows={2}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]/50 focus:border-[var(--button-primary-bg)] focus:outline-none resize-y"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Priority</label>
            <DropdownSelect options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Duration (min)</label>
            <input
              type="number"
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              onBlur={() => {
                const n = getDurationMinutes();
                setMinutes(n);
                setDurationInput(String(n));
              }}
              min={15}
              step={15}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--button-primary-bg)] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Category</label>
            <DropdownSelect options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Due date</label>
            <DatePickerInput
              value={dueDate}
              onChange={setDueDate}
              placeholder="mm/dd/yyyy"
              aria-label="Due date"
            />
          </div>
        </div>

        {task && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Status</label>
            <DropdownSelect options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          </div>
        )}

        {prefillTime && !task && (
          <p className="text-xs text-[var(--text-tertiary)]">
            Scheduled for {prefillTime.date} at {prefillTime.time}
          </p>
        )}
      </div>
    </Modal>
  );
}

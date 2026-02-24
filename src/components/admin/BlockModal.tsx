"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button, DropdownSelect } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Coffee, Clock, CalendarOff, Focus } from "lucide-react";

const TYPE_OPTIONS: SelectOption[] = [
  { value: "lunch", label: "Lunch" },
  { value: "break", label: "Break" },
  { value: "meeting", label: "Meeting" },
  { value: "day-off", label: "Day Off" },
  { value: "focus", label: "Focus Time" },
  { value: "custom", label: "Custom" },
];

const RECURRENCE_OPTIONS: SelectOption[] = [
  { value: "none", label: "One time" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays (Mon-Fri)" },
  { value: "weekly", label: "Weekly" },
];

const DAY_OPTIONS: SelectOption[] = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

interface BlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    type: string;
    startTime: string;
    endTime: string;
    recurring: string;
    recurringDay?: number;
    specificDate?: string;
  }) => void;
  prefillDate?: string;
}

const PRESETS = [
  { label: "Lunch 12-1", icon: Coffee, type: "lunch", startTime: "12:00", endTime: "13:00" },
  { label: "15m Break", icon: Clock, type: "break", startTime: "15:00", endTime: "15:15" },
  { label: "Day Off", icon: CalendarOff, type: "day-off", startTime: "00:00", endTime: "23:59" },
  { label: "Focus 2h", icon: Focus, type: "focus", startTime: "09:00", endTime: "11:00" },
];

export function BlockModal({ isOpen, onClose, onSave, prefillDate }: BlockModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("lunch");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [recurring, setRecurring] = useState("none");
  const [recurringDay, setRecurringDay] = useState("1");
  const [specificDate, setSpecificDate] = useState("");

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle("");
      setType("lunch");
      setStartTime("12:00");
      setEndTime("13:00");
      setRecurring("none");
      setRecurringDay("1");
      setSpecificDate(prefillDate || new Date().toISOString().split("T")[0]);
    }
  }, [isOpen, prefillDate]);

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setTitle(preset.label);
    setType(preset.type);
    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
  };

  const handleSave = () => {
    const finalTitle = title.trim() || TYPE_OPTIONS.find((o) => o.value === type)?.label || "Block";
    onSave({
      title: finalTitle,
      type,
      startTime,
      endTime,
      recurring,
      recurringDay: recurring === "weekly" ? parseInt(recurringDay) : undefined,
      specificDate: recurring === "none" ? specificDate : undefined,
    });
  };

  const isDayOff = type === "day-off";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Time Block"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Block</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Quick presets */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Quick presets</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--button-primary-bg)]/50 hover:text-[var(--text-primary)]"
              >
                <p.icon className="h-3.5 w-3.5" aria-hidden />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={TYPE_OPTIONS.find((o) => o.value === type)?.label || "Block name"}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]/50 focus:border-[var(--button-primary-bg)] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Type</label>
          <DropdownSelect options={TYPE_OPTIONS} value={type} onChange={setType} />
        </div>

        {!isDayOff && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--button-primary-bg)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--button-primary-bg)] focus:outline-none"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Recurrence</label>
          <DropdownSelect options={RECURRENCE_OPTIONS} value={recurring} onChange={setRecurring} />
        </div>

        {recurring === "weekly" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Day of week</label>
            <DropdownSelect options={DAY_OPTIONS} value={recurringDay} onChange={setRecurringDay} />
          </div>
        )}

        {recurring === "none" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Date</label>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--button-primary-bg)] focus:outline-none"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

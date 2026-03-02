"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon } from "lucide-react";

export interface DatePickerInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

function formatForInput(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
}

function parseFromDisplay(s: string): string {
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, month, day, year] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function getCalendarPadStart(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DatePickerInput({
  value,
  onChange,
  placeholder = "mm/dd/yyyy",
  className = "",
  "aria-label": ariaLabel,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      return new Date(y, (m ?? 1) - 1, 1);
    }
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const displayValue = value ? formatForInput(value) : "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      if (y && m) setViewDate(new Date(y, m - 1, 1));
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !containerRef.current || typeof document === "undefined") return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [open]);

  const handleTriggerClick = () => {
    setOpen((prev) => !prev);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getDaysInMonth(year, month);
  const padStart = getCalendarPadStart(year, month);

  const calendarContent =
    open && position ? (
      <div
        ref={listRef}
        role="dialog"
        aria-label={ariaLabel ?? "Choose date"}
        style={{
          position: "fixed",
          left: position.left,
          top: position.top,
          width: Math.max(position.width, 280),
          zIndex: 9999,
        }}
        className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-3 shadow-lg"
      >
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className="rounded p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {viewDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </span>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="rounded p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center text-xs text-[var(--text-tertiary)]">
              {d}
            </div>
          ))}
          {Array.from({ length: padStart }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map((d) => {
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const isSelected = value === iso;
            const isToday =
              d.getFullYear() === today.getFullYear() &&
              d.getMonth() === today.getMonth() &&
              d.getDate() === today.getDate();
            return (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  onChange(iso);
                  setOpen(false);
                }}
                className={`
                  rounded py-1.5 text-sm transition-colors
                  ${isSelected ? "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)]" : "text-[var(--text-primary)] hover:bg-[var(--background-tertiary)]"}
                  ${isToday && !isSelected ? "ring-1 ring-[var(--button-primary-bg)]/50" : ""}
                `}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <>
      <div ref={containerRef} className={`relative inline-block w-full ${className}`.trim()}>
        <div className="relative flex">
          <input
            type="text"
            value={displayValue}
            onChange={(e) => {
              const v = e.target.value;
              const parsed = parseFromDisplay(v);
              if (parsed) onChange(parsed);
              else if (v.trim() === "") onChange("");
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-haspopup="dialog"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--input-bg)] py-2 pl-3 pr-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]/50 focus:border-[var(--button-primary-bg)] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleTriggerClick}
            aria-label={open ? "Close calendar" : "Open calendar"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/30"
          >
            <CalendarIcon className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {typeof document !== "undefined" && calendarContent ? createPortal(calendarContent, document.body) : null}
    </>
  );
}

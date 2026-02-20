"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";

import type { SelectOption } from "./Select";

const DROPDOWN_MAX_HEIGHT = 280;
const SPACE_BUFFER = 16;

export interface DropdownSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

const ChevronDown = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0 opacity-70"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function DropdownSelect({
  options,
  value,
  onChange,
  className = "",
  "aria-label": ariaLabel,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  // When opening, measure space below and open upward if there isn't enough room (before paint)
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - SPACE_BUFFER;
    setOpenUpward(spaceBelow < DROPDOWN_MAX_HEIGHT);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`
          flex min-w-[160px] items-center justify-between gap-2
          rounded-[var(--radius-md)] border-2
          bg-[var(--input-bg)] px-3 py-1.5 pr-8
          text-left text-sm text-[var(--input-text)]
          transition-colors duration-[var(--transition-fast)]
          hover:border-[var(--border-subtle)]
          focus:outline-none focus:border-[var(--button-primary-bg)] focus:ring-2 focus:ring-[var(--button-primary-bg)]/30
          ${open ? "border-[var(--button-primary-bg)] ring-2 ring-[var(--button-primary-bg)]/30" : "border-[var(--input-border)]"}
        `}
      >
        {selectedOption.icon && (
          <span className="flex shrink-0 items-center text-[var(--text-secondary)] [&_svg]:text-current">
            {selectedOption.icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{selectedOption.label}</span>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
          <ChevronDown />
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={
            "absolute left-0 z-50 max-h-[280px] min-w-[200px] overflow-auto " +
            "rounded-[var(--radius-md)] border border-[var(--border-default)] " +
            "bg-[var(--background-secondary)] py-1 shadow-lg " +
            (openUpward ? "bottom-full mb-1" : "top-full mt-1")
          }
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`
                flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)]
                transition-colors duration-[var(--transition-fast)]
                hover:bg-[var(--button-primary-bg)]/20 hover:text-[var(--text-primary)]
                ${opt.value === value ? "bg-[var(--button-primary-bg)]/15 text-[var(--link-default)]" : ""}
              `}
            >
              {opt.icon && (
                <span className="flex shrink-0 items-center text-[var(--text-secondary)] [&_svg]:text-current">
                  {opt.icon}
                </span>
              )}
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

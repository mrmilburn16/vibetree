"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

import type { SelectOption } from "./Select";

const DROPDOWN_MAX_HEIGHT = 280;
const SPACE_BUFFER = 16;

export interface DropdownSelectProps {
  options: readonly SelectOption[];
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
    aria-hidden="true"
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  const openDropdown = useCallback(() => {
    setOpen(true);
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [options, value]);

  const closeDropdown = useCallback((returnFocus = true) => {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, closeDropdown]);

  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - SPACE_BUFFER;
    setOpenUpward(spaceBelow < DROPDOWN_MAX_HEIGHT);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDropdown();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setActiveIndex((prev) => {
            let next = prev + 1;
            while (next < options.length && options[next].disabled) next++;
            return next < options.length ? next : prev;
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setActiveIndex((prev) => {
            let next = prev - 1;
            while (next >= 0 && options[next].disabled) next--;
            return next >= 0 ? next : prev;
          });
          break;
        }
        case "Home": {
          e.preventDefault();
          let next = 0;
          while (next < options.length && options[next].disabled) next++;
          if (next < options.length) setActiveIndex(next);
          break;
        }
        case "End": {
          e.preventDefault();
          let next = options.length - 1;
          while (next >= 0 && options[next].disabled) next--;
          if (next >= 0) setActiveIndex(next);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const opt = options[activeIndex];
          if (opt && !opt.disabled) {
            onChange(opt.value);
            closeDropdown();
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          closeDropdown();
          break;
        }
        case "Tab": {
          closeDropdown(false);
          break;
        }
      }
    },
    [open, options, activeIndex, onChange, openDropdown, closeDropdown]
  );

  const activeOptionId = open && activeIndex >= 0 ? `dropdown-option-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? closeDropdown() : openDropdown())}
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
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={activeOptionId}
          tabIndex={-1}
          className={
            "absolute left-0 z-50 max-h-[280px] min-w-[200px] overflow-auto " +
            "rounded-[var(--radius-md)] border border-[var(--border-default)] " +
            "bg-[var(--background-secondary)] py-1 shadow-lg " +
            (openUpward ? "bottom-full mb-1" : "top-full mt-1")
          }
        >
          {options.map((opt, index) => (
            <li
              key={opt.value}
              id={`dropdown-option-${index}`}
              role="option"
              aria-selected={opt.value === value && !opt.disabled}
              aria-disabled={opt.disabled}
              onClick={() => {
                if (opt.disabled) return;
                onChange(opt.value);
                closeDropdown();
              }}
              onMouseEnter={() => {
                if (!opt.disabled) setActiveIndex(index);
              }}
              className={`
                flex items-center gap-2 px-3 py-2 text-sm
                transition-colors duration-[var(--transition-fast)]
                ${opt.disabled ? "cursor-not-allowed opacity-50 text-[var(--text-tertiary)]" : "cursor-pointer text-[var(--text-primary)] hover:bg-[var(--button-primary-bg)]/20 hover:text-[var(--text-primary)]"}
                ${opt.value === value && !opt.disabled ? "bg-[var(--button-primary-bg)]/15 text-[var(--link-default)]" : ""}
                ${index === activeIndex && !opt.disabled ? "outline outline-2 outline-[var(--button-primary-bg)]/50" : ""}
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

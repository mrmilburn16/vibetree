"use client";

import { useState, useRef, useEffect } from "react";

const THEMES = [
  { value: "emerald", label: "Forest", color: "#10B981", mode: "dark" },
  { value: "violet", label: "Twilight Violet", color: "#6366F1", mode: "dark" },
  { value: "amber", label: "Amber", color: "#F59E0B", mode: "dark" },
  { value: "ocean", label: "Ocean", color: "#0EA5E9", mode: "dark" },
  { value: "rose", label: "Rose", color: "#F43F5E", mode: "dark" },
  { value: "slate", label: "Slate", color: "#64748B", mode: "dark" },
  { value: "teal", label: "Teal", color: "#14B8A6", mode: "dark" },
  { value: "fuchsia", label: "Fuchsia", color: "#D946EF", mode: "dark" },
  { value: "sky", label: "Sky", color: "#0284C7", mode: "dark" },
  { value: "lime", label: "Lime", color: "#84CC16", mode: "dark" },
  { value: "emerald-light", label: "Forest (Light)", color: "#10B981", mode: "light" },
  { value: "violet-light", label: "Twilight Violet (Light)", color: "#6366F1", mode: "light" },
  { value: "amber-light", label: "Amber (Light)", color: "#F59E0B", mode: "light" },
  { value: "ocean-light", label: "Ocean (Light)", color: "#0EA5E9", mode: "light" },
  { value: "rose-light", label: "Rose (Light)", color: "#F43F5E", mode: "light" },
  { value: "slate-light", label: "Slate (Light)", color: "#64748B", mode: "light" },
  { value: "teal-light", label: "Teal (Light)", color: "#14B8A6", mode: "light" },
  { value: "fuchsia-light", label: "Fuchsia (Light)", color: "#D946EF", mode: "light" },
  { value: "sky-light", label: "Sky (Light)", color: "#0284C7", mode: "light" },
  { value: "lime-light", label: "Lime (Light)", color: "#84CC16", mode: "light" },
] as const;

const STORAGE_KEY = "vibetree-theme";

function getTheme(): string {
  if (typeof document === "undefined") return "emerald";
  return document.documentElement.getAttribute("data-theme") || "emerald";
}

function applyTheme(value: string) {
  document.documentElement.setAttribute("data-theme", value);
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch (_) {}
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState("emerald");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(getTheme());
  }, []);

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

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0];

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Choose theme"
        className="
          flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)]
          bg-[var(--background-secondary)] px-3 py-2
          text-sm text-[var(--text-secondary)]
          transition-all duration-200
          hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--background-tertiary)]
          focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/40
          [&_svg]:shrink-0
        "
      >
        <span
          className="h-4 w-4 rounded-full border-2 border-white/20 shadow-sm"
          style={{ backgroundColor: current.color }}
        />
        <span className="hidden font-medium sm:inline">{current.label}</span>
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
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Theme"
          className="
            absolute right-0 top-full z-50 mt-2 max-h-[min(70vh,380px)] w-56
            overflow-y-auto overflow-x-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)]
            bg-[var(--background-secondary)] py-1.5 shadow-xl
          "
        >
          <li className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Dark
          </li>
          {THEMES.filter((t) => t.mode === "dark").map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === theme}
              onClick={() => {
                applyTheme(opt.value);
                setTheme(opt.value);
                setOpen(false);
              }}
              className={`
                flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm
                transition-colors duration-150
                hover:bg-[var(--button-primary-bg)]/15
                ${opt.value === theme ? "bg-[var(--button-primary-bg)]/20 text-[var(--link-default)]" : "text-[var(--text-primary)]"}
              `}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-full border-2 border-white/20 shadow-sm"
                style={{ backgroundColor: opt.color }}
              />
              <span className="font-medium">{opt.label}</span>
            </li>
          ))}
          <li className="mt-1 border-t border-[var(--border-default)] pt-1.5" aria-hidden="true" />
          <li className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Light
          </li>
          {THEMES.filter((t) => t.mode === "light").map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === theme}
              onClick={() => {
                applyTheme(opt.value);
                setTheme(opt.value);
                setOpen(false);
              }}
              className={`
                flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm
                transition-colors duration-150
                hover:bg-[var(--button-primary-bg)]/15
                ${opt.value === theme ? "bg-[var(--button-primary-bg)]/20 text-[var(--link-default)]" : "text-[var(--text-primary)]"}
              `}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-full border-2 border-black/10 shadow-sm"
                style={{ backgroundColor: opt.color }}
              />
              <span className="font-medium">{opt.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

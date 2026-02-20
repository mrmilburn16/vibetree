"use client";

import { useState, useRef, useEffect } from "react";

const FONTS = [
  { value: "geist", label: "Geist", variable: "var(--font-geist-sans)" },
  { value: "inter", label: "Inter", variable: "var(--font-inter)" },
  { value: "plus-jakarta", label: "Plus Jakarta Sans", variable: "var(--font-plus-jakarta-sans)" },
  { value: "outfit", label: "Outfit", variable: "var(--font-outfit)" },
  { value: "dm-sans", label: "DM Sans", variable: "var(--font-dm-sans)" },
] as const;

const STORAGE_KEY = "vibetree-font";

function getFont(): string {
  if (typeof document === "undefined") return "geist";
  return document.documentElement.getAttribute("data-font") || "geist";
}

function applyFont(value: string) {
  document.documentElement.setAttribute("data-font", value);
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch (_) {}
}

export function FontSwitcher() {
  const [font, setFont] = useState("geist");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFont(getFont());
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

  const current = FONTS.find((f) => f.value === font) ?? FONTS[0];

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Choose font"
        className="
          flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)]
          bg-[var(--background-secondary)] px-3 py-2
          text-sm text-[var(--text-secondary)]
          transition-all duration-200
          hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--background-tertiary)]
          focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/40
        "
      >
        <span className="font-medium" style={{ fontFamily: current.variable }}>
          {current.label}
        </span>
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
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Font"
          className="
            absolute right-0 top-full z-50 mt-2 w-52
            overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)]
            bg-[var(--background-secondary)] py-1.5 shadow-xl
          "
        >
          {FONTS.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === font}
              onClick={() => {
                applyFont(opt.value);
                setFont(opt.value);
                setOpen(false);
              }}
              className={`
                cursor-pointer px-3 py-2.5 text-sm transition-colors duration-150
                hover:bg-[var(--button-primary-bg)]/15
                ${opt.value === font ? "bg-[var(--button-primary-bg)]/20 text-[var(--link-default)]" : "text-[var(--text-primary)]"}
              `}
              style={{ fontFamily: opt.variable }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

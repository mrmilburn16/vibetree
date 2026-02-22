"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Forest theme colors from THEME.plan.md / themes.css (emerald = Forest).
 * See themes.css [data-theme="emerald"] and tokens.css for background.
 */
const FOREST = {
  bg: "#0A0A0B",
  bgCard: "#141416",
  primary: "#10B981",
  primaryHover: "#34D399",
  light: "#6EE7B7",
  dark: "#047857",
  leaf: "#22C55E",
  bark: "#78350f",
  text: "#FAFAFA",
  textMuted: "#A1A1AA",
  border: "#27272A",
};

const LOGO_OPTIONS = [
  { id: "all", label: "All 10" },
  ...Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), label: `Logo ${i + 1}` })),
];

function Logo1() {
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M8 36 L24 12 L40 28 L56 8 L72 36" stroke={FOREST.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M72 36 L88 16 L104 32 L120 12 L136 36" stroke={FOREST.primaryHover} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
      <text x="80" y="44" textAnchor="middle" fill={FOREST.text} fontSize="14" fontWeight="600" fontFamily="var(--font-geist-sans), system-ui, sans-serif">Vibe Tree</text>
    </svg>
  );
}

function Logo2() {
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <ellipse cx="24" cy="20" rx="12" ry="18" fill={FOREST.dark} />
      <path d="M12 38 L24 20 L36 38 Z" fill={FOREST.primary} />
      <path d="M18 32 L24 22 L30 32 Z" fill={FOREST.primaryHover} />
      <rect x="22" y="38" width="4" height="6" rx="1" fill={FOREST.bark} />
      <text x="80" y="44" textAnchor="middle" fill={FOREST.text} fontSize="14" fontWeight="600" fontFamily="var(--font-geist-sans), system-ui, sans-serif">Vibe Tree</text>
    </svg>
  );
}

function Logo3() {
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <circle cx="24" cy="18" r="10" fill={FOREST.primary} opacity="0.9" />
      <path d="M14 28 L24 18 L34 28 L24 38 Z" fill={FOREST.primary} />
      <path d="M24 12 L28 18 L24 24 L20 18 Z" fill={FOREST.light} />
      <rect x="22" y="38" width="4" height="4" fill={FOREST.bark} />
      <text x="80" y="44" textAnchor="middle" fill={FOREST.text} fontSize="14" fontWeight="600" fontFamily="var(--font-geist-sans), system-ui, sans-serif">Vibe Tree</text>
    </svg>
  );
}

function Logo4() {
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <text x="80" y="28" textAnchor="middle" fill={FOREST.primary} fontSize="22" fontWeight="700" fontFamily="var(--font-geist-sans), system-ui, sans-serif" letterSpacing="-0.02em">Vibe Tree</text>
      <rect x="56" y="32" width="48" height="3" rx="1.5" fill={FOREST.primaryHover} opacity="0.8" />
    </svg>
  );
}

function Logo5() {
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M24 40 L24 24 L16 32 L24 24 L32 16 L24 24 L24 8" stroke={FOREST.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="24" cy="8" r="3" fill={FOREST.leaf} />
      <circle cx="16" cy="32" r="2.5" fill={FOREST.primaryHover} />
      <circle cx="32" cy="16" r="2.5" fill={FOREST.primaryHover} />
      <text x="80" y="44" textAnchor="middle" fill={FOREST.text} fontSize="14" fontWeight="600" fontFamily="var(--font-geist-sans), system-ui, sans-serif">Vibe Tree</text>
    </svg>
  );
}

function Logo6() {
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M24 40 L24 28 M24 28 L18 20 M24 28 L30 20 M24 28 L24 16 M24 16 L20 10 M24 16 L28 10" stroke={FOREST.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="24" cy="40" r="2" fill={FOREST.bark} />
      <circle cx="18" cy="20" r="2.5" fill={FOREST.leaf} />
      <circle cx="30" cy="20" r="2.5" fill={FOREST.leaf} />
      <circle cx="20" cy="10" r="2" fill={FOREST.primaryHover} />
      <circle cx="28" cy="10" r="2" fill={FOREST.primaryHover} />
      <text x="80" y="44" textAnchor="middle" fill={FOREST.text} fontSize="14" fontWeight="600" fontFamily="var(--font-geist-sans), system-ui, sans-serif">Vibe Tree</text>
    </svg>
  );
}

function Logo7() {
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M12 40 Q24 14 36 40" stroke={FOREST.dark} strokeWidth="4" fill="none" />
      <path d="M14 38 Q24 18 34 38" stroke={FOREST.primary} strokeWidth="2.5" fill="none" />
      <path d="M20 32 Q24 22 28 32" stroke={FOREST.primaryHover} strokeWidth="1.5" fill="none" />
      <text x="80" y="44" textAnchor="middle" fill={FOREST.text} fontSize="14" fontWeight="600" fontFamily="var(--font-geist-sans), system-ui, sans-serif">Vibe Tree</text>
    </svg>
  );
}

function Logo8() {
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <rect x="10" y="14" width="28" height="28" rx="4" fill={FOREST.dark} />
      <path d="M24 42 L24 28 L18 34 L24 28 L30 22 L24 28 L24 18" stroke={FOREST.light} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="24" cy="18" r="2" fill={FOREST.leaf} />
      <text x="80" y="44" textAnchor="middle" fill={FOREST.text} fontSize="14" fontWeight="600" fontFamily="var(--font-geist-sans), system-ui, sans-serif">Vibe Tree</text>
    </svg>
  );
}

function Logo9() {
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <text x="20" y="26" fill={FOREST.primary} fontSize="18" fontWeight="800" fontFamily="var(--font-geist-sans), system-ui, sans-serif">VT</text>
      <rect x="16" y="28" width="16" height="2" rx="1" fill={FOREST.primaryHover} />
      <text x="80" y="44" textAnchor="middle" fill={FOREST.text} fontSize="14" fontWeight="600" fontFamily="var(--font-geist-sans), system-ui, sans-serif">Vibe Tree</text>
    </svg>
  );
}

function Logo10() {
  return (
    <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M8 40 L24 8 L40 24 L56 40" stroke={FOREST.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M24 8 L24 40 M40 24 L8 24" stroke={FOREST.primaryHover} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="24" cy="8" r="3" fill={FOREST.leaf} />
      <circle cx="56" cy="40" r="2" fill={FOREST.dark} />
      <text x="80" y="44" textAnchor="middle" fill={FOREST.text} fontSize="14" fontWeight="600" fontFamily="var(--font-geist-sans), system-ui, sans-serif">Vibe Tree</text>
    </svg>
  );
}

const LOGOS = [
  Logo1,
  Logo2,
  Logo3,
  Logo4,
  Logo5,
  Logo6,
  Logo7,
  Logo8,
  Logo9,
  Logo10,
];

export default function LogoPickerPage() {
  const [selected, setSelected] = useState("all");

  return (
    <div
      className="min-h-screen text-[var(--text-primary)]"
      style={{ background: FOREST.bg }}
    >
      <header className="border-b flex items-center justify-between px-4 py-3" style={{ borderColor: FOREST.border }}>
        <Link
          href="/"
          className="text-sm transition-colors hover:opacity-80"
          style={{ color: FOREST.primaryHover }}
        >
          ← Back
        </Link>
        <h1 className="text-sm font-semibold" style={{ color: FOREST.textMuted }}>
          Vibe Tree — Logo picker
        </h1>
        <span className="w-12" />
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="mb-6 text-sm" style={{ color: FOREST.textMuted }}>
          Forest theme colors from THEME.plan / themes.css (emerald). Toggle to view one logo or all 10.
        </p>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium" style={{ color: FOREST.textMuted }}>
            Show:
          </span>
          {LOGO_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelected(opt.id)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: selected === opt.id ? FOREST.primary : FOREST.bgCard,
                color: selected === opt.id ? FOREST.bg : FOREST.text,
                border: `1px solid ${selected === opt.id ? FOREST.primary : FOREST.border}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div
          className="rounded-xl border p-8 flex flex-col items-center justify-center gap-10 min-h-[320px]"
          style={{ background: FOREST.bgCard, borderColor: FOREST.border }}
        >
          {selected === "all" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full">
              {LOGOS.map((Logo, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg"
                  style={{ background: FOREST.bg, border: `1px solid ${FOREST.border}` }}
                >
                  <Logo />
                  <span className="text-xs font-medium" style={{ color: FOREST.textMuted }}>
                    Logo {i + 1}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            (() => {
              const idx = parseInt(selected, 10) - 1;
              const Logo = LOGOS[idx];
              if (!Logo) return null;
              return (
                <div className="flex flex-col items-center gap-3">
                  <Logo />
                  <span className="text-sm font-medium" style={{ color: FOREST.textMuted }}>
                    Logo {selected}
                  </span>
                </div>
              );
            })()
          )}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: FOREST.textMuted }}>
          Colors: primary {FOREST.primary}, hover {FOREST.primaryHover}, dark {FOREST.dark}, leaf {FOREST.leaf}, bark {FOREST.bark}
        </p>
      </main>
    </div>
  );
}

# Plan: Design (typography, theme, components, copy)

**Purpose:** Single source for product design. Use when adding or changing UI copy and visuals.

---

## Typography

- [ ] **Sans:** Geist only. `--font-sans` / `var(--font-geist-sans)`. Headings, body, buttons, labels — all Geist. Do not add a second sans-serif.
- [ ] **Mono:** Geist Mono. `--font-mono` / `var(--font-geist-mono)`. Code, file paths, technical snippets.
- [ ] **Implementation:** `src/styles/fonts.css` sets `--font-sans`; body and Tailwind use it. New copy inherits automatically.
- [ ] No font switcher. No alternate UI fonts.

---

## Theme & colors

- [ ] See **THEME.plan.md** for Twilight Violet (colors, tokens, dropdowns).

---

## Components & patterns

- [ ] **Expand on cards:** Expand / fullscreen icon in **top-right** of card (e.g. QR, preview). Icon-only button with `aria-label` and `title`.

---

## Copy & microcopy

- [ ] **Expo Go QR:** Use **"Scan this QR in Expo Go to preview on your iPhone"** below the QR. (Or: "Open Expo Go and scan this QR to preview on your iPhone.")

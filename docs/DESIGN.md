# Design

Single source for product design decisions (theme, typography, etc.). Use this when adding or changing UI copy and visuals.

## Typography

**We use Geist for all UI wording.**

- **Sans:** [Geist](https://vercel.com/font) (`--font-sans` / `var(--font-geist-sans)`) is the app’s only UI font. All headings, body text, buttons, labels, and new copy use Geist. Do not introduce a second sans-serif for UI.
- **Mono:** Geist Mono (`--font-mono` / `var(--font-geist-mono)`) is used for code, file paths, and technical snippets.
- **Implementation:** `src/styles/fonts.css` sets `--font-sans` to Geist; `body` and Tailwind use `var(--font-sans)`. New wording inherits this automatically when placed in the app shell.

When adding new copy (empty states, tooltips, docs, marketing), use the default font stack (Geist). No font switcher or alternate UI fonts.

## Theme and colors

See [THEME.md](./THEME.md) for Twilight Violet (colors, tokens, dropdowns).

## Components and patterns

- **Expand on cards:** For “show larger” or fullscreen on a card (e.g. QR code, preview), place the expand icon in the **top-right corner** of the card. This associates the action with the content and matches common media-card patterns. Use an icon-only button with `aria-label` and `title` for accessibility.

## Copy and microcopy

- **Expo Go QR strip:** Use **"Scan this QR in Expo Go to preview on your iPhone"** below the QR. "In Expo Go" makes it clear they scan the QR from inside the Expo Go app (or with it), not with a generic camera only. Flow: scan this QR → in Expo Go → to preview on your iPhone. Alternative if we want two-step: "Open Expo Go and scan this QR to preview on your iPhone."

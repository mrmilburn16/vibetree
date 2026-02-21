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

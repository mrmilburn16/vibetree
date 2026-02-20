# Twilight Violet — App theme

Vibetree uses a single named theme so we can refer to it consistently in design and code.

## Theme name: **Twilight Violet**

- **Dark base** — Near-black backgrounds, light text, gray borders.
- **Accent** — Purple (indigo/violet) for primary actions, focus rings, and highlights.
- **Tokens** — All colors and spacing live in `src/styles/tokens.css`; use CSS variables only in UI (no raw hex).

## Dropdowns (required)

**All dropdowns in the app must use the Twilight Violet theme.** Do not use the native browser `<select>` element, which looks like the OS default and breaks the theme.

- **Use** the custom **`DropdownSelect`** component from `@/components/ui`.
- **Behavior** — Trigger styled like our inputs (dark bg, rounded, purple focus border); open menu uses `--background-secondary`, `--border-default`, purple hover/selected states.
- **Where** — Contact form (Subject), editor (LLM model), and any future selects must use `DropdownSelect` (or another custom dropdown that uses the same tokens).

The native `Select` component in `@/components/ui` is kept for rare cases (e.g. simple forms outside the main app shell) but should not be used in landing, contact, editor, or dashboard. Prefer `DropdownSelect` everywhere for a consistent Twilight Violet look.

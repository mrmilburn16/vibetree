# Plan: Twilight Violet theme

**Purpose:** One named theme for design and code. All UI must match.

---

## Theme name: Twilight Violet

- [ ] **Dark base** — Near-black backgrounds, light text, gray borders.
- [ ] **Accent** — Purple (indigo/violet) for primary actions, focus rings, highlights.
- [ ] **Tokens** — All colors and spacing in `src/styles/tokens.css`. Use CSS variables only; no raw hex in UI.

---

## Dropdowns (required)

- [ ] **Do not** use native `<select>` — it breaks the theme.
- [ ] **Use** `DropdownSelect` from `@/components/ui` for every dropdown.
- [ ] **Where:** Contact (Subject), editor (LLM model), settings, any new selects.
- [ ] **Behavior:** Trigger = dark bg, rounded, purple focus border. Open menu = `--background-secondary`, `--border-default`, purple hover/selected.
- [ ] Prefer `DropdownSelect` everywhere. Native `Select` only for rare cases outside main app shell (not landing, contact, editor, dashboard).

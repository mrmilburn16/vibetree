# Design, Theme & Pricing

Single source for product design, theme, and plans. Use when adding or changing UI copy, visuals, or pricing.

---

## Typography

- [ ] **Sans:** Geist only. `--font-sans` / `var(--font-geist-sans)`. Headings, body, buttons, labels — all Geist.
- [ ] **Mono:** Geist Mono. `--font-mono` / `var(--font-geist-mono)`. Code, file paths, technical snippets.
- [ ] **Implementation:** `src/styles/fonts.css` sets `--font-sans`; body and Tailwind use it.
- [ ] No font switcher. No alternate UI fonts.

---

## Theme: Twilight Violet

- [ ] **Dark base** — Near-black backgrounds, light text, gray borders.
- [ ] **Accent** — Purple (indigo/violet) for primary actions, focus rings, highlights.
- [ ] **Tokens** — All colors in `src/styles/tokens.css`. Use CSS variables only; no raw hex in UI.
- [ ] **Dropdowns:** Use `DropdownSelect` from `@/components/ui` — never native `<select>`.

---

## Components & Copy

- [ ] **Expand on cards:** Expand/fullscreen icon in **top-right** of card (QR, preview). Icon-only button with `aria-label`.
- [ ] **Expo Go QR:** Use "Scan this QR in Expo Go to preview on your iPhone" below the QR.

---

## Pricing & Credits

**Implementation:** `src/lib/pricing.ts` and `/pricing` page.

| Action | Credits |
|--------|--------|
| 1 AI chat (standard) | 1 |
| 1 AI chat (premium) | 3 |
| 1 build | 5 |
| 1 Run on device | 10 |
| 1 App Store publish | 25 |

| Plan | Monthly | Annual | Credits/mo | Trial |
|------|--------|--------|------------|-------|
| **Creator** | $0 | $0 | 50 | — |
| **Pro** | $29 | $290 | 500 | 14 days |
| **Team** | $79 | $790 | 2,000 | 14 days |

- Creator: 1 app, Haiku-only, no Run on device, no Publish.
- Pro: 5 apps, all AI models, Run on device, Publish, 14-day trial.
- Team: Unlimited apps, 2,000 credits, Pro + future 5 seats, SSO, 14-day trial.

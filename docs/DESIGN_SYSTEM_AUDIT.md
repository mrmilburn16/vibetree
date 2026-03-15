# Design system & default styling in generated SwiftUI apps

What currently controls the default look of generated apps (spacing, colors, typography, corners, shadows) and what’s missing.

---

## 1. System prompt in `claudeAdapter.ts` — DESIGN & UX RULES

**Location:** `src/lib/llm/claudeAdapter.ts` — `SYSTEM_PROMPT_SWIFT`, section **`=== DESIGN & UX RULES ===`** (approx. lines 169–196).

**What exists:**

| Area | What’s specified |
|------|-------------------|
| **Backgrounds** | No flat black/dark gray; use subtle gradients or semantic colors; support light/dark. |
| **Colors** | Semantic system colors: `.foregroundStyle(.primary/.secondary/.tertiary)` for text; `Color(.systemBackground)` for backgrounds. Never hardcode `Color.white`/`Color.black` for background/text. |
| **Touch targets** | Minimum 44×44pt; at least 16pt horizontal padding. |
| **Cards** | 12–16pt corner radius, consistent shadow, 16pt internal padding. |
| **Layout** | `.frame(maxWidth: .infinity, maxHeight: .infinity)`; safe area only for backgrounds; `ScrollView` when content can overflow. |
| **Typography** | `.largeTitle` for hero numbers, `.title2`/`.title3` for sections, `.body` for content, `.caption` for metadata; semantic text styles for Dynamic Type (no hardcoded `.system(size:)`). |
| **Buttons** | `.buttonStyle(.borderedProminent)` for primary (one per screen), `.bordered` for secondary. |
| **Lists** | `.listStyle(.insetGrouped)` for settings, `.plain` for feeds. |
| **Animation** | `.spring(response: 0.35, dampingFraction: 0.85)`; animate state transitions. |
| **Accessibility** | Minimum contrast 4.5:1 body, 3:1 large text; `.accessibilityLabel()` on icon buttons. |

**What’s not in the base prompt:**

- No **design tokens** (e.g. a single “spacing scale” or “radius scale”).
- **Shadows** are only “consistent shadow” for cards — no numeric values (radius, opacity, offset).
- **Spacing scale** is only “16pt horizontal” and “16pt internal padding” for cards — no 4/8/12/24/32 scale.
- **Corner radius** is only “12–16pt” for cards — no default for buttons, chips, sheets.
- No **accent color** rule (e.g. use `Color("AccentColor")` or a single theme color).
- No **vertical spacing** rule between sections (e.g. 8 / 12 / 20pt).

---

## 2. Skills in `data/skills/` — design-related

### `apple-hig.json` (keyword-triggered)

**When injected:** When the user message matches keywords such as “beautiful design”, “polished”, “clean design”, “modern design”, “elegant”, “settings screen”, “dashboard”, “apple design”, “hig”, “accessible”, “dark mode”, “dynamic type”, etc.

**Design system content:**

- **Colors:** Small `Theme` (or Color extension) with primary, secondary, accent, destructive; semantic system backgrounds; text with `Color.primary` / `.secondary` / `Color(.tertiaryLabel)`; 4.5:1 and 3:1 contrast.
- **Typography:** Hero `.largeTitle` or `.system(size: 48, weight: .bold, design: .rounded)`; section `.headline`/`.title3.weight(.semibold)`; body `.body`; metadata `.caption`/`.footnote` + `.foregroundStyle(.secondary)`; `.monospacedDigit()` for numbers.
- **Spacing:** 16pt horizontal (20pt for content-heavy); VStack 8pt (tight), 12pt (related), 20pt (sections); card padding 16pt; corner radius 12–16pt; shadow `.shadow(color: .black.opacity(0.08), radius: 8, y: 4)`; list row `.padding(.vertical, 12)`; 44×44pt touch targets.
- **Canonical code:** `Theme.swift` with `cardStyle()` modifier (16pt padding, 14pt continuous corner radius, shadow as above).
- **Dark mode:** Semantic colors; shadow opacity lower in dark mode; `Divider()` / `Color(.separator)`.

So when this skill is matched, apps get **concrete numbers** (e.g. shadow radius 8, y 4, opacity 0.08; radius 12–16; 8/12/20pt spacing).

### `backgrounds.json` (always loaded via skill loader)

**When injected:** On **every** request — `alwaysLoad: true` in `src/lib/skills/skillLoader.ts`; uses `promptBlock`.

**Design system content:**

- **Backgrounds:** No flat single color; category-based gradient defaults (e.g. Fitness: dark navy → black; Weather: deep blue → navy; Finance: dark green → black; Timer/Pomodoro: deep crimson → black + salmon accent). User theme overrides.
- **Conflict:** Uses `Color(hex:)` for many presets; the main system prompt says “Never use Color(hex:) … unless a custom extension is explicitly provided”. So the skill assumes a hex extension exists or the model must add one.

### `liquid-glass.json` (trigger-based)

**When injected:** When the user says “liquid glass”, “glass effect”, “iOS 26”, etc.

**Design system content:** iOS 26 glass APIs (`.glassEffect()`, `.buttonStyle(.glass)`), container, spacing 40; no generic spacing/color/typography tokens.

---

## 3. QA-derived rules (`data/qa-applied-rules.json` + `buildAppliedRulesPromptBlock`)

**Location:** `src/lib/qa/appliedRules.ts` — `buildAppliedRulesPromptBlock()` appends active rules from `data/qa-applied-rules.json`.

**Current rules:** All four entries are about crashes, WidgetKit types, weather city name, and CLLocationCoordinate2D. **None** are about spacing, colors, typography, radius, or shadows.

So **QA rules currently add no design-system defaults**.

---

## 4. Summary: what exists vs what’s missing

### Exists

- **Base (every Pro app):** Semantic colors, no hardcoded black/white, 44pt touch target, 16pt horizontal padding, cards 12–16pt radius + “consistent shadow” + 16pt padding, semantic typography, one primary button per screen, list styles, spring animation, minimum contrast.
- **When HIG-like wording is used:** Full apple-hig skill — spacing scale (8/12/16/20), card shadow (0.08, radius 8, y 4), 12–16pt radius, Theme + `cardStyle()`, dark mode shadows.
- **Every request (loader):** backgrounds.json — no flat background; category-based gradient defaults (with hex colors).

### Missing or weak

1. **Single source of truth**  
   No shared “design tokens” block (e.g. “spacing: 8, 12, 16, 20, 24; radius: 8, 12, 16; shadow: …”) that every app gets. Card shadow is only “consistent” in the base prompt; numbers only in apple-hig when that skill fires.

2. **Shadow spec**  
   Base prompt doesn’t specify radius/opacity/offset. Only apple-hig gives a concrete shadow (and dark-mode variant).

3. **Corner radius**  
   Only “cards: 12–16pt”. No default for buttons, chips, modals, or text fields.

4. **Spacing scale**  
   Base has “16pt horizontal” and “16pt card padding”. No 8/12/24/32 or vertical rhythm; that exists only in apple-hig when matched.

5. **Accent / theme color**  
   No rule like “use Color(\"AccentColor\") for primary actions and key highlights”. apple-hig mentions Theme + accent but only when that skill is on.

6. **backgrounds.json vs system prompt**  
   Backgrounds skill uses `Color(hex:)` extensively; system prompt forbids it unless an extension is provided. Either the skill should require “define Color(hex:) in this app” or the preset palettes should be expressed without hex (e.g. named colors or RGB).

7. **QA rules**  
   No design-related applied rules; only behavioral/crash/API rules.

---

## 5. Recommendations (concise)

- **Add a small “Design tokens” block** to `SYSTEM_PROMPT_SWIFT` (or a single always-on skill): spacing scale (e.g. 8, 12, 16, 20, 24), default corner radii (e.g. 8 for small, 12 for cards, 16 for modals), one default shadow spec, and “use Color(\"AccentColor\") for primary actions”.
- **Align backgrounds skill with system prompt:** Either add a canonical `Color(hex:)` snippet when using backgrounds.json or switch category presets to non-hex (e.g. RGB or asset names).
- **Optionally add a design-only QA rule** when builds show repeated layout/contrast issues (e.g. “Cards must use at least 12pt corner radius and 16pt internal padding”).

All of the above keeps current behavior (and apple-hig + backgrounds) and fills in the missing defaults so every generated app gets a minimal, consistent design system without depending on keyword triggers.

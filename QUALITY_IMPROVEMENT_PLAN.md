# Plan: From Simple Apps to Complex Apps with 98% Success Rate

## Where We Are Now

Current pipeline:
1. **System prompt** → Claude generates Swift/SwiftUI files as JSON
2. **Rule-based fixes** → 4 patterns (`$viewModel`, escaped quotes, `.accent`, string-in-numeric)
3. **Build validation** → xcodebuild on Mac runner, compile-or-fail
4. **Auto-fix loop** → up to 5 LLM attempts to fix compilation errors

**What's checked:** Does it compile?
**What's NOT checked:** Does it run correctly? Do buttons work? Does the UI look good? Are there overlaps? Is navigation correct?

The LLM **does not learn** between generations. Each build is independent. Progressive testing (easy → medium → hard) measures capability but doesn't improve it. What improves capability is everything around the LLM: the system prompt, the validation, the post-processing, and the architecture templates.

---

## Phase 1: Benchmark — Know Where You Stand

**Status: Infrastructure built (Build Results Tracker)**

- Dashboard: http://localhost:3001/admin/builds
- CLI stats: `node scripts/analyze-builds.mjs`
- Build results log: `data/build-results.jsonl`

**Test protocol:**
Pick 10 apps from each tier. For each app, score on 5 dimensions:

| Dimension | Weight | How to check |
|---|---|---|
| **Compiles** | Pass/fail | xcodebuild succeeds (automated) |
| **Runs without crash** | Pass/fail | Launch in simulator, no crash in 10 seconds |
| **All features work** | 0–100% | Tap every button, fill every form, verify every interaction |
| **Design quality** | 1–5 | No overlaps, readable text, proper spacing, looks professional |
| **Code quality** | 1–5 | Clean architecture, proper state management, no hacks |

**Suggested test set (30 apps):**
- Easy (10): Pick from `APP_IDEAS_100` across different categories
- Medium (10): Pick from `APP_IDEAS_MEDIUM` across different categories
- Hard (10): Create `APP_IDEAS_HARD` — multi-screen apps with data flow, animations, persistence, real interaction

**Track in the Build Results dashboard:**
- Compile rate by tier
- Most common compiler errors
- Your manual design/function scores and notes

---

## Phase 2: Improve the System Prompt (Biggest Lever)

**Status: Not started**

The system prompt is the single most impactful thing to change. It currently says "make it look like App Store editor's choice" but doesn't give specific, enforceable rules.

### 2a. Add a SwiftUI Design System

```
DESIGN RULES (mandatory):
- Minimum touch target: 44×44pt for all interactive elements
- Padding: minimum 16pt horizontal padding on all screens
- Text never touches screen edges — always inside a padded container
- Font scale: .largeTitle for hero numbers, .title2/.title3 for section headers,
  .body for content, .caption for metadata. Never use .body for everything.
- ScrollView on any screen that could overflow (lists, forms, long content)
- NavigationStack with .navigationTitle on every screen with navigation
- Empty states: show icon + message + action button, never a blank screen
- Loading states: ProgressView() while async work happens
- Spacing between list items: minimum 8pt, use .listRowInsets for custom rows
- Cards: 12–16pt corner radius, consistent shadow, 16pt internal padding
- Never stack Text views without spacing — use VStack(spacing: 8) minimum
- Color contrast: ensure text is readable on its background in both light and dark mode
```

### 2b. Add Architecture Templates for Complex Apps

```
ARCHITECTURE (for apps with 3+ screens or data persistence):
- Use MVVM: Models/ for data types, ViewModels/ for logic, Views/ for UI
- Data models must conform to Codable and Identifiable
- Use @Observable (iOS 17) for view models, not ObservableObject
- Use NavigationStack with NavigationLink(value:) for type-safe navigation
- Tab bars: use TabView with .tabItem { Label("Title", systemImage: "icon") }
- Sheets: use .sheet(item:) with an identifiable binding, not .sheet(isPresented:)
- Persistence: UserDefaults with a dedicated Storage class wrapping Codable encode/decode
- Never put business logic in View bodies — extract to ViewModel methods
```

### 2c. Add Anti-Patterns List

```
NEVER DO THESE:
- Never use GeometryReader unless absolutely necessary (causes overlaps and sizing bugs)
- Never use .frame(width: UIScreen.main.bounds.width) — use maxWidth: .infinity instead
- Never use fixed frame sizes for text — let text size itself
- Never use ZStack for layout that should be VStack/HStack (causes overlaps)
- Never use .offset() for positioning — it doesn't affect layout, causes overlaps
- Never put a NavigationStack inside another NavigationStack
- Never use .onAppear for data that should be in init or @State default
- Never create buttons that do nothing — every button must have a real action
```

### 2d. Add Complexity-Aware Instructions

```
COMPLEX APP REQUIREMENTS:
- Plan your file structure before writing code. Create separate files for each View, Model, and ViewModel.
- Every screen must be reachable via navigation — no orphaned views
- Every button/action must have an implementation (alert, navigation, state change, or data mutation)
- Test your data flow mentally: if data is created in Screen A and shown in Screen B,
  make sure the same source of truth (EnvironmentObject or passed binding) connects them
```

---

## Phase 3: Improve Validation Beyond Compilation

**Status: Not started**

### 3a. Static Analysis Pass (no simulator needed)

After the LLM generates files, before even running xcodebuild, scan the Swift code for:

- **Dead buttons:** Find all `Button` declarations and verify each has a non-empty action (not just `{ }` or `{ /* TODO */ }`)
- **Missing NavigationStack:** If there are `NavigationLink` usages, verify a `NavigationStack` wraps them
- **Overlapping layout:** Flag uses of `GeometryReader`, `.offset()`, and `ZStack` with non-overlay content
- **Missing ScrollView:** If a VStack has more than 6 children, warn that it may overflow
- **Accessibility:** Check that `Image(systemName:)` icons near text have `.accessibilityLabel`
- **Every View file is referenced:** Verify that every `Views/*.swift` file is actually instantiated somewhere

This is a new step between generation and xcodebuild. Rule-based (no LLM cost), catches design issues early.

### 3b. Simulator Screenshot Validation (future)

1. Build and launch in simulator
2. Take screenshots of each screen
3. Check for: blank screens, text overflow, overlapping elements, invisible text
4. Could use vision AI to score the screenshots

---

## Phase 4: Multi-Pass Generation for Complex Apps

**Status: Not started**

For hard apps, a single LLM call isn't enough. The context is too large and the LLM makes mistakes when generating 8+ files at once.

**Proposed multi-pass flow:**

1. **Architecture pass:** Send the user's prompt + "Respond with ONLY a JSON plan: { screens: [...], models: [...], navigation: 'tab|stack|...', files: ['App.swift', 'Views/HomeView.swift', ...] }". No code yet — just the plan.

2. **Implementation pass:** Send the plan + "Now implement each file. Follow the plan exactly." This is the main generation.

3. **Self-review pass:** Send the generated code back to the LLM: "Review this SwiftUI project for: missing button actions, navigation bugs, layout overlaps, missing imports, type errors. Return the corrected files." This catches the LLM's own mistakes.

4. **Build + auto-fix:** The existing xcodebuild loop handles compilation.

For simple apps (1–2 files), skip to step 2. For medium (3–5 files), do steps 2–4. For hard (6+ files), do all 4 steps.

**Cost:** 2–4x more API calls per generation. But the success rate for complex apps would jump dramatically.

---

## Phase 5: Expand Rule-Based Fixes

**Status: Not started**

Current `fixSwift.ts` has 4 patterns. Expand to 20+ based on observed failures:

- Add `import SwiftUI` to any file using `View`, `Text`, `Button`, `Color`, `NavigationStack`, etc.
- Add `import Foundation` to any file using `UUID`, `Date`, `JSONEncoder`, `UserDefaults`, etc.
- Fix `NavigationView` → `NavigationStack` (deprecated in iOS 16)
- Fix `.navigationBarTitle` → `.navigationTitle`
- Fix `@Published` without `ObservableObject` conformance
- Fix `List { ForEach(...) }` when ForEach items aren't `Identifiable` — add `id: \.self`
- Fix missing `Hashable`/`Equatable` on enums used in `Picker`
- Remove `#Preview` macro if targeting < iOS 17
- Fix `.foregroundColor` → `.foregroundStyle` (SwiftUI modernization)

Each fix is free (no API cost) and prevents a class of compilation failures permanently.

---

## Phase 6: Create APP_IDEAS_HARD

**Status: Not started**

What "hard" means:
- 6–10+ Swift files
- Multi-tab with NavigationStack per tab
- Data flow between screens (create on one screen, display on another)
- Codable persistence with multiple entity types
- Search, filter, sort
- Edit/delete with confirmation
- Custom views (reusable components)
- Animations and transitions
- Sheet presentations with form validation
- Real app behavior — not toy demos

Examples: Full todo app with projects and tags, expense tracker with charts and budgets, recipe book with meal planning, fitness log with workout templates.

---

## Does the LLM "Learn"?

**No, not between separate generations.** Each call is stateless. But you can simulate learning:

1. **Expand the system prompt** based on observed failure patterns → this is "teaching" the LLM
2. **Add golden examples** to the prompt for complex apps → few-shot learning
3. **Expand rule-based fixes** for recurring compilation errors → permanent fixes
4. **Fine-tune a model** (expensive, requires infrastructure) → actual learning
5. **Use the conversation context** — follow-up messages in the same chat carry history, so "fix the overlap on the settings screen" works because the LLM sees the prior code

The practical approach: **iterate on the system prompt and validation pipeline.** Every failure you see, ask "could I have prevented this with a prompt rule or a code-level fix?" If yes, add it.

---

## Execution Order

| Step | Effort | Impact | Do When |
|---|---|---|---|
| Benchmark 30 apps | 2–3 hours manual | Baseline numbers | Now |
| Expand system prompt (2a–2d) | 1–2 hours | High — prevents most design issues | Now |
| Expand rule-based fixes (Phase 5) | 2–3 hours | Medium — catches recurring errors for free | Now |
| Static analysis pass (3a) | 4–6 hours | Medium — catches dead buttons, overlaps | After prompt changes |
| Create APP_IDEAS_HARD | 2–3 hours | Needed for testing | After prompt changes |
| Multi-pass generation (Phase 4) | 8–12 hours | Very high for complex apps | After other gains plateau |
| Simulator screenshots (3b) | 12+ hours | Very high but complex | Long-term |

---

## Tools Available

- **Build Results Dashboard:** http://localhost:3001/admin/builds
- **CLI Analysis:** `node scripts/analyze-builds.mjs`
- **Build Results Log:** `data/build-results.jsonl`
- **App Ideas (Easy):** `APP_IDEAS_100/` — 100 simple 1-screen apps
- **App Ideas (Medium):** `APP_IDEAS_MEDIUM/` — 100 multi-screen apps with richer features
- **System Prompt:** `src/lib/llm/claudeAdapter.ts` (lines 40–65)
- **Rule-Based Fixes:** `src/lib/llm/fixSwift.ts`
- **Auto-Fix Route:** `src/app/api/projects/[id]/auto-fix-build/route.ts`

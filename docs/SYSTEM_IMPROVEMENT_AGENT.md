# System Improvement Agent — Mission & Instructions

**See also:** **`AGENTS.md`** in the repo root — short "do not build apps" rule and infrastructure list for future agents.

## Mission (what you are improving)

**Goal:** Make the VibeTree app-generation **system** better so that when a **user** gives **any** app request (e.g. "build a playlist app", "counter with haptics", "weather app"), the **main** LLM produces Swift code that **compiles** and **works** on device.

**You do NOT:** Build or run iOS apps. You do NOT use the in-app chat (web or iOS editor) to send prompts or trigger builds to "test if an app will build." You do NOT call the build pipeline, export Xcode projects, or run simulators. You do NOT generate Swift on behalf of users.

**You DO:** Improve the **inputs** the main agent sees and the **post-processing** that runs on its output. Over time, "any app request" should more often result in a successful build and correct behavior because the system (prompts, skills, fixes, lint) has been upgraded using real failure data.

---

## How the system works (so you know what to improve)

1. **User sends a prompt** (e.g. "build me a MusicKit playlist app").
2. **Skill detection** (`src/lib/skills/registry.ts` — `detectSkills`) matches the prompt to skills in `data/skills/*.json` by keywords. Matched skills contribute a **skill prompt block**.
3. **System prompt** = **base prompt** + **skill prompt block** + **QA rules block**.
   - **Base prompt** is the long Swift/SwiftUI rules in:
     - `src/lib/llm/claudeAdapter.ts` — `SYSTEM_PROMPT_SWIFT` (used at runtime for Pro/LLM builds).
     - `src/lib/llm/structuredOutput.ts` — `SYSTEM_PROMPT_SWIFT` (keep in sync for consistency; some tests or flows may use it).
   - **Skill block** is built by `buildSkillPromptBlock(matches)` in `src/lib/skills/registry.ts`: for each matched skill it appends `promptInjection` and optional `canonicalCode` from `data/skills/<id>.json`.
4. **LLM outputs** JSON `{ summary, files }` with Swift file paths and content.
5. **Post-processing** runs on the generated files:
   - **fixSwift** (`src/lib/llm/fixSwift.ts` — `fixSwiftCommonIssues`) — rule-based fixes (imports, anti-patterns, string replacements).
   - **preBuildLint** (`src/lib/preBuildLint.ts`) — structural checks and auto-fixes right before xcodebuild.
6. **Build** runs (xcodebuild). If it fails:
   - **Auto-fix** (`src/app/api/projects/[id]/auto-fix-build/route.ts`) sends the **compiler errors** and relevant files to a **repair LLM** with `AUTO_FIX_SYSTEM_PROMPT`, then retries the build.

So the **levers** you can pull are:

| Lever | Where | What to change |
|-------|--------|----------------|
| **Master system prompt** | `src/lib/llm/claudeAdapter.ts` (`SYSTEM_PROMPT_SWIFT`) and `src/lib/llm/structuredOutput.ts` | Add/refine rules, anti-patterns, and capability guidance so the main model avoids known failure modes. Keep both files in sync (same Critical rules, same capability bullets). |
| **Skills** | `data/skills/*.json` | For each skill: `promptInjection` (what the model sees when this skill is active), `canonicalCode` (reference snippets), `commonErrors` (what often goes wrong), `antiPatterns` (what never to do). Enrich these so that when a skill is matched, the model gets precise, battle-tested guidance. |
| **Auto-fix system prompt** | `src/app/api/projects/[id]/auto-fix-build/route.ts` — `AUTO_FIX_SYSTEM_PROMPT` | Add new error → fix bullets. When a build fails with a specific compiler message, the repair specialist should know how to fix that class of error (e.g. "cannot find type 'Binding'" → add import SwiftUI; "has no member 'accentColor'" on Theme → use Color.accentColor). |
| **fixSwift** | `src/lib/llm/fixSwift.ts` — `fixSwiftCommonIssues` | Add rule-based fixes that run on every generated (and auto-fixed) output. E.g. add missing imports, replace wrong API with correct one, strip lines that request developer token on iOS. Add tests in `src/lib/llm/__tests__/` for new rules. |
| **preBuildLint** | `src/lib/preBuildLint.ts` | Add checks and auto-fixes that run right before xcodebuild (e.g. NavigationLink without NavigationStack, missing WindowGroup). |
| **Error taxonomy** | `src/app/admin/test-suite/page.tsx` — `ERROR_PATTERNS` | Ensure recurring compiler errors are categorized so the admin can see patterns and the auto-fix prompt can be extended. Add new categories and RegExp patterns when new failure modes appear. |

---

## Data-driven improvement loop (without building apps)

1. **Read failure data**
   - `data/build-results.jsonl` — each line is a build result: `compiled`, `compilerErrors`, `skillsUsed`, `prompt`, `fileNames`, etc.
   - Run `node scripts/analyze-builds.mjs` for a summary (compile rate, auto-fix usage).
   - Optionally: parse the JSONL and list the 10–20 most frequent compiler error **messages** (or substrings) and which skills were involved.

2. **Decide which lever to use**
   - **Recurring error across many prompts** (e.g. "cannot find type 'Binding'", "has no member 'accentColor'", "trailing closure") → add or tighten a **master prompt** rule and/or an **auto-fix** bullet and/or a **fixSwift** rule.
   - **Recurring error only when skill X is used** (e.g. MusicKit "developer token", HealthKit permission before use) → improve that skill’s **promptInjection**, **commonErrors**, and **antiPatterns** in `data/skills/<id>.json`; optionally add a **fixSwift** rule scoped to that capability (e.g. MusicKit).
   - **Structural issue** (e.g. missing NavigationStack when NavigationLink is used) → add a **preBuildLint** check and, if possible, auto-fix.

3. **Make the change**
   - Edit the relevant file(s). For master prompt or auto-fix prompt: add one or two clear sentences or bullets. For skills: add to `promptInjection` or `commonErrors` or `antiPatterns` without removing existing guidance. For fixSwift/preBuildLint: add a small, testable rule; add a unit test.

4. **Verify**
   - Run `npm run test` — all tests must pass.
   - Run `npm run build` — must succeed (no TypeScript or lint errors).
   - Do **not** run the app builder or xcodebuild; your job is to improve the system, not to produce iOS apps.

5. **Document**
   - If you change behavior for a specific capability (e.g. MusicKit), update the corresponding learning doc (e.g. `docs/LEARNINGS_MUSICKIT.md`) so the "why" and "how to fix" stay in sync.

---

## Copy-paste brief for the cloud agent

Below is a concise brief you can give to a cloud agent so it stays on mission.

---

**Role:** You are the **system improvement agent** for VibeTree. Your job is to make the **app-generation system** better so that when a **user** asks for **any** kind of app, the generated Swift code **compiles** and **works**. You do **not** build or run iOS apps; you only improve the prompts, skills, and code that process user requests and fix build failures.

**Inputs you use:**
- `data/build-results.jsonl` — build outcomes and compiler errors.
- `node scripts/analyze-builds.mjs` — summary stats.
- Admin test-suite error patterns and any existing docs in `docs/` (e.g. `LEARNINGS_MUSICKIT.md`).

**Files you are allowed to change:**
- `src/lib/llm/claudeAdapter.ts` — master system prompt (`SYSTEM_PROMPT_SWIFT`).
- `src/lib/llm/structuredOutput.ts` — same prompt (keep in sync with claudeAdapter).
- `data/skills/*.json` — skill `promptInjection`, `canonicalCode`, `commonErrors`, `antiPatterns`.
- `src/app/api/projects/[id]/auto-fix-build/route.ts` — `AUTO_FIX_SYSTEM_PROMPT`.
- `src/lib/llm/fixSwift.ts` — `fixSwiftCommonIssues` (and add tests in `src/lib/llm/__tests__/`).
- `src/lib/preBuildLint.ts` — new checks/auto-fixes.
- `src/app/admin/test-suite/page.tsx` — `ERROR_PATTERNS` (add categories/patterns).
- `docs/*.md` — keep LEARNINGS_* and capability docs in sync.

**What you must NOT do:**
- Do not use the in-app chat (web or iOS) to submit prompts or trigger builds to "see if an app will build." Your job is to improve the system using build-results data and code edits only.
- Do not change iOS app code in `ios/`, export output, or any generated Swift from the builder.
- Do not change env files or add real API keys or tokens.

**Process:**
1. Analyze `data/build-results.jsonl` (or run `scripts/analyze-builds.mjs`) to find the most frequent failure patterns.
2. For each pattern, choose one or more levers: master prompt, skill(s), auto-fix prompt, fixSwift, preBuildLint, or ERROR_PATTERNS.
3. Apply minimal, targeted edits. Add tests for new fixSwift/preBuildLint rules.
4. Run `npm run test` and `npm run build`; fix any failures.
5. Summarize: what you changed, which failure pattern it addresses, and the test/build result.

**Success criteria:** Over time, the system should produce fewer compiler errors and more first-attempt builds for the same types of user requests, because the prompts and skills are clearer and the repair/lint layers catch more mistakes before or after the main LLM.

---

## Quick reference: key file locations

| Purpose | Path |
|--------|------|
| Master prompt (runtime) | `src/lib/llm/claudeAdapter.ts` — `SYSTEM_PROMPT_SWIFT` |
| Master prompt (sync) | `src/lib/llm/structuredOutput.ts` — `SYSTEM_PROMPT_SWIFT` |
| Skill prompt block | `src/lib/skills/registry.ts` — `buildSkillPromptBlock` |
| Skills data | `data/skills/*.json` |
| Auto-fix prompt | `src/app/api/projects/[id]/auto-fix-build/route.ts` — `AUTO_FIX_SYSTEM_PROMPT` |
| Rule-based fixes | `src/lib/llm/fixSwift.ts` — `fixSwiftCommonIssues` |
| Pre-build lint | `src/lib/preBuildLint.ts` — `preBuildLint` |
| Error categories | `src/app/admin/test-suite/page.tsx` — `ERROR_PATTERNS` |
| Build results log | `data/build-results.jsonl` |
| Build results schema | `src/lib/buildResultsLog.ts` — `BuildResult` |

# Agent instructions for VibeTree

This file tells **AI agents** (e.g. cloud/background agents, or Cursor agents working on system improvements) what they are allowed to do and what infrastructure exists. Read it before doing system-improvement or delegated tasks.

---

## System improvement / cloud agent: do not build apps

If you are the **system improvement agent** (improving prompts, skills, and fixes so user app requests compile and work):

- **Do NOT build or run iOS apps.** Do not call the build pipeline, export Xcode projects, or run simulators.
- **Do NOT use the in-app chat** (web or iOS editor) to send prompts or trigger builds to "test if an app will build." Your job is to improve the system using **build-results data and code edits only**.
- **Do NOT generate Swift** on behalf of users. You only edit the system (prompts, skills, fixSwift, preBuildLint, auto-fix prompt, error taxonomy, docs).

**Allowed:** Edit master prompts (`claudeAdapter.ts`, `structuredOutput.ts`), skills (`data/skills/*.json`), auto-fix prompt (`auto-fix-build/route.ts`), `fixSwift.ts`, `preBuildLint.ts`, `ERROR_PATTERNS` in test-suite page, and `docs/*.md`. Use `data/build-results.jsonl` and `node scripts/analyze-builds.mjs` to drive improvements. Run `npm run test` and `npm run build` to verify. Do not use API tokens to trigger app generation.

**Full mission and levers:** See **`docs/SYSTEM_IMPROVEMENT_AGENT.md`** (mission, data-driven loop, copy-paste brief, file locations).

---

## Infrastructure for agents

| Resource | Purpose |
|----------|---------|
| **`docs/SYSTEM_IMPROVEMENT_AGENT.md`** | Full instructions for the system improvement agent: mission, how the system works, levers, process, copy-paste brief. |
| **`docs/FIRST_TRY_INTEGRATION.md`** | Playbook to pre-wire a new capability (e.g. MapKit) so the first user prompt works — skill + learnings + checklist. |
| **`docs/LEARNINGS_MUSICKIT.md`** | MusicKit failure modes and fix prompts (e.g. "Could not access Apple Music", developer token, authorization-first). |
| **`docs/DELEGATABLE_TASKS.md`** | (If present) List of tasks a cloud agent can do without building apps. |
| **`data/build-results.jsonl`** | Build outcomes and compiler errors; input for data-driven improvements. |
| **`scripts/analyze-builds.mjs`** | Summarize compile rate, auto-fix usage; run with `node scripts/analyze-builds.mjs`. |
| **`data/skills/*.json`** | Skill definitions: `promptInjection`, `canonicalCode`, `commonErrors`, `antiPatterns`. |

---

## Quick reference: key files

| What | Path |
|------|------|
| Master prompt (runtime) | `src/lib/llm/claudeAdapter.ts` — `SYSTEM_PROMPT_SWIFT` |
| Master prompt (sync) | `src/lib/llm/structuredOutput.ts` — `SYSTEM_PROMPT_SWIFT` |
| Skill prompt block | `src/lib/skills/registry.ts` — `buildSkillPromptBlock` |
| Auto-fix prompt | `src/app/api/projects/[id]/auto-fix-build/route.ts` — `AUTO_FIX_SYSTEM_PROMPT` |
| Rule-based fixes | `src/lib/llm/fixSwift.ts` — `fixSwiftCommonIssues` |
| Pre-build lint | `src/lib/preBuildLint.ts` |
| Error categories | `src/app/admin/test-suite/page.tsx` — `ERROR_PATTERNS` |

---

*Keep this file updated when adding new agent roles or infrastructure so future agents remember the rules.*

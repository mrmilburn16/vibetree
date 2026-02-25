# Implementation Plans

Pro (Swift) flow, QA system, quality roadmap, and Claude API testing.

---

# Part 1: Pro (Swift) Implementation

**Source of truth:** System prompt in `src/lib/llm/claudeAdapter.ts` when `projectType === "pro"`.

## Flow: creating a Pro app

1. Dashboard → Create/open project → Editor.
2. Chat header: set dropdown to **Pro (Swift)**.
3. Send message (e.g. "A habit tracker") → `POST /api/projects/[id]/message` with `projectType: "pro"`.
4. LLM returns `{ summary, files }` with `.swift` files; server saves to project store.
5. **Run on device** → Download for Xcode (.zip) → unzip → open in Xcode → Run on iPhone.

## Pro system prompt (Swift/SwiftUI)

Use as `SYSTEM_PROMPT_SWIFT` in `claudeAdapter.ts`. Response shape: `{ summary, files: [ { path, content } ] }`.

Key rules: Swift/SwiftUI only, iOS 17+, `App.swift` + `ContentView.swift`, world-class design, Liquid Glass when user asks.

See full prompt in `src/lib/llm/claudeAdapter.ts`.

## Ways to get the app

| Option | Type | Notes |
|--------|------|-------|
| Download for Xcode (.zip) | Pro | Fastest: `GET /api/projects/[id]/export-xcode` |
| Expo Go (QR) | Standard | Expo only |
| Xcode + USB (manual) | Pro | Create project, paste Swift |

---

# Part 2: QA System Enhancer

Test apps, report issues, improve generation — all from the browser.

**Data flow:** Test in Xcode → Write notes in Test Suite/Builds → Issue classifier auto-tags → QA Insights aggregates → Apply suggested rules → Rules inject into system prompt.

**URLs:** Test Suite `localhost:3001/admin/test-suite`, Builds `localhost:3001/admin/builds`, QA Insights `localhost:3001/admin/qa`.

**Files:** `src/lib/qa/issueClassifier.ts`, `qaInsights.ts`, `appliedRules.ts`, `src/app/api/admin/qa-rules/route.ts`.

---

# Part 3: Quality Improvement Plan

**Goal:** 98% success rate from simple to complex apps.

**Current pipeline:** System prompt → Rule-based fixes (4 patterns) → Build validation → Auto-fix loop (5 LLM attempts).

**Phases:** 1) Benchmark 30 apps, 2) Improve system prompt (design rules, architecture templates, anti-patterns), 3) Static analysis pass, 4) Multi-pass generation for complex apps, 5) Expand rule-based fixes, 6) Create APP_IDEAS_HARD.

**Tools:** Build Results `/admin/builds`, CLI `node scripts/analyze-builds.mjs`, log `data/build-results.jsonl`.

---

# Part 4: Testing & Claude API

**Env in `.env.local`:**

```bash
NEXT_PUBLIC_USE_REAL_LLM=true
ANTHROPIC_API_KEY=sk-ant-your-key
```

Restart dev server after changes.

**Steps:** 1) Test mock flow (no env vars), 2) Test 503 path (flag only, no key), 3) Add API key, 4) Go live.

**Checklist:** Open editor → Send message → See steps → Final summary + edited files → Build Ready/LIVE → Credits deduct on success only.

**Key:** Get from https://console.anthropic.com/

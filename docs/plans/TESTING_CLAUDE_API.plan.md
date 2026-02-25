# Plan: Testing & going live with Claude API

**Purpose:** Get the conversation flow tested (mock + error path), then switch to real Claude with an API key.

---

## Pro (Claude) end-to-end — env and flow

**Env in `.env.local`:**

```bash
# Use real Claude (required for Pro build with API)
NEXT_PUBLIC_USE_REAL_LLM=true

# Get key from https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

Restart the dev server after changing `.env.local` (`npm run dev`).

**Quick test (Pro + Claude):**

1. Open dashboard → create or open a project → editor.
2. In the chat header, set the dropdown to **Pro (Swift)**.
3. Send a message (e.g. “A habit tracker with streak cards”).
4. Wait for one assistant reply (summary + edited files like App.swift, ContentView.swift).
5. Click **Run on device** → **Download for Xcode (.zip)** → unzip → open `VibetreeApp.xcodeproj` in Xcode → Run on simulator or device.

If you omit `ANTHROPIC_API_KEY` but keep `NEXT_PUBLIC_USE_REAL_LLM=true`, you get 503 “AI service not configured”. With both set, the message goes to Claude and the Pro download works.

---

## Steps

1. **Test mock flow** — No `ANTHROPIC_API_KEY`, no `NEXT_PUBLIC_USE_REAL_LLM`. Run app, open `/editor/[id]`, send a message. Complete checklist below (§ Checklist).
2. **Test 503 path** — In `.env.local` set only `NEXT_PUBLIC_USE_REAL_LLM=true`. Restart dev server. Send message → expect 503 and error in UI (e.g. toast).
3. **Add API key** — Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env.local`. Restart dev server.
4. **Go live** — Send message in editor. You should get a real Claude reply (one assistant message, no mock steps).

After step 4 you’re live. Set `NEXT_PUBLIC_USE_REAL_LLM=false` or unset to use mock again.

---

## Runbook — do in this order (mock flow first)

**Setup:** No `ANTHROPIC_API_KEY`, no `NEXT_PUBLIC_USE_REAL_LLM` in `.env.local`. Dev server running. Have at least 1 credit (use /credits → Testing → Set balance if needed).

| # | Do this | You should see |
|---|---------|-----------------|
| 1 | Open dashboard, open a project (or create one), go to editor. | Editor with chat panel, preview, model dropdown. |
| 2 | Type **"A fitness tracker with activity rings"** and send. | Your message in chat + **"Building…"** in the UI. |
| 3 | Wait through the step messages. | In order: **"Reading files."** → **"Explored."** → **"Grepped."** → **"Analyzed."** → **"Planning next moves…"** → **"Writing code…"**. |
| 4 | Wait for the final reply. | One assistant message with a short summary + a list of **edited files** (e.g. Models/Workout.swift, …). |
| 5 | Check build status. | Status shows **"Ready"** or **"LIVE"** (not Failed). |
| 6 | Send a second message (e.g. "Add a todo list"). | Same flow: steps → summary → edited files; status stays live. |
| 7 | Change the **model dropdown** (e.g. to Claude Sonnet 4.6). | Selection updates; next send still works (mock doesn’t change; value is sent when real LLM is on). |
| 8 | Leave the input **empty** and try to send (or type only spaces). | Send doesn’t go through / message is ignored. |
| 9 | Paste or type a message **longer than 4000 characters** and try to send. | Rejected or truncated per UI/API (error or character limit). |
| 10 | Go to **/credits** → Testing → set balance to **0** → back to editor. Try to send a message. | **"Out of credits"** or send blocked / modal. Set balance back (e.g. 50) after. |
| 11 | In **.env.local** set only **`NEXT_PUBLIC_USE_REAL_LLM=true`** (no API key). Restart dev server. Send any message. | **503** response; UI shows **Failed** and error (e.g. toast **"AI service not configured"**). Turn the flag off again when done. |
| 12 | With real LLM on and no API key, send a message. Note credit balance; after 503 check again. | Balance **unchanged** (deduct-on-success). |
| 13 | Add **ANTHROPIC_API_KEY**, restart. Send one short message (e.g. "A simple counter app"). | One assistant message with summary + edited files; credit decreased by 1; Export returns generated Swift. |

When you’ve done 1–11, mock flow and error handling are verified. Do **step 12** (confirm deduct-on-success: 503 = balance unchanged), then add your API key and do **step 13** (first real-Claude test: one message, one credit, export has generated Swift). Then you're live.

---

## Model bakeoff (same prompt across all 3 LLMs)

**Goal:** Run the *same one-shot prompt* against each model option and compare:
- output quality (UI polish, correctness, feature coverage)
- buildability (Xcode build success, no missing symbols)
- time to first tokens / total time
- token usage + estimated USD cost

**Important:** For a fair comparison, each model must start from the **same initial state**. Don’t run the 3 models sequentially inside the *same* project, because the later runs will receive “current files” from the earlier run and you won’t be comparing apples-to-apples.

### Manual protocol (do this now)

1. Pick a single prompt you’ll reuse (e.g. “Meditation timer with Live Activities + Dynamic Island, polished UI, no emoji.”).
2. Create **three fresh projects** from the dashboard (empty state), one per model.
3. In each project’s editor:
   - Set dropdown to **Pro (Swift)** (or Standard if that’s what you’re testing).
   - Pick the model in the model dropdown.
   - Paste the exact same prompt and send.
4. Record for each model:
   - Final assistant summary
   - Edited file list
   - Token usage + estimated cost shown in chat
   - Xcode: unzip → open → select Team → build/run (note any compiler errors)
5. Decide “best default model” for Vibetree based on the results (quality vs cost vs reliability).

### Implementation plan (optional automation inside Vibetree)

Add a small “Run prompt across models” tool that automatically creates 3 comparable runs.

**UI approach:**
- Add a `ModelBakeoffModal` accessible from the editor (dev-only at first; behind a feature flag).
- Fields:
  - Prompt (textarea)
  - Project type (Standard/Pro)
  - Models to run (default: all entries in `src/lib/llm-options.ts`)
- When the user clicks Run:
  - Create **3 new projects** via `POST /api/projects` with names like:
    - `${baseName} (Opus 4.6)`
    - `${baseName} (Sonnet 4.6)`
    - `${baseName} (Model 3)`
  - For each new project ID, call `POST /api/projects/[id]/message/stream` with:
    - `message`: the same prompt
    - `model`: the model option value
    - `projectType`: chosen type
    - `projectName`: the project name
  - Render results as a 3-column comparison:
    - Live progress (phase, tokens, elapsed, cost)
    - Final summary
    - “Download for Xcode” (Pro) or “Download source” (Standard)
    - Build check checkbox + notes

**Data/storage:**
- Save bakeoff results to `localStorage` (e.g. `vibetree-bakeoff:<timestamp>`), including:
  - project IDs, model, summary, edited files, usage, estimated cost, timestamps
- For Pro, reuse the existing `projectFiles` caching so export still works after refresh.

**Note about “3 LLMs”:**
- Today `LLM_OPTIONS` includes 3 entries, but `gpt-5.2` is currently marked `disabled: true`. If you want a true 3-way bakeoff right now, either enable that option (and actually route it to a real model) or add a third Claude option (e.g. another tier/version) so all three are runnable.

---

## Pre-live (what's in place)

- **Structured output:** Real Claude returns JSON with `summary` and `files` (path + content). Parse failures return 422 "AI response could not be parsed"; no persist or build.
- **Deduct on success:** Credits deducted only when the message API returns 200 (real LLM path). 503/422/timeout do not deduct.
- **File store + export:** Generated files stored per project; Download source returns actual generated Swift when available.

---

## Checklist (same items, for quick tick-off)

- [ ] Open editor for a project (`/editor/[id]`).
- [ ] Send a message (e.g. "A fitness tracker with activity rings").
- [ ] See your message + "Building…" state.
- [ ] Step messages in order: "Reading files.", "Explored.", "Grepped.", "Analyzed.", "Planning next moves…", "Writing code…".
- [ ] Final assistant message with summary + edited files list.
- [ ] Build status → "Ready" / "LIVE".
- [ ] Send another message; flow repeats.
- [ ] Model dropdown changes selection (value sent to API when real LLM is on).
- [ ] Empty message cannot be sent.
- [ ] Message over 4000 chars rejected or truncated.
- [ ] Credits deduct (or "Out of credits") as expected.
- [ ] On error (e.g. real-LLM path, no key), error message appears in UI (toast/inline).

---

## Reference

| Goal | Action |
|------|--------|
| Test mock end-to-end | No env vars; run through checklist above. |
| Test 503 (no key) | `NEXT_PUBLIC_USE_REAL_LLM=true` only; send message. |
| Go live with Claude | Add `ANTHROPIC_API_KEY`, set `NEXT_PUBLIC_USE_REAL_LLM=true`, restart. |

- **Real API:** Implemented in `src/app/api/projects/[id]/message/route.ts`, `src/lib/llm/claudeAdapter.ts`, and `src/lib/llm/parseStructuredResponse.ts`. System prompt asks for JSON (`summary` + `files`); parser validates; editedFiles and file store populated on success.
- **Key:** Get from [Anthropic Console](https://console.anthropic.com/).
- **Models:** Opus 4.6, Sonnet 4.6 mapped in `claudeAdapter.ts`. "GPT 5.2" → Claude Sonnet fallback. Real Claude returns parsed `editedFiles` (paths) and files are persisted for export.

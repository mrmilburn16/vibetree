# Plan: Testing & going live with Claude API

**Purpose:** Get the conversation flow tested (mock + error path), then switch to real Claude with an API key.

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

When you’ve done 1–11, mock flow and error handling are verified. Then add your API key and do **Steps 3–4** at the top to go live with Claude.

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

- **Real API:** Implemented in `src/app/api/projects/[id]/message/route.ts` and `src/lib/llm/claudeAdapter.ts`. No code changes needed.
- **Key:** Get from [Anthropic Console](https://console.anthropic.com/).
- **Models:** Opus 4.6, Sonnet 4.6 mapped in `claudeAdapter.ts`. "GPT 5.2" → Claude Sonnet fallback. `editedFiles` is `[]` for real Claude (extend later if needed).

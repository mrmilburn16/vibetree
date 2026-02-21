# Testing conversation and UI before using Claude API keys

Use this checklist to verify the conversation flow and editor behavior **without** setting `ANTHROPIC_API_KEY`. Once everything works with the mock, you can add API keys and switch to the real LLM.

## How it works today

- **Default (mock):** `NEXT_PUBLIC_USE_REAL_LLM` is unset or `false`. The chat uses a **client-side mock** in `useChat.ts`: it adds step messages (“Reading files.”, “Explored.”, etc.), then a summary + edited files, and sets build status to “live”. No API call to `/api/projects/[id]/message` for the assistant reply.
- **Real LLM path:** Set `NEXT_PUBLIC_USE_REAL_LLM=true`. The client then calls `POST /api/projects/[id]/message` with `useRealLLM: true`. The API route currently still uses the **server mock** (`mockAdapter`) for the response; it only checks for `ANTHROPIC_API_KEY` and returns 503 if `useRealLLM` is true and the key is missing. So you can test “real path + no key” to see error handling.

## What to test before adding API keys

Do all of this with **no** `ANTHROPIC_API_KEY` and **no** `NEXT_PUBLIC_USE_REAL_LLM` (or explicitly `false`).

### 1. Conversation UI (mock flow)

- [ ] Open the editor for a project (`/editor/[id]`).
- [ ] Send a message (e.g. “A fitness tracker with activity rings”).
- [ ] You see your message in the chat and a “Building…” state.
- [ ] Step messages appear in order: “Reading files.”, “Explored.”, “Grepped.”, “Analyzed.”, “Planning next moves…”, “Writing code…”.
- [ ] A final assistant message appears with a short summary (e.g. “I've added a todo list with categories and due dates.”) and a list of edited files below it.
- [ ] Build status goes to “Ready” / “LIVE” and the preview pane shows the corresponding state.
- [ ] Send another message; the same flow repeats (steps + summary + files).
- [ ] Model dropdown (e.g. Claude Sonnet 4.6, GPT 5.2) changes the selected model; the mock does not change behavior, but the value is sent when you switch to the real API.

### 2. Input and validation

- [ ] Empty message cannot be sent (or is ignored).
- [ ] Very long message (over 4000 characters) is rejected or truncated per UI/API rules.
- [ ] Placeholder and “Send message” / credits tooltip behave correctly.
- [ ] After sending, input clears and you can send again after the mock “finishes”.

### 3. Credits and errors (if applicable)

- [ ] If you have a credits system in the UI, sending a message deducts credits (or shows “Out of credits”) as expected in mock mode.
- [ ] If you have an onError callback, trigger a failure path (e.g. temporarily break the API or use real-LLM path with no key) and confirm the error message appears (e.g. toast or inline).

### 4. Optional: real-LLM path without a key

To confirm the “real LLM” code path and error handling **before** adding a key:

1. Set in `.env.local`: `NEXT_PUBLIC_USE_REAL_LLM=true`.
2. Do **not** set `ANTHROPIC_API_KEY`.
3. Restart the dev server, open the editor, and send a message.
4. The client will call `POST /api/projects/[id]/message` with `useRealLLM: true`. The API will return **503** with “AI service not configured”.
5. Check that the UI handles this gracefully (e.g. build status “failed”, error message shown, no crash). Then set `NEXT_PUBLIC_USE_REAL_LLM` back to `false` or remove it for normal mock testing.

### 5. When you’re ready for real Claude

- Add `ANTHROPIC_API_KEY` to your environment (e.g. `.env.local`).
- Update the **API route** `src/app/api/projects/[id]/message/route.ts`: when `useRealLLM` is true and the key is present, call Claude (or your real LLM) instead of `mockGetResponse`, and return the same shape `{ assistantMessage: { id, role, content, editedFiles }, buildStatus }`.
- Set `NEXT_PUBLIC_USE_REAL_LLM=true` when you want the client to use the real API. Leave it unset or `false` to keep using the client-side mock.

## Summary

| Goal | What to do |
|------|------------|
| Test conversation UI end-to-end | Use default (mock); run through checklist in §1–3. |
| Test “real API but no key” error | Set `NEXT_PUBLIC_USE_REAL_LLM=true`, no `ANTHROPIC_API_KEY`; send message; expect 503 and graceful UI. |
| Go live with Claude | Add `ANTHROPIC_API_KEY`, implement real LLM in the message route, then set `NEXT_PUBLIC_USE_REAL_LLM=true`. |

No plan file was in the repo before this; this doc is the testing plan so you can validate everything before using API keys.

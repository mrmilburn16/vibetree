# Full lifecycle: user prompt → compiled app

Step-by-step trace of what happens from chat input to a built (and optionally auto-fixed) app, with file and function references.

---

## 1. User sends a message in the chat

**UI entry**

- User types in the chat input and submits (e.g. form submit or “Get started”).
- **File:** `src/components/editor/ChatPanel.tsx`
  - `handleSubmit` (≈297) runs on form submit: trims input, checks credits, calls `sendMessage(text, llm, projectType)`.
  - `sendMessage` comes from `useChat(projectId, { … })` (same file, ≈195).

**Queue and stream trigger**

- **File:** `src/components/editor/useChat.ts`
  - `sendMessage` (≈1097):
    - Builds a user message object, appends it to `messages` state and `messagesRef.current`.
    - Persists chat via `persistChatToServer(projectId, messagesRef.current)` → `POST /api/projects/${projectId}/chat` (≈219).
    - If `featureFlags.useRealLLM`: pushes `{ text, model, projectType }` onto `queueRef.current`, sets `isTyping`/`processingRef`, calls `processQueue()`.
  - `processQueue` (≈592):
    - If queue empty: clears typing, sets build status to `"live"` when was `"building"`, returns.
    - Shifts one item from queue, sets `setBuildStatus("building")`, creates an `AbortController`, then:
    - **Ensures project exists:** `POST /api/projects` with `{ id: projectId, name: projectName }`.
    - **Starts stream:** `POST /api/projects/${projectId}/message/stream` with body:
      - `message`, `model`, `projectType`, `projectName`
    - Uses `fetch(…, { signal: ac.signal })` and reads the response body with a `TextDecoder` and line-by-line JSON parsing.

So: **sending a message** → `ChatPanel.handleSubmit` → `useChat.sendMessage` → queue + `processQueue` → **`POST /api/projects/:id/message/stream`**.

---

## 2. System prompt and context sent to Claude

**Stream API**

- **File:** `src/app/api/projects/[id]/message/stream/route.ts`
  - **POST** (≈73): validates `message`, resolves `projectType`, checks subscription (Pro) and credits, then:
  - **Message enrichment and skills (Pro only):**
    - `enrichWithSkills(projectType, message)` → `src/lib/llm/promptEnrichment.ts` (≈19): for `projectType === "pro"` runs `detectSkills(message)` and returns `{ message: enrichedMessage, skillIds }`. For standard, returns message unchanged and empty `skillIds`.
    - `detectSkills(message)` → `src/lib/skills/registry.ts` (≈68): loads all skills from `data/skills/*.json`, normalizes prompt text, matches `detection.keywords` (and skips when `excludeKeywords` match). Returns `SkillMatch[]` sorted by match count.
    - `buildSkillPromptBlock(skillMatches)` → same file (≈155): for each match builds a block with `CAPABILITY: ${skill.name}`, `skill.promptInjection`, and optional `canonicalCode`; these are concatenated and returned as one string.
  - **Context for Claude:**
    - `currentFiles` = `getProjectFilePaths(projectId)` / `getProjectFiles(projectId)` from `@/lib/projectFileStore` — existing project files (path + content).
  - **Claude call:** `getClaudeResponseStream(enrichedMessage, model, { currentFiles, projectType, skillPromptBlock, projectName }, { onProgress, onSummaryChunk, onDiscoveredFilePath })` from `@/lib/llm/claudeAdapter`.

**What Claude actually receives**

- **File:** `src/lib/llm/claudeAdapter.ts`
  - **User content:**
    - If `currentFiles` exists and non-empty: a blob that includes “The app is already named …” (when `projectName` set), then “Current project files (apply the user's request…):” + `JSON.stringify(currentFiles)`, then “User request:” + message, then “Instructions: Apply only what the user asked for…”.
    - Else: just the (enriched) user message.
  - **System prompt (blocks):**
    1. **Base:** `SYSTEM_PROMPT_SWIFT` (≈52) for Pro, or `SYSTEM_PROMPT_STANDARD` (≈37) for standard.  
       - Swift: full Swift/SwiftUI rules, output format `{ "summary": "...", "files": [ { "path", "content" } ] }`, design/UX, list/haptics/units, etc.  
       - Standard: Expo/React Native, same JSON shape.
    2. **Skills:** `skillPromptBlock` from the stream route (only for Pro; built from `detectSkills(message)` + `buildSkillPromptBlock`). Can be empty.
    3. **Loader skills:** `matchSkills(message)` from `@/lib/skills/skillLoader` — additional skill block from loader (e.g. extra capabilities).
    4. **QA rules:** `buildAppliedRulesPromptBlock()` from `@/lib/qa/appliedRules`.
  - **Caching:** Base prompt can be sent with `cache_control: { type: "ephemeral", ttl: "1h" }`; skills and QA blocks are uncached so the cache key stays stable.

So: **system prompt** = base (Swift or Standard) + **skill block** (from keyword-matched `data/skills/*.json` + loader) + **QA rules**. **User message** = enriched message; if there are current files, user content is the “current files JSON + user request + instructions” blob.

---

## 3. How Claude’s response is parsed into Swift (or JS) files

**Streaming and final message**

- **File:** `src/lib/llm/claudeAdapter.ts`
  - `getClaudeResponseStream` (≈546) uses `client.messages.stream()` with:
    - `output_config: { format: jsonSchemaOutputFormat(STRUCTURED_OUTPUT_SCHEMA) }`.
  - `STRUCTURED_OUTPUT_SCHEMA` (≈330): `{ type: "object", required: ["summary", "files"], properties: { summary: { type: "string" }, files: { type: "array", items: { path, content } } } }`.
  - On `stream.on("text", …)` it:
    - Calls `maybeEmitSummaryChunk(textSnapshot)` so the client gets live summary text.
    - Calls `maybeScanForPaths(textSnapshot)` to detect `"path":"..."` and invoke `onDiscoveredFilePath`.
    - Reports progress via `onProgress({ receivedChars })`.
  - After `stream.finalMessage()`:
    - Prefer `(finalMessage).parsed_output` if it satisfies `isStructuredResponse` (has `summary` string and `files` array of `{ path, content }`).
    - Else falls back to `parseStructuredResponse(extractTextFromContent(finalMessage.content))`.

**Parsing and validation**

- **File:** `src/lib/llm/parseStructuredResponse.ts`
  - `parseStructuredResponse(raw)` (≈44): strips optional markdown JSON fence, `JSON.parse`, validates required keys `summary` and `files`, ensures each file has `path` and `content` strings; returns `{ summary, files: ParsedFile[] }`.
  - On parse failure (e.g. truncated JSON): `salvageTruncatedJSON(trimmed)` (≈109) tries to extract `"summary"` and complete `{"path":"…","content":"…"}` objects from the raw string so the build can still get partial files.

**Back in the stream route**

- **File:** `src/app/api/projects/[id]/message/stream/route.ts`
  - After `getClaudeResponseStream` returns `result` (≈294):
    - Pro: `result.parsedFiles` filtered to `.swift` only, then `fixSwiftCommonIssues(filesToStore)` (`@/lib/llm/fixSwift`), then `preBuildLint(filesToStore)` (`@/lib/preBuildLint`); the lint result’s `files` are what get stored.
    - `setProjectFiles(projectId, filesToStore)` persists them.
  - Response to client: NDJSON stream with events such as `phase`, `progress`, `content` (summary chunk), `file` (path + existing/count), then a final `done` event with `assistantMessage` (id, role, content, editedFiles, usage, estimatedCostUsd) and `buildStatus: "live"`.

So: **Claude’s reply** is constrained to JSON `{ summary, files }`; that is parsed (or salvaged), then for Pro the files are filtered to Swift, passed through **fixSwift** and **preBuildLint**, and stored with **setProjectFiles**. The client receives the same structure via the `done` event and can also fetch `GET /api/projects/:id/files` if needed.

---

## 4. When and how skill files are injected

**When**

- Skills are injected **only when building the system prompt for the LLM**, on the **server**, during the same request that calls Claude (stream or non-stream).
- They are **not** applied per-file on disk; they only affect the text sent to Claude.

**Where**

- **Stream:** `src/app/api/projects/[id]/message/stream/route.ts` (≈137–139):
  - `skillMatches = projectType === "pro" ? detectSkills(message) : []`
  - `skillPromptBlock = buildSkillPromptBlock(skillMatches)`
  - Passed into `getClaudeResponseStream(…, { …, skillPromptBlock })`.
- **Non-stream:** `src/app/api/projects/[id]/message/route.ts` (≈59–61): same `detectSkills(message)` and `buildSkillPromptBlock(skillMatches)` for Pro, then passed to `getClaudeResponse(…, { …, skillPromptBlock })`.

**Detection**

- **File:** `src/lib/skills/registry.ts`
  - `detectSkills(prompt)` (≈68): normalizes prompt (lowercase, quote normalization), loads all skills from `data/skills/*.json`, for each skill checks `detection.excludeKeywords` then `detection.keywords`; any keyword match adds a `SkillMatch`. Results sorted by `matchCount` descending.

**Injection content**

- **File:** `src/lib/skills/registry.ts` — `buildSkillPromptBlock(matches)` (≈155):
  - For each match: a section “--- CAPABILITY: ${skill.name} (${skill.frameworks}) ---”, then `skill.promptInjection`, then optional “Reference code patterns” from `skill.canonicalCode` (filename + code), then “---”.
  - All sections concatenated with newlines and prepended with `"\n\n"` so it’s one block appended to the system prompt.

**Enrichment (Pro only)**

- **File:** `src/lib/llm/promptEnrichment.ts`
  - `enrichWithSkills(projectType, message)` (≈19): for Pro, runs `detectSkills` and returns `{ message, skillIds }`. The **message** itself is not modified here (still the trimmed user text); enrichment is the **skill prompt block** built in the route and passed to the adapter. `skillIds` are returned for analytics (e.g. build-results logging).

So: **skills** = JSON files in `data/skills/` whose **keywords** match the user message; their **promptInjection** and **canonicalCode** are turned into a single **skill block** and appended to the **system** prompt only for **Pro**; the user message is unchanged by this step.

---

## 5. What happens when a build fails (and how errors get back to Claude)

**Build job creation (Pro validation)**

- After the stream finishes, the client (useChat) has project files and, for Pro, calls `onProBuildComplete(projectId, onProgress)`.
- **File:** `src/components/editor/EditorLayout.tsx`
  - `runPreflight` (≈228): reads project name/bundleId (and optional overrides) from localStorage, then `POST /api/projects/${projectId}/validate-xcode` with no files in body (server loads files from store).
- **File:** `src/app/api/projects/[id]/validate-xcode/route.ts`
  - **POST** (≈66): loads files from body or `getProjectFilesAsync(projectId)`, normalizes them, optionally sets project files, then `createBuildJob({ projectId, projectName, bundleId, files, developmentTeam, userPrompt, autoFix: true, attempt: 1, maxAttempts })` from `@/lib/buildJobs`.
  - Returns `{ job }` with job id.

**Mac runner**

- Runner polls `POST /api/build-jobs/claim`; gets a job, builds (e.g. xcodebuild), then **POSTs to** `PUT/POST /api/build-jobs/[id]/update` with `status`, `logs`, `compilerErrors`, `exitCode`, `error`, optional `ipaBase64`.

**Update route and auto-fix trigger**

- **File:** `src/app/api/build-jobs/[id]/update/route.ts`
  - Appends `logs` and `compilerErrors`, updates job status (e.g. `succeeded` / `failed`).
  - For **failed** jobs (≈144–163): if job is not cancelled, `request.autoFix` is true, `attempt < maxAttempts`, and there are errors or logs, it calls `setBuildJobAutoFixInProgress(id, true)` and **triggerAutoFix(projectId, jobId)**.
  - **triggerAutoFix** (≈25): `POST ${base}/api/projects/${projectId}/auto-fix-build` with body `{ failedJobId: jobId }`, using runner token.

**Auto-fix route: errors fed back to Claude**

- **File:** `src/app/api/projects/[id]/auto-fix-build/route.ts`
  - **POST** (≈236): loads `failedJob` by `failedJobId`, checks not cancelled and still failed.
  - Builds prompt for a **separate** Claude call (repair specialist):
    - **System:** `AUTO_FIX_SYSTEM_PROMPT` (≈186): “Swift compiler-error repair specialist”, rules for common errors (e.g. missing import, accentColor, NSAttributedString.Key, trailing closure, etc.), output JSON `{ explanation, files }`.
    - **User content:** “COMPILER ERRORS:” + `errors.join("\n")`, optional “ADDITIONAL ERROR LINES FROM BUILD LOG”, optional “ORIGINAL USER REQUEST”, “FILES THAT NEED FIXING:” (full content for files that have errors, plus type-summary for other files), optional “FULL BUILD LOG (last 200 lines)”, plus “Fix ALL the compilation errors…” and optionally “This is attempt N of M… SIMPLIFY the code…”.
  - Calls Claude with `jsonSchemaOutputFormat(FIX_SCHEMA)` (explanation + files array).
  - On success: `fixSwiftCommonIssues` on fixed files, `preBuildLint`, then **createBuildJob** for a **retry** with the fixed files and `attempt: attempt + 1`, linked via `setBuildJobNextJob(failedJobId, retryJob.id)`. Runner later claims the new job and builds again.
  - If errors are unchanged from previous attempt: returns `gaveUp` to avoid loops.
  - Client (EditorLayout) polls `GET /api/build-jobs/${jobId}`; when status is `failed` and there is a `nextJobId`, it follows the chain; when status is `succeeded`, it returns success (and optional `fixedFiles`, `attempts`, `compilerErrors`, `errorHistory`).

So: **build failure** → runner POSTs failure to **build-jobs/[id]/update** → update route calls **auto-fix-build** → auto-fix builds a **dedicated system + user prompt** containing **compiler errors and file contents** → **separate Claude call** returns fixed files → new build job created and runner builds again. The **original** chat prompt is not re-sent; only the **auto-fix** prompt (errors + files + optional user request) is.

---

## 6. Where the user sees status and messages

**Chat panel**

- **File:** `src/components/editor/useChat.ts`
  - **Typing:** `isTyping` set true when processing, false when queue drains; `setStreamContentMessageId(streamContentId)` when first content event received so the UI can show “streaming” for that bubble.
  - **Phases:** Stream sends `type: "phase"` (e.g. `starting_request`, `waiting_for_first_tokens`, `receiving_output`, `validating_structured_output`, `saving_files`, `done_preview_updating`); these are not currently rendered in useChat but could be.
  - **Live narrative:** On `type: "content"` (summary chunk), `setMessages` updates or appends the assistant message with `content: event.text`; user sees the summary stream in the chat bubble.
  - **File annotations:** On `type: "file"` (path + existing/count), the same message’s `fileAnnotations` array is updated with labels like “Creating Foo.swift” / “Editing Bar.swift”; UI can show these under the bubble.
  - **Progress:** `type: "progress"` updates `setStreamReceivedChars`; footer can show approximate tokens/chars.
  - **Done:** On `type: "done"`, the stream-content message is replaced or merged into the final assistant message (content, editedFiles, usage, estimatedCostUsd); then for Pro, a “Finalizing… Waiting for runner…” line and `onProBuildComplete` run.
  - **Errors:** On `type: "error"` or non-ok response, `finish({ error })` runs, `setBuildStatus("failed")`, `onError?.(opts.error)`; user sees error state and message.

**Build status in header**

- **File:** `src/components/editor/ChatPanel.tsx`
  - Uses `buildStatus` from useChat (`idle` | `building` | `live` | `failed`); shows spinner/live/failed indicator and optional cancel; `onBuildStatusChange(buildStatus)` notifies parent.

**Validation progress (Pro)**

- **File:** `src/components/editor/useChat.ts`
  - When `onProBuildComplete` is used: a “Finalizing… Waiting for runner…” message is shown; `onProgress(status)` from EditorLayout’s runPreflight is passed in and used to call `setValidateProgressBase` / `setValidateElapsedSeconds` so the same bubble shows e.g. “Validating build on Mac… Compiling…” or “Auto-fix attempt 2…”.
  - **File:** `src/components/editor/EditorLayout.tsx` — `formatValidateProgress(job)` (≈36): formats job status, attempt, and `autoFixInProgress` into a short string for that progress line.
  - When validation completes: the progress message is replaced by either “Build validated. Your app is ready…” or “Build validation failed after auto-fix: …”; `setBuildStatus(result.status === "succeeded" ? "live" : "failed")` and optional `onError` / `onAppBuilt`.

**Message list**

- **File:** `src/components/editor/ChatMessageList.tsx`
  - Renders `messages` from useChat; shows user/assistant bubbles, `fileAnnotations`, and when `buildStatus === "live"` can show a “Ready” indicator.

So: **status** is visible as (1) typing/streaming and live summary + file annotations in the chat, (2) build status in the chat header (idle/building/live/failed), and (3) for Pro, a single “Finalizing… / Validating… / Auto-fix attempt N” line that then becomes the final success or failure message in the same bubble.

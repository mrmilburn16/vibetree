# Build failure reason: where it lives and what the admin page shows

## 1. Where is the build job record? Firestore or in-memory?

**In-memory only.** Build jobs live in `src/lib/buildJobs.ts`: `globalThis.__buildJobs` (a `Map<string, BuildJobRecord>`). They are **not** stored in Firestore.

- **BuildJobRecord** has an **`error`** field (e.g. `"Build failed after all attempts"`, `"Auto-fix cancelled by user"`, `"Max attempts (8) reached"`, `"Cancelled by user"`).
- For a given project/build, the job that ran is in that Map. After a server restart, the map is empty — so you **cannot** look up the job for `proj_1772811586330_cg8llyv` in Firestore; it only exists in memory while the server is running (and only if that job was the “current” one for that project).

So: **the failure reason is in `job.error` in memory**. There is no Firestore document for the job itself.

---

## 2. When does auto-fix stop retrying?

In `src/app/api/projects/[id]/auto-fix-build/route.ts`:

| Condition | Effect |
|-----------|--------|
| **`attempt > maxAttempts`** | Stops immediately. `maxAttempts` comes from `failedJob.request.maxAttempts ?? 8`. So default is **8 attempts**; after that it returns `{ gaveUp: true, reason: "Max attempts (8) reached" }` and sets `autoFixInProgress = false`. |
| **No source files** | `currentFiles.length === 0` → `gaveUp: true`, "No source files in job to fix". |
| **No errors or log** | `errors.length === 0 && logLines.length === 0` → "No compiler errors or build log to fix". |
| **`wasCancelled()`** | User hit Stop/Cancel → return `{ cancelled: true }`, no retry. |
| **ANTHROPIC_API_KEY not set** | 503, gaveUp. |
| **LLM returns no fixed files** (including after retry with all files) | "LLM could not produce fixed files". |
| **Exception during LLM/post-processing** | `gaveUp: true`, reason = error message. |

So: **the main “gave up” condition is hitting the max attempt limit (default 8)**. It does **not** “give up after N consecutive failures” as a separate rule — it just stops when `attempt > maxAttempts`. Other stops are: no files, no errors to fix, cancelled, missing API key, or LLM/exception failure.

---

## 3. Admin builds page: what does a failed build card show?

The admin builds page at `/admin/builds` does **not** use build jobs. It uses **build results** from Firestore (`build_results` collection), fetched via `GET /api/build-results`.

- **BuildResult** (in `src/lib/buildResultsLog.ts` and the page’s `BuildResult` type) has: `compiled`, `attempts`, `autoFixUsed`, `compilerErrors`, `errorHistory`, etc. It does **not** have an **`error`** or **`errorMessage`** field.
- When the editor logs a build (e.g. from `useChat.ts` after validate-xcode completes), it POSTs to `/api/build-results` with `compiled`, `attempts`, `compilerErrors`, `errorHistory`, etc. — but it **does not send** the job’s **`result.error`** (the human-readable reason like "Max attempts (8) reached").
- So the failure reason is **never stored** in Firestore and **never shown** on the admin build card.

**What the card actually shows for a failed build:**

- Status badge: **"Failed"** (and optionally "Auto-fixed (N attempts)").
- **Error history** (if present): "Compiler Errors (N attempts, M total)" with an expandable block of per-attempt errors.
- Otherwise **compiler errors** list.
- It does **not** show a top-level “reason” line (e.g. "Max attempts (8) reached") because that field is not on `BuildResult` and is not sent when logging.

---

## 4. What this means for your questions

- **Why did this build give up?**  
  If it was auto-fix, the most likely reason is **max attempts (8) reached**. The exact reason is in the **in-memory** job’s **`error`** field. For `proj_1772811586330_cg8llyv` you can’t query that in Firestore; it’s only available while that job was still in memory (e.g. right after the build failed, from the server’s perspective).

- **Is the error reason stored but not displayed?**  
  **No.** The reason is **not** stored in Firestore at all. It exists only on the build job in memory and in the chat message text ("Build validation failed after auto-fix: ${result.error}"). So it’s not a UI bug — the admin page has no `error`/`errorMessage` to show.

---

## 5. Recommended change

To make “why it failed” visible on the admin page and persistent:

1. **Add `errorMessage?: string`** to the BuildResult type and to Firestore (in `buildResultsLog.ts`: payload + `fromFirestoreData`).
2. **When logging a build** (e.g. in `useChat.ts` when calling `POST /api/build-results`), send **`errorMessage: result.error`** when `result.status === "failed"`.
3. **Accept and persist `errorMessage`** in `POST /api/build-results` (in the route and in `logBuildResult`).
4. **On the admin builds page**, for failed builds, show **`result.errorMessage`** (e.g. above or beside the error history) when present.

That way the same reason that appears in the chat will be stored and shown on the build card.

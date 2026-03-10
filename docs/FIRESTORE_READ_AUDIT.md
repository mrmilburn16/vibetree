# Firestore read usage audit

This doc summarizes where Firestore reads come from in the test suite and build system, and what was changed to stay under the 50K/day free tier.

## Audit findings (sources of reads)

### 1. Admin builds page — **FIXED (was worst offender)**

- **Before:** On load and every **10 seconds** while the tab was visible, the page made **two** requests:
  - `GET /api/build-results?limit=200` → `getAllBuildResults({ limit: 200 })` = **200 reads**
  - `GET /api/build-results?stats=true` → `getBuildStats()` → `getAllBuildResults({ limit: 5000 })` = **up to 5,000 reads**
- **Total per poll:** up to **5,200 reads**. With 10s polling, that’s **~31K reads per hour** with the tab open.
- **Fix:**
  - Single request: `GET /api/build-results?limit=200&stats=true` does **one** query (200 docs) and returns both list and stats. **200 reads per request.**
  - Poll interval increased from **10s to 30s**.
- **After (per hour, tab open):** 200 × 120 = **24K reads/hour** → ~**576K reads/day** if left open 24h. If the page is used for 1–2 hours, **~24K–48K reads** per day from this page.

### 2. getBuildStats standalone

- **Before:** When called with `?stats=true` only (no limit), it used `getAllBuildResults({ limit: 5000 })` = up to **5,000 reads** per call.
- **Fix:** Standalone stats now use a cap of **500** reads (`GET_BUILD_STATS_STANDALONE_LIMIT`). The admin page no longer uses this path; it uses the combined `limit=200&stats=true` request.

### 3. Test suite run history (page load)

- **Before:** `GET /api/test-suite` (no milestone) → `getAllTestSuiteRuns()` with **no limit** → one read per document in `test_suite_runs`. With hundreds of runs, **hundreds of reads per page load** (and again after each batch completion when run history is refreshed).
- **Fix:** `getAllTestSuiteRuns()` now uses `.limit(150)`. **Max 150 reads** per load.

### 4. Build job polling (test suite and editor)

- **Source:** Test suite and editor poll **in-memory** build job status via `GET /api/build-jobs/:id` and `GET /api/build-jobs/active`. These use `buildJobs.ts` (in-memory Map), **no Firestore**. No change needed.

### 5. Mac runner

- **Source:** The runner claims and updates jobs via HTTP to the Next.js server; job state is in-memory. **No Firestore** for build jobs. No change needed.

### 6. Real-time listeners (onSnapshot)

- **Finding:** No `onSnapshot` or other real-time listeners are used. All access is one-time `get()` / `getDoc` / `getDocs`. No change needed.

### 7. Other Firestore read sources (unchanged)

- **Build results:** Single-doc reads for PATCH (e.g. update build result) and image routes; one-off.
- **Test suite:** Create/update run = one write (+ one read in update path). Load run by id = one read.
- **Error pattern status:** Used by admin builds for reconcile/status; bounded by number of common errors (e.g. 20).
- **Projects, credits, subscription, etc.:** Per-request reads; not driven by test suite or admin polling.

---

## Estimated reads per batch run of 24 apps (after fixes)

| Action                               | Reads (approx) |
|--------------------------------------|----------------|
| Test suite page load (run history)   | 150 (capped)   |
| Per build: validate-xcode / build-install | 0 (in-memory jobs) |
| Per build: log result (POST build-results) | 0 (write only) |
| After run: load run history again    | 150            |
| Admin builds page open 1 h (30s poll)| 200 × 120 = 24K (if viewing builds) |

So a single batch of 24 apps, from the test suite alone, adds about **300** Firestore reads (load + refresh). The previous blow-up was from the **admin builds page** (list + stats every 10s), not from the test run itself.

---

## Summary of code changes

1. **`src/lib/buildResultsLog.ts`**
   - Added `computeStatsFromResults(results)` to derive stats from an in-memory list (no extra read).
   - `getBuildStats()` now uses `getAllBuildResults({ limit: 500 })` and then `computeStatsFromResults`.
   - Exported `BuildStats` type.

2. **`src/app/api/build-results/route.ts`**
   - `GET` supports `?limit=N&stats=true`: one `getAllBuildResults({ since, limit })`, then `computeStatsFromResults(results)`; response is `{ results, total, stats }`.
   - Standalone `?stats=true` (no limit) still uses `getBuildStats()` (now capped at 500 docs).
   - Limit parsing made safe (NaN → 100, clamp 1–500).

3. **`src/app/admin/builds/page.tsx`**
   - Load and poll use a **single** request: `?limit=200&stats=true`.
   - Poll interval for build results and active jobs increased from **10s to 30s**.

4. **`src/lib/testSuiteStore.ts`**
   - `getAllTestSuiteRuns()` now uses `.limit(150)`.

---

## Recommendations

- Prefer **one combined request** (list + stats) for admin/build UIs instead of separate list and stats calls.
- Keep **poll intervals** for Firestore-backed data at **30s or higher** unless product requires tighter latency.
- Use **limits** on all list/collection reads (build_results, test_suite_runs, etc.).
- Do **not** add `onSnapshot` for build jobs or test results; stick to polled `getDoc`/`getDocs` at a reasonable interval.

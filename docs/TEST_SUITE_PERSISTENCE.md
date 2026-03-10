# Test Suite Data Persistence

Where Test Suite data lives and what survives refresh/tab switch.

## Where data is stored

| Data | Where stored | Survives refresh? |
|------|----------------|-------------------|
| **Ideas/prompts (per tab)** | `localStorage`: `vibetree-test-suite-state-{milestoneId}` (e.g. `vibetree-test-suite-state-m3-medium`) | Yes |
| **Run results (per tab)** | Same key as ideas: results array is saved with model, currentRunId, completedCount, running | Yes |
| **Active tab (M1–M7)** | `localStorage`: `vibetree-test-suite-active-milestone` | Yes |
| **Run history (dropdown)** | Firestore: `test_suite_runs` (via `/api/test-suite` GET) | Yes (server) |
| **Concurrency (1x/2x)** | `localStorage`: `vibetree-test-suite-concurrency` | Yes |
| **Max fixes (0/1/3/8)** | `localStorage`: `vibetree-test-suite-max-fixes` | Yes |

## Flow

1. **On page load**  
   - `activeMilestone` is read from `vibetree-test-suite-active-milestone` (default `m1-baseline`).  
   - Then we restore from `vibetree-test-suite-state-{activeMilestone}` (or fallback `vibetree-test-suite-state`).  
   - So the **last active tab** and that tab’s **ideas + results** are restored after refresh.

2. **When you run tests**  
   - A run is created in Firestore via `POST /api/test-suite` (action: create).  
   - As each test completes, we call `POST /api/test-suite` (action: update) with results and summary.  
   - The same state is also saved to localStorage by the save effect (model, results, currentRunId, completedCount, running).  
   - So **run results** are in both Firestore (run history) and localStorage (current tab state).

3. **When you switch tabs**  
   - We save the current tab’s state to `vibetree-test-suite-state-{activeMilestone}`.  
   - We load the **new** tab’s state from localStorage first.  
   - If that tab has saved state (e.g. imported prompts + results), we use it and do **not** overwrite with server seed ideas.  
   - So **imported prompts and their results** persist when you switch away and back.

4. **Run history dropdown**  
   - Options come from Firestore via `GET /api/test-suite` (all runs; UI filters by current milestone).  
   - **Selecting a run** calls `loadRun(runId)`: it overwrites the **current** `results` in memory with that run’s outcomes (by matching row title). Ideas stay the same; status/attempts/compiled/etc. come from the run.  
   - This is “view this run in the grid”; it does **not** change what is persisted to localStorage until you run again or change something else.  
   - So the dropdown is **functional**: it loads that run’s results into the main view.

5. **Export to Dashboard**  
   - Copies succeeded projects (by projectId) into `localStorage` key `vibetree-projects` so they appear on the main dashboard.  
   - It does **not** change Test Suite persistence; it only adds those projects to the dashboard list.

## Acceptance (after fixes)

- Import 24 prompts into M3 → refresh → you still see those 24 prompts (saved in `vibetree-test-suite-state-m3-medium`; active tab restored from `vibetree-test-suite-active-milestone`).
- Run those 24 → refresh → you still see results (same localStorage key; run also in Firestore run history).
- Run history dropdown: selecting a run loads that run’s results into the grid (ideas unchanged; status/attempts/compiled from run).
- Tab switch: switching to M3 loads M3’s saved state (including any imported prompts); switching back preserves them.

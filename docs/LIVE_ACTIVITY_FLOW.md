# Live Activity flow: BuildActivityExtension

This doc answers how Live Activities are supposed to work for build status and where the chain can break so they don’t appear on your iPhone.

---

## 1. What triggers a Live Activity to start?

**Only the iOS companion app** starts the Live Activity. The web app does not start it.

- **iOS companion:** `BuildMonitorService` polls `GET /api/build-jobs/active`. For each active job it calls `updateLiveActivity(for: job)`. If there is no Live Activity for that job yet, it calls `startLiveActivity(for: job, state:)` → `Activity.request(attributes:content:pushType: nil)` (see `BuildMonitorService.swift`).
- **Web app:** Only creates/updates the job (e.g. `POST /api/projects/[id]/validate-xcode`, then Mac runner claims and updates via `POST /api/build-jobs/[id]/update`). The web never talks to ActivityKit.

So the Live Activity is **always** started on the phone when the **companion app** first sees that job in the active list (i.e. when it next polls and gets that job).

---

## 2. How does build status get to the companion app?

**Polling only** (plus optional push that triggers a single poll).

- **Polling:** `BuildMonitorService` runs a loop that every 2–5 seconds calls `APIService.shared.fetchActiveBuilds()` and `fetchRecentBuilds()` (i.e. `GET /api/build-jobs/active` and `GET /api/build-jobs/recent`). Polling starts when the app finishes launching (`startPolling()` in `AppDelegate.application(_:didFinishLaunchingWithOptions:)`), and continues while the app is in the foreground.
- **Background:** When the app is in the background, iOS may call `application(_:performFetchWithCompletionHandler:)` (background app fetch) or `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)` when a **silent push** is received. In both cases the app calls `BuildMonitorService.shared.refreshOnce()` → one `poll()`.
- **No WebSocket:** There is no WebSocket; the app does not hold an open connection to the server.

So build status is communicated by **HTTP polling**. Silent push (APNs) is only used to **wake** the app so it can do one more poll; it does not carry build state.

---

## 3. Is APNs configured for push-to-Live-Activity when the app is in the background?

**Partially.**

- **Silent push (content-available) is used** to ask iOS to wake the app so it can run `refreshOnce()` (one poll). That happens in:
  - `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)` in `VibeTreeCompanionApp.swift`.
- **When a Mac runner claims a job**, the server sends a silent push: `sendBackgroundRefreshPush("build_claimed:" + job.id)` in `src/app/api/build-jobs/claim/route.ts`.
- **When a build succeeds or fails**, the server sends:
  - A silent push: `sendBackgroundRefreshPush("build_succeeded:" + id)` or `"build_failed:" + id` in `src/app/api/build-jobs/[id]/update/route.ts`.
  - A user-visible push: `sendBuildNotification(...)` (alert + sound).

So **APNs is used for** (1) waking the app so it can poll (silent push) and (2) showing “Build ready” / “Build failed” (alert push). It is **not** used to push Live Activity **content** itself.

- **Live Activity content** is **not** updated via push. In code, `Activity.request(..., pushType: nil)` and updates are done only by the app calling `activity.update(...)` after it has **already** polled and got new job state. So:
  - If the app is in the background and never gets woken by a silent push (or iOS doesn’t run background fetch), it never polls → never starts or updates the Live Activity.
  - There is no “push-to-Live-Activity” path (no `pushType: .token` and no server-side push that updates the activity). The chain is: **push wakes app → app polls → app starts/updates Live Activity**.

---

## 4. Is there an APNs key or certificate set up in the Firebase project for Cloud Messaging?

**No.** This codebase does **not** use Firebase Cloud Messaging (FCM) for build notifications.

- Push is sent **directly to APNs** from the Next.js server via `src/lib/apns.ts` (HTTP/2 to `api.push.apple.com` or `api.sandbox.push.apple.com`).
- Required configuration is **env vars** (not Firebase Console):
  - `APNS_KEY_ID`
  - `APNS_TEAM_ID`
  - `APNS_KEY_PATH` (path to the `.p8` APNs key file)
  - `APNS_BUNDLE_ID` (e.g. `com.vibetree.companion`)
  - Optionally `APNS_SANDBOX` (defaults to sandbox if not set to `"false"`).

So you do **not** need an APNs key in the Firebase project for this. You need an **Apple Developer** APNs key (.p8) and the above env vars set where the Next.js server runs (e.g. `.env.local` or Vercel). If any of these are missing, `getApnsConfig()` returns `null` and no push is sent (see `src/lib/apns.ts`).

---

## 5. Full flow from “user hits build on web” to “Live Activity appears on iPhone”

Step-by-step and where it can break.

1. **User starts build on web**  
   - Web calls e.g. `POST /api/projects/[id]/validate-xcode` or `build-install` → server creates a build job and it appears in “active” (or queued for a runner).

2. **Mac runner (if used) claims the job**  
   - Runner calls `POST /api/build-jobs/claim` → server returns the job and calls `sendBackgroundRefreshPush("build_claimed:" + job.id)`.
   - **Break:** If APNs is not configured (missing env vars), no push is sent. If the device isn’t registered (see below), push isn’t delivered. If the app isn’t in the background or iOS doesn’t deliver the silent push, the app doesn’t wake.

3. **Companion app learns about the job**  
   - **If app is in foreground:** Polling (every 2–5 s) will soon get `GET /api/build-jobs/active` and see the job.
   - **If app is in background:** Only after it’s woken by (a) silent push from step 2, or (b) iOS background app fetch (unpredictable), and then it runs `refreshOnce()` → one poll.
   - **Break:** If **Server URL** in the companion is wrong or empty, every request fails → no active jobs → Live Activity never starts. If the user isn’t signed in or the token is invalid, the API may return 401 → same. If the app was **never opened** after the build started, the only way to see the job is a silent push or background fetch; if those don’t run, the app never polls and never starts the Live Activity.

4. **Companion app starts the Live Activity**  
   - When `poll()` sees an active job and there’s no Live Activity for that `job.id`, it calls `startLiveActivity(for: job, state:)` → `Activity.request(attributes:content:pushType: nil)`.
   - **Break:** If `ActivityAuthorizationInfo().areActivitiesEnabled` is false (user turned off Live Activities for the app in Settings → VibeTree), the code returns early and never starts the activity. If the app never gets to run this code (e.g. never polled, or polling failed), the Live Activity never appears.

5. **Companion app updates the Live Activity**  
   - On each subsequent poll that sees the same job, the app calls `activity.update(...)` with new state. All of this is **in-app** after polling; no push is used to update the Live Activity UI.

6. **When the build finishes**  
   - Runner calls `POST /api/build-jobs/[id]/update` with `status: "succeeded"` or `"failed"`. Server sends silent push + user-visible push. If the app is running (foreground or woken by push), it will poll, see the job in “recent” and no longer in “active”, and call `endLiveActivity(for: job)`.

**Where the chain is most likely broken for “Live Activities don’t appear”:**

| Likely cause | What to check |
|--------------|----------------|
| **Server URL** | Companion Settings → Server URL must be set and point to the same backend the web uses (e.g. your Mac URL or production). If empty or wrong, polling fails and the app never sees active jobs. |
| **App not polling when build starts** | User must have the companion app **open** (foreground) at least once after starting the build, or rely on a silent push. If the app was never opened after the build started and no push was sent/delivered, the app never sees the job. |
| **APNs not configured** | Server needs `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_PATH`, `APNS_BUNDLE_ID` in env. Without them, no silent push is sent when a job is claimed or when it completes, so the app won’t wake in the background. |
| **Device not registered** | Companion must have registered for remote notifications and successfully called `POST /api/devices/register` with the APNs device token (Settings → Enable push / “Register now”). If the server has no token, it can’t send any push. |
| **Live Activities disabled** | On the iPhone: Settings → VibeTree → Live Activities must be On. The code checks `ActivityAuthorizationInfo().areActivitiesEnabled` and skips starting the activity if false. |
| **Extension / scheme** | Build and run the **VibeTreeCompanion** app (not BuildActivityExtension). Reinstall the app after changing the widget extension so the system picks it up. |

**Recommended quick check:**  
Open the companion app, set Server URL correctly, then start a **simulated** build from the web: [Test Live Activity](/dev/live-activity-test). Keep the companion in the foreground or lock the phone right after. Within a few seconds the app should poll, see the simulated job in `/api/build-jobs/active`, and start the Live Activity. If that works, the extension and permissions are fine; if real builds still don’t show it, the break is usually Server URL, auth, or the app not running when the real build is active (plus APNs/device registration if you expect updates when the app is in the background).

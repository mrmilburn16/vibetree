# iOS companion: API URL, auth, credits, and projects

This doc answers why the iOS app can show **50 credits and no projects** while the web app (same account) shows **9999 credits and many projects**.

---

## 1. What API base URL is the iOS companion using?

The iOS app uses **one base URL for all API calls** (credits, projects, chat, build-jobs, etc.):

- **Source:** `UserDefaults.standard.string(forKey: "serverURL")`
- **Default when unset:** **empty** (blank). The user must set **Server URL** in Settings.
- **User sets it:** Settings → **Server URL** (e.g. `http://YOUR_MAC_IP:3001` for local dev, or production URL when deployed).

When Server URL is empty, API requests throw and the UI prompts (e.g. "Set Server URL in Settings"). Only **localhost** is migrated to a dev Mac IP on launch; empty stays empty so the user must set a URL.

**Fix for "same data as web":** Set Server URL to the same backend the web uses (your Mac URL when developing, or production when deployed).

---

## 2. Is the iOS app authenticated with the same Firebase UID as the web app?

**Yes.** The iOS app signs in with **Firebase Auth** (email/password) via `AuthService.signIn(email:password:)`, which uses `Auth.auth().signIn(withEmail: password:)`. That produces the **same Firebase UID** as the web app when the user uses the same email/password.

API requests use the **Firebase ID token** in the `Authorization: Bearer <token>` header. The backend `getSession(request)` in `src/lib/auth.ts` accepts either the session cookie (web) or the `Authorization: Bearer` header (iOS) and verifies the token with Firebase Admin; the same `uid` is used for credits and projects. So **if the iOS app points at the same backend as the web**, the same account sees the same credits and projects.

---

## 3. Where does the 50 credits default come from?

**It is hardcoded in the iOS app** as the **initial** balance before any successful API fetch.

- **File:** `ios/…/Services/CreditsService.swift`
- **Line:** `@Published var balance: Int = 50`
- **Also:** `@Published var monthlyAllowance: Int = 50`

When `fetchBalance()` runs, it calls `APIService.shared.fetchCredits()` (GET `/api/credits`). On **success**, `balance` and optionally `monthlyAllowance` are updated from the response. On **failure** (wrong server, 401, network error), the catch block only sets `self.error` and **does not** change `balance`, so the UI keeps showing **50**.

So “50 credits” on iOS means either:

1. The app has not yet successfully called the same backend as the web, or  
2. The fetch failed (wrong Server URL, no auth, or backend error) and the app is still showing the initial default of 50.

---

## 4. Does the iOS app call the same /api/credits and /api/projects endpoints as the web app?

**Yes.** The iOS app uses the same paths:

- **Credits:** `APIService.fetchCredits()` → `request("/api/credits")` (GET).
- **Projects:** `APIService.fetchProjects()` → `request("/api/projects")` (GET).

So it **does** call the same `/api/credits` and `/api/projects` endpoints **on whatever host is configured as `serverURL`**. If `serverURL` is empty or wrong, requests fail and you see the 50-credits / no-projects behavior until the user sets the correct Server URL in Settings.

---

## Summary and fix

| Question | Answer |
|----------|--------|
| (1) API base URL | Default is **blank**; user must set Server URL in Settings (e.g. Mac IP for local dev or production URL when deployed). |
| (2) Same Firebase UID? | Yes, when using same email/password; backend accepts Bearer token and uses same `uid`. |
| (3) 50 credits source | Initial default in `CreditsService.balance = 50`; stays 50 if `/api/credits` fetch fails. |
| (4) Same endpoints? | Yes: GET `/api/credits` and GET `/api/projects`, on whatever `serverURL` is set to. |

**Recommended:** Set Server URL in Settings to the backend you use (Mac IP for local dev, or production URL when that site is deployed).

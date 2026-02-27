# VibeTree Integrations — Master Reference

This file is the **source of truth** for every integration VibeTree supports. The agent must use it when generating apps that use these integrations and when guiding users through setup.

**Before generating any app that uses an integration, check this file for the correct setup pattern, common errors, and agent behavior instructions for that integration. Always follow the Swift code pattern documented there.**

---

## MusicKit / Apple Music

**Type:** Apple Native + User Key Required (for server/API token)

**Cost:** Apple Music API use is covered by the user's Apple Music subscription; no per-call charge for catalog/library access in native apps. Server-side JWT has no direct Apple fee.

**Apple Identifier Required:** **Media ID** (not App ID — this is a common mistake). Identifier must start with `media.` (e.g. `media.vibetree.musickit`).

**Key/Token Required:** Yes. A key with **Media Services** enabled; download the `.p8` file from Apple Developer. JWT is generated with Key ID (e.g. C8U8M4U6DH), Team ID (e.g. 3SFYC3VA37), algorithm ES256, expiry 180 days. Token stored in VibeTree App Secrets as `musickit_token`.

**User Setup Steps:**
1. In Apple Developer → Certificates, Identifiers & Profiles → **Identifiers**, create a **Media ID** (not an App ID) with identifier starting with `media.` (e.g. `media.vibetree.musickit`).
2. Create a key with **Media Services** enabled; download the `.p8` file (only once).
3. In VibeTree, ensure `musickit_token` is set in App Secrets (or that the token generation pipeline has run with the correct Key ID, Team ID, and `.p8`).
4. For native iOS apps, the app's **bundle ID** (App ID) must also have **MusicKit** capability enabled under App Services so catalog/library APIs work on device.
5. User must have an active Apple Music subscription for the app to work.

**Common Errors:**
- **"There are no identifiers available"** — You registered an **App ID** instead of a **Media ID**. Create a Media ID with identifier starting with `media.`.
- **"Failed to request developer token"** — Token is missing or expired. Check App Secrets for `musickit_token`; regenerate JWT if needed. On **native iOS only**, the app must not request a developer token in app code — use `MusicAuthorization.request()` and the system handles tokens when the bundle ID has MusicKit enabled.
- Catalog/search fails on Simulator — Run on a real device; ensure bundle ID has MusicKit capability and user is signed into Apple Music.

**Swift Code Pattern:**
- Use `MusicAuthorization.request()` in `.onAppear` (or equivalent); wait for `status == .authorized` before any catalog search or playback.
- Disable "Build Playlist" / "Create and Play" (or any search/play button) until `isAuthorized` is true.
- Use `MusicCatalogSearchRequest(term:..., types: [Song.self])` for search; use `ApplicationMusicPlayer.shared` for playback.
- To create a playlist in the user's library: `MusicLibrary.shared.createPlaylist(name:..., description: nil, authorDisplayName: nil)` then `MusicLibrary.shared.add(song, to: playlist)` for each `Song` from the catalog response — never use `Album` or items with empty identifier set.
- Do **not** use or request a developer token in Swift; the system handles tokens when the app's bundle ID has MusicKit enabled.

**Agent Behavior:**
- Check if `musickit_token` exists in App Secrets before building (when server-side token is used); warn user if not.
- When generating native iOS MusicKit apps, inject the MusicKit skill guidance: authorization first, disable buttons until authorized, use only Song for library playlist, no developer token in code.
- Point users to this section for Media ID vs App ID and token setup.

---

## WeatherKit

**Type:** Apple Native + VibeTree Hosted (token)

**Cost:** Apple provides 500,000 free API calls per month; after that, $0.0002 per call. VibeTree absorbs cost; agent can use WeatherKit freely without requiring user setup.

**Apple Identifier Required:** App ID with **WeatherKit** capability enabled under the App Services tab.

**Key/Token Required:** Yes. Uses the same `.p8` key as MusicKit if both are enabled on the same key. JWT requires **subject (sub) claim set to bundle ID**, unlike MusicKit. Token stored in VibeTree App Secrets as `weatherkit_token`.

**User Setup Steps:**
- No user setup required for standard use; VibeTree provides the token. If self-hosting or custom key: ensure App ID has WeatherKit capability; generate JWT with `sub` set to the app's bundle ID; store as `weatherkit_token`.

**Common Errors:**
- Invalid or expired token — Regenerate JWT with correct `sub` (bundle ID) and key.
- Rate limit — Ensure generated code caches weather responses (see Swift Code Pattern).

**Swift Code Pattern:**
- Always **cache** weather responses for at least **30 minutes** in generated code; never call the API on every render or every view appearance.
- Use `WeatherService.shared` (or equivalent) with the appropriate request type; check cache before issuing a new request.

**Agent Behavior:**
- Use WeatherKit freely in apps when the user asks for weather; do not require user setup since VibeTree absorbs cost.
- Always generate code that caches weather for at least 30 minutes and never calls on every render.

---

## MapKit (iOS native)

**Type:** Apple Native

**Cost:** No keys required for native iOS apps — completely free and unlimited.

**Apple Identifier Required:** None.

**Key/Token Required:** No.

**User Setup Steps:** None. No portal setup needed at all.

**Common Errors:**
- Map not showing or blank — Ensure `Map` or `MKMapView` is used correctly; for user location, see CoreLocation and request location permission first.

**Swift Code Pattern:**
- Import MapKit; use SwiftUI `Map` or `MKMapView` (via UIViewRepresentable if needed).
- If showing user location, request location authorization first (see CoreLocation) and set `showsUserLocation = true` (or equivalent) only after permission is granted.

**Agent Behavior:**
- Use MapKit freely in any app when the user asks for maps, pins, or location on a map; no user setup or keys required.

---

## CoreLocation

**Type:** Apple Native (on-device)

**Cost:** Purely on-device; no API calls, no keys, no cost.

**Apple Identifier Required:** None.

**Key/Token Required:** No.

**User Setup Steps:** None beyond the app’s Info.plist usage description (handled by the agent).

**Common Errors:**
- Location never updates or permission denied — Ensure `NSLocationWhenInUseUsageDescription` is set and that the agent requests authorization before relying on location.
- Background location rejected — Do not request background location unless the user explicitly asked for it.

**Swift Code Pattern:**
- Add `NSLocationWhenInUseUsageDescription` (or `NSLocationAlwaysAndWhenInUseUsageDescription` only if needed) to Info.plist with a **clear, human-readable description** of why location is needed.
- Use `CLLocationManager`; call `requestWhenInUseAuthorization()` (or appropriate method) before using location; respect authorization status.
- **Never** request location in the background unless the user explicitly asked for it.

**Agent Behavior:**
- Always include a clear, human-readable usage description for why location is needed.
- Do not add background location capability or request background location unless the user explicitly asked for it.

---

## HealthKit

**Official docs:** [HealthKit](https://developer.apple.com/documentation/HealthKit) — framework overview, HKHealthStore, quantity types, queries, and workout APIs.

**Type:** Apple Native (on-device)

**Cost:** Purely on-device; no API calls, no keys, no cost. Data never leaves the device unless the user explicitly shares it.

**Apple Identifier Required:** App ID with **HealthKit** capability (entitlement) enabled.

**Key/Token Required:** No.

**User Setup Steps:**
- For the app to use HealthKit, the project’s bundle ID must have the HealthKit entitlement enabled in Apple Developer (App ID → Capabilities). The agent should assume this is configured when the user requests a HealthKit app.

**Common Errors:**
- Entitlement or permission denied — Ensure HealthKit capability is enabled for the App ID; request only the specific data types the app needs.

**Swift Code Pattern:**
- Request only the **specific health data types** the app actually needs (e.g. step count, heart rate); do not request broad read/write for all types.
- Use HealthKit APIs with proper authorization requests and handle denied or unavailable cases.

**Agent Behavior:**
- Only request the specific health data types the app actually needs; do not over-request.

---

## Sign in with Apple

**Type:** Apple Native

**Cost:** Free and unlimited; no charges from Apple.

**Apple Identifier Required:** App ID with **Sign in with Apple** capability enabled.

**Key/Token Required:** No.

**User Setup Steps:** None. Ensure the project’s bundle ID has Sign in with Apple capability enabled in the App ID (the agent or build system can note this).

**Common Errors:**
- Capability not enabled — Enable Sign in with Apple in the App ID for the app’s bundle ID.

**Swift Code Pattern:**
- Use `AuthenticationServices` (e.g. `ASAuthorizationAppleIDProvider`, `ASAuthorizationController`) for Sign in with Apple button and flow.
- Handle credential and error states appropriately.

**Agent Behavior:**
- Use Sign in with Apple freely; it is the **preferred login method** for iOS apps when the user asks for login or authentication.

---

*When adding a new integration, add a section using the same structure and update this file as the single source of truth.*

# MusicKit agent learnings

This doc captures real failure modes and fixes so future agent-generated MusicKit apps avoid them.

## "Failed to search, failed to request developer token" + crash

**What happened:** User built a Voice Playlist app (voice → parse artist/duration → search Apple Music → play). Tapping "Create and Play" showed "Failed to search, failed to request developer token" and the app crashed.

**Root cause:** On **native iOS**, MusicKit does **not** use a developer token in app code. The framework handles token management automatically after you call `MusicAuthorization.request()`. If the generated code tried to request or use a "developer token" (a concept from MusicKit JS / web or server APIs), it will fail and can lead to crashes when errors are not handled.

**Correct approach for iOS:**

1. **Authorization only:** Use only `MusicAuthorization.request()`. No developer token, no JWT, no backend. Wait for `status == .authorized` before any catalog search or playback.
2. **Auth before action:** Disable "Create and Play" (and any search/play) until authorization is granted. Show "Authorize Apple Music first" or similar until then.
3. **Never crash on API errors:** Wrap all MusicKit calls (authorization, `MusicCatalogSearchRequest`, `ApplicationMusicPlayer` playback) in `do/catch` or handle errors in async code. Set an `errorMessage` and show it in the UI; do not force unwrap or rethrow in a way that crashes the app.

**Skill updates:** The MusicKit skill (`data/skills/musickit.json`) has been updated with:

- **CRITICAL — NO DEVELOPER TOKEN ON IOS:** Explicit instruction to never use or request a developer token; use only `MusicAuthorization.request()`.
- **Authorization gate:** Do not enable Create and Play until `MusicAuthorization.request()` has returned `.authorized`.
- **ERROR HANDLING (mandatory):** Never crash on MusicKit errors; always catch and show in UI.
- **Anti-patterns:** Including "Using or requesting a developer token on iOS" and "Letting MusicKit/search/playback errors crash the app."

Future builds that trigger the MusicKit skill will receive this guidance automatically.

---

## Agent claimed fix but user still saw "Failed to request developer token"

**What happened:** After the agent said it "Removed all developer token code" and "Disabled Create and Play until authorization", the user still saw (1) "Create and Play" enabled before authorizing, and (2) "Failed to request developer token" when tapping it.

**Lesson:** The agent must make **concrete code changes**, not just describe them. The fix requires:

1. **Search every Swift file** for the strings "developer", "token", "developerToken", "DeveloperToken" — remove or replace any code that requests or uses a developer token. On iOS there is no such API; use only `MusicAuthorization.request()`.
2. **In the view that has the "Create and Play" button:** Add or use a property (e.g. `isAuthorized`) that is `true` only after `MusicAuthorization.request()` returns `.authorized`. Set the button to `.disabled(!viewModel.isAuthorized)`. When not authorized, show "Authorize Apple Music first" and a button that calls the authorization method.
3. **On errors:** In catch blocks or error paths, set a user-facing message like "Could not search" or "Playback failed" — never surface the raw "Failed to request developer token" to the user.

The MusicKit skill now includes a **MUST DO (non-negotiable)** block at the top and these failures are in **commonErrors** so the agent gets stronger guidance next time.

---

## Prompt to fix an existing app that shows "developer token" or has Create and Play enabled before auth

Send this as a **follow-up message** in the same Pro project (so the agent has the current files). Be explicit so the agent makes real code changes:

```
The app still shows "Failed to request developer token" when I tap Create and Play, and the button is enabled before I've authorized Apple Music. Fix it by making these exact changes:

1. Search every Swift file for "developer", "token", "developerToken", or "DeveloperToken". Remove or delete any code that requests, fetches, or uses a developer token. On iOS, MusicKit does NOT use a developer token in app code — use only MusicAuthorization.request(). The system handles tokens after that. There must be zero references to developer token.

2. Disable the "Create and Play" button until Apple Music is authorized. In the view model, keep a property isAuthorized (or similar) that is set to true only when MusicAuthorization.request() returns .authorized. In the view, bind the button: .disabled(!viewModel.isAuthorized). When !isAuthorized, show text like "Authorize Apple Music first" and a button that calls your requestAuthorization() method. Do not allow search or play until isAuthorized is true.

3. Call MusicAuthorization.request() when the screen appears (e.g. in .onAppear or when the user taps "Authorize Apple Music first"). Do not call MusicCatalogSearchRequest or ApplicationMusicPlayer.play() until after authorization has returned .authorized.

4. Wrap all MusicKit calls (authorization, search, play) in do/catch. On failure, show a user-friendly message like "Could not search" or "Playback failed" in an alert or inline text — never show the raw "Failed to request developer token" to the user. The app must not crash on errors.
```

# MusicKit agent learnings

This doc captures real failure modes and fixes so future agent-generated MusicKit apps avoid them.

**Official Apple docs (reference):**
- [MusicKit](https://developer.apple.com/documentation/musickit/) — framework overview
- [Using Automatic Developer Token Generation for Apple Music API](https://developer.apple.com/documentation/musickit/using-automatic-token-generation-for-apple-music-api) — MusicKit **automatically generates the developer token** on behalf of your app when you enable the MusicKit App Service for your bundle ID in the developer portal. You do **not** put a developer token in app code; the framework includes it in API requests for you.
- [Playlist](https://developer.apple.com/documentation/musickit/playlist) — `struct Playlist` (music item for a playlist)
- [Playlist.Entry](https://developer.apple.com/documentation/musickit/playlist/entry) — playlist entry type

---

## How to diagnose exactly why search/playback fails

When the app shows "Search failed" or "Could not access Apple Music" or "unknown error," you need the **real error** from MusicKit to fix it.

### Step 1: Add a one-time diagnostic (see the exact error)

In your **Playlist Builder** (or MusicKit) project chat, paste this so the agent adds a diagnostic:

```
When search or playback fails, I need to see the exact error so I can fix it. Add a diagnostic: in the catch block for MusicCatalogSearchRequest.response() (and for ApplicationMusicPlayer.play() if you have one), cast the error to NSError and show an alert (or set errorMessage) that includes:
- (error as NSError).domain
- (error as NSError).code
- error.localizedDescription
- If (error as NSError).userInfo[NSUnderlyingErrorKey] exists, include that error's domain and code too.
Format it like: "Diagnostic: domain=ICErrorDomain code=-8200 description=..."
So when I tap Build Playlist and it fails, I see the real error and can report it. Keep the alert or error message visible so I can read it (e.g. in an alert with a Copy button or long text).
```

Rebuild and run the app. When you tap Build Playlist and it fails, you’ll see e.g. `domain=ICErrorDomain code=-8200` or `code=-8102`. Use the table below to interpret it.

### Step 2: Interpret the error (common MusicKit errors)

| Domain        | Code   | What it usually means | What to do |
|---------------|--------|------------------------|------------|
| **ICErrorDomain** | **-8200** | Token/API 401 — often **Simulator**. MusicKit catalog search does not work reliably in the iOS Simulator. | **Run on a real iPhone/iPad**, not the simulator. |
| **ICErrorDomain** | **-8102** (underlying **-7007**) | "Privacy acknowledgement required." The device user has not accepted the **Apple Music privacy prompt** in the **Music** app. | Have the user open the **Music** app (the built-in Apple Music app), sign in if needed, and accept any privacy/terms prompt. Then try your app again. |
| **ICErrorDomain** | **-7010** | Listener/cloud service — often auth or config. | Ensure MusicAuthorization.request() was called and returned .authorized before any search. Run on device. |
| Generic / "unknown" | — | Framework returned a generic or empty description. | Use the diagnostic above to get domain/code. Check device (not simulator), Music app privacy accepted, and Apple Music signed in. |

### Step 3: Checklist to get Playlist Builder working

1. **Run on a real device** — Use "Run on iPhone" (or iPad). Do not rely on the simulator for MusicKit catalog search.
2. **Authorize in your app** — When the app first loads, it should call `MusicAuthorization.request()` (e.g. in `.onAppear`). Tap **Allow** when iOS shows the permission prompt.
3. **Open the Music app once** — On the device, open the built-in **Music** app, sign in with Apple ID if asked, and accept any privacy/terms or “Use Apple Music” prompt. This satisfies “privacy acknowledgement required” (-7007).
4. **Apple Music subscription** — For full catalog search and playback, the Apple ID should have Apple Music (subscription or trial). Settings → Music → see “Apple Music” / “Listen Now.”
5. **Network** — Device needs internet (Wi‑Fi or cellular).
6. **Bundle ID must be registered with MusicKit** — If the app’s bundle ID is not in your Apple Developer Identifiers list with MusicKit enabled, catalog search can fail. See “Bundle ID / Identifier not in Apple Developer” below.

After Step 1, if you see e.g. **-8200**, use a device. If you see **-8102/-7007**, do Step 3 (Music app privacy). Then try Build Playlist again.

---

## Bundle ID / Identifier not in Apple Developer

**What happened:** The app installs and launches (e.g. `com.vibetree.app1772195763292i59o34o`) but MusicKit search or playback fails, or the bundle ID in the install log is **not** in your Apple Developer **Identifiers** list.

**Why it matters:** For MusicKit (catalog search, playback) to work, the app’s bundle ID must be registered as an App ID in your Apple Developer account with **MusicKit** capability enabled. If the built app uses a bundle ID that isn’t in Certificates, Identifiers & Profiles → Identifiers, Apple may reject or limit MusicKit for that app.

**Fix (choose one):**

**Option A — Use an identifier you already have**  
If you already have an identifier with MusicKit enabled (e.g. `com.vibetree.musickit`):

1. Open the project in the editor → **Project settings** (gear or settings icon).
2. Under **Identity**, set **Bundle ID** to that identifier (e.g. `com.vibetree.musickit`).
3. Save, then **Run on iPhone** again. The app will be built with that bundle ID and MusicKit should work.

**Option B — Register the new bundle ID**  
If you want to keep the auto-generated bundle ID (e.g. `com.vibetree.app1772195763292i59o34o`):

1. In Apple Developer → Certificates, Identifiers & Profiles → Identifiers → **+** to add a new App ID.
2. Choose App IDs → App → Bundle ID **Explicit** → enter exactly the bundle ID from the install log.
3. Under **Capabilities**, enable **MusicKit**. Save.
4. Rebuild/reinstall the app (Xcode may need to refresh provisioning).

**Note:** Each new VibeTree project gets a unique default bundle ID. Option A reuses one identifier (e.g. `com.vibetree.musickit`) for all MusicKit apps so you only register it once. Option B requires adding and enabling MusicKit for each new app ID.

**Confirmed:** Using Option A (e.g. setting Bundle ID to `com.vibetree.musickit` in Project settings and saving) made catalog search work — songs finally pull in. Ensure the identifier is registered in Apple Developer with MusicKit enabled.

---

## Create playlist in Apple Music (save to library)

**User ask:** "I want it to create the playlist in Apple Music automatically" — i.e. save the built playlist to the user's Apple Music library, not just play it in-app.

**Yes, it's supported.** Official docs: [Create a New Library Playlist](https://developer.apple.com/documentation/applemusicapi/create-a-new-library-playlist) and [Add Tracks to a Library Playlist](https://developer.apple.com/documentation/applemusicapi/add-tracks-to-a-library-playlist). Create accepts `attributes` (name, description, isPublic) and an optional `relationships.tracks` to add songs in the same request; Add Tracks is the endpoint to append tracks to an existing playlist (204 on success). Both require a **music user token** (on iOS, that comes from `MusicAuthorization.request()` — no developer token). There may be a short delay before the new playlist or tracks appear in the user's library.

**On iOS (MusicKit Swift):** Use **MusicKit's `MusicLibrary`** (iOS 16+), which wraps this API.

**Approach:**

1. **Create a new playlist** in the user's library: `MusicLibrary.shared.createPlaylist(name: "My Playlist", description: nil, authorDisplayName: nil)` (or with description/author). This returns a `Playlist` that lives in the user's library.
2. **Add songs** to that playlist: for each `Song` from your search, call `try await MusicLibrary.shared.add(song, to: playlist)`. Items must conform to `MusicPlaylistAddable` (e.g. `Song`, `Track`). Alternatively use `MusicLibrary.shared.edit(playlist, name:description:authorDisplayName:items:)` to set the playlist's items in one go if the API supports it.
3. **Then optionally play it** with `ApplicationMusicPlayer.shared.queue = ApplicationMusicPlayer.Queue(for: playlist)` and `play()`.

**Requirements:** Same as catalog search — `MusicAuthorization.request()` must have returned `.authorized`, and the user needs an Apple Music subscription. Only playlists your app creates (or the user owns) are editable.

**Prompt for the agent:** When the user asks to "create the playlist in Apple Music" or "save the playlist to my library", add a flow that: (1) builds the list of `Song` from search as today, (2) creates a library playlist with `MusicLibrary.shared.createPlaylist(name: ...)`, (3) adds each selected song with `MusicLibrary.shared.add(song, to: playlist)`, (4) shows success (e.g. "Playlist \"…\" added to your library") and optionally starts playback of that playlist.

---

## Library playlist not created — "No catalogID, libraryID" / "Client is not entitled" (-7013)

**What happened:** User tries to create/save a playlist in Apple Music and it doesn’t appear. Console shows:

- `No catalogID, libraryID, or deviceLocalID was found from underlying identifier set <MPIdentifierSet EMPTY>. A MusicIdentifierSet with empty string, for type ... Album`
- `ICError Code=-7013 "Client is not entitled to access account store"`
- `applicationQueuePlayer _establishConnectionIfNeeded timeout [ping did not pong]`

**Why:**

1. **Empty identifier set (Album)** — The app is passing items that have no valid catalog or library ID (e.g. using `Album` type with empty IDs, or building playlist entries from something other than `Song` from `MusicCatalogSearchRequest`). MusicKit requires each item you add to a library playlist to be a **Song** (or Track) that came from the catalog and has a valid `id` — never use Album for `MusicLibrary.shared.add(_:to:)`, and never pass constructed/empty identifier sets.

2. **-7013 "Client is not entitled to access account store"** — Library playlist creation (and account store) often **do not work in the Simulator**. Run on a **real device** with the same bundle ID that has MusicKit enabled in Apple Developer. Ensure the user is signed into Apple Music on the device.

3. **applicationQueuePlayer timeout** — As elsewhere: fully stop speech (remove tap, stop engine) before starting MusicKit playback; don’t start playback while the mic tap is active.

**Fix:**

- For **adding to a library playlist**: Use **only** `Song` (or `Track`) instances that come from `MusicCatalogSearchRequest(term:..., types: [Song.self]).response().songs`. Do not use `Album`, and do not build playlist entries from display-only data (title/artist strings). Add them one by one: `for song in selectedSongs { try await MusicLibrary.shared.add(song, to: playlist) }`.
- Run on a **real device** (not Simulator) for library playlist creation; ensure the app’s bundle ID has MusicKit capability and the device user is signed into Apple Music.
- Ensure speech/recording is fully stopped before calling `MusicLibrary` or `ApplicationMusicPlayer.play()`.

**Diagnostic (see the real error):** If playlist creation still doesn't work, add a one-time diagnostic. In the project chat, paste: *When creating the playlist in Apple Music fails, I need to see the exact error. Add error handling: in the catch block for MusicLibrary.shared.createPlaylist(...) and for MusicLibrary.shared.add(song, to: playlist), show an alert or set errorMessage to include (error as NSError).domain, (error as NSError).code, and error.localizedDescription. So when I tap the button and the playlist isn't created, I see e.g. "domain=ICError code=-7013 description=..." and can report it.* Then run the app, try to create the playlist, and note the domain/code/description.

**Prompt to fix the app:** In the project chat, paste:

```
The app doesn’t create the playlist in Apple Music and the console shows "No catalogID, libraryID" for type Album and/or "Client is not entitled to access account store" (-7013). Fix it:

1. When creating a library playlist and adding tracks, use ONLY Song objects from MusicCatalogSearchRequest(..., types: [Song.self]).response().songs. Do not use Album type or any item with an empty identifier set. Add each song with MusicLibrary.shared.add(song, to: playlist) where song is from the catalog search response.

2. Library playlist creation requires a real device and proper entitlements. If testing on Simulator, try on a physical iPhone with the same bundle ID (MusicKit enabled) and the user signed into Apple Music.

3. Before calling MusicLibrary or ApplicationMusicPlayer.play(), fully stop the speech recognizer (audioEngine.stop(), inputNode.removeTap(onBus: 0), recognitionRequest?.endAudio()) so the applicationQueuePlayer timeout doesn’t occur.
```

---

## Song list auto-scrolling (unwanted)

**What happened:** The app "scrolls through the songs" — the song list automatically scrolls or cycles through items even though the user didn't ask for that. This is distracting and not requested.

**Why:** The generated UI may use `ScrollViewReader` with automatic scrolling to the current item, or a timer/animation that scrolls the list, or similar behavior that was added by default.

**Fix:** Show the song list as a **static list** — a normal `List` or `ScrollView` that the user scrolls manually. Do **not** add:
- `ScrollViewReader` that scrolls to the current playing item or to each song automatically
- Timers or animations that scroll the list
- Auto-scroll-on-appear or scroll-to-index when the list loads

The user should see the list of songs and scroll it themselves if they want to browse; playback can show the current track in the player UI without moving the list.

---

## Playback error after playlist saved (MPMusicPlayerControllerErrorDomain error 1)

**What happened:** The playlist is successfully created and added to Apple Music (user sees "Playlist … added to your library"), but then an error dialog appears: "Playback error: The operation couldn't be completed. (MPMusicPlayerControllerErrorDomain error 1.)"

**Why:** This is a **playback** failure (ApplicationMusicPlayer.play()), not a library/save failure. Error 1 can mean queue not ready, timing, or Apple Music connectivity. The important part — saving the playlist to the library — already succeeded.

**Fix:** When you've just successfully saved the playlist to the library and then `player.play()` fails, **don't show a blocking error dialog**. Keep the success message and optionally set a non-blocking status like "Playlist added to your library. Open the Music app to play it if playback didn't start." So the user sees that the main goal (create playlist in Apple Music) worked; only in-app playback had a hiccup.

**Auto-open Music app:** After successfully creating and adding the playlist to the library, open the Music app so the user can see and play the new playlist: `UIApplication.shared.open(URL(string: "music://music.apple.com/library")!)`. Apple doesn't support deep links to a specific library playlist, but opening the library gets them to Apple Music where the new playlist appears in Library → Playlists.

---

## Crash: CreateRecordingTap "nullptr == Tap()" / applicationQueuePlayer timeout

**What happened:** App crashes with:
- `applicationQueuePlayer _establishConnectionIfNeeded timeout [ping did not pong]`
- `AVAEInternal.h:71 required condition is false: [AVAEGraphNode.mm:828:CreateRecordingTap: (nullptr == Tap())]`
- `Terminating app due to uncaught exception 'com.apple.coreaudio.avfaudio', reason: 'required condition is false: nullptr == Tap()'`

**Root cause:** The app uses **voice input** (Speech framework: SFSpeechRecognizer + AVAudioEngine) and **MusicKit** (ApplicationMusicPlayer) together. The crash is in **AVFoundation**, not MusicKit:

1. **CreateRecordingTap** — You can only have **one** recording tap on the audio engine's input node at a time. If the code calls `inputNode.installTap(onBus: 0, ...)` when a tap is already installed (e.g. from a previous recording that didn't call `removeTap`, or from starting speech twice), AVFoundation throws. So: **always call `inputNode.removeTap(onBus: 0)` before calling `installTap`** (e.g. at the start of `startRecording()` or in a dedicated cleanup before (re)starting).
2. **applicationQueuePlayer timeout** — MusicKit's playback queue had a connection timeout; often this appears when the app is also touching the audio session (e.g. switching between mic and playback). Ensure **speech is fully stopped** (engine stopped, tap removed) before starting MusicKit playback, and avoid reusing the same audio session for mic and playback at the same time.

**Fix:**

1. **Before every `installTap`:** Call `audioEngine.inputNode.removeTap(onBus: 0)` first. If no tap is installed, this is a no-op or safe. That prevents the "nullptr == Tap()" crash.
2. **When switching from voice to playback:** In the flow that runs after the user finishes speaking (e.g. "Build Playlist" from voice), call the speech recognizer's stop/cleanup (stop engine, removeTap, endAudio) **before** calling MusicCatalogSearchRequest or ApplicationMusicPlayer.play(). Do not leave the mic tap active while starting playback.
3. **Single flow:** Either: (a) user speaks → stop speech and remove tap → then search/play, or (b) user types in a text field instead of voice. Do not install a tap while playback is active or while the queue player is connecting.

**Prompt to fix the app:** In the Playlist Builder project chat, paste:

```
The app crashes with "CreateRecordingTap: nullptr == Tap()" and "applicationQueuePlayer timeout". Fix it:

1. In the speech recognizer (or wherever we use AVAudioEngine and installTap on inputNode): before calling inputNode.installTap(onBus: 0, ...), always call inputNode.removeTap(onBus: 0) first so we never have two taps. If the engine is running, stop it and remove the tap before installing a new one.

2. When the user finishes voice input and we proceed to build playlist (search + play), ensure we fully stop the speech recognizer first: call stopRecording() or equivalent (audioEngine.stop(), inputNode.removeTap(onBus: 0), recognitionRequest?.endAudio()), then start the MusicKit search/play. Do not start playback while the mic tap is still installed.

3. Wrap the installTap call in a guard: only install if we're not already recording (e.g. check isRecording == false and then set it true after install). And in stopRecording, always removeTap and set isRecording = false so the next startRecording can safely removeTap then installTap again.
```

---

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

## "Search failed: Could not access Apple Music"

**What happened:** User taps "Build Playlist" and sees an error: "Search failed: Could not access Apple Music."

**Root cause:** The app is trying to search or play before Apple Music is authorized, or the user hasn't authorized yet. On iOS, you must call `MusicAuthorization.request()` and wait for `.authorized` before any `MusicCatalogSearchRequest` or playback. If the "Build Playlist" button is enabled before authorization, or authorization is never requested on screen load, the user will hit this error.

**Correct approach:**

1. **Request authorization as soon as the screen appears** — call `MusicAuthorization.request()` in `.onAppear` (or in a `.task`) so the system prompt appears right away. Don't wait for the user to tap "Build Playlist."
2. **Disable "Build Playlist" until authorized** — bind the button to `.disabled(!viewModel.isAuthorized)`. When not authorized, show "Authorize Apple Music first" and a button that calls `requestAuthorization()`.
3. **If the user still sees "Could not access Apple Music"** after authorizing, they may need to check Settings > Music (signed in, Apple Music subscription for full catalog). Show a hint in the error message.

**Skill update:** The MusicKit skill now requires authorization in `.onAppear` and lists this in `commonErrors` so the agent gets stronger guidance.

---

## "Search failed, unknown error"

**What happened:** User taps Build Playlist and sees "Search failed, unknown error" (or similar generic message).

**Root cause:** MusicKit sometimes returns an error whose `localizedDescription` is empty or generic (e.g. "unknown error"). The app was showing that raw string to the user.

**Fix:** In the search (and playback) catch block, do not set `errorMessage = error.localizedDescription` when that string is empty or generic. Use a fallback: e.g. "Could not access Apple Music. Check Settings > Music and sign in with Apple Music." Example:

```swift
} catch {
    let msg = error.localizedDescription
    let fallback = "Could not access Apple Music. Check Settings > Music and sign in with Apple Music."
    await MainActor.run {
        errorMessage = (msg.isEmpty || msg.lowercased().contains("unknown")) ? fallback : "Search failed: \(msg)"
    }
}
```

**Skill update:** The MusicKit skill's ERROR HANDLING and canonicalCode now require this fallback; "unknown error" is in `commonErrors`.

If you still don't know why it's failing, use **"How to diagnose exactly why search/playback fails"** at the top of this doc to add a diagnostic and read the real error (domain/code).

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

---

## Prompt to fix "Could not access Apple Music" (Build Playlist not working)

Send this as a **follow-up message** in the same Playlist Builder (or MusicKit) project so the app fully works:

```
The app shows "Search failed: Could not access Apple Music" when I tap Build Playlist. Fix it so playlists actually build and play:

1. Request Apple Music authorization as soon as the screen appears: in the main view, add .onAppear { Task { await viewModel.requestAuthorization() } } (or .task { await viewModel.requestAuthorization() }) so the system authorization prompt appears when the user opens the app. Do not wait for them to tap Build Playlist first.

2. Disable the "Build Playlist" button until authorized. In the view model, keep isAuthorized = true only when MusicAuthorization.request() returns .authorized. In the view, set the Build Playlist button to .disabled(!viewModel.isAuthorized). When !viewModel.isAuthorized, show clear text like "Authorize Apple Music first" and a button that calls requestAuthorization() so the user can grant access.

3. Only when isAuthorized is true should search or playback run. Guard every MusicCatalogSearchRequest and ApplicationMusicPlayer.play() path with a check for isAuthorized.

4. If search or playback still fails (e.g. after authorization), show a helpful error message like "Could not access Apple Music. Check Settings > Music and ensure you're signed in with an Apple Music subscription." so the user knows what to check.
```

---

## Complete prompt (library playlist + no auto-scroll + speech)

Use this **single prompt** in the Playlist Builder project chat when you want: (1) the playlist created in Apple Music (saved to library), (2) no auto-scrolling of the song list, and (3) speech/playback fixes so the app doesn’t crash or timeout.

```
Fix the MusicKit playlist app with these changes:

1. **Create the playlist in Apple Music (save to library)**  
   When the user builds a playlist from their voice (or search), save it to their Apple Music library, not just play in-app. Use ONLY Song objects from MusicCatalogSearchRequest(term:..., types: [Song.self]).response().songs. Create the playlist with MusicLibrary.shared.createPlaylist(name: "…", description: nil, authorDisplayName: nil), then for each selected song call MusicLibrary.shared.add(song, to: playlist). Do NOT use Album type or any item with an empty identifier set. Show a success message like "Playlist added to your library" and optionally start playback of that playlist. Note: library playlist creation works on a real device with MusicKit-enabled bundle ID and the user signed into Apple Music; -7013 "Client is not entitled" usually means Simulator.

2. **Stop auto-scrolling the song list**  
   The app should not automatically scroll or cycle through the songs. Show the song list as a normal static List (or ScrollView) that the user scrolls manually. Remove any ScrollViewReader that scrolls to the current item or to each song, and remove any timers or animations that automatically scroll the list. The user scrolls the list themselves; the player can show the current track without moving the list.

3. **Speech before MusicKit**  
   Before calling MusicLibrary or ApplicationMusicPlayer.play(), fully stop the speech recognizer: audioEngine.stop(), inputNode.removeTap(onBus: 0), recognitionRequest?.endAudio(). Always call inputNode.removeTap(onBus: 0) before calling installTap so we never have two taps (avoids CreateRecordingTap crash and applicationQueuePlayer timeout).
```

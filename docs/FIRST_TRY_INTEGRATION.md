# First-try integration playbook

**Goal:** When you (or a user) ask for an app that uses a new capability (e.g. MapKit, WeatherKit, HealthKit), have it **work on the first try** instead of hours of back-and-forth.

---

## Why the MusicKit path took so long (and how to avoid that)

| What happened | Why it was slow | What would have made it first-try |
|---------------|-----------------|-----------------------------------|
| Generated app had no "create playlist in Apple Music" code | The skill didn’t spell out that flow; the model only did "search + play in-app." | Skill `promptInjection` explicitly: create playlist with MusicLibrary, add songs, then play. |
| "Developer token" errors | Model sometimes used web/JS patterns (developer token) on iOS. | Skill + master prompt + fixSwift: "never use developer token on iOS; use MusicAuthorization.request() only." |
| Wrong types (Album vs Song) when adding to playlist | No guidance that library playlist add requires Song from catalog only. | Skill + preBuildLint: "use only Song from MusicCatalogSearchRequest; never Album for MusicLibrary.add." |
| Bundle ID / -7013 "not entitled" | App used an unregistered bundle ID; library APIs need MusicKit in developer portal. | Learnings doc: "use a bundle ID that has MusicKit enabled; run on device." |
| Playback error after save confused the user | Success (playlist saved) was overwritten by a playback error dialog. | Logic: if save succeeded and play failed, don’t show blocking error; open Music app instead. |
| "Should it open the Music app?" | Not specified up front. | Skill + learnings: "after saving playlist, open Music app (music://music.apple.com/library)." |

**Takeaway:** Most of the time was spent **fixing after the fact**. First-try means **pre-wiring** the system so the first generated app already has the right patterns and the first run on device has the right setup.

---

## Pre-wire before the first user prompt (checklist for any new capability)

Do this **before** you (or a user) ask for the first app using MapKit, WeatherKit, etc. Then the first prompt can succeed.

### 1. Create or update the skill (`data/skills/<id>.json`)

- **Detection:** Add `keywords` (and `excludeKeywords` if needed) so the skill matches when the user says "map", "MapKit", "show my location", "weather", etc.
- **promptInjection:** Write **concrete** instructions:
  - Which APIs to use (e.g. `Map`, `MKMapView`, `CLLocationManager`, or `WeatherService`).
  - Required flow (e.g. "request location permission before showing map"; "call X in .onAppear").
  - What **not** to do (anti-patterns from Apple docs or common mistakes).
  - One or two sentences linking to official Apple docs.
- **canonicalCode:** Optional but powerful — a minimal ViewModel or view snippet that compiles and does the right thing. The model can mirror this.
- **commonErrors:** List 3–5 typical failures (e.g. "Map doesn't show user location" → request authorization and set `showsUserLocation = true") so the model avoids them.
- **antiPatterns:** Bullet list of "do not do X" so the model and auto-fix know what to fix.

### 2. Add a learnings doc (`docs/LEARNINGS_<CAPABILITY>.md`)

- **Official Apple docs:** Links to the main framework and the 2–3 most relevant pages (e.g. MapKit, MKMapView, location permission).
- **One-time setup:** What the user must do once (e.g. bundle ID with capability, run on device, enable in Developer portal).
- **Common failure modes:** Table or list: error message or symptom → cause → fix. Copy-paste prompts for the in-app agent to fix known issues.
- **"Complete prompt" section:** One block the user can paste to get the full desired behavior (like we have for MusicKit: create playlist + no auto-scroll + speech + open Music app).

### 3. Master prompt (optional but helpful)

- In `claudeAdapter.ts` and `structuredOutput.ts`, add one short bullet under the capability list, e.g.:  
  "MapKit: Request location authorization before showing the map; use Map (SwiftUI) or MKMapView with showsUserLocation; do not assume permission is granted."

### 4. fixSwift / preBuildLint (if there are clear, scannable mistakes)

- **fixSwift:** If the capability has a recurring mistake (e.g. wrong import, wrong API name), add a rule that detects it and fixes it (and a unit test).
- **preBuildLint:** If there’s a structural rule (e.g. "Map used but no location permission request"), add a check and optionally a warning.

### 5. Tests

- At least one test that the skill loads and that `promptInjection` contains the key guidance (e.g. "request location", "MapKit", "do not X"). That way future edits don’t remove first-try behavior.

---

## Example: MapKit "first try" in 30 minutes

1. **Skill** (`data/skills/mapkit.json`):  
   Keywords: "map", "mapkit", "show my location", "pin", "annotation", "MKMapView", "Map".  
   promptInjection: Use SwiftUI `Map` or `MKMapView`; request location authorization (e.g. `CLLocationManager.requestWhenInUseAuthorization()`) before relying on user location; set `showsUserLocation = true` if showing user; add `NSLocationWhenInUseUsageDescription` (or note it’s added by build).  
   commonErrors: "Map empty / no user location" → request permission and set showsUserLocation; "crash on launch" → check Info.plist usage description.  
   antiPatterns: "Don’t use map without requesting location permission"; "Don’t assume authorization is granted."

2. **Learnings** (`docs/LEARNINGS_MAPKIT.md`):  
   Links to MapKit and CLLocationManager docs. Short "first-time setup": run on device for location; add location usage description. One "complete prompt" block for "show a map with my location and a pin."

3. **Master prompt:** One line: "MapKit: Request location authorization before showing user location on the map; use Map or MKMapView with showsUserLocation."

4. **preBuildLint (optional):** If `Map` or `MKMapView` appears and `CLLocationManager` or `requestWhenInUseAuthorization` is missing, warn.

5. **Test:** Assert the MapKit skill’s promptInjection contains "location" and "authorization" (or similar).

After that, the **first** user prompt like "build an app that shows my location on a map" should get the right code and the first run on device should work, as long as the user has granted location once.

---

## How you get better each time

- **After each integration:** Add 1–2 bullets to the relevant LEARNINGS doc and skill (commonErrors, antiPatterns) for anything that went wrong. That way the next app with that capability is even more likely to work first try.
- **Use build-results.jsonl:** When a build fails, note the error and skill; add that error to the skill’s commonErrors and, if possible, to fixSwift or auto-fix so the system auto-corrects next time.
- **One "complete prompt" per integration:** Keep a single copy-paste block in the learnings doc that encodes the full desired behavior (all features + no known anti-patterns). That’s your first-try user prompt.

---

## Summary

- **We didn’t do MusicKit the most efficient way at first** — we improved reactively (fixing after each failure). The efficient way is **pre-wiring**: skill + learnings + optional master prompt + optional fixSwift/preBuildLint + tests **before** the first user request.
- **To get MapKit (or any new capability) on the first try:** Spend 20–30 minutes up front on the checklist above; then the first prompt and first run on device should be much closer to "it just works."
- **You learn more** by turning each failure into a single, reusable rule (in the skill or learnings doc) so the system and your own mental model both improve.

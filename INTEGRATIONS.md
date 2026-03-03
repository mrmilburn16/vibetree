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
- Catalog search returns empty or no results — The user may not have an Apple Music subscription, or catalog may be unavailable in their region. Handle empty results gracefully: show "No results" or "Apple Music may not be available" instead of assuming results exist.

**Swift Code Pattern:**
- Use `MusicAuthorization.request()` in `.onAppear` (or equivalent); wait for `status == .authorized` before any catalog search or playback.
- Disable "Build Playlist" / "Create and Play" (or any search/play button) until `isAuthorized` is true.
- Use `MusicCatalogSearchRequest(term:..., types: [Song.self])` for search; use `ApplicationMusicPlayer.shared` for playback.
- To create a playlist in the user's library: `MusicLibrary.shared.createPlaylist(name:..., description: nil, authorDisplayName: nil)` then `MusicLibrary.shared.add(song, to: playlist)` for each `Song` from the catalog response — never use `Album` or items with empty identifier set. Ensure each \`Song\` has a non-empty \`id\` before adding to a playlist; adding an item with an empty identifier can cause a runtime error or silent failure.
- Do **not** use or request a developer token in Swift; the system handles tokens when the app's bundle ID has MusicKit enabled.

**Agent Behavior:**
- Check if `musickit_token` exists in App Secrets before building (when server-side token is used); warn user if not.
- When generating native iOS MusicKit apps, inject the MusicKit skill guidance: authorization first, disable buttons until authorized, use only Song for library playlist, no developer token in code.
- In the app summary, warn that the user must enable MusicKit on the App ID in the Apple Developer portal or the app may crash with a missing entitlement.
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
- Rate limit or too many requests — Calling the weather API on every view appearance or every render causes rate limiting. You must cache responses for at least 30 minutes and never call the API from a view body or on every .onAppear without checking the cache first.

**Swift Code Pattern:**
- Always **cache** weather responses for at least **30 minutes** in generated code; never call the API on every render or every view appearance.
- Use `WeatherService.shared` (or equivalent) with the appropriate request type; check cache before issuing a new request. Use a single shared service instance (e.g. \`WeatherService.shared\`); do not create a new \`WeatherService\` on every request or in every view. The response type (e.g. \`Weather\`) may have optional properties (e.g. \`dailyForecast\`); handle \`nil\` for optional fields instead of force-unwrapping to avoid runtime crashes.

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
- **App crashes or map fails when showing user location** — You must request location permission (see CoreLocation: \`// REQUIRES PLIST: NSLocationWhenInUseUsageDescription\` and \`requestWhenInUseAuthorization()\`) before setting \`showsUserLocation = true\` or accessing the user's location. Do not enable user location on the map until authorization has been requested and (if required) granted.

**Swift Code Pattern:**
- Import MapKit; use SwiftUI `Map` or `MKMapView` (via UIViewRepresentable if needed). For SwiftUI \`Map\` (iOS 17+), provide a valid position/region (e.g. \`Map(position: $position)\` or \`Map(initialPosition: ...)\`) so the map has a defined region; do not leave the map without an initial position or binding when the API requires it. When using \`MKMapView\` inside \`UIViewRepresentable\`, implement both \`makeUIView(context:)\` and \`updateUIView(_:context:)\`; if the map must react to state changes (e.g. region, annotations), update the view in \`updateUIView\`—do not leave \`updateUIView\` empty when the represented view has changing state.
- If showing user location, request location authorization first (see CoreLocation) and set `showsUserLocation = true` (or equivalent) only after permission is granted. Never set showsUserLocation or add a user location annotation before calling the location permission request.

**Agent Behavior:**
- Use MapKit freely in any app when the user asks for maps, pins, or location on a map; no user setup or keys required.

---

## Camera / AVFoundation

**Type:** Apple Native (on-device)

**Cost:** No keys; camera is on-device only.

**Apple Identifier Required:** None.

**Key/Token Required:** No.

**User Setup Steps:** None beyond Info.plist usage description (handled by the agent).

**Common Errors:**
- **App crashes at launch or when opening camera** — The app attempted to access the camera without a usage description. You MUST add \`NSCameraUsageDescription\` to Info.plist and include the code comment \`// REQUIRES PLIST: NSCameraUsageDescription\` above the first place that triggers camera access (e.g. \`AVCaptureDevice.requestAccess(for: .video)\` or before presenting a capture session). The system will crash immediately if the key is missing.
- Permission denied — Request camera permission before presenting the camera UI; handle denied/restricted and show a clear message (e.g. "Camera access was denied. Enable it in Settings to use this feature.").

**Swift Code Pattern:**
- Add \`// REQUIRES PLIST: NSCameraUsageDescription\` immediately above the call to \`AVCaptureDevice.requestAccess(for: .video)\` (or above the first code path that uses the camera). Never use the camera without this comment and without requesting permission first.
- Call \`AVCaptureDevice.requestAccess(for: .video)\` before presenting any capture session or camera preview. Do not assume permission is granted; check the result and disable or explain the feature when denied.

**Agent Behavior:**
- For any app that uses the camera (AVCaptureDevice, AVCaptureSession, camera preview, face/body detection from camera), always add the REQUIRES PLIST comment and request permission before use. In the summary, do not warn about developer portal—camera does not require a capability—but do ensure the plist key is documented in code.
- **ARKit / RealityKit:** The build system auto-adds \`NSCameraUsageDescription\` when it detects \`import ARKit\` or ARKit/AR types (e.g. ARSession, ARSCNView, ARView). You do not need to add the REQUIRES PLIST comment for AR-only apps; the key is injected automatically. You may still add the comment for consistency.

---

## Photos / Photo Library (PhotosUI, PHPhotoLibrary)

**Type:** Apple Native (on-device)

**Cost:** No keys; on-device only.

**Apple Identifier Required:** None.

**Key/Token Required:** No.

**User Setup Steps:** None beyond Info.plist usage description (handled by the agent).

**Common Errors:**
- **App crashes when accessing photo library** — The app attempted to access the photo library without a usage description. Add \`NSPhotoLibraryUsageDescription\` to Info.plist and include the code comment \`// REQUIRES PLIST: NSPhotoLibraryUsageDescription\` above the first place that accesses the photo library (e.g. before presenting PHPickerViewController or reading PHPhotoLibrary). Request or check authorization before accessing photos.
- Permission denied — Handle denied/restricted and show a clear message; use limited library or explain when the user denies full access.

**Swift Code Pattern:**
- Add \`// REQUIRES PLIST: NSPhotoLibraryUsageDescription\` immediately above the first code that presents a photo picker or reads the photo library. For PHPickerViewController (PhotosUI) on iOS 14+, the system may not require a plist key for limited picker usage in some configurations, but always include the comment so the build system can detect usage; for full library access use PHPhotoLibrary.requestAuthorization.
- Do not assume permission is granted; handle denied and limited access gracefully.

**Agent Behavior:**
- For any app that uses the photo library (photo picker, gallery, saving images, receipt scanning from photos), always add the REQUIRES PLIST comment and request or check permission before use when required.

---

## Microphone / AVFoundation (audio)

**Type:** Apple Native (on-device)

**Cost:** No keys; on-device only.

**Apple Identifier Required:** None.

**Key/Token Required:** No.

**User Setup Steps:** None beyond Info.plist usage description (handled by the agent).

**Common Errors:**
- **App crashes when accessing microphone** — The app attempted to access the microphone without a usage description. Add \`NSMicrophoneUsageDescription\` to Info.plist and include the code comment \`// REQUIRES PLIST: NSMicrophoneUsageDescription\` above the first place that triggers microphone access (e.g. before configuring AVAudioSession for record or before starting speech recognition). Request permission (or check authorization) before using the microphone.
- Permission denied — Handle denied/restricted and show a clear message; disable or explain the feature when the user denies access.

**Swift Code Pattern:**
- Add \`// REQUIRES PLIST: NSMicrophoneUsageDescription\` immediately above the first code that configures or uses the microphone (e.g. \`AVAudioSession.shared().setCategory(.record)\` or before \`SFSpeechRecognizer\` / recording APIs). Request or check recording permission before starting capture or recognition.
- Do not assume permission is granted; check the result and disable the feature or show an explanation when denied.

**Agent Behavior:**
- For any app that uses the microphone (recording, speech recognition, ShazamKit audio capture, etc.), always add the REQUIRES PLIST comment and request or check permission before use.

---

## Speech Recognition (SFSpeechRecognizer)

**Type:** Apple Native (on-device)

**Cost:** No keys; on-device only.

**Apple Identifier Required:** None.

**Key/Token Required:** No.

**User Setup Steps:** None beyond Info.plist usage description (handled by the agent).

**Common Errors:**
- **App crashes when starting speech recognition** — Add \`NSSpeechRecognitionUsageDescription\` to Info.plist and \`// REQUIRES PLIST: NSSpeechRecognitionUsageDescription\` above the first use of SFSpeechRecognizer. Request \`SFSpeechRecognizer.requestAuthorization\` before starting recognition.
- Recognition not available — Check \`SFSpeechRecognizer.isAvailable\`; handle unavailable and denied authorization.

**Swift Code Pattern:**
- Add \`// REQUIRES PLIST: NSSpeechRecognitionUsageDescription\` above the authorization request or first use of SFSpeechRecognizer. Call \`SFSpeechRecognizer.requestAuthorization\` and wait for the result before starting a recognition task.

**Agent Behavior:**
- For any app that uses speech recognition, always add the REQUIRES PLIST comment and request authorization before use.

---

## Contacts (CNContactStore)

**Type:** Apple Native (on-device)

**Cost:** No keys; on-device only.

**Apple Identifier Required:** None.

**Key/Token Required:** No.

**User Setup Steps:** None beyond Info.plist usage description (handled by the agent).

**Common Errors:**
- **App crashes when accessing contacts** — Add \`NSContactsUsageDescription\` to Info.plist and \`// REQUIRES PLIST: NSContactsUsageDescription\` above the first access to CNContactStore. Request \`requestAccess(for: .contacts)\` before reading or presenting a contact picker.

**Swift Code Pattern:**
- Add \`// REQUIRES PLIST: NSContactsUsageDescription\` above the first CNContactStore usage. Call \`store.requestAccess(for: .contacts)\` and check the result before fetching contacts.

**Agent Behavior:**
- For any app that uses the contacts API, always add the REQUIRES PLIST comment and request authorization before use.

---

## Calendar / Reminders (EventKit)

**Type:** Apple Native (on-device)

**Cost:** No keys; on-device only.

**Apple Identifier Required:** None.

**Key/Token Required:** No.

**User Setup Steps:** None beyond Info.plist usage description. Use \`NSCalendarsUsageDescription\` for calendar and \`NSRemindersUsageDescription\` for reminders if the app uses both.

**Common Errors:**
- **App crashes when accessing calendar or reminders** — Add the appropriate usage description to Info.plist and \`// REQUIRES PLIST: NSCalendarsUsageDescription\` (or NSRemindersUsageDescription) above the first EKEventStore access. Call \`requestAccess(to: .event)\` or \`requestAccess(to: .reminder)\` before reading or writing.

**Swift Code Pattern:**
- Add the REQUIRES PLIST comment(s) above the first EKEventStore usage. Request access for .event or .reminder and check the result before querying.

**Agent Behavior:**
- For any app that uses EventKit, always add the required plist comment(s) and request authorization before use.

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
- Use `CLLocationManager`; call `requestWhenInUseAuthorization()` (or appropriate method) before using location; respect authorization status. When holding a \`CLLocationManager\` in a view or ViewModel, use \`@StateObject\` or a single retained instance and set the delegate once; do not create a new \`CLLocationManager\` on every view update or the delegate callbacks may stop or behave incorrectly.
- **Never** request location in the background unless the user explicitly asked for it.

**Agent Behavior:**
- Always include a clear, human-readable usage description for why location is needed. Add the code comment `// REQUIRES PLIST: NSLocationWhenInUseUsageDescription` above the permission request.
- Call `requestWhenInUseAuthorization()` before using location; handle `.denied` and `.restricted` by showing a helpful message (e.g. "Location access was denied. Enable it in Settings to use this feature.").
- Do not add background location capability or request background location unless the user explicitly asked for it.

---

## HealthKit

**Official docs:** [HealthKit](https://developer.apple.com/documentation/HealthKit) — framework overview, HKHealthStore, quantity types, queries, and workout APIs.

**Type:** Apple Native (on-device)

**Cost:** Purely on-device; no API calls, no keys, no cost. Data never leaves the device unless the user explicitly shares it.

**Apple Identifier Required:** App ID with **HealthKit** capability (entitlement) enabled.

**Key/Token Required:** No.

**User Setup Steps:**
- **Required:** In Apple Developer → Identifiers, select your app's App ID (same as bundle ID) and enable **HealthKit** under Capabilities. Otherwise the app shows "Missing com.apple.developer.healthkit entitlement". The export adds the entitlement to `App.entitlements`; the App ID must still have the capability so the provisioning profile includes it.

**Common Errors:**
- **"Missing com.apple.developer.healthkit entitlement"** — The App ID (bundle ID) does not have HealthKit enabled in Apple Developer. Add the HealthKit capability to the App ID, then regenerate your provisioning profile (e.g. in Xcode: Signing & Capabilities).
- Entitlement or permission denied — Ensure HealthKit capability is enabled for the App ID; request only the specific data types the app needs. Do not request broad read/write for all quantity types—request only what the app actually uses (e.g. step count, heart rate); requesting too many types can overwhelm the permission UI and increase the chance of denial.

**Swift Code Pattern:**
- Add `// REQUIRES PLIST: NSHealthShareUsageDescription` (and NSHealthUpdateUsageDescription if writing) above the authorization request.
- Call `healthStore.requestAuthorization(toShare:read:completion:)` before reading or writing any health data. Check `HKHealthStore.isHealthDataAvailable()` before using HealthKit. Use a single \`HKHealthStore\` instance (e.g. shared or injected); do not create a new \`HKHealthStore()\` on every request. For writing, pass the types to \`toShare:\`; for reading, pass the types to \`read:\`; request only the types you need.
- **Check status and run queries in the completion handler:** Do not check authorization status or show "denied" before the completion handler runs. The completion is called after the user dismisses the Health permission sheet. Inside the completion handler (dispatch to main if needed): run the read query (e.g. step count) immediately so data appears without an app restart. For read-only data (e.g. steps), HealthKit does not expose whether the user granted or denied read; run the query and show results or "No data". Show "Health Access Denied" only when the user has explicitly denied (e.g. \`authorizationStatus(for: type)\` is \`.sharingDenied\` for a type you write to). Do not show "Health Access Denied" when status is \`.notDetermined\`.
- Request only the **specific health data types** the app actually needs (e.g. step count, heart rate); do not request broad read/write for all types.
- Handle denied and unavailable in the completion handler and when `isHealthDataAvailable()` is false—show a clear message or disable the feature.

**Agent Behavior:**
- Only request the specific health data types the app actually needs; do not over-request.
- In the app summary, warn that the user must enable HealthKit on the App ID in the Apple Developer portal or the app may crash with a missing entitlement.

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
- Handle credential and error states appropriately: user cancelled (\`.canceled\`), credential revoked (re-check on app launch), network error. Do not assume the user completed sign-in; always handle the case where no credential is available. If you need to restore sign-in state across app launches, store the user identifier or credential reference securely (e.g. Keychain); do not store raw credentials in UserDefaults.

**Agent Behavior:**
- Use Sign in with Apple freely; it is the **preferred login method** for iOS apps when the user asks for login or authentication.
- In the app summary, warn that the user must enable Sign in with Apple on the App ID in the Apple Developer portal or the app may not work.

---

## Bluetooth (CoreBluetooth)

**Type:** Apple Native (on-device)

**Cost:** No keys; on-device only.

**Apple Identifier Required:** None.

**Key/Token Required:** No.

**User Setup Steps:** None beyond Info.plist usage description (handled by the agent).

**Common Errors:**
- **App crashes when accessing Bluetooth** — Add \`NSBluetoothAlwaysUsageDescription\` to Info.plist and \`// REQUIRES PLIST: NSBluetoothAlwaysUsageDescription\` above the first use of CBCentralManager or CBPeripheralManager. Request or check authorization before scanning or advertising.
- Bluetooth off or unavailable — Handle powered-off and unauthorized states; show a clear message when Bluetooth is not available.

**Swift Code Pattern:**
- Add \`// REQUIRES PLIST: NSBluetoothAlwaysUsageDescription\` above the first CoreBluetooth usage. Do not assume Bluetooth is powered on or authorized; check state and handle accordingly.

**Agent Behavior:**
- For any app that uses CoreBluetooth (BLE scanning, peripherals), always add the REQUIRES PLIST comment and handle unavailable/denied states.

---

## Motion (Core Motion)

**Type:** Apple Native (on-device)

**Cost:** No keys; on-device only.

**Apple Identifier Required:** None.

**Key/Token Required:** No.

**User Setup Steps:** None beyond Info.plist usage description (handled by the agent). Motion usage is often auto-approved; still document if the app uses CMMotionManager for significant motion or device motion.

**Common Errors:**
- **App crashes or rejection when accessing motion** — If the app uses motion data (accelerometer, gyro, pedometer), add \`NSMotionUsageDescription\` to Info.plist and \`// REQUIRES PLIST: NSMotionUsageDescription\` above the first use of CMMotionManager or CMPedometer. Request authorization where required (e.g. CMMotionActivityManager).
- Motion not available — Handle the case when motion hardware or permission is unavailable.

**Swift Code Pattern:**
- Add \`// REQUIRES PLIST: NSMotionUsageDescription\` when using CMMotionActivityManager or other motion APIs that require permission. For CMMotionManager (device motion, accelerometer) and CMPedometer, check availability and handle errors.

**Agent Behavior:**
- For any app that uses Core Motion (workout detection, step count, device motion), add the REQUIRES PLIST comment when a usage description is required and handle unavailable states.

---

## CoreNFC

**Type:** Apple Native (on-device)

**Cost:** No keys; requires NFC capability on the App ID.

**Apple Identifier Required:** App ID with **NFC Tag Reading** capability (and optionally "NFC Tag Reader Session" usage description).

**Key/Token Required:** No.

**User Setup Steps:** Enable NFC capability on the App ID in the Apple Developer portal. Add `NFCReaderUsageDescription` to Info.plist (handled by the agent via `// REQUIRES PLIST: NFCReaderUsageDescription`).

**Common Errors:**
- NFC not available — Check `NFCTagReaderSession.readingAvailable` before starting a session; show a clear message when false (e.g. "NFC is not available on this device"). NFC reading is only available on a physical device; the simulator typically does not support it, so always guard with \`readingAvailable\` and do not assume the session can start.
- Missing entitlement — User must enable NFC on the App ID in the Apple Developer portal.

**Swift Code Pattern:**
- Add `// REQUIRES PLIST: NFCReaderUsageDescription` above the code that starts the NFC session.
- Check `NFCTagReaderSession.readingAvailable` before starting a session; if false, show a helpful message and do not start the session.
- Use `NFCTagReaderSession` for reading tags; handle errors and cancellation in the delegate. Delegate callbacks run on a background queue—if you update UI or observable state from the delegate, dispatch to the main actor (e.g. `await MainActor.run { }` or `DispatchQueue.main.async`) so the UI updates correctly.

**Agent Behavior:**
- In the app summary, warn that the user must enable NFC on the App ID in the Apple Developer portal if the app uses CoreNFC.

---

## CloudKit / iCloud

**Type:** Apple Native (sync)

**Cost:** No per-call fee for typical usage; iCloud account required.

**Apple Identifier Required:** App ID with **iCloud** capability (and optionally CloudKit container).

**Key/Token Required:** No.

**User Setup Steps:** Enable iCloud capability on the App ID in the Apple Developer portal. No plist usage-description key is required for CloudKit.

**Common Errors:**
- Missing entitlement — User must enable iCloud (and CloudKit if used) on the App ID in the Apple Developer portal.
- Unavailable — When iCloud is unavailable (e.g. not signed in, no network), handle gracefully and work offline if the app supports it. Always check account status (e.g. \`CKContainer.accountStatus\`) and do not assume iCloud is available; show a clear message or disable sync when unavailable.

**Swift Code Pattern:**
- Use `NSUbiquitousKeyValueStore` or `CKContainer` as appropriate. Handle account status and errors; do not assume iCloud is always available. When using \`NSUbiquitousKeyValueStore\`, do not assume keys exist—check for the key and provide a default or handle missing values; \`object(forKey:)\` can return \`nil\`. When using \`CKContainer\`, use the correct container identifier (typically from your app's entitlements, e.g. \`CKContainer.default()\` or the container ID that matches the App ID capability); a wrong or missing container ID causes "container not found" or permission errors.
- For offline-first apps, persist locally (e.g. Core Data) and sync when iCloud is available.

**Agent Behavior:**
- In the app summary, warn that the user must enable iCloud (and the capability used) on the App ID in the Apple Developer portal when the app uses CloudKit or iCloud sync.

---

---

## WidgetKit / Live Activities (ActivityKit)

**Type:** Apple Native (extensions)

**Cost:** No keys; on-device only. Live Activities require a real device for full behavior.

**Apple Identifier Required:** App ID with **Push Notifications** capability if you use Live Activity updates from a server (optional). For timeline-only widgets, no extra capability is required.

**Key/Token Required:** No.

**User Setup Steps:** None for basic widgets. For Live Activities, the app must start the activity from the main app target; the WidgetExtension target is built from the "WidgetExtension/" folder.

**Common Errors:**
- **"cannot find type 'XIntent' in scope"** in a file under WidgetExtension/ — The widget extension is a separate target and cannot see types from the main app. Define the App Intent type (e.g. VoiceNoteIntent) in a file **inside** WidgetExtension/ (e.g. WidgetExtension/VoiceNoteIntent.swift). Do not define it only in the main app.
- **Multiple @main** — The main app has \`@main\` on the App struct in App.swift; the widget has \`@main\` on the WidgetBundle in WidgetExtension/WidgetBundle.swift. Do not put \`@main\` on both the app and a widget struct in the same target.
- **"cannot find type 'WorkoutAttributes' / 'DeliveryStage' in scope"** or **"ContentState does not conform to Decodable/Encodable/Hashable"** in WidgetExtension — ActivityAttributes structs and ALL types they reference (enums, nested structs, ContentState) must be defined **in the WidgetExtension target**, not in the main app. The widget is a separate compilation target and cannot see types defined only in the main app. Define the ActivityAttributes struct and every associated type (enums, ContentState, nested structs) in files under WidgetExtension/. The main app imports from the widget extension; never define ActivityAttributes or its associated types in the main app Swift files.

**Live Activities / ActivityKit shared types rule:** ActivityAttributes structs and ALL types they reference (enums, nested structs, ContentState) MUST be defined in the WidgetExtension target, not the main app target. The main app imports from the WidgetExtension, not the other way around. Specifically:
- Define the ActivityAttributes struct in WidgetExtension/ (e.g. WidgetExtension/DeliveryAttributes.swift).
- Define ALL enums and types used inside ActivityAttributes.ContentState in the **same** WidgetExtension/ file (e.g. \`DeliveryStage\`, \`WorkoutAttributes\`, or any nested enum/struct).
- The ContentState struct must conform to **Codable** and **Hashable** — all its property types must also conform to Codable and Hashable.
- Never define ActivityAttributes or its associated types in the main app Swift files.

**Swift Code Pattern:**
- Place **all** widget and Live Activity code under the folder **"WidgetExtension/"** (exact name). The exporter creates the extension target from this folder.
- WidgetBundle: one struct with \`@main\` in WidgetExtension/WidgetBundle.swift that lists the widgets.
- TimelineEntry: every \`TimelineEntry\` must have a \`date: Date\` property set to a valid date. The timeline provider must call the completion handler with a valid \`Timeline<Entry>\` (entries array and policy); do not call completion with an empty entries array or the widget may not display.
- Live Activities: use \`ActivityConfiguration(for: YourAttributes.self)\` in a widget file. **Define YourAttributes and every type it uses (enums, ContentState, nested structs) in WidgetExtension/** — e.g. WidgetExtension/DeliveryAttributes.swift containing both the attributes struct and all referenced types. The main app starts the activity and uses the types from the extension; it does not define them.
- App Intents: when using AppIntentConfiguration or AppIntentTimelineProvider, define the Intent type in WidgetExtension/ (e.g. WidgetExtension/MyIntent.swift) with \`import AppIntents\`.

**Correct file placement example (Live Activities):**

Define attributes and all associated types in WidgetExtension, e.g. **WidgetExtension/DeliveryAttributes.swift**:

```swift
import ActivityKit
import Foundation

struct DeliveryAttributes: ActivityAttributes {
    enum DeliveryStage: String, Codable, Hashable {
        case ordered
        case preparing
        case outForDelivery
        case delivered
    }

    struct ContentState: Codable, Hashable {
        var stage: DeliveryStage
        var message: String
        var progress: Double
    }

    var orderId: String
}
```

Then in **WidgetExtension/LiveActivityWidget.swift** use \`ActivityConfiguration(for: DeliveryAttributes.self)\`. In the **main app** (e.g. ContentView.swift), start the activity with \`Activity.request(attributes: DeliveryAttributes(orderId: "123"), contentState: ...)\` — the main app sees \`DeliveryAttributes\` because the build links the extension; do not define \`DeliveryAttributes\`, \`DeliveryStage\`, or \`ContentState\` in the main app target.

**Agent Behavior:**
- When the user asks for widgets or Live Activities, generate code under "WidgetExtension/" and define **all** ActivityAttributes and their associated types (enums, ContentState, nested structs) in WidgetExtension/ files only. Never define ActivityAttributes or types they reference in the main app Swift files. In the summary, note that Live Activities are best tested on a real device.

---

*When adding a new integration, add a section using the same structure and update this file as the single source of truth.*

# System Prompt Restructuring Plan

## The Problem

Your current Swift system prompt is ~15,000+ characters (~3,750+ tokens). This gets sent with EVERY API call — first message, follow-ups, color changes, everything. At Claude Sonnet 4.5 input pricing ($3/M tokens), that's roughly $0.011 per call just for the system prompt. At 1,000 calls/day, that's $11/day or $330/month in system prompt overhead alone.

More importantly, a huge system prompt competes with the actual user content for the model's attention. Rules about AR measurement apps are wasted tokens when someone is building a recipe app.

## The Strategy

**Core system prompt**: Rules that apply to EVERY app, EVERY time. ~6,000-7,000 characters target.

**Skills (injected conditionally)**: Rules that only apply when the user's message matches certain keywords/categories. Each skill adds 500-3,000 characters only when relevant.

---

## RESTRUCTURED CORE SYSTEM PROMPT

This is what should stay in `SYSTEM_PROMPT_SWIFT`. Everything here applies to every single app generation.

```
You are an expert Swift and SwiftUI developer. You build native iOS apps that run on iPhone and iPad. Reply message-by-message: if the user sends a follow-up, you will receive the current project files and their request; apply the change and output the full updated JSON. If there are no current files, create a new app from scratch.

Output format: Respond with a single JSON object only. No other text before or after.
Shape: { "summary": "1-2 sentence description of what you built or changed", "files": [ { "path": "App.swift", "content": "full Swift source..." }, { "path": "ContentView.swift", "content": "..." }, ... ] }

Integrations: Before generating any app that uses an integration, check INTEGRATIONS.md for the correct setup pattern, common errors, and agent behavior instructions for that integration. Always follow the Swift code pattern documented there.

Critical — Follow user requests: Whatever the user asks for, you MUST do it and output the full updated JSON with all project files. This includes any change: change a word, add a button, change a color, rename something, move a view, add a screen, etc. Do not return empty files. Do not say "no change needed." Apply the user's request and return the complete modified files. User requests override default style or design guidance. Color changes are the most common edit request. When a user says "change X to Y color", find the exact modifier and update only that value. Never regenerate the whole file for a color change.

Critical — Background: Do NOT use Color.black as the full-screen root background by default. Prefer a subtle LinearGradient that matches the app's theme. HOWEVER: if the user explicitly requests any background color or gradient, you MUST apply exactly what they asked for — no substitutions. User color requests are absolute.

Critical — App name: When the user message includes "The app is already named X", do NOT change the app name unless the user explicitly asks to rename the app.

Q&A: If the user is asking a question (and NOT asking you to change the app), answer in the summary string and set files to an empty array.

=== SWIFT LANGUAGE RULES ===

- Use Swift and SwiftUI. Target iOS 17+. No UIKit unless necessary.
- Use NavigationStack (not NavigationView), .foregroundStyle (not .foregroundColor), .navigationTitle (not .navigationBarTitle).
- App entry must be "App.swift": a struct conforming to App with @main and a WindowGroup showing ContentView().
- Include at least "App.swift" and "ContentView.swift". Use paths relative to project root. May add "Models/", "Views/", "ViewModels/" subfolders.
- All file paths must end with ".swift". No placeholders; produce complete, compilable Swift code.
- Any file using Binding, @State, @Binding, @StateObject, @ObservedObject, @Observable, @Bindable, or any SwiftUI View type must have import SwiftUI.
- Any file using @Published must import Combine.
- Never use force unwrap (!) in SwiftUI view bodies. Use optional binding (if let) or nil-coalescing (??) instead.
- Do not add trailing closures unless the API accepts one. BarMark, LineMark, AreaMark, PointMark initializers do NOT take trailing closures.
- String interpolation in Text() must be valid Swift. Write .currency(code: "USD"), not .currency(code: \"USD\").
- Don't pass formatted strings into numeric APIs. Keep numbers as Double/Int for ProgressView, Gauge, charts; only format to String for Text display.
- Never create an accentColor property on custom types. Only valid use is Color.accentColor.
- Write Color once only (Color.primary, not ColorColor). Color has no .quaternary property.
- NSAttributedString.Key has no member .foregroundStyle. The correct key is .foregroundColor.
- No duplicate declarations in the same type.
- AsyncStream requires for await, not for-in.
- Async functions in sync context require Task { await ... }.
- ForEach needs explicit id: when compiler can't infer. Use id: \.id for Identifiable, id: \.self for Hashable.
- @StateObject requires the type to conform to ObservableObject.
- Slider, Stepper require Binding<Double> or Binding<Int>, not Binding<String>.
- TextField, SecureField, .searchable require Binding<String>.
- Picker selection type must match tag type.
- DatePicker requires Binding<Date>, not Binding<String>.
- .sheet(item:) and .fullScreenCover(item:) require Binding<Item?> where Item: Identifiable.
- .onChange(of:) in iOS 17+ uses two parameters: { oldValue, newValue in }.
- .accessibilityLabel() takes a String, not a complex View.
- When using @Observable (iOS 17+), use @Bindable in child views for bindings.
- @StateObject in root views, @ObservedObject in child views; pass the object itself, not a binding.
- NavigationLink(value:) and .navigationDestination(for:) types MUST conform to Hashable.
- Timer.publish: store subscription in @StateObject and cancel in onDisappear.
- UIViewRepresentable: implement updateUIView to apply SwiftUI state changes; empty updateUIView means the UIKit view won't update.

=== DESIGN & UX RULES ===

- Every screen must feel like App Store editor's choice — modern, polished, visually outstanding.
- Do NOT default to plain black or flat dark gray backgrounds. Use subtle gradients or semantic colors matching the theme.
- Use semantic system colors (Color.primary, .secondary, Color(.systemBackground)) that adapt to light/dark mode.
- Support both light and dark mode. Never hardcode Color.white for backgrounds or Color.black for text.
- Minimum touch target 44×44pt. Always use at least 16pt horizontal padding.
- Use ScrollView on any screen whose content could overflow. Never use fixed .frame(height:) that clips content.
- Cards: 12-16pt corner radius, consistent shadow, 16pt internal padding.
- Fill device screen correctly: use .frame(maxWidth: .infinity, maxHeight: .infinity). Don't use fixed widths/heights.
- Respect safe area: only use .ignoresSafeArea() for backgrounds, then add padding for content.
- Typography: .largeTitle for hero numbers, .title2/.title3 for sections, .body for content, .caption for metadata.
- Use semantic text styles for Dynamic Type support, not hardcoded .system(size:).
- Empty states: SF Symbol icon + message + action button. Never a blank screen.
- Loading states: show ProgressView(). Never leave screens blank.
- AsyncImage with placeholder and failure view for remote images.
- Prefer SF Symbols via Image(systemName:). Use .symbolRenderingMode for depth.
- Avoid emojis in UI text. Prefer clean typography and SF Symbols sparingly.
- Animation: .spring(response: 0.35, dampingFraction: 0.85) for natural feel. Always animate state transitions.
- Use .buttonStyle(.borderedProminent) for primary actions (one per screen), .bordered for secondary.
- Use TabView for 3-5 top-level sections. Each tab gets its own NavigationStack.
- Use .sheet for non-blocking tasks, .fullScreenCover only for immersive content.
- Use Form { Section { } } for settings screens.
- Use List with .listStyle(.insetGrouped) for settings, .plain for feeds.
- Confirm destructive actions with .alert() or .confirmationDialog().
- Respect Reduce Motion: wrap motion animations in UIAccessibility.isReduceMotionEnabled check.
- Add .accessibilityLabel() to icon buttons and non-text controls.
- Minimum color contrast: 4.5:1 for body text, 3:1 for large text.

=== ARCHITECTURE RULES (3+ screens) ===

- Models/ for data types (Codable, Identifiable, Hashable), ViewModels/ for logic (@Observable), Views/ for UI.
- NavigationStack with NavigationLink(value:) for type-safe navigation.
- Persistence: dedicated Storage class wrapping UserDefaults with Codable encode/decode.
- Never put business logic in View bodies.

=== ANTI-PATTERNS (NEVER DO) ===

- Never use GeometryReader unless absolutely necessary.
- Never use .frame(width: UIScreen.main.bounds.width) — use maxWidth: .infinity.
- Never use fixed device-specific sizes (width: 390, height: 844) for root views.
- Never use ZStack for layout that should be VStack/HStack.
- Never use .offset() for positioning.
- Never put NavigationStack inside another NavigationStack.
- Never use .onAppear for data that should be in init or @State default.
- Never create buttons with empty actions.
- Never put NavigationStack or full view hierarchy inside .toolbar or .contextMenu.
- Do NOT add PassKit, StoreKit, or In-App Purchase code unless the user explicitly requests payments.

=== PRIVACY & CAPABILITIES ===

- For every privacy API used, add a comment: // REQUIRES PLIST: KeyName
  CLLocationManager → NSLocationWhenInUseUsageDescription
  HKHealthStore → NSHealthShareUsageDescription / NSHealthUpdateUsageDescription
  AVCaptureDevice (camera) → NSCameraUsageDescription
  AVAudioSession (mic) → NSMicrophoneUsageDescription
  PHPhotoLibrary → NSPhotoLibraryUsageDescription
  CNContactStore → NSContactsUsageDescription
  EKEventStore → NSCalendarsUsageDescription / NSRemindersUsageDescription
  CBCentralManager → NSBluetoothAlwaysUsageDescription
  CMMotionManager → NSMotionUsageDescription
  NFCTagReaderSession → NFCReaderUsageDescription
  SFSpeechRecognizer → NSSpeechRecognitionUsageDescription
  MusicAuthorization → NSAppleMusicUsageDescription
- Request authorization before accessing any protected data. Never read the API until auth is granted.
- Handle permission denied and integration unavailable gracefully with clear messages.
- Capabilities requiring entitlements (HealthKit, MusicKit, Push, iCloud, Sign in with Apple, CoreNFC): in your summary, include an explicit warning to enable the capability in the Apple Developer portal.

=== FILE PLANNING ===

- For apps with 3+ files, plan file structure before writing. Separate files for each View, Model, ViewModel.
- Every screen must be reachable via navigation. Every button must have a real action.
- If data is created in Screen A and shown in Screen B, ensure the same source of truth connects them.

Produce the full set of files in one reply. No markdown, no code fences — only the raw JSON object.
```

**Estimated size: ~7,500 characters (~1,875 tokens)**

That's roughly half of your current prompt. You save ~1,875 tokens per call.

---

## WHAT MOVES TO SKILLS

Each of these becomes a JSON skill file that your skills system injects ONLY when the user's message matches the trigger keywords.

### Skill 1: `widget-live-activities.json`

**Triggers:** "widget", "live activity", "live activities", "dynamic island", "WidgetKit", "home screen widget"

**Content to move (from your current prompt):**

```
Widgets and Live Activities: WidgetKit timeline providers, widget views, and Live Activity configurations require specific entry types conforming to TimelineEntry. The widget @main attribute must be on the WidgetBundle (not the app's @main). Place all widget code in the "WidgetExtension/" folder. Do NOT duplicate @main across the app and the widget extension. When using AppIntentConfiguration or AppIntentTimelineProvider, the App Intent type MUST be defined in a file inside WidgetExtension/ — the widget extension is a separate target and cannot see types from the main app.

Live Activities / ActivityKit shared types rule: ActivityAttributes MUST be defined in the main app target, not in the WidgetExtension. The WidgetExtension only references the type (e.g. in ActivityConfiguration(for: YourAttributes.self)); it does not define it. The main app never imports from the WidgetExtension. Specifically: (1) Define the ActivityAttributes struct (and ContentState, and any enums it uses) in the main app — use "LiveActivity/<Name>Attributes.swift" or "Models/<Name>Attributes.swift". (2) The widget extension gets access because the build system compiles LiveActivity/ (or shared files) for both targets; the extension only references the type. (3) ContentState must conform to Codable and Hashable; all its property types must conform. (4) Never define ActivityAttributes in WidgetExtension/ — the main app needs the type for Activity.request and activity.update; defining it only in the extension causes "cannot find type 'YourAttributes' in scope" in the app.

If the user asks for Live Activities, you MUST generate a WidgetKit extension implementation under "WidgetExtension/" so the exporter can auto-create the extension target. Include at least:
- "WidgetExtension/WidgetBundle.swift" with an @main WidgetBundle
- "WidgetExtension/LiveActivityWidget.swift" with ActivityConfiguration and Dynamic Island regions
- ActivityAttributes and ContentState in main app only (LiveActivity/ or Models/); WidgetExtension/ only contains the widget UI that references the type.
```

**Note (corrected):** The original draft of this section incorrectly stated that ActivityAttributes should be defined in the WidgetExtension target and that the main app imports from the widget. The correct rule — and what the system prompt and skills already enforce — is: ActivityAttributes must be defined in the main app target (LiveActivity/ or Models/); the WidgetExtension only references them; the main app never imports from the widget.

### Skill 2: `musickit.json`

**Triggers:** "music", "apple music", "MusicKit", "song", "playlist", "now playing", "music player"

**Content to move:**

```
Apple Music / MusicKit (native iOS): Do NOT use or request a "developer token" in app code. On iOS, MusicKit handles tokens automatically after you call MusicAuthorization.request(). Use only MusicAuthorization.request(); wait for status == .authorized before any catalog search or playback. Disable any button until authorized. Never generate code that fetches, sets, or references a developer token — that causes "Failed to request developer token" and is wrong for iOS (developer tokens are for MusicKit JS/web only).

MusicKit PLIST comment (mandatory): When using MusicAuthorization, ApplicationMusicPlayer, or any MusicKit API, you MUST add this comment immediately above the MusicAuthorization.request() call: // REQUIRES PLIST: NSAppleMusicUsageDescription
```

### Skill 3: `ar-measurement.json`

**Triggers:** "AR", "augmented reality", "ARKit", "ruler", "measure", "measurement", "3D", "anchor", "plane detection"

**Content to move:**

```
AR ruler / measurement apps: For any AR measurement or ruler app, use the standard UX pattern: (1) tap to place first anchor point, (2) tap again to place second anchor point, (3) draw a visible line between the two points, (4) show distance in both inches and centimeters, (5) include a Reset button to start over. Tapping should lock the cursor dot's current AR raycast position as the anchor point — not place a point at the screen touch coordinates. The cursor dot tracks the AR surface continuously; tap confirms its current position.
```

### Skill 4: `workout-fitness.json`

**Triggers:** "workout", "exercise", "rep", "reps", "fitness tracker", "gym", "pushup", "squat", "rep counting", "motion detection"

**Content to move:**

```
Sensing strategy (workout rep counting / detection): Choose the sensing approach that matches the user's described setup. Do NOT guess.
- If the phone is placed in front of the user (selfie/FaceTime-style camera on tripod/table), Core Motion will NOT reliably detect reps because the device is stationary. Use AVFoundation camera frames + Vision human body pose estimation with smoothing + hysteresis thresholds + cooldown. Provide on-screen guidance when the body isn't visible enough, plus a manual +1 fallback button.
- If the phone/watch moves with the body (pocket/armband/Apple Watch), use Core Motion (accelerometer/gyro or CMPedometer) with filtering + thresholds + cooldown.
- If ambiguous, infer from phrasing: "selfie/FaceTime/tripod/watching me" => Vision pose; "pocket/armband/watch" => Core Motion.
```

### Skill 5: `social-media-posting.json`

**Triggers:** "social media", "post to", "cross-post", "X/Twitter", "Instagram", "LinkedIn", "Facebook", "TikTok", "Bluesky", "Mastodon"

**Content to move:**

```
Cross-posting / multi-platform posting: If the app posts to multiple social platforms, it MUST include a way to "connect" or "link" accounts — e.g. a Settings or "Connected accounts" screen where each platform has a "Connect" action and shows connection status. Do not only show platform selection toggles; users need a visible flow to connect each platform. Real posting requires OAuth/API keys per service, so implement connection UI and demo/simulated posting unless you have backend support.
```

### Skill 6: `apple-notes.json`

**Triggers:** "notes app", "Apple Notes", "save to notes", "log to notes"

**Content to move:**

```
Apple Notes app: There is no public API for third-party apps to create or edit notes inside the built-in Apple Notes app. If the user wants to "log to Apple Notes" or "save to the Notes app", store the content in your app and provide a Share action (ShareLink or UIActivityViewController) so the user can tap "Share to Notes." For programmable system integration, Reminders (EventKit) is an alternative when "reminder"-style logging is acceptable.
```

### Skill 7: `liquid-glass.json`

**Triggers:** "liquid glass", "glass effect", "iOS 26", "glassEffect", "glass design"

**Content to move (expand from current one-liner + community skill patterns):**

```
Liquid Glass (iOS 26+): Set deployment target to iOS 26 and use the real APIs.

Basic: .glassEffect() — default regular variant, capsule shape.
Customizing: .glassEffect(.regular.tint(.orange).interactive(), in: .rect(cornerRadius: 16.0))
Buttons: .buttonStyle(.glass) or .buttonStyle(.glassProminent)

GlassEffectContainer: Always wrap multiple glass views in a container for performance and morphing:
GlassEffectContainer(spacing: 40.0) {
    HStack(spacing: 40.0) {
        Image(systemName: "scribble.variable")
            .frame(width: 80.0, height: 80.0)
            .glassEffect()
        Image(systemName: "eraser.fill")
            .frame(width: 80.0, height: 80.0)
            .glassEffect()
    }
}

Morphing: Use @Namespace + .glassEffectID("id", in: namespace) with withAnimation for smooth transitions.
Union: .glassEffectUnion(id: "group1", namespace: namespace) to merge shapes.

Apply .glassEffect() AFTER other appearance modifiers (frame, font, padding).
Use .interactive() only on elements that respond to user interaction.
Don't apply glass to every view — reserve for interactive elements, toolbars, cards.
Don't use opaque backgrounds behind glass.
Test across light mode, dark mode, and accented/tinted modes.
```

### Skill 8: `healthkit.json`

**Triggers:** "health", "HealthKit", "heart rate", "steps", "calories", "sleep", "blood pressure", "fitness data", "health data"

**Content (new — extracted from your privacy rules + expanded):**

```
HealthKit: Check HKHealthStore.isHealthDataAvailable() first. Request authorization with healthStore.requestAuthorization(toShare:read:completion:) specifying exact HKQuantityType/HKCategoryType needed. Handle denied gracefully — show a clear message explaining why health data access is needed and how to enable it in Settings. 

// REQUIRES PLIST: NSHealthShareUsageDescription (for reading)
// REQUIRES PLIST: NSHealthUpdateUsageDescription (for writing)

In your summary, warn: "Enable HealthKit in your App ID in the Apple Developer portal."

Common types:
- Steps: HKQuantityType(.stepCount)
- Heart rate: HKQuantityType(.heartRate) 
- Calories: HKQuantityType(.activeEnergyBurned)
- Sleep: HKCategoryType(.sleepAnalysis)
- Distance: HKQuantityType(.distanceWalkingRunning)
```

### Skill 9: `camera-photos.json`

**Triggers:** "camera", "photo", "scan", "QR code", "barcode", "OCR", "take picture", "capture", "image picker"

**Content:**

```
Camera: Use AVCaptureDevice.requestAccess(for: .video) before accessing camera.
// REQUIRES PLIST: NSCameraUsageDescription

Photo Library: Use PHPhotoLibrary.requestAuthorization before accessing photos.
// REQUIRES PLIST: NSPhotoLibraryUsageDescription

For image picking, prefer PhotosUI PhotosPicker (iOS 16+) — it doesn't require photo library permission.
For camera capture, use UIImagePickerController via UIViewControllerRepresentable or AVCaptureSession for custom camera UI.
Handle permission denied gracefully — show a message and a button to open Settings.
```

### Skill 10: `location-maps.json`

**Triggers:** "map", "location", "GPS", "MapKit", "directions", "nearby", "geofence", "CoreLocation"

**Content:**

```
Location: Use CLLocationManager with requestWhenInUseAuthorization() before accessing location.
// REQUIRES PLIST: NSLocationWhenInUseUsageDescription

Handle .denied and .restricted with a clear message.

MapKit: Use Map() view (iOS 17+) with MapContentBuilder. For annotations, use Annotation() or MapMarker. For search, use MKLocalSearch.

For background location (if needed):
// REQUIRES PLIST: NSLocationAlwaysAndWhenInUseUsageDescription
Warn in summary: "Background location requires additional App ID configuration."
```

---

## SKILL TRIGGER SYSTEM — WHAT TO ASK CURSOR

Here's what you need Cursor to help you build. Give it this prompt:

---

### Cursor Prompt 1: Skill Loader System

```
I need to build a skill injection system for my SwiftUI app generation agent. Here's how it works:

1. I have a directory `data/skills/` containing JSON files. Each skill file has this structure:
{
  "name": "widget-live-activities",
  "triggers": ["widget", "live activity", "live activities", "dynamic island", "WidgetKit", "home screen widget"],
  "promptBlock": "...the skill-specific system prompt text..."
}

2. When a user sends a message, BEFORE calling Claude, I need a function that:
   a. Takes the user's message string
   b. Scans it against ALL skill trigger keywords (case-insensitive, whole word or substring match)
   c. Returns the concatenated promptBlock text from ALL matching skills
   d. This text gets appended to the base system prompt

3. The matching should be:
   - Case-insensitive
   - Match if the trigger appears as a word or substring in the user message
   - Multiple skills can match the same message (e.g., "fitness app with HealthKit" matches both workout-fitness AND healthkit skills)
   - Deduplicate if somehow the same skill matches twice

4. I already have a `skillPromptBlock` parameter in my Claude adapter. I need the function that generates this string.

5. Performance matters — this runs on every API call. Keep it fast. Preload/compile the triggers once at startup, not on every call.

Here's my current adapter signature for reference:
export async function getClaudeResponse(
  message: string,
  modelOption?: string,
  options?: GetClaudeResponseOptions
)

And GetClaudeResponseOptions already has:
skillPromptBlock?: string;

Build me:
- The skill loader module (TypeScript)
- The trigger matching function
- Example of how to wire it into my existing getClaudeResponse flow
- 3 example skill JSON files matching the structure above
```

### Cursor Prompt 2: Migrate Current Prompt Rules to Skills

```
I'm restructuring my SwiftUI agent's system prompt. I have a new slimmed-down base system prompt (attached below) and I need to create skill JSON files for the rules I've extracted.

Create the following skill files in data/skills/:

1. widget-live-activities.json — triggers: ["widget", "live activity", "live activities", "dynamic island", "WidgetKit", "home screen widget", "timeline provider"]
2. musickit.json — triggers: ["music", "apple music", "MusicKit", "song", "playlist", "now playing", "music player", "ApplicationMusicPlayer"]
3. ar-measurement.json — triggers: ["AR", "augmented reality", "ARKit", "ruler", "measure", "measurement", "3D", "anchor", "plane detection"]
4. workout-fitness.json — triggers: ["workout", "exercise", "rep", "reps", "fitness tracker", "gym", "pushup", "squat", "rep counting", "motion detection", "Core Motion"]
5. social-media-posting.json — triggers: ["social media", "post to", "cross-post", "twitter", "instagram", "linkedin", "facebook", "tiktok", "bluesky", "mastodon"]
6. apple-notes.json — triggers: ["notes app", "Apple Notes", "save to notes", "log to notes"]
7. liquid-glass.json — triggers: ["liquid glass", "glass effect", "iOS 26", "glassEffect", "glass design"]
8. healthkit.json — triggers: ["health", "HealthKit", "heart rate", "steps", "calories", "sleep", "blood pressure", "fitness data", "health data"]
9. camera-photos.json — triggers: ["camera", "photo", "scan", "QR code", "barcode", "OCR", "take picture", "capture", "image picker", "PhotosPicker"]
10. location-maps.json — triggers: ["map", "location", "GPS", "MapKit", "directions", "nearby", "geofence", "CoreLocation"]

Each file should have: { "name": "...", "triggers": [...], "promptBlock": "..." }

The promptBlock content for each is provided below:
[paste the skill content sections from this document]
```

### Cursor Prompt 3: Add Skill Analytics

```
I want to track which skills are being triggered and how often, so I can optimize my trigger keywords and identify gaps (user messages that probably SHOULD trigger a skill but don't).

Add to my skill loader:
1. A simple counter that tracks how many times each skill is triggered per day
2. A log of user messages that matched ZERO skills (these might need new skills or new triggers on existing skills)
3. Store this in a simple JSON file or database table — I just need the data for now, not a fancy dashboard.

This helps me:
- See which skills are most used (and should be optimized first)
- Find messages that fall through the cracks
- Identify skills that never trigger (bad trigger keywords)
```

---

## SUMMARY OF WHAT CHANGES

### What stays in the core system prompt:
- Output format / JSON schema
- Follow-up message handling
- App name preservation
- ALL Swift compiler rules (these apply to every app)
- ALL design/UX rules (these apply to every app)
- ALL anti-patterns (these apply to every app)
- Architecture rules for multi-screen apps
- Privacy PLIST comment format and the complete key list
- Authorization-before-use rule
- Capability entitlement warning rule
- File planning rules

### What moves to skills:
- WidgetKit / Live Activities (entire section)
- MusicKit (entire section)
- AR measurement UX pattern
- Workout rep counting / sensing strategy
- Social media cross-posting
- Apple Notes limitation
- Liquid Glass (expand with community skill patterns)
- HealthKit-specific patterns (new, extracted from privacy rules)
- Camera/Photos-specific patterns (new)
- Location/Maps-specific patterns (new)

### Token savings estimate:
- Current: ~3,750 tokens per call
- After restructure: ~1,875 tokens base + 0-500 tokens per matching skill
- Average call (1-2 skills match): ~2,200 tokens
- Savings: ~1,550 tokens per call (~41%)
- At 1,000 calls/day, Sonnet pricing: saves ~$4.65/day or ~$140/month

### What to build in Cursor:
1. Skill loader module (TypeScript) — reads JSON files, compiles triggers, matches user messages
2. 10 initial skill JSON files with content from this document
3. Skill analytics (trigger counting, zero-match logging)
4. Wire the skill loader output into the existing `skillPromptBlock` parameter

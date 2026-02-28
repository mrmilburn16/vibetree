# Improvement Log (self-improvement loops)

Summaries of each improvement cycle: what was audited, what was changed, and estimated impact.

---

## Cycle 1 — 2026-02-27

**Timestamp:** 2026-02-27 (local).

### What was audited

- **src/lib/llm/claudeAdapter.ts** — Full read of `SYSTEM_PROMPT_SWIFT`: rules for integrations, SwiftUI, Bindings, Charts, accentColor, NSAttributedString, ForEach, Widgets, privacy, MusicKit, capabilities, HIG, sensing strategy.
- **INTEGRATIONS.md** — Full read: MusicKit, WeatherKit, MapKit, CoreLocation, HealthKit, Sign in with Apple, CoreNFC, CloudKit. No Camera/AVFoundation section.
- **Test suite / error data:** `src/app/admin/test-suite/page.tsx` (ERROR_PATTERNS and categories), `data/build-results.jsonl` (sample of failed builds and compiler errors), `scripts/error-patterns.mjs` (category definitions).

**Findings:**

- **Binding in scope:** Build result `br_1771735685563_w0v77` (flashcard app) failed with `cannot find type 'Binding' in scope` in `Models/DeckStore.swift` — file used `Binding` without `import SwiftUI`.
- **Color / ShapeStyle:** Build result `br_1771741179882_kvnvo` (event planner) failed with `member 'indigo' in 'HierarchicalShapeStyle' produces result of type 'Color', but context expects 'HierarchicalShapeStyle'` and `instance member 'quaternary' cannot be used on type 'Color'` in AddEventView and CalendarView — `Color.quaternary` does not exist; mixing Color vs HierarchicalShapeStyle in list/row modifiers causes type errors.
- **Camera runtime crash:** User note in build result `br_1771745048368_c2sim`: app crashed because it attempted to access privacy-sensitive data without a usage description; Info.plist must contain NSCameraUsageDescription. INTEGRATIONS.md had no Camera section, so camera apps had no single place for setup and REQUIRES PLIST behavior.
- **accentColor on custom types:** Build results (e.g. Haptic Metronome, Squat Coach) showed `type 'BeatPattern' has no member 'accentColor'`, `type 'Theme' has no member 'accentColor'` — prompt already forbids this; no change in this cycle.

### What was changed and why

1. **claudeAdapter.ts — Imports (Binding / SwiftUI)**  
   - **Before:** No explicit rule that files using `Binding` must import SwiftUI.  
   - **After:** New bullet: "Any file that uses Binding, @State, @Binding, @StateObject, @ObservedObject, @Observable, @Bindable, or any SwiftUI View type must have import SwiftUI at the top. Model or ViewModel files that use Binding in a function signature also need import SwiftUI. The error 'cannot find type Binding in scope' means that file is missing import SwiftUI."  
   - **Why:** Directly addresses missing_import / member_not_found from build-results; reduces first-attempt failures for multi-file apps where ViewModels/Models use Binding.

2. **claudeAdapter.ts — Color.quaternary / HierarchicalShapeStyle**  
   - **Before:** No guidance on Color.quaternary or HierarchicalShapeStyle vs Color in list modifiers.  
   - **After:** Extended Color bullet: "Color has no property .quaternary—use Color(uiColor: .systemGray4), Color.secondary, or .quaternary as a ShapeStyle where the modifier accepts ShapeStyle. When the compiler says 'context expects HierarchicalShapeStyle', use .foregroundStyle(.indigo) or .indigo (not Color.indigo in that context) so the type matches."  
   - **Why:** Addresses type_mismatch / member_not_found from event planner build; reduces errors in list/row styling and semantic colors.

3. **INTEGRATIONS.md — Camera / AVFoundation section**  
   - **Before:** No Camera section; only the generic REQUIRES PLIST list in the system prompt.  
   - **After:** New section "Camera / AVFoundation" with Type, Cost, User Setup, Common Errors (crash without plist, permission denied), Swift Code Pattern (REQUIRES PLIST comment, request permission before use), Agent Behavior (always add comment and request before use).  
   - **Why:** Gives the agent a single source of truth for camera apps and makes the crash cause and fix explicit, improving integration pass rate for camera/vision apps.

### Error patterns addressed

- **missing_import / cannot find type 'Binding' in scope** — Import rule.
- **type_mismatch / member_not_found (Color.quaternary, HierarchicalShapeStyle vs Color)** — Color/ShapeStyle rule.
- **Runtime crash (camera without usage description)** — INTEGRATIONS Camera section + existing REQUIRES PLIST reinforcement.

### Test cases added

- **PENDING_TEST_CASES.md:** Three test app ideas: (1) Flashcard deck with bindings, (2) Event list with semantic colors, (3) Camera placeholder with permission.

### Estimated impact

- **Binding/import:** Medium–high; affects any app with ViewModels/Models using Binding (multi-file persistence, sheets, forms). One concrete failure in build-results; pattern is recurring.
- **Color/ShapeStyle:** Medium; affects apps with styled lists, calendars, and semantic colors. One failure in build-results; avoids type_mismatch and member_not_found in list UI.
- **Camera INTEGRATIONS:** Medium; affects all camera and camera-based vision apps. Prevents runtime crash and improves M6 integration checks (plist comment, request before use).

---

## Cycle 2 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **claudeAdapter.ts** — Re-read SYSTEM_PROMPT_SWIFT after Cycle 1 edits; checked for remaining gaps.
- **INTEGRATIONS.md** — Confirmed Camera section present; no WidgetKit/Live Activities section.
- **Build-results / error patterns:** ShazamKit build `br_1771811541040` had "invalid redeclaration of 'pendingEntry'" in JournalViewModel; multiple Widget/Live Activity builds failed (Workout Live Activity, Delivery Tracker, Budget Widget) with 7–8 attempts and auto-fix. Widget skill and prompt already mention Intent in WidgetExtension and shared types; INTEGRATIONS had no single section for widgets.

**Findings:**

- **Invalid redeclaration:** ViewModels (e.g. ShazamKit music journal) sometimes declare the same property name twice (e.g. two @Published for the same concept), causing "invalid redeclaration". ShazamKit skill antiPatterns already mention it; a general prompt rule would help all ViewModels.
- **WidgetKit/Live Activities in INTEGRATIONS:** Prompt and widget skill already describe WidgetExtension/, @main, Intent in extension, shared types. INTEGRATIONS did not list WidgetKit/Live Activities, so the agent had no single "check INTEGRATIONS" entry for widget apps. Adding a section would align with other integrations and reduce "cannot find type 'XIntent' in scope" and shared-type errors.

### What was changed and why

1. **claudeAdapter.ts — No duplicate declarations**  
   - **Before:** No explicit rule about duplicate property/variable names in one type.  
   - **After:** New bullet: "Do not declare two properties or variables with the same name in the same type. 'Invalid redeclaration' means you have a duplicate identifier (e.g. two @Published var pendingEntry, or the same let/var name declared twice). Use a single property and update it, or use distinct names (e.g. pendingEntry and lastMatchedEntry)."  
   - **Why:** Addresses scope_error / invalid redeclaration from ShazamKit and similar ViewModels; reduces failures in recognition/journal-style apps.

2. **INTEGRATIONS.md — WidgetKit / Live Activities section**  
   - **Before:** No WidgetKit or Live Activities section; only prompt and widget skill.  
   - **After:** New section "WidgetKit / Live Activities (ActivityKit)" with Type, Cost, Common Errors (cannot find type XIntent in scope, multiple @main, shared types not visible), Swift Code Pattern (WidgetExtension/ folder, WidgetBundle, ActivityConfiguration, Intent in WidgetExtension/), Agent Behavior.  
   - **Why:** Gives the agent one place to check when generating widget or Live Activity apps; reinforces Intent-in-extension and shared-types pattern; improves consistency with other integrations.

### Error patterns addressed

- **Invalid redeclaration** — General rule so ViewModels/models use a single property or distinct names.
- **Widget scope (Intent in extension, shared types)** — INTEGRATIONS section so widget/Live Activity apps follow the same patterns as in the prompt and skill.

### Test cases added

- **PENDING_TEST_CASES.md:** Three more ideas: (4) Music journal (ShazamKit, no duplicate pendingEntry), (5) Workout Live Activity (Intent in WidgetExtension), (6) Delivery tracker Live Activity (shared ActivityAttributes).

### Estimated impact

- **Redeclaration rule:** Medium; affects ViewModels with multiple state vars (recognition, journal, multi-step flows). One concrete failure in build-results; pattern is easy to repeat.
- **WidgetKit INTEGRATIONS:** Medium–high; affects all widget and Live Activity apps. Aligns INTEGRATIONS with prompt/skill and reduces "cannot find type in scope" and multiple-@main issues in the extension target.

---

## Cycle 3 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **INTEGRATIONS.md** — After adding Camera and WidgetKit, checked for other privacy-sensitive or common APIs that deserved a section. Prompt already lists Microphone (AVAudioSession) in the REQUIRES PLIST list and "Request auth before use".
- **Consistency:** Camera has its own section with crash behavior and REQUIRES PLIST; microphone is used for recording, speech recognition, ShazamKit; same pattern (plist + request before use) applies.

**Findings:**

- **Microphone undocumented in INTEGRATIONS:** Camera and CoreLocation have full sections; microphone (NSMicrophoneUsageDescription, AVAudioSession) only appears in the prompt's list. Adding a short "Microphone / AVFoundation (audio)" section would make the pattern explicit and reduce runtime crashes for voice/speech/recording apps.

### What was changed and why

1. **INTEGRATIONS.md — Microphone / AVFoundation (audio) section**  
   - **Before:** No Microphone section; only the generic plist list in the system prompt.  
   - **After:** New section with Type, Cost, Common Errors (crash without plist, permission denied), Swift Code Pattern (REQUIRES PLIST comment, request/check before use), Agent Behavior.  
   - **Why:** Mirrors Camera section; gives the agent a single place for microphone apps (voice memo, speech recognition, ShazamKit audio); improves consistency and reduces runtime crashes when microphone is used without plist or before requesting permission.

### Error patterns addressed

- **Runtime crash (microphone without usage description)** — INTEGRATIONS section so microphone apps follow the same REQUIRES PLIST and request-before-use pattern as Camera.

### Test cases added

- **PENDING_TEST_CASES.md:** One test idea: (7) Voice memo placeholder with microphone permission.

### Estimated impact

- **Microphone INTEGRATIONS:** Medium; affects voice memo, speech recognition, and any app that uses the microphone. Prevents runtime crash and aligns with Camera/CoreLocation documentation.

---

## Cycle 4 — 2026-02-27 (minor)

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **Integrations bullet** in SYSTEM_PROMPT_SWIFT — It listed "MusicKit, WeatherKit, MapKit, CoreLocation, HealthKit, Sign in with Apple, etc." but did not explicitly name Camera, Microphone, or WidgetKit/Live Activities, which now have INTEGRATIONS sections.

### What was changed and why

1. **claudeAdapter.ts — Integrations list**  
   - **Before:** "MusicKit, WeatherKit, MapKit, CoreLocation, HealthKit, Sign in with Apple, etc."  
   - **After:** Added "Camera, Microphone, WidgetKit/Live Activities" to the list.  
   - **Why:** Ensures the agent explicitly considers INTEGRATIONS.md when generating camera, microphone, or widget/Live Activity apps; reinforces the new sections without changing behavior.

### Estimated impact

- **Low:** Reminder only; INTEGRATIONS.md is already appended in full. Slightly increases likelihood the model checks the right section for camera/mic/widget apps.

---

## Cycle 5 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **claudeAdapter.ts** — Full SYSTEM_PROMPT_SWIFT re-read; iOS 17+ and UIKit bullet; AsyncStream bullet; ERROR_PATTERNS (deprecated_api, async_await_misuse).
- **INTEGRATIONS.md** — Camera, Microphone, CoreLocation present; no Photos/Photo Library section. Prompt lists PHPhotoLibrary/NSPhotoLibraryUsageDescription in plist list.
- **PENDING_TEST_CASES.md** — Cycles 1–4 test cases present; no Photos, deprecated API, or async/await tests.
- **Build-results / ERROR_PATTERNS:** deprecated_api (NavigationView, .foregroundColor, .navigationBarTitle); async_await_misuse (missing 'await', call is 'async' but).

### Findings (5+ potential improvements)

1. **Photos/Photo Library undocumented in INTEGRATIONS** — Same pattern as Camera/Microphone; photo picker and gallery apps need REQUIRES PLIST and permission handling.
2. **Deprecated API not explicit in prompt** — ERROR_PATTERNS catch deprecated_api; prompt says "Target iOS 17+" but does not say "use NavigationStack not NavigationView, .foregroundStyle not .foregroundColor, .navigationTitle not .navigationBarTitle".
3. **Async/await guidance vague** — Prompt has AsyncStream rule but no rule for "call async from sync context must use Task { await } or .task"; "missing 'await'" and "call is 'async' but" are common.
4. **Speech Recognition** — Could add INTEGRATIONS section (deferred to later cycle).
5. **Contacts/Calendar** — Could add INTEGRATIONS sections (deferred).

### What was changed and why

1. **INTEGRATIONS.md — Photos / Photo Library section**  
   - **Before:** No Photos section; only plist list in prompt.  
   - **After:** New section "Photos / Photo Library (PhotosUI, PHPhotoLibrary)" with Type, Cost, Common Errors (crash without plist), Swift Code Pattern (REQUIRES PLIST comment, request/check before use), Agent Behavior.  
   - **Why:** Reduces runtime crashes for photo picker, gallery, and receipt-scanning-from-photos apps; aligns with Camera/Microphone.

2. **claudeAdapter.ts — Deprecated API replacements**  
   - **Before:** "Target iOS 17+ by default. No UIKit unless necessary."  
   - **After:** Added "Do NOT use deprecated APIs: use NavigationStack (not NavigationView), .foregroundStyle(...) (not .foregroundColor(...)), .navigationTitle(...) (not .navigationBarTitle(...)). The compiler errors 'was deprecated' or 'renamed to' mean replace with the modern API."  
   - **Why:** Directly addresses deprecated_api category; reduces builds that use old APIs.

3. **claudeAdapter.ts — Async/await from sync context**  
   - **Before:** Only AsyncStream rule (for await in loop).  
   - **After:** New bullet "When calling an async function from a synchronous context (e.g. Button action or view body), use Task { await someAsyncFunction() } or .task { await ... }. The errors 'missing await' and 'call is async but is not marked with await' mean you forgot to await or wrap in Task."  
   - **Why:** Addresses async_await_misuse; reduces missing-await and sync-call-to-async errors.

### Test cases added

- **PENDING_TEST_CASES.md:** (8) Photo picker with permission, (9) Settings screen with modern APIs (deprecated), (10) Async data load in view (Task/await).

### Estimated impact

- **Photos INTEGRATIONS:** Medium; affects photo picker, gallery, receipt scanning from photos.
- **Deprecated API rule:** Medium–high; affects any app using navigation or styling; ERROR_PATTERNS show deprecated_api as a category.
- **Async/await rule:** Medium–high; affects any app with async data loading or async API calls from views.

---

## Cycle 6 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **INTEGRATIONS.md** — Photos added in Cycle 5; CoreLocation, HealthKit, etc. present. No Speech Recognition, Contacts, or Calendar/Reminders sections; prompt already lists NSSpeechRecognitionUsageDescription, NSContactsUsageDescription, NSCalendarsUsageDescription in plist list.
- **claudeAdapter.ts** — Request auth bullet listed HealthKit, CoreLocation, MusicKit, Camera, Microphone, NFC but not Photos, Speech, Contacts, Calendar/Reminders explicitly. Plist list had CNContactStore and EKEventStore with keys but no "request X before use" in the same bullet.
- **PENDING_TEST_CASES.md** — No Speech or Contacts tests.

### Findings (5+ potential improvements)

1. **Speech Recognition undocumented in INTEGRATIONS** — Same pattern as Camera/Microphone; voice and dictation apps need REQUIRES PLIST and requestAuthorization.
2. **Contacts undocumented in INTEGRATIONS** — Contact picker and contact-based apps need NSContactsUsageDescription and requestAccess.
3. **Calendar/Reminders undocumented in INTEGRATIONS** — EventKit apps need NSCalendarsUsageDescription/NSRemindersUsageDescription and requestAccess.
4. **Request auth bullet incomplete** — Photos, Speech, Contacts, Calendar/Reminders were not in the "Request auth before use" list.
5. **Integrations list** — Could add Speech, Contacts, Calendar to the check-INTEGRATIONS list.

### What was changed and why

1. **INTEGRATIONS.md — Speech Recognition (SFSpeechRecognizer) section**  
   - **Before:** No Speech section.  
   - **After:** New section with Type, Cost, Common Errors (crash without plist, unavailable), Swift Code Pattern (REQUIRES PLIST, requestAuthorization), Agent Behavior.  
   - **Why:** Reduces runtime crashes for voice input and speech recognition apps.

2. **INTEGRATIONS.md — Contacts (CNContactStore) section**  
   - **Before:** No Contacts section.  
   - **After:** New section with Common Errors (crash without plist), Swift Code Pattern (REQUIRES PLIST, requestAccess(for: .contacts)), Agent Behavior.  
   - **Why:** Reduces runtime crashes for contact picker and contact-based apps.

3. **INTEGRATIONS.md — Calendar / Reminders (EventKit) section**  
   - **Before:** No EventKit section.  
   - **After:** New section with Common Errors (crash without plist), Swift Code Pattern (REQUIRES PLIST for NSCalendarsUsageDescription/NSRemindersUsageDescription, requestAccess(to: .event/.reminder)), Agent Behavior.  
   - **Why:** Reduces runtime crashes for calendar and reminder apps.

4. **claudeAdapter.ts** — (Cycle 5 already added plist bullets for CNContactStore and EKEventStore with "request ... before use"; this cycle added the three INTEGRATIONS sections and expanded "Request auth before use" in Cycle 5/6 to include Photos, Speech, Contacts, Calendar/Reminders.) **Request auth bullet** was already updated in a previous edit to include Photos, Speech, Contacts, Calendar/Reminders. **Integrations list** updated to include "Speech Recognition, Contacts, Calendar/Reminders".

### Test cases added

- **PENDING_TEST_CASES.md:** (11) Voice input placeholder (Speech), (12) Contact picker with permission (Contacts).

### Estimated impact

- **Speech INTEGRATIONS:** Medium; affects voice input, dictation, voice command apps.
- **Contacts INTEGRATIONS:** Medium; affects contact picker and contact-based apps.
- **Calendar/Reminders INTEGRATIONS:** Medium; affects calendar and reminder apps.

---

## Cycle 7 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **INTEGRATIONS.md** — Speech, Contacts, Calendar/Reminders added in Cycle 6. No Bluetooth (CoreBluetooth) or Motion (Core Motion) sections; prompt lists NSBluetoothAlwaysUsageDescription and NSMotionUsageDescription in plist list.
- **claudeAdapter.ts** — Type correctness bullet says keep numbers as Double/Int for ProgressView/Gauge but does not explicitly say "never pass String"; type_mismatch in ERROR_PATTERNS can be caused by passing formatted strings to these views.
- **Build-results / ERROR_PATTERNS:** type_mismatch ("cannot convert value of type"); ProgressView/Gauge are common places for String-to-number mistakes.

### Findings (5+ potential improvements)

1. **Bluetooth undocumented in INTEGRATIONS** — BLE apps need NSBluetoothAlwaysUsageDescription and handling of Bluetooth off/unauthorized.
2. **Motion undocumented in INTEGRATIONS** — Workout/step/motion apps need NSMotionUsageDescription where required and handling of unavailable.
3. **ProgressView/Gauge type rule** — Explicit "value and total must be Double/Int, never String" would reduce type_mismatch in progress/goal UIs.
4. **Integrations list** — Add Bluetooth, Motion to the check-INTEGRATIONS list (done).
5. **Request auth** — Bluetooth and Motion could be added to the request-auth bullet (optional; plist list already has them).

### What was changed and why

1. **INTEGRATIONS.md — Bluetooth (CoreBluetooth) section**  
   - **Before:** No Bluetooth section.  
   - **After:** New section with Common Errors (crash without plist, Bluetooth off), Swift Code Pattern (REQUIRES PLIST, handle state), Agent Behavior.  
   - **Why:** Reduces runtime crashes for BLE scanner and peripheral apps.

2. **INTEGRATIONS.md — Motion (Core Motion) section**  
   - **Before:** No Motion section.  
   - **After:** New section with Common Errors (crash when motion permission required), Swift Code Pattern (REQUIRES PLIST for NSMotionUsageDescription when required, handle unavailable), Agent Behavior.  
   - **Why:** Reduces crashes for workout and step-count apps that use CMMotionActivityManager or similar.

3. **claudeAdapter.ts — ProgressView and Gauge numeric rule**  
   - **Before:** Type correctness said "keep numbers as Double/Int" but did not name ProgressView/Gauge explicitly or the "cannot convert value of type 'String'" error.  
   - **After:** New bullet "ProgressView and Gauge: ProgressView(value:total:) and Gauge(value:in:) require value and total (or range) to be Double or Int—never pass a String or formatted number. The error 'cannot convert value of type String' in these views means use a raw numeric type."  
   - **Why:** Directly addresses type_mismatch when progress/goal UIs receive formatted strings.

4. **claudeAdapter.ts — Integrations list** — Added "Bluetooth, Motion" to the list (already done in same cycle).

### Test cases added

- **PENDING_TEST_CASES.md:** (13) BLE scanner placeholder, (14) Savings goal progress (numeric only).

### Estimated impact

- **Bluetooth INTEGRATIONS:** Medium; affects BLE and peripheral apps.
- **Motion INTEGRATIONS:** Medium; affects workout and motion-based apps.
- **ProgressView/Gauge rule:** Medium; affects any app with progress bars or gauges; reduces type_mismatch.

---

## Cycle 8 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **claudeAdapter.ts** — ForEach bullet (id: explicit); Architecture bullet (.sheet(item:)); INTEGRATIONS MapKit section.
- **INTEGRATIONS.md** — MapKit had "request location authorization first" but no explicit "crash or fail when showing user location without permission" error.
- **ERROR_PATTERNS / build-results:** ForEach generic parameter and Binding issues; sheet(item:) requires Optional binding.

### Findings (5+ potential improvements)

1. **ForEach Identifiable/id** — Prompt said give explicit id: but did not say "when element is Identifiable use id: \.id; when not, use id: \.self only if Hashable."
2. **.sheet(item:) optional binding** — Architecture said "prefer .sheet(item:) with an identifiable binding" but did not say the binding must be Optional so nil dismisses the sheet; non-optional causes type errors.
3. **MapKit user location** — INTEGRATIONS could add explicit common error "crash or fail when showing user location without requesting permission first."
4. **NavigationStack per tab** — Already in HIG ("Each tab gets its own NavigationStack"). No change.
5. **Hashable for navigation** — Already in Architecture. No change.

### What was changed and why

1. **claudeAdapter.ts — ForEach Identifiable/id**  
   - **Before:** "Give ForEach an explicit id: (e.g. ForEach(items, id: \.id)) or use ForEach(array.indices, id: \.self)."  
   - **After:** Added "When the collection's element type conforms to Identifiable, use id: \.id (or the type's id property); when it does not, use id: \.self only if the element type is Hashable, otherwise provide a unique id: closure."  
   - **Why:** Reduces ForEach generic parameter and Binding inference failures.

2. **claudeAdapter.ts — .sheet(item:) optional binding**  
   - **Before:** "Sheets: prefer .sheet(item:) with an identifiable binding."  
   - **After:** "the item type must conform to Identifiable and the binding must be optional (Binding<Item?>) so setting it to nil dismisses the sheet. Do not use a non-optional binding with .sheet(item:)."  
   - **Why:** Ensures correct type for .sheet(item:) and avoids type_mismatch.

3. **INTEGRATIONS.md — MapKit user location error**  
   - **Before:** "for user location, see CoreLocation and request location permission first."  
   - **After:** Added common error "App crashes or map fails when showing user location — You must request location permission ... before setting showsUserLocation = true ... Never set showsUserLocation ... before calling the location permission request." Extended Swift Code Pattern with "Never set showsUserLocation or add a user location annotation before calling the location permission request."  
   - **Why:** Makes the failure mode and fix explicit for map+location apps.

### Test cases added

- **PENDING_TEST_CASES.md:** (15) List of identifiable items (ForEach id), (16) Sheet with item binding (.sheet(item:) optional).

### Estimated impact

- **ForEach rule:** Medium; reduces ForEach inference and Binding errors in lists.
- **.sheet(item:) rule:** Medium; reduces type_mismatch when using item sheets.
- **MapKit user location:** Medium; reduces crashes and failures in map-with-location apps.

---

## Cycle 9 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **INTEGRATIONS.md** — WeatherKit (cache 30 min); CloudKit (unavailable handling); prompt (Slider/Stepper not mentioned).
- **ERROR_PATTERNS** — type_mismatch can come from Slider/Stepper when passing wrong binding type.
- **Build-results** — WeatherKit rate limit mentioned in INTEGRATIONS; CloudKit account status not explicit.

### Findings (5+ potential improvements)

1. **WeatherKit rate limit** — INTEGRATIONS said "cache 30 min" but common error could explicitly say "calling on every view appearance causes rate limit."
2. **Slider/Stepper binding** — No prompt rule that Slider(value:in:) and Stepper require Binding<Double>/Binding<Int>; passing String or wrong type causes type_mismatch.
3. **CloudKit unavailable** — INTEGRATIONS could add "Always check account status; do not assume iCloud is available."
4. **Sign in with Apple** — Could add common error "capability not enabled" handling (already has). No change.
5. **CoreNFC** — Already has readingAvailable check. No change.

### What was changed and why

1. **INTEGRATIONS.md — WeatherKit rate limit error**  
   - **Before:** "Rate limit — Ensure generated code caches weather responses."  
   - **After:** "Rate limit or too many requests — Calling the weather API on every view appearance or every render causes rate limiting. You must cache responses for at least 30 minutes and never call the API from a view body or on every .onAppear without checking the cache first."  
   - **Why:** Makes the cause and fix explicit so generated code does not call WeatherKit on every render.

2. **claudeAdapter.ts — Slider and Stepper binding**  
   - **Before:** No rule for Slider/Stepper.  
   - **After:** New bullet "Slider and Stepper require a Binding to the value type (e.g. Binding<Double>, Binding<Int>). Do not pass a Binding<String> or a non-binding value; ... use @State private var value: Double = 0 and $value."  
   - **Why:** Reduces type_mismatch when building settings or controls with sliders/steppers.

3. **INTEGRATIONS.md — CloudKit account status**  
   - **Before:** "Unavailable — When iCloud is unavailable ... handle gracefully."  
   - **After:** Added "Always check account status (e.g. CKContainer.accountStatus) and do not assume iCloud is available; show a clear message or disable sync when unavailable."  
   - **Why:** Ensures generated CloudKit apps check availability and handle signed-out/no-network.

### Test cases added

- **PENDING_TEST_CASES.md:** (17) Weather dashboard with cache, (18) Settings sliders (Slider/Stepper binding type).

### Estimated impact

- **WeatherKit error text:** Medium; reduces rate-limit failures in weather apps.
- **Slider/Stepper rule:** Medium; reduces type_mismatch in forms/settings.
- **CloudKit account status:** Medium; reduces silent failures in iCloud apps.

---

## Cycle 10 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **claudeAdapter.ts** — Forms & Text Input (HIG); no TextField/SecureField or Picker selection rule.
- **INTEGRATIONS.md** — Sign in with Apple (credential states).
- **ERROR_PATTERNS** — type_mismatch from TextField (Binding<Int> vs String) and Picker (selection vs tag type).

### Findings (5+ potential improvements)

1. **TextField/SecureField binding** — They require Binding<String>; passing Int or Double binding causes "cannot convert."
2. **Picker selection and tag** — Selection binding type must match tag/content type; mismatch causes type_mismatch.
3. **Sign in with Apple credential handling** — INTEGRATIONS could explicitly say handle .canceled and credential revoked.
4. **Toggle** — Toggle(isOn:) takes Binding<Bool>; usually correct. No change.
5. **DatePicker** — Similar; binding to Date. No change.

### What was changed and why

1. **claudeAdapter.ts — TextField and SecureField**  
   - **Before:** No rule.  
   - **After:** New bullet "TextField and SecureField require a Binding<String> for the text parameter. Do not pass Binding<Int> or Binding<Double>; ... The error 'cannot convert' in TextField usually means the binding type is not String."  
   - **Why:** Reduces type_mismatch in forms with text input.

2. **claudeAdapter.ts — Picker selection**  
   - **Before:** No Picker-specific rule.  
   - **After:** Under Apple HIG — Forms: "Picker selection: When using Picker(selection:content:label:), the selection binding type must match the type of the values in the content (e.g. tag(1) requires Binding<Int>). ... 'cannot convert' in Picker often means selection and tag types do not match."  
   - **Why:** Reduces type_mismatch when building pickers.

3. **INTEGRATIONS.md — Sign in with Apple credential states**  
   - **Before:** "Handle credential and error states appropriately (e.g. user cancelled, credential revoked, network error)."  
   - **After:** "Handle ... : user cancelled (.canceled), credential revoked (re-check on app launch), network error. Do not assume the user completed sign-in; always handle the case where no credential is available."  
   - **Why:** Makes handling explicit so generated auth flows don't assume success.

### Test cases added

- **PENDING_TEST_CASES.md:** (19) Login form (TextField Binding<String>), (20) Picker with enum selection.

### Estimated impact

- **TextField/SecureField rule:** Medium; reduces type_mismatch in login and form screens.
- **Picker selection rule:** Medium; reduces type_mismatch in picker UIs.
- **Sign in with Apple:** Low–medium; improves robustness of auth flows.

---

## Cycle 11 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **claudeAdapter.ts** — Layout rules (ScrollView); Anti-patterns (Timer not mentioned).
- **INTEGRATIONS.md** — CoreNFC (readingAvailable); simulator note not explicit.
- **Build-results** — Layout and timer leaks can cause subtle bugs.

### Findings (5+ potential improvements)

1. **ScrollView for variable content** — Layout said "Use ScrollView on any screen whose content could overflow" but did not say "do not use fixed height that clips content."
2. **Timer cleanup** — No rule that Timer.publish or Timer must be stored and cancelled; creating a timer in view body leaks and causes multiple firings.
3. **CoreNFC simulator** — INTEGRATIONS could add "NFC reading is only available on physical device; simulator typically does not support it."
4. **GeometryReader** — Already in anti-patterns. No change.
5. **ZStack for layout** — Already in anti-patterns. No change.

### What was changed and why

1. **claudeAdapter.ts — Layout ScrollView/fixed height**  
   - **Before:** "Use ScrollView on any screen whose content could overflow."  
   - **After:** Added "When content length is variable (e.g. list, form, or long text), always wrap in ScrollView or List—do not use a fixed .frame(height:) that clips content on smaller devices or with larger Dynamic Type."  
   - **Why:** Reduces clipping and layout bugs on small devices and with accessibility text size.

2. **claudeAdapter.ts — Timers**  
   - **Before:** No timer rule.  
   - **After:** New bullet "When using Timer.publish or a repeating Timer, store the subscription or timer in an @StateObject (or similar) and cancel it in onDisappear. Do not create a new timer in the view body or on every update—that leaks timers and causes multiple simultaneous firings."  
   - **Why:** Reduces timer leaks and duplicate firings in countdown/timer apps.

3. **INTEGRATIONS.md — CoreNFC simulator**  
   - **Before:** "Check readingAvailable before starting a session; show a clear message when false."  
   - **After:** Added "NFC reading is only available on a physical device; the simulator typically does not support it, so always guard with readingAvailable and do not assume the session can start."  
   - **Why:** Sets expectation for simulator and reinforces the guard.

### Test cases added

- **PENDING_TEST_CASES.md:** (21) Long form with scroll, (22) NFC tag reader placeholder (readingAvailable).

### Estimated impact

- **ScrollView/fixed height:** Medium; reduces layout clipping.
- **Timer rule:** Medium; reduces leaks and double-firing in timer apps.
- **CoreNFC simulator:** Low–medium; clarifies simulator behavior.

---

## Cycle 12 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **claudeAdapter.ts** — Forms (Picker); no DatePicker rule.
- **INTEGRATIONS.md** — HealthKit (request specific types); MusicKit (empty catalog).
- **ERROR_PATTERNS** — type_mismatch from DatePicker when passing String or wrong type.

### Findings (5+ potential improvements)

1. **DatePicker binding** — DatePicker requires Binding<Date> or Binding<Date?>; passing String causes type_mismatch.
2. **HealthKit over-request** — INTEGRATIONS said "request only the specific data types" but could add "requesting too many types can overwhelm permission UI and increase denial."
3. **MusicKit empty catalog** — Catalog search can return empty (no subscription, region); handle gracefully.
4. **Toggle** — Already correct (Bool). No change.
5. **ColorPicker** — Less common. Deferred.

### What was changed and why

1. **claudeAdapter.ts — DatePicker**  
   - **Before:** No DatePicker rule.  
   - **After:** Under Forms & Text Input: "DatePicker requires a Binding<Date> (or Binding<Date?> for optional). Do not pass a Binding<String> or formatted date; ... 'Cannot convert' in DatePicker means the binding type is not Date or Date?."  
   - **Why:** Reduces type_mismatch in forms with date pickers.

2. **INTEGRATIONS.md — HealthKit over-request**  
   - **Before:** "Request only the specific data types the app needs."  
   - **After:** Added "Do not request broad read/write for all quantity types—request only what the app actually uses; requesting too many types can overwhelm the permission UI and increase the chance of denial."  
   - **Why:** Reinforces minimal permission request for HealthKit.

3. **INTEGRATIONS.md — MusicKit empty catalog**  
   - **Before:** No empty-results error.  
   - **After:** New common error "Catalog search returns empty or no results — The user may not have an Apple Music subscription, or catalog may be unavailable in their region. Handle empty results gracefully."  
   - **Why:** Ensures MusicKit apps handle no-results instead of assuming data.

### Test cases added

- **PENDING_TEST_CASES.md:** (23) Event date picker (DatePicker Binding<Date>), (24) Step count only (HealthKit request only needed types).

### Estimated impact

- **DatePicker rule:** Medium; reduces type_mismatch in date/time forms.
- **HealthKit over-request:** Medium; improves permission UX and approval rate.
- **MusicKit empty catalog:** Medium; improves robustness of catalog/search UIs.

---

## Cycle 13 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **INTEGRATIONS.md** — WeatherKit (cache, shared service).
- **claudeAdapter.ts** — Alerts & Confirmations; Architecture (LazyVStack).
- **Build-results** — Alert API misuse; lazy stack identity.

### Findings (5+ potential improvements)

1. **WeatherKit service instance** — INTEGRATIONS could add "Use a single shared service instance; do not create a new WeatherService on every request."
2. **Alert title/message** — .alert() title and message must be String (or Text); passing a View can cause type errors; add explicit "use role: .cancel for cancel buttons."
3. **LazyVStack/LazyHStack identity** — When used in ScrollView, rows need stable id so list state is correct; add to Architecture.
4. **confirmationDialog** — Already has .cancel role. No change.
5. **NavigationStack** — Already in Architecture. No change.

### What was changed and why

1. **INTEGRATIONS.md — WeatherKit single service**  
   - **Before:** "Use WeatherService.shared ... check cache before issuing a new request."  
   - **After:** Added "Use a single shared service instance (e.g. WeatherService.shared); do not create a new WeatherService on every request or in every view."  
   - **Why:** Avoids redundant service creation and potential rate/state issues.

2. **claudeAdapter.ts — Alert title and role**  
   - **Before:** "Include a clear title, concise message, and explicit button labels."  
   - **After:** "The title and message must be String (or Text where the API accepts it); do not pass a complex View as the alert title. Use role: .cancel for cancel buttons."  
   - **Why:** Reduces type errors and ensures correct alert API usage.

3. **claudeAdapter.ts — LazyVStack/LazyHStack identity**  
   - **Before:** No LazyVStack rule.  
   - **After:** In Architecture: "When using LazyVStack or LazyHStack inside a ScrollView, ensure each row has a stable identity: use id: \.id if Identifiable, or ForEach(..., id: \.self) only when Hashable, so the list does not lose state or animate incorrectly."  
   - **Why:** Reduces list state and animation bugs in long scrollable lists.

### Test cases added

- **PENDING_TEST_CASES.md:** (25) Weather with shared service, (26) Destructive action alert (title/message String, roles).

### Estimated impact

- **WeatherKit service:** Low–medium; avoids redundant instances.
- **Alert rule:** Medium; reduces alert API misuse.
- **LazyVStack identity:** Medium; reduces list state bugs.

---

## Cycle 14 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **INTEGRATIONS.md** — CloudKit (NSUbiquitousKeyValueStore); MapKit (SwiftUI Map).
- **claudeAdapter.ts** — Empty and loading states; image loading not mentioned.
- **Build-results** — Remote image loading; CloudKit key handling.

### Findings (5+ potential improvements)

1. **CloudKit key-value store** — object(forKey:) can return nil; INTEGRATIONS could add "do not assume keys exist; provide default or handle missing."
2. **AsyncImage / remote images** — No rule that remote images should use AsyncImage and handle loading/failure; synchronous load in view body blocks UI.
3. **MapKit SwiftUI Map** — iOS 17+ Map requires position/region; INTEGRATIONS could add "provide a valid position or initial position."
4. **Core Data** — Not in scope for this cycle. No change.
5. **Refreshable** — Already in HIG. No change.

### What was changed and why

1. **INTEGRATIONS.md — CloudKit NSUbiquitousKeyValueStore**  
   - **Before:** "Handle account status and errors; do not assume iCloud is always available."  
   - **After:** Added "When using NSUbiquitousKeyValueStore, do not assume keys exist—check for the key and provide a default or handle missing values; object(forKey:) can return nil."  
   - **Why:** Prevents crashes or wrong state when keys are missing.

2. **claudeAdapter.ts — AsyncImage / remote images**  
   - **Before:** No image-loading rule.  
   - **After:** In Empty and loading states: "When loading remote images, use AsyncImage with a URL and provide a placeholder and failure view; do not perform synchronous network image load in the view body—it blocks the UI and can cause errors."  
   - **Why:** Ensures async image loading and avoids blocking the main thread.

3. **INTEGRATIONS.md — MapKit SwiftUI Map position**  
   - **Before:** "Import MapKit; use SwiftUI Map or MKMapView."  
   - **After:** Added "For SwiftUI Map (iOS 17+), provide a valid position/region (e.g. Map(position: $position) or Map(initialPosition: ...)) so the map has a defined region; do not leave the map without an initial position or binding when the API requires it."  
   - **Why:** Reduces Map API misuse and blank map when position is required.

### Test cases added

- **PENDING_TEST_CASES.md:** (27) Remote image list (AsyncImage), (28) Settings sync (iCloud KVS nil keys).

### Estimated impact

- **CloudKit nil keys:** Medium; prevents wrong state/crashes in iCloud KVS apps.
- **AsyncImage rule:** Medium; prevents blocking and errors in image-heavy UIs.
- **MapKit position:** Medium; reduces blank or incorrect map UIs.

---

## Cycle 15 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **claudeAdapter.ts** — @StateObject; Navigation Patterns (toolbar).
- **INTEGRATIONS.md** — Sign in with Apple (credential storage).
- **Build-results** — StateObject re-creation; toolbar misuse.

### Findings (5+ potential improvements)

1. **@StateObject initializer** — The initializer runs once per view identity; passing varying parameters on each redraw can cause unexpected re-creation or bugs; add "do not pass parameters that change on every redraw."
2. **Toolbar content** — Toolbar should contain ToolbarItem with buttons/menus, not NavigationStack or full views; add explicit rule.
3. **Sign in with Apple storage** — If restoring sign-in state, store securely (Keychain); INTEGRATIONS could add this.
4. **EnvironmentObject** — Different from StateObject. No change this cycle.
5. **ObservableObject** — Already covered. No change.

### What was changed and why

1. **claudeAdapter.ts — @StateObject stable initializer**  
   - **Before:** "StateObject requires that 'X' conform to 'ObservableObject'."  
   - **After:** Added "The @StateObject initializer is called only once per view identity; do not pass parameters that change on every redraw (e.g. a new array or id each time)—use stable inputs or pass dependencies via the initializer only when they are constant for the lifetime of the view."  
   - **Why:** Prevents accidental re-creation of the object and subtle state bugs.

2. **claudeAdapter.ts — Toolbar ToolbarItem**  
   - **Before:** "Show a .navigationTitle and optionally .toolbar items."  
   - **After:** "Use .toolbar { ToolbarItem(placement: .primaryAction) { ... } } (or other ToolbarItem placements); do not put a NavigationStack or full view hierarchy inside a toolbar—only buttons, menus, or small controls belong in the toolbar."  
   - **Why:** Reduces toolbar API misuse and layout errors.

3. **INTEGRATIONS.md — Sign in with Apple credential storage**  
   - **Before:** "Handle ... credential revoked (re-check on app launch)."  
   - **After:** Added "If you need to restore sign-in state across app launches, store the user identifier or credential reference securely (e.g. Keychain); do not store raw credentials in UserDefaults."  
   - **Why:** Guides secure storage for auth state.

### Test cases added

- **PENDING_TEST_CASES.md:** (29) ViewModel with stable dependency (@StateObject), (30) List with toolbar actions (ToolbarItem only).

### Estimated impact

- **@StateObject rule:** Medium; reduces state and lifecycle bugs.
- **Toolbar rule:** Medium; reduces toolbar misuse.
- **Sign in with Apple storage:** Low–medium; improves auth state security.

---

## Cycle 16 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **INTEGRATIONS.md** — CoreLocation (CLLocationManager); WidgetKit (TimelineEntry).
- **claudeAdapter.ts** — Lists & Tables (context menu not specified).
- **Build-results** — Location manager lifecycle; widget timeline completion.

### Findings (5+ potential improvements)

1. **CLLocationManager lifecycle** — Creating a new manager on every view update can break delegate callbacks; INTEGRATIONS could add "use single retained instance, set delegate once."
2. **Context menu content** — .contextMenu should contain actions (buttons), not NavigationStack or full views; add to HIG Lists & Tables.
3. **WidgetKit TimelineEntry** — Provider must call completion with valid Timeline and non-empty entries; INTEGRATIONS could add "TimelineEntry date must be set; provider must call completion with valid Timeline."
4. **Swipe actions** — Already in HIG. No change.
5. **Section** — Already in HIG. No change.

### What was changed and why

1. **INTEGRATIONS.md — CoreLocation CLLocationManager**  
   - **Before:** "Use CLLocationManager; call requestWhenInUseAuthorization() ..."  
   - **After:** Added "When holding a CLLocationManager in a view or ViewModel, use @StateObject or a single retained instance and set the delegate once; do not create a new CLLocationManager on every view update or the delegate callbacks may stop or behave incorrectly."  
   - **Why:** Prevents location updates from stopping due to manager re-creation.

2. **claudeAdapter.ts — Context menu**  
   - **Before:** No context menu rule.  
   - **After:** Under Lists & Tables: "Context menus: use .contextMenu { } with Button or other controls; the closure is a ViewBuilder. Do not put a NavigationStack or full view hierarchy inside a context menu—only actions (buttons) or a small control set belong there."  
   - **Why:** Reduces context menu API misuse.

3. **INTEGRATIONS.md — WidgetKit TimelineEntry and completion**  
   - **Before:** No explicit TimelineEntry date or completion rule.  
   - **After:** "TimelineEntry: every TimelineEntry must have a date: Date property set to a valid date. The timeline provider must call the completion handler with a valid Timeline<Entry> (entries array and policy); do not call completion with an empty entries array or the widget may not display."  
   - **Why:** Ensures widgets receive valid timeline data.

### Test cases added

- **PENDING_TEST_CASES.md:** (31) Location display (single CLLocationManager), (32) List with context menu (actions only).

### Estimated impact

- **CLLocationManager lifecycle:** Medium; fixes location update reliability.
- **Context menu rule:** Medium; reduces context menu misuse.
- **WidgetKit TimelineEntry:** Medium; reduces blank or broken widgets.

---

## Cycle 17 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **claudeAdapter.ts** — SwiftUI correctness (@Observable, @Bindable); Accessibility (HIG).
- **INTEGRATIONS.md** — HealthKit (HKHealthStore usage).
- **Build-results** — @Bindable vs $observable type mismatch; HealthKit store lifecycle.

### Findings (5+ potential improvements)

1. **@Observable @Bindable** — When using @Observable, child views need @Bindable(observable) and $observable.property, not $observable; add explicit rule.
2. **HealthKit single store** — INTEGRATIONS could add "Use a single HKHealthStore instance; do not create a new one on every request."
3. **Accessibility label type** — .accessibilityLabel() expects String (or LocalizedStringKey); passing wrong type causes "cannot convert"; add rule.
4. **toShare vs read** — HealthKit requestAuthorization has toShare and read; INTEGRATIONS could clarify. Done in HealthKit Swift Code Pattern.
5. **Environment** — Different topic. No change.

### What was changed and why

1. **claudeAdapter.ts — @Observable @Bindable**  
   - **Before:** "use iOS 17 Observation with @Observable + @Bindable explicitly."  
   - **After:** Added "When using @Observable (iOS 17+), use @Bindable(observable) in child views and then $observable.property for bindings—do not pass $observable where a Binding<SomeProperty> is expected; the compiler will report a type mismatch."  
   - **Why:** Reduces type_mismatch when using Observation framework.

2. **INTEGRATIONS.md — HealthKit single HKHealthStore**  
   - **Before:** "Call healthStore.requestAuthorization ..."  
   - **After:** Added "Use a single HKHealthStore instance (e.g. shared or injected); do not create a new HKHealthStore() on every request. For writing, pass the types to toShare:; for reading, pass the types to read:; request only the types you need."  
   - **Why:** Ensures consistent HealthKit usage and correct authorization.

3. **claudeAdapter.ts — Accessibility label type**  
   - **Before:** "Add .accessibilityLabel() to any Image, icon button, or non-text control."  
   - **After:** New bullet "When adding .accessibilityLabel(), pass a String that describes the element; do not pass a complex View. For .accessibilityHint(), use a short String. The error 'cannot convert' in accessibility modifiers often means you passed the wrong type."  
   - **Why:** Reduces type errors in accessibility APIs.

### Test cases added

- **PENDING_TEST_CASES.md:** (33) Form with Observable model (@Bindable binding), (34) Step count with single HKHealthStore.

### Estimated impact

- **@Observable @Bindable:** Medium; reduces type_mismatch in iOS 17+ Observation apps.
- **HealthKit single store:** Medium; improves HealthKit reliability.
- **Accessibility rule:** Low–medium; reduces accessibility API type errors.

---

## Cycle 18 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **INTEGRATIONS.md** — MusicKit (createPlaylist, add Song); CoreNFC (delegate).
- **claudeAdapter.ts** — No onChange rule; Anti-patterns long line.
- **Build-results** — MusicKit playlist add; onChange signature varies by iOS version.

### Findings (5+ potential improvements)

1. **MusicKit Song id** — Adding a Song with empty id to a playlist can fail; INTEGRATIONS could add "Ensure each Song has a non-empty id before adding to a playlist."
2. **onChange closure** — .onChange(of:) signature changed in iOS 17 (two params); wrong signature causes "cannot convert" or "extra argument"; add rule.
3. **CoreNFC delegate queue** — Delegate callbacks are on background queue; updating UI from delegate needs MainActor; INTEGRATIONS could add this.
4. **MusicCatalogSearchRequest** — Already in MusicKit. No change.
5. **NFC tag types** — Deferred. No change.

### What was changed and why

1. **INTEGRATIONS.md — MusicKit Song non-empty id**  
   - **Before:** "never use Album or items with empty identifier set."  
   - **After:** Added "Ensure each Song has a non-empty id before adding to a playlist; adding an item with an empty identifier can cause a runtime error or silent failure."  
   - **Why:** Prevents MusicKit playlist add failures.

2. **claudeAdapter.ts — onChange signature**  
   - **Before:** No onChange rule.  
   - **After:** New bullet "When using .onChange(of: value), use the correct closure signature for your deployment target: .onChange(of: value) { oldValue, newValue in } (two parameters in iOS 17+) or the single-parameter form where required. 'Cannot convert' or 'extra argument' in onChange usually means the closure parameter count or types do not match the API."  
   - **Why:** Reduces onChange-related type and argument errors.

3. **INTEGRATIONS.md — CoreNFC delegate main actor**  
   - **Before:** "Use NFCTagReaderSession for reading tags; handle errors and cancellation in the delegate."  
   - **After:** Added "Delegate callbacks run on a background queue—if you update UI or observable state from the delegate, dispatch to the main actor (e.g. await MainActor.run { } or DispatchQueue.main.async) so the UI updates correctly."  
   - **Why:** Prevents UI updates from background thread in NFC apps.

### Test cases added

- **PENDING_TEST_CASES.md:** (35) Add songs to playlist (Song non-empty id), (36) Filter with onChange (closure signature).

### Estimated impact

- **MusicKit Song id:** Medium; prevents playlist add failures.
- **onChange rule:** Medium; reduces closure signature errors.
- **CoreNFC main actor:** Medium; prevents UI threading issues in NFC apps.

---

## Cycle 19 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **claudeAdapter.ts** — Sheets (.sheet(item:)); UIViewRepresentable.
- **INTEGRATIONS.md** — MapKit (MKMapView, UIViewRepresentable).
- **Build-results** — fullScreenCover(item:) same as sheet(item:); map not updating when state changes.

### Findings (5+ potential improvements)

1. **fullScreenCover(item:)** — Same rules as .sheet(item:)—optional binding, Identifiable; add explicit mention.
2. **UIViewRepresentable updateUIView** — When state drives the UIKit view, updateUIView must apply state; empty updateUIView causes stale UI; add rule.
3. **MapKit MKMapView** — INTEGRATIONS could add "implement both makeUIView and updateUIView; update the view in updateUIView when state changes."
4. **sheet(isPresented)** — Different API. No change this cycle.
5. **WKWebView** — Similar to Map. Covered by general UIViewRepresentable rule.

### What was changed and why

1. **claudeAdapter.ts — fullScreenCover(item:)**  
   - **Before:** Only .sheet(item:) had the optional binding rule.  
   - **After:** "The same applies to .fullScreenCover(item:)—binding must be Binding<Item?> and item type Identifiable."  
   - **Why:** Ensures fullScreenCover is used correctly like sheet(item:).

2. **claudeAdapter.ts — UIViewRepresentable updateUIView**  
   - **Before:** "makeUIView and updateUIView use Context from SwiftUI; file must import SwiftUI and UIKit."  
   - **After:** Added "When the represented view depends on SwiftUI state (e.g. a map region or a list of annotations), implement updateUIView to apply that state to the UIKit view; an empty updateUIView means the UIKit view will not update when state changes."  
   - **Why:** Prevents stale or non-updating wrapped UIKit views.

3. **INTEGRATIONS.md — MapKit MKMapView updateUIView**  
   - **Before:** No mention of updateUIView.  
   - **After:** "When using MKMapView inside UIViewRepresentable, implement both makeUIView(context:) and updateUIView(_:context:); if the map must react to state changes (e.g. region, annotations), update the view in updateUIView—do not leave updateUIView empty when the represented view has changing state."  
   - **Why:** Ensures MapKit maps in representable update when region/annotations change.

### Test cases added

- **PENDING_TEST_CASES.md:** (37) Full-screen detail cover (fullScreenCover item binding), (38) Map with region binding (updateUIView).

### Estimated impact

- **fullScreenCover rule:** Medium; reduces type and dismiss issues.
- **updateUIView rule:** Medium; fixes stale map and other wrapped views.
- **MapKit updateUIView:** Medium; fixes map-not-updating bugs.

---

## Cycle 20 — 2026-02-27

**Timestamp:** 2026-02-27 (same session).

### What was audited

- **INTEGRATIONS.md** — WeatherKit (response type); CloudKit (CKContainer).
- **claudeAdapter.ts** — TextField/SecureField (searchable not mentioned).
- **Build-results** — Weather optional fields; searchable binding type.

### Findings (5+ potential improvements)

1. **WeatherKit optional fields** — Weather response may have optional properties (e.g. dailyForecast); force-unwrapping causes crashes; INTEGRATIONS could add "handle nil for optional fields."
2. **searchable(text:)** — .searchable(text: $binding) requires Binding<String>; add to TextField bullet or new bullet.
3. **CloudKit container ID** — Using wrong CKContainer identifier causes "container not found"; INTEGRATIONS could add "use the correct container identifier from entitlements."
4. **SecureField** — Already covered. No change.
5. **Toolbar searchable** — Same binding type. Covered by searchable rule.

### What was changed and why

1. **INTEGRATIONS.md — WeatherKit optional response**  
   - **Before:** No mention of optional response fields.  
   - **After:** "The response type (e.g. Weather) may have optional properties (e.g. dailyForecast); handle nil for optional fields instead of force-unwrapping to avoid runtime crashes."  
   - **Why:** Prevents crashes when WeatherKit returns optional fields as nil.

2. **claudeAdapter.ts — searchable(text:) binding**  
   - **Before:** Only TextField and SecureField had the Binding<String> rule.  
   - **After:** Added "Similarly, .searchable(text: $searchText) requires a Binding<String>; do not pass a non-String binding."  
   - **Why:** Reduces type_mismatch in searchable list screens.

3. **INTEGRATIONS.md — CloudKit container identifier**  
   - **Before:** "Use NSUbiquitousKeyValueStore or CKContainer as appropriate."  
   - **After:** Added "When using CKContainer, use the correct container identifier (typically from your app's entitlements, e.g. CKContainer.default() or the container ID that matches the App ID capability); a wrong or missing container ID causes 'container not found' or permission errors."  
   - **Why:** Prevents CloudKit container and permission errors.

### Test cases added

- **PENDING_TEST_CASES.md:** (39) Weather with optional forecast (WeatherKit nil handling), (40) Searchable list (.searchable Binding<String)).

### Estimated impact

- **WeatherKit optional fields:** Medium; prevents force-unwrap crashes in weather UIs.
- **searchable rule:** Medium; reduces type_mismatch in search UIs.
- **CloudKit container ID:** Medium; prevents container-not-found and permission errors.

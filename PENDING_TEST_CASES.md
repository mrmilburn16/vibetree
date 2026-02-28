# Pending Test Cases (from improvement loops)

Test ideas added to validate system-prompt and INTEGRATIONS.md improvements. Run these in the test suite to confirm the fixes reduce errors.

---

## Cycle 1 (2026-02-27)

### 1. Binding / import SwiftUI

- **Title:** Flashcard deck with bindings
- **Milestone:** M4
- **Category:** Persistence (UserDefaults)
- **Prompt:** Build a flashcard app with decks. Main screen: list of decks; tap a deck to see cards. Add/edit cards in a sheet that takes a Binding to the deck's cards array. Persist with Codable + UserDefaults.
- **Tests for:** Ensures ViewModels or Models that use `Binding` in a signature have `import SwiftUI` so "cannot find type 'Binding' in scope" does not occur.

### 2. Color.quaternary / HierarchicalShapeStyle

- **Title:** Event list with semantic colors
- **Milestone:** M4
- **Category:** Lists & navigation
- **Prompt:** Build an event list app. One screen: list of events in an inset grouped list. Use semantic list row backgrounds (e.g. secondary fill) and an accent color for the leading icon. Do not use Color.quaternary; use system semantic colors that work in both light and dark mode.
- **Tests for:** Ensures generated code does not use `Color.quaternary` (nonexistent) or mix Color vs HierarchicalShapeStyle in list modifiers so "instance member 'quaternary' cannot be used on type 'Color'" and "context expects HierarchicalShapeStyle" do not occur.

### 3. Camera REQUIRES PLIST and request before use

- **Title:** Camera placeholder with permission
- **Milestone:** M6
- **Category:** Camera
- **Prompt:** Build a simple camera app. One screen: a "Open camera" button. When tapped, request camera permission; if granted show a placeholder view (dark rectangle with "Camera active"); if denied show "Camera access denied". Include the required plist usage description.
- **Tests for:** Ensures generated code has `// REQUIRES PLIST: NSCameraUsageDescription` and calls `AVCaptureDevice.requestAccess(for: .video)` before using the camera, preventing runtime crash when opening camera without plist.

---

## Cycle 2 (2026-02-27)

### 4. Invalid redeclaration (ViewModel / single property)

- **Title:** Music journal (ShazamKit-style)
- **Milestone:** M6
- **Category:** Music recognition (ShazamKit)
- **Prompt:** Build a music journal: recognize a song with ShazamKit, let the user tag the mood (happy/chill/energy), and save. Show mood filters and a list of saved entries. Use a single pending-entry state for the current recognition; do not declare the same property name twice in the ViewModel.
- **Tests for:** Ensures no duplicate @Published or var with the same name in one type so "invalid redeclaration" does not occur.

### 5. Widget / Live Activity — Intent in WidgetExtension

- **Title:** Workout Live Activity (Intent in extension)
- **Milestone:** M6
- **Category:** Live Activities (ActivityKit)
- **Prompt:** Build a workout timer that starts a Live Activity showing elapsed time and rep count. Main app: start/stop and target. Live Activity: compact and expanded layouts. Use AppIntentConfiguration or a timeline provider; if you use an App Intent, define it in the WidgetExtension folder so the widget target can see it.
- **Tests for:** Ensures App Intent types are defined in WidgetExtension/ so "cannot find type 'XIntent' in scope" does not occur in the widget target.

### 6. Widget shared types (ActivityAttributes)

- **Title:** Delivery tracker Live Activity
- **Milestone:** M6
- **Category:** Live Activities (ActivityKit)
- **Prompt:** Build a delivery tracker that starts a Live Activity for an active delivery (ETA, status, progress). App screen: create a mock delivery and update status. Live Activity updates in real time. Define the activity attributes type so both the app and the WidgetExtension can use it (e.g. in a file the extension can see).
- **Tests for:** Ensures shared types (e.g. ActivityAttributes) are visible to the widget extension so the widget view can reference them without "cannot find type in scope".

---

## Cycle 3 (2026-02-27)

### 7. Microphone REQUIRES PLIST and request before use

- **Title:** Voice memo placeholder
- **Milestone:** M6
- **Category:** Audio / Microphone
- **Prompt:** Build a simple voice memo app. One screen: a "Start recording" button. When tapped, request microphone permission; if granted show a placeholder "Recording..." view; if denied show "Microphone access denied". Include the required plist usage description for the microphone.
- **Tests for:** Ensures generated code has `// REQUIRES PLIST: NSMicrophoneUsageDescription` and requests/checks permission before using the microphone, preventing runtime crash when accessing microphone without plist.

---

## Cycle 5 (2026-02-27)

### 8. Photos / Photo Library REQUIRES PLIST

- **Title:** Photo picker with permission
- **Milestone:** M6
- **Category:** Photos / Photo Library
- **Prompt:** Build a simple app that lets the user pick a photo from their library. One screen: a "Choose photo" button. When tapped, request photo library permission if needed, then present a photo picker (PHPickerViewController or PhotosPicker). Show the selected image or a placeholder. Include the required plist usage description for the photo library.
- **Tests for:** Ensures generated code has `// REQUIRES PLIST: NSPhotoLibraryUsageDescription` and handles permission before accessing the photo library, preventing runtime crash.

### 9. Deprecated API (NavigationView, .foregroundColor, .navigationBarTitle)

- **Title:** Settings screen with modern APIs
- **Milestone:** M4
- **Category:** Lists & navigation
- **Prompt:** Build a settings screen with NavigationStack (not NavigationView). Use .navigationTitle for the bar title and .foregroundStyle for text and icon colors. No .foregroundColor or .navigationBarTitle. List of 3 sections with toggles and navigation links. Target iOS 17+.
- **Tests for:** Ensures generated code uses NavigationStack, .foregroundStyle, and .navigationTitle so deprecated_api (NavigationView, .foregroundColor, .navigationBarTitle) does not occur.

### 10. Async/await (Task { await } from sync context)

- **Title:** Async data load in view
- **Milestone:** M4
- **Category:** Async
- **Prompt:** Build a single screen that loads a list of items from an async function (e.g. Task { await fetchItems() }). Show ProgressView while loading and the list when done. The fetch is async; call it from the view using .task or Task { }. Do not call the async function without await.
- **Tests for:** Ensures async functions are called with await and from Task or .task so "missing 'await'" and "call is 'async' but" do not occur.

---

## Cycle 6 (2026-02-27)

### 11. Speech Recognition REQUIRES PLIST

- **Title:** Voice input placeholder
- **Milestone:** M6
- **Category:** Speech Recognition
- **Prompt:** Build a simple app with a "Start listening" button. When tapped, request speech recognition permission; if granted show a placeholder "Listening..." view; if denied show "Speech recognition denied". Include the required plist usage description for speech recognition.
- **Tests for:** Ensures generated code has `// REQUIRES PLIST: NSSpeechRecognitionUsageDescription` and requests authorization before using SFSpeechRecognizer.

### 12. Contacts REQUIRES PLIST

- **Title:** Contact picker with permission
- **Milestone:** M6
- **Category:** Contacts
- **Prompt:** Build a simple app with a "Choose contact" button. When tapped, request contacts permission; if granted present a contact picker (CNContactPickerViewController) or list; if denied show "Contacts access denied". Include the required plist usage description for contacts.
- **Tests for:** Ensures generated code has `// REQUIRES PLIST: NSContactsUsageDescription` and requests authorization before accessing CNContactStore.

---

## Cycle 7 (2026-02-27)

### 13. Bluetooth REQUIRES PLIST

- **Title:** BLE scanner placeholder
- **Milestone:** M6
- **Category:** Bluetooth (CoreBluetooth)
- **Prompt:** Build a simple app with a "Scan for devices" button. When tapped, ensure Bluetooth usage is documented (REQUIRES PLIST comment for NSBluetoothAlwaysUsageDescription). Show a placeholder list of devices or "Scanning...". Handle the case when Bluetooth is off. Do not assume Bluetooth is available.
- **Tests for:** Ensures generated code has `// REQUIRES PLIST: NSBluetoothAlwaysUsageDescription` when using CoreBluetooth and handles unavailable/off state.

### 14. ProgressView/Gauge numeric types

- **Title:** Savings goal progress (numeric only)
- **Milestone:** M4
- **Category:** UI / Progress
- **Prompt:** Build a single screen with a savings goal: ProgressView showing current/target (e.g. 200.0 / 1000.0 as Double). Below it show the same as text (e.g. "$200 / $1000"). Use Double for ProgressView(value:total:); format to String only for the Text label. Do not pass a String into ProgressView.
- **Tests for:** Ensures ProgressView(value:total:) receives Double or Int, not String, so "cannot convert value of type 'String'" does not occur.

---

## Cycle 8 (2026-02-27)

### 15. ForEach with Identifiable / id

- **Title:** List of identifiable items
- **Milestone:** M4
- **Category:** Lists & navigation
- **Prompt:** Build a list screen showing 5 items. Each item has a unique id (UUID or Int). Use ForEach with the collection and provide id: \.id because the item type conforms to Identifiable. Tapping an item navigates to detail. Do not pass a Binding where a plain array is expected.
- **Tests for:** Ensures ForEach is given an explicit id (e.g. id: \.id) when using Identifiable, so "generic parameter 'C' could not be inferred" does not occur.

### 16. .sheet(item:) optional binding

- **Title:** Sheet with item binding
- **Milestone:** M4
- **Category:** UI states
- **Prompt:** Build a screen with a list of 3 items. Tapping an item presents a sheet showing that item's detail. Use .sheet(item: $selectedItem) where selectedItem is Optional (Item?) and Item conforms to Identifiable. Dismiss by setting selectedItem = nil. Do not use a non-optional binding for .sheet(item:).
- **Tests for:** Ensures .sheet(item:) receives an optional binding (Binding<Item?>) so the sheet can dismiss and the type matches the API.

---

## Cycle 9 (2026-02-27)

### 17. WeatherKit cache (no call on every render)

- **Title:** Weather dashboard with cache
- **Milestone:** M6
- **Category:** WeatherKit
- **Prompt:** Build a weather dashboard showing current conditions and 3-day forecast. Use WeatherKit. Cache the response for at least 30 minutes; do not call the weather API on every view appearance or in the view body. Check cache before issuing a new request.
- **Tests for:** Ensures WeatherKit is not called on every render so rate limit and "too many requests" are avoided.

### 18. Slider/Stepper binding type

- **Title:** Settings sliders
- **Milestone:** M4
- **Category:** Forms & pickers
- **Prompt:** Build a settings screen with a Slider(0...100) for volume and a Stepper for count. Use @State Double for the slider and @State Int for the stepper; pass Binding to Slider and Stepper. Do not use String or a non-binding value. Show the current values as text.
- **Tests for:** Ensures Slider and Stepper receive the correct Binding type (Double/Int) so type_mismatch does not occur.

---

## Cycle 10 (2026-02-27)

### 19. TextField Binding<String>

- **Title:** Login form (TextField binding)
- **Milestone:** M4
- **Category:** Forms & pickers
- **Prompt:** Build a simple login form: two text fields (email, password) and a Submit button. Use @State String for each field and pass Binding<String> to TextField and SecureField. Do not use Binding<Int> or a non-String binding. Show the submitted values in an alert.
- **Tests for:** Ensures TextField/SecureField receive Binding<String> so "cannot convert" does not occur.

### 20. Picker selection and tag type

- **Title:** Picker with enum selection
- **Milestone:** M4
- **Category:** Forms & pickers
- **Prompt:** Build a form with a Picker for "Priority" (Low, Medium, High). Use an enum conforming to String and CaseIterable; selection binding is Binding<Priority?>. Use ForEach(Priority.allCases, id: \.self) or Picker with tag(priority) so the selection type matches. Do not mix Int tags with String binding.
- **Tests for:** Ensures Picker selection type matches tag/content type so type_mismatch does not occur.

---

## Cycle 11 (2026-02-27)

### 21. ScrollView for variable content

- **Title:** Long form with scroll
- **Milestone:** M4
- **Category:** Layout
- **Prompt:** Build a settings-style form with 8 sections (each with 2–3 rows). Wrap the entire form in a ScrollView so it scrolls on small devices. Do not use a fixed height that would clip content. Use Form or List inside ScrollView if appropriate, or VStack in ScrollView.
- **Tests for:** Ensures variable-length content is in ScrollView/List so it does not clip on smaller screens or with Dynamic Type.

### 22. NFC readingAvailable (simulator)

- **Title:** NFC tag reader placeholder
- **Milestone:** M6
- **Category:** CoreNFC
- **Prompt:** Build a simple NFC reader app. Before starting a session, check NFCTagReaderSession.readingAvailable. If false, show "NFC is not available on this device" (e.g. on simulator). If true, show a "Scan" button that starts the session. Include REQUIRES PLIST for NFCReaderUsageDescription.
- **Tests for:** Ensures code checks readingAvailable and does not assume NFC is available (e.g. on simulator).

---

## Cycle 12 (2026-02-27)

### 23. DatePicker Binding<Date>

- **Title:** Event date picker
- **Milestone:** M4
- **Category:** Forms & pickers
- **Prompt:** Build a form with a date picker for "Event date". Use @State var eventDate: Date = Date() and pass $eventDate to DatePicker. Do not use a String for the selection. Show the selected date as formatted text below. Include a time picker if appropriate.
- **Tests for:** Ensures DatePicker receives Binding<Date> (or Date?) so type_mismatch does not occur.

### 24. HealthKit request only needed types

- **Title:** Step count only (HealthKit)
- **Milestone:** M6
- **Category:** HealthKit
- **Prompt:** Build an app that reads only step count from HealthKit. Request authorization only for step count (HKQuantityType.quantityType(forIdentifier: .stepCount)); do not request read for all quantity types. Show today's steps and handle denied/unavailable. Include REQUIRES PLIST and capability warning in summary.
- **Tests for:** Ensures HealthKit authorization requests only the specific types the app needs (e.g. step count), not broad read.

---

## Cycle 13 (2026-02-27)

### 25. WeatherKit single service instance

- **Title:** Weather with shared service
- **Milestone:** M6
- **Category:** WeatherKit
- **Prompt:** Build a weather screen that shows current conditions. Use WeatherService.shared (or a single shared instance) for the request; do not create a new WeatherService in the view or on every request. Cache the result for 30 minutes. Show a loading state and handle errors.
- **Tests for:** Ensures WeatherKit uses one shared service instance and avoids creating a new service per request.

### 26. Alert title/message as String

- **Title:** Destructive action alert
- **Milestone:** M4
- **Category:** Alerts & confirmations
- **Prompt:** Build a screen with a "Delete" button. When tapped, show an .alert with a clear title (String), message (String), and two buttons: "Cancel" (role: .cancel) and "Delete" (role: .destructive). Do not pass a View as the alert title. Dismiss on Cancel; perform delete on Delete.
- **Tests for:** Ensures .alert uses String title and message and proper button roles so the API is used correctly.

---

## Cycle 14 (2026-02-27)

### 27. AsyncImage for remote images

- **Title:** Remote image list
- **Milestone:** M4
- **Category:** Loading / Images
- **Prompt:** Build a list of 5 items, each with a title and a remote image URL (use placeholder URLs like https://picsum.photos/100). Use AsyncImage for each image with a placeholder (ProgressView) and a failure view (e.g. Image(systemName: "photo")). Do not load images synchronously in the view body.
- **Tests for:** Ensures remote images use AsyncImage (or similar async loading) and handle loading/failure so the UI does not block or error.

### 28. CloudKit / NSUbiquitousKeyValueStore nil keys

- **Title:** Settings sync (iCloud KVS)
- **Milestone:** M6
- **Category:** CloudKit / iCloud
- **Prompt:** Build a settings screen that syncs a toggle and a text preference to iCloud using NSUbiquitousKeyValueStore. When reading, check if the key exists and provide a default value; do not assume object(forKey:) returns a non-nil value. Handle iCloud unavailable. Include capability warning in summary.
- **Tests for:** Ensures NSUbiquitousKeyValueStore reads handle nil/missing keys and provide defaults.

---

## Cycle 15 (2026-02-27)

### 29. @StateObject stable initializer

- **Title:** ViewModel with stable dependency
- **Milestone:** M4
- **Category:** Architecture
- **Prompt:** Build a screen that uses a ViewModel (ObservableObject) as @StateObject. The ViewModel takes a stable dependency (e.g. a constant config or store). Do not pass a value that changes on every view redraw (e.g. a new array or id) into the @StateObject initializer—use a constant or inject once. Show data from the ViewModel.
- **Tests for:** Ensures @StateObject is initialized with stable inputs so the object is not recreated on every redraw.

### 30. Toolbar with ToolbarItem only

- **Title:** List with toolbar actions
- **Milestone:** M4
- **Category:** Navigation
- **Prompt:** Build a list screen with a .navigationTitle and a .toolbar containing a "Add" button (ToolbarItem(placement: .primaryAction)) and an "Edit" button. Do not put a NavigationStack or a full view inside the toolbar—only buttons or menus. Tapping Add shows a sheet.
- **Tests for:** Ensures toolbar contains only ToolbarItem(s) with controls, not full view hierarchies.

---

## Cycle 16 (2026-02-27)

### 31. CLLocationManager single instance

- **Title:** Location display (single manager)
- **Milestone:** M6
- **Category:** CoreLocation
- **Prompt:** Build a screen that shows the current location (latitude/longitude). Use a single CLLocationManager instance (e.g. @StateObject wrapper or retained in a view model). Set the delegate once and request authorization before starting updates. Do not create a new CLLocationManager on every view redraw. Include REQUIRES PLIST for location.
- **Tests for:** Ensures CLLocationManager is not recreated on every update so delegate callbacks work correctly.

### 32. Context menu actions only

- **Title:** List with context menu
- **Milestone:** M4
- **Category:** Lists & Tables
- **Prompt:** Build a list of 5 items. Each row has a .contextMenu with two actions: "Edit" and "Delete". Use Button("Edit") and Button("Delete", role: .destructive) inside the context menu. Do not put a NavigationStack or a full view inside the context menu—only action buttons. Tapping Edit shows a sheet; Delete removes the item.
- **Tests for:** Ensures .contextMenu contains only actions (buttons), not full view hierarchies.

---

## Cycle 17 (2026-02-27)

### 33. @Observable and @Bindable binding

- **Title:** Form with Observable model
- **Milestone:** M4
- **Category:** Architecture
- **Prompt:** Build a form screen using @Observable for the model (iOS 17+). The model has a name: String and isComplete: Bool. In a child view, use @Bindable(model) and pass $model.name to a TextField and $model.isComplete to a Toggle. Do not pass $model where a Binding<String> or Binding<Bool> is expected. Show the values in the parent.
- **Tests for:** Ensures @Observable + @Bindable produce correct property bindings so type_mismatch does not occur.

### 34. HealthKit single HKHealthStore

- **Title:** Step count with single store
- **Milestone:** M6
- **Category:** HealthKit
- **Prompt:** Build an app that reads step count from HealthKit. Use one HKHealthStore instance (e.g. @StateObject or shared). Request authorization for step count only (read). Check isHealthDataAvailable() before use. Do not create a new HKHealthStore on every view update. Include REQUIRES PLIST and capability warning.
- **Tests for:** Ensures a single HKHealthStore is used so authorization and queries work correctly.

---

## Cycle 18 (2026-02-27)

### 35. MusicKit Song non-empty id for playlist

- **Title:** Add songs to playlist (MusicKit)
- **Milestone:** M6
- **Category:** MusicKit
- **Prompt:** Build an app that searches for songs with MusicKit and lets the user add selected songs to a new playlist. Use MusicLibrary.shared.createPlaylist and add(song, to: playlist). Only add Song items that have a non-empty id; skip or filter out any result with an empty identifier. Include authorization and REQUIRES PLIST. Warn about MusicKit capability in summary.
- **Tests for:** Ensures Song items added to playlists have non-empty id so runtime errors or silent failures do not occur.

### 36. onChange closure signature

- **Title:** Filter with onChange
- **Milestone:** M4
- **Category:** UI state
- **Prompt:** Build a screen with a TextField and a label that shows the character count. Use .onChange(of: text) { oldValue, newValue in } (iOS 17+) to update the count when text changes. Use the correct closure signature (two parameters for iOS 17+). Do not use the wrong parameter count or types.
- **Tests for:** Ensures .onChange(of:) uses the correct closure signature so "cannot convert" or "extra argument" does not occur.

---

## Cycle 19 (2026-02-27)

### 37. fullScreenCover(item:) optional binding

- **Title:** Full-screen detail cover
- **Milestone:** M4
- **Category:** UI states
- **Prompt:** Build a list of 5 items. Tapping an item presents a full-screen cover (not a sheet) showing that item's detail. Use .fullScreenCover(item: $selectedItem) where selectedItem is Item? and Item conforms to Identifiable. Provide a "Close" button that sets selectedItem = nil. Do not use a non-optional binding.
- **Tests for:** Ensures .fullScreenCover(item:) receives an optional Binding<Item?> so the cover can dismiss and the type matches.

### 38. UIViewRepresentable updateUIView

- **Title:** Map with region binding
- **Milestone:** M6
- **Category:** MapKit
- **Prompt:** Build a screen with an MKMapView wrapped in UIViewRepresentable. The map region is driven by @State (e.g. center and span). Implement both makeUIView(context:) and updateUIView(_:context:) so that when the state changes, the map's region updates. Do not leave updateUIView empty. Include location permission if showing user location.
- **Tests for:** Ensures UIViewRepresentable implements updateUIView when state drives the UIKit view so the map (or other wrapped view) updates when state changes.

---

## Cycle 20 (2026-02-27)

### 39. WeatherKit optional response fields

- **Title:** Weather with optional forecast
- **Milestone:** M6
- **Category:** WeatherKit
- **Prompt:** Build a weather screen that shows current conditions and, if available, the first day of the daily forecast. Use WeatherKit and cache for 30 minutes. When reading the response, treat dailyForecast (or similar) as optional—use optional binding or nil-coalescing; do not force-unwrap optional properties. Handle the case when daily forecast is nil. Include capability/plist as needed.
- **Tests for:** Ensures WeatherKit response optional fields (e.g. dailyForecast) are handled without force-unwrap so runtime crashes do not occur.

### 40. searchable(text:) Binding<String>

- **Title:** Searchable list
- **Milestone:** M4
- **Category:** Lists & navigation
- **Prompt:** Build a list screen with a search bar. Use .searchable(text: $searchText) where searchText is @State String. Filter the list based on searchText. Do not pass a Binding<Int> or a non-String binding to searchable(text:). Show filtered results as the user types.
- **Tests for:** Ensures .searchable(text:) receives Binding<String> so type_mismatch does not occur.

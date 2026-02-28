import { APP_IDEAS_BY_CATEGORY } from "./appIdeaPrompts";
import { APP_IDEAS_MEDIUM_BY_CATEGORY } from "./appIdeaPromptsMedium";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export type MilestoneIdea = {
  title: string;
  prompt: string;
  category: string;
  tier: "easy" | "medium" | "hard";
};

export type MilestoneConfig = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  target: number;
  ideas: MilestoneIdea[];
};

function easyByTitle(title: string, category: string): MilestoneIdea | null {
  for (const [cat, ideas] of Object.entries(APP_IDEAS_BY_CATEGORY)) {
    const match = ideas.find((i) => i.title === title);
    if (match) return { title: match.title, prompt: match.prompt, category: category || cat, tier: "easy" };
  }
  return null;
}

function mediumByTitle(title: string, category: string): MilestoneIdea | null {
  for (const [cat, ideas] of Object.entries(APP_IDEAS_MEDIUM_BY_CATEGORY)) {
    const match = ideas.find((i) => i.title === title);
    if (match) return { title: match.title, prompt: match.prompt, category: category || cat, tier: "medium" };
  }
  return null;
}

const M1_BASELINE: MilestoneIdea[] = [
  { title: "Smoke Test", category: "Misc", tier: "easy",
    prompt: "Build the simplest possible iOS app. Just a white screen with a label in the center that says Hello Vibetree in large bold text. Nothing else." },
  { title: "Todo list with categories", category: "Persistence", tier: "medium",
    prompt: `Build a todo app with categories. Main screen: segmented control to filter (All, Active, Completed). List of tasks with checkboxes, due dates, and priority colors (high=red, medium=orange, low=green). Add task sheet: title, due date picker, priority picker, optional notes. Swipe to delete. Sort by due date or priority. Persist with Codable + UserDefaults. Show completion percentage at top.` },
  { title: "Expense tracker", category: "Persistence", tier: "medium",
    prompt: `Build an expense tracker with categories. Main screen: list of expenses (amount, label, category icon, date) with running total at top. Add expense sheet: amount field, label, category picker (Food, Transport, Entertainment, etc.), date picker. Filter by category using segmented control. Monthly summary view showing total per category. Persist with Codable + UserDefaults.` },
  { title: "Product catalog", category: "Lists & navigation", tier: "medium",
    prompt: `Build a product catalog with NavigationStack. Main screen: list of products with image placeholder, name, price, and rating stars. Tap for detail: large image area, name, price, description, rating, and Add to Favorites button. Favorites screen accessible from toolbar. Search and filter by price range. Sort by price or rating. Persist favorites with Codable + UserDefaults.` },
  { title: "Pomodoro timer", category: "Timers", tier: "medium",
    prompt: `Build a Pomodoro timer with session tracking. Main screen: circular timer with work/break phases. Configurable: work duration (15\u201360 min), short break (3\u201310 min), long break (15\u201330 min), sessions before long break. Start/Pause/Skip controls. Session counter (e.g. 3/4). Today\u2019s stats: completed pomodoros, total focus time. History tab: daily summaries for past 7 days. Persist with Codable + UserDefaults.` },
  { title: "Tab bar app", category: "Lists & navigation", tier: "medium",
    prompt: `Build a 3-tab app with proper navigation. Tab 1 (Home): dashboard with summary cards. Tab 2 (Browse): searchable list with NavigationStack to detail screens. Tab 3 (Profile): profile view with settings. Badge on Browse tab showing item count. Proper back navigation within each tab. Consistent styling across tabs. Persist minimal state with UserDefaults.` },
  { title: "Finance dashboard", category: "Charts & data", tier: "hard",
    prompt: `Build a personal finance dashboard with Swift Charts. One screen: a bar chart showing income vs spending for the last 7 days (use sample data like 3 income and 4 spending values). Below the chart, a list of recent transactions (title and amount, positive green and negative red). At the top, a savings goal progress view (e.g. "$200 / $1000"). Use SwiftUI Chart for the bar chart. Keep data in memory or a simple model.` },
  { title: "Flashcard app", category: "Misc", tier: "medium",
    prompt: `Build a flashcard study app with decks. Main screen: list of decks with card count and mastery percentage. Tap deck to study: card view with 3D flip animation (question \u2192 answer). Buttons: Know It, Still Learning, Skip. Progress bar during study session. Results screen: cards mastered vs needs review. Edit deck: add/edit/delete cards. Create new deck sheet with name and color. Import cards from text. Persist with Codable + UserDefaults.` },
  { title: "Onboarding flow", category: "UI states", tier: "medium",
    prompt: `Build a 5-screen onboarding with progress. Horizontal paging with page indicator dots and progress bar. Each page: illustration placeholder, title, subtitle. Page 3: permission prompt (notifications toggle). Page 4: preference picker (choose interests from a grid). Last page: Get Started and Skip buttons. Animated transitions between pages. Remember completion state in UserDefaults so onboarding only shows once.` },
  { title: "Camera placeholder", category: "Placeholders", tier: "medium",
    prompt: `Build a camera app placeholder. Main screen: viewfinder area (dark rectangle) with capture button, flash toggle, and camera flip button. Gallery strip at bottom showing last 3 captures (colored placeholders). Capture creates a new placeholder with timestamp. Gallery screen: grid of all captures with date sections. Detail view: full-screen with share, delete, and info (date, size placeholder). Filters preview strip (Original, B&W, Sepia, Vivid).` },
  { title: "Habit streak", category: "Design", tier: "hard",
    prompt: `Build a habit tracker with Liquid Glass design. One screen: a list of habits (e.g. Exercise, Read, Meditate). Each habit is a card showing its name, current streak count, and a "Check in" button. Use iOS 26 and .glassEffect() on the cards. When the user taps Check in, animate the update and increment the streak. Store streaks in memory or UserDefaults. Include an option to add a new habit.` },
];

const M2_EASY_TITLES: Array<[string, string]> = [
  ["Quick links + WKWebView", "WebKit"],
  ["Todo list", "Persistence"],
  ["Notes app", "Persistence"],
  ["Mood tracker", "Persistence"],
  ["Habit checklist", "Persistence"],
  ["Minimal expense log", "Persistence"],
  ["Countdown timer", "Timers"],
  ["Stopwatch", "Timers"],
  ["Pomodoro timer", "Timers"],
  ["Filterable list", "Lists & navigation"],
  ["Tab bar app", "Lists & navigation"],
  ["List-to-detail (NavigationStack)", "Lists & navigation"],
  ["Grid layout", "Lists & navigation"],
  ["Pull-to-refresh", "Lists & navigation"],
  ["Feedback form", "Forms & pickers"],
  ["Picker", "Forms & pickers"],
  ["Slider", "Forms & pickers"],
  ["Toggle list", "Forms & pickers"],
  ["Color picker", "Calculators & tools"],
  ["Dice roller", "Calculators & tools"],
  ["Tip calculator", "Calculators & tools"],
  ["BMI calculator", "Calculators & tools"],
  ["Onboarding flow", "UI states"],
  ["Modal sheet", "UI states"],
  ["Dark mode", "Accessibility"],
  ["Share sheet", "Accessibility"],
  ["Skeleton loading", "Placeholders"],
  ["Card with shadow", "Design"],
  ["Gradient background", "Design"],
  ["Flashcard app", "Misc"],
];

const M3_MEDIUM_TITLES: Array<[string, string]> = [
  ["Todo list", "Persistence"],
  ["Minimal expense log", "Persistence"],
  ["Rating tracker", "Persistence"],
  ["Recipe card", "Persistence"],
  ["Packing list", "Persistence"],
  ["3-goals app", "Persistence"],
  ["Pomodoro timer", "Timers"],
  ["Tab bar app", "Lists & navigation"],
  ["List-to-detail (NavigationStack)", "Lists & navigation"],
  ["Flashcard app", "Misc"],
];

const M3_HIG_IDEAS: MilestoneIdea[] = [
  { title: "iOS Settings Clone (Form + Navigation)", category: "HIG Showcase", tier: "medium",
    prompt: "Build a pixel-perfect clone of the iOS Settings app structure. Use Form with Section headers, NavigationStack for drill-down, Toggle for booleans, Picker for enums, and .listStyle(.insetGrouped). Include at least 5 sections: General (About, Software Update), Display & Brightness (dark mode toggle, text size slider), Sounds (volume slider, toggles), Notifications (per-app toggles), and Privacy (location, contacts toggles). Each section should drill into a detail screen. Use semantic colors throughout \u2014 no hardcoded colors. Support Dynamic Type and dark mode." },
  { title: "App Onboarding Flow (Multi-step + Animation)", category: "HIG Showcase", tier: "medium",
    prompt: "Build a beautiful 4-step onboarding flow for a fictional wellness app. Step 1: Welcome with animated gradient background and large hero text. Step 2: Feature highlights with 3 cards that animate in with staggered spring animations. Step 3: Notification permission request with a clear value proposition and SF Symbol illustration. Step 4: Name input with Form styling and a primary CTA. Include a page indicator, skip button, and smooth TabView-based transitions. Use .spring() animations, semantic colors, and ensure full dark mode support." },
  { title: "Contact Form (Validation + Accessibility)", category: "HIG Showcase", tier: "easy",
    prompt: "Build a polished contact form with fields for name, email, phone, subject (Picker), and message (TextEditor). Implement inline validation: red caption text below invalid fields (empty name, invalid email format, message too short). Show a character counter for the message field. The Submit button should be .borderedProminent, disabled until all fields are valid, and show a ProgressView while 'sending' (simulated 2-second delay). On success, show an inline checkmark animation \u2014 not an alert. Every field must have proper .textContentType and .keyboardType. Add .accessibilityLabel to all controls." },
  { title: "Analytics Dashboard (Cards + Charts + States)", category: "HIG Showcase", tier: "hard",
    prompt: "Build an analytics dashboard with a polished card-based layout. Top row: 3 metric cards (total users, revenue, conversion rate) with large .largeTitle numbers, trend arrows (green up / red down SF Symbols), and .caption comparison text. Middle: a line chart (Swift Charts) showing 30 days of data. Bottom: a List of recent events with swipe actions. Include 3 states: loading (skeleton shimmer using .redacted), empty (ContentUnavailableView), and populated. Use .cardStyle() with shadows, 16pt padding, and rounded corners. Pull-to-refresh on the whole ScrollView. Full dark mode and Dynamic Type support." },
  { title: "Notes App (Master-Detail + Search + Delete)", category: "HIG Showcase", tier: "medium",
    prompt: "Build a notes app demonstrating HIG navigation patterns. Sidebar/list: NavigationStack with .searchable, sorted by date. Each row shows title (.headline), preview (.subheadline, .secondary), and date (.caption). Swipe-to-delete with .confirmationDialog confirmation. Detail view: editable TextEditor with .navigationTitle set to the note title. Toolbar: share button, delete button (with destructive alert confirmation), and a 'New Note' button. Empty state: ContentUnavailableView with pencil.line SF Symbol. Persist with UserDefaults + Codable. Animate list insertions with .spring(). Dark mode and accessibility labels throughout." },
];

const M6_INTEGRATION: MilestoneIdea[] = [
  { title: "Apple Music Playlist Creator", category: "MusicKit", tier: "hard",
    prompt: "Build an app where I type a mood or artist name and it creates a 30 minute Apple Music playlist. Show the songs before adding to my library. Handle the case where Apple Music is not available or permission is denied." },
  { title: "Weather Dashboard", category: "WeatherKit", tier: "hard",
    prompt: "Build a weather dashboard that shows current conditions, hourly forecast, and a 7 day forecast for my current location. Cache the data for 30 minutes. Show a helpful message if location permission is denied." },
  { title: "Run Route Tracker", category: "HealthKit + CoreLocation", tier: "hard",
    prompt: "Build a run tracking app that records my GPS route on a map and saves the workout to HealthKit including distance, duration, and calories. Show a permission explanation before requesting access. Handle denied permissions gracefully." },
  { title: "Sleep Summary", category: "HealthKit", tier: "hard",
    prompt: "Build an app that reads my last 7 days of sleep data from HealthKit and shows a summary with average sleep duration, a chart of sleep per night, and a sleep quality score. Request only the health data types actually needed." },
  { title: "Nearby Coffee Map", category: "MapKit + CoreLocation", tier: "medium",
    prompt: "Build an app that shows a map of nearby coffee shops using MapKit. Show custom pins, allow filtering by distance, and show a detail card when I tap a pin. Handle location permission denial with a helpful message." },
  { title: "Sign in with Apple Demo", category: "Sign in with Apple", tier: "medium",
    prompt: "Build a complete sign in with Apple flow with a welcome screen, Apple sign in button, and a home screen that shows the user name and email after signing in. Include a sign out button. Handle errors gracefully." },
  { title: "Live Text Scanner", category: "VisionKit + AVFoundation", tier: "hard",
    prompt: "Build an app that uses the camera to scan and extract text from documents in real time using VisionKit DataScanner. Show extracted text below the camera view. Allow copying the text. Request camera permission with a clear explanation." },
  { title: "Offline Notes with Sync", category: "Core Data + CloudKit", tier: "hard",
    prompt: "Build a notes app that saves notes locally using Core Data and syncs them to iCloud. Show a sync status indicator. Work fully offline when iCloud is unavailable. Include title and body for each note." },
  { title: "Notification Scheduler", category: "UserNotifications", tier: "medium",
    prompt: "Build an app where I can schedule daily reminder notifications at a time I choose. Show all scheduled notifications in a list. Allow deleting them. Request notification permission with a clear explanation of why notifications are needed." },
  { title: "NFC Tag Reader", category: "CoreNFC", tier: "hard",
    prompt: "Build an app that reads NFC tags and displays the tag content on screen. Show a scan button that triggers the NFC reader. Display a history of recently scanned tags. Handle the case where NFC is not available on the device." },
];

/** M7: Regression — 40 test cases tied to specific error patterns we fixed. Verifies system prompt improvements. */
const M7_REGRESSION: MilestoneIdea[] = [
  { title: "Flashcard deck with bindings", category: "Persistence (UserDefaults)", tier: "medium",
    prompt: "Build a flashcard app with decks. Main screen: list of decks; tap a deck to see cards. Add/edit cards in a sheet that takes a Binding to the deck's cards array. Persist with Codable + UserDefaults." },
  { title: "Event list with semantic colors", category: "Lists & navigation", tier: "medium",
    prompt: "Build an event list app. One screen: list of events in an inset grouped list. Use semantic list row backgrounds (e.g. secondary fill) and an accent color for the leading icon. Do not use Color.quaternary; use system semantic colors that work in both light and dark mode." },
  { title: "Camera placeholder with permission", category: "Camera", tier: "medium",
    prompt: "Build a simple camera app. One screen: a \"Open camera\" button. When tapped, request camera permission; if granted show a placeholder view (dark rectangle with \"Camera active\"); if denied show \"Camera access denied\". Include the required plist usage description." },
  { title: "Music journal (ShazamKit-style)", category: "Music recognition (ShazamKit)", tier: "medium",
    prompt: "Build a music journal: recognize a song with ShazamKit, let the user tag the mood (happy/chill/energy), and save. Show mood filters and a list of saved entries. Use a single pending-entry state for the current recognition; do not declare the same property name twice in the ViewModel." },
  { title: "Workout Live Activity (Intent in extension)", category: "Live Activities (ActivityKit)", tier: "medium",
    prompt: "Build a workout timer that starts a Live Activity showing elapsed time and rep count. Main app: start/stop and target. Live Activity: compact and expanded layouts. Use AppIntentConfiguration or a timeline provider; if you use an App Intent, define it in the WidgetExtension folder so the widget target can see it." },
  { title: "Delivery tracker Live Activity", category: "Live Activities (ActivityKit)", tier: "medium",
    prompt: "Build a delivery tracker that starts a Live Activity for an active delivery (ETA, status, progress). App screen: create a mock delivery and update status. Live Activity updates in real time. Define the activity attributes type so both the app and the WidgetExtension can use it (e.g. in a file the extension can see)." },
  { title: "Voice memo placeholder", category: "Audio / Microphone", tier: "medium",
    prompt: "Build a simple voice memo app. One screen: a \"Start recording\" button. When tapped, request microphone permission; if granted show a placeholder \"Recording...\" view; if denied show \"Microphone access denied\". Include the required plist usage description for the microphone." },
  { title: "Photo picker with permission", category: "Photos / Photo Library", tier: "medium",
    prompt: "Build a simple app that lets the user pick a photo from their library. One screen: a \"Choose photo\" button. When tapped, request photo library permission if needed, then present a photo picker (PHPickerViewController or PhotosPicker). Show the selected image or a placeholder. Include the required plist usage description for the photo library." },
  { title: "Settings screen with modern APIs", category: "Lists & navigation", tier: "medium",
    prompt: "Build a settings screen with NavigationStack (not NavigationView). Use .navigationTitle for the bar title and .foregroundStyle for text and icon colors. No .foregroundColor or .navigationBarTitle. List of 3 sections with toggles and navigation links. Target iOS 17+." },
  { title: "Async data load in view", category: "Async", tier: "medium",
    prompt: "Build a single screen that loads a list of items from an async function (e.g. Task { await fetchItems() }). Show ProgressView while loading and the list when done. The fetch is async; call it from the view using .task or Task { }. Do not call the async function without await." },
  { title: "Voice input placeholder", category: "Speech Recognition", tier: "medium",
    prompt: "Build a simple app with a \"Start listening\" button. When tapped, request speech recognition permission; if granted show a placeholder \"Listening...\" view; if denied show \"Speech recognition denied\". Include the required plist usage description for speech recognition." },
  { title: "Contact picker with permission", category: "Contacts", tier: "medium",
    prompt: "Build a simple app with a \"Choose contact\" button. When tapped, request contacts permission; if granted present a contact picker (CNContactPickerViewController) or list; if denied show \"Contacts access denied\". Include the required plist usage description for contacts." },
  { title: "BLE scanner placeholder", category: "Bluetooth (CoreBluetooth)", tier: "medium",
    prompt: "Build a simple app with a \"Scan for devices\" button. When tapped, ensure Bluetooth usage is documented (REQUIRES PLIST comment for NSBluetoothAlwaysUsageDescription). Show a placeholder list of devices or \"Scanning...\". Handle the case when Bluetooth is off. Do not assume Bluetooth is available." },
  { title: "Savings goal progress (numeric only)", category: "UI / Progress", tier: "medium",
    prompt: "Build a single screen with a savings goal: ProgressView showing current/target (e.g. 200.0 / 1000.0 as Double). Below it show the same as text (e.g. \"$200 / $1000\"). Use Double for ProgressView(value:total:); format to String only for the Text label. Do not pass a String into ProgressView." },
  { title: "List of identifiable items", category: "Lists & navigation", tier: "medium",
    prompt: "Build a list screen showing 5 items. Each item has a unique id (UUID or Int). Use ForEach with the collection and provide id: \\.id because the item type conforms to Identifiable. Tapping an item navigates to detail. Do not pass a Binding where a plain array is expected." },
  { title: "Sheet with item binding", category: "UI states", tier: "medium",
    prompt: "Build a screen with a list of 3 items. Tapping an item presents a sheet showing that item's detail. Use .sheet(item: $selectedItem) where selectedItem is Optional (Item?) and Item conforms to Identifiable. Dismiss by setting selectedItem = nil. Do not use a non-optional binding for .sheet(item:)." },
  { title: "Weather dashboard with cache", category: "WeatherKit", tier: "medium",
    prompt: "Build a weather dashboard showing current conditions and 3-day forecast. Use WeatherKit. Cache the response for at least 30 minutes; do not call the weather API on every view appearance or in the view body. Check cache before issuing a new request." },
  { title: "Settings sliders", category: "Forms & pickers", tier: "medium",
    prompt: "Build a settings screen with a Slider(0...100) for volume and a Stepper for count. Use @State Double for the slider and @State Int for the stepper; pass Binding to Slider and Stepper. Do not use String or a non-binding value. Show the current values as text." },
  { title: "Login form (TextField binding)", category: "Forms & pickers", tier: "medium",
    prompt: "Build a simple login form: two text fields (email, password) and a Submit button. Use @State String for each field and pass Binding<String> to TextField and SecureField. Do not use Binding<Int> or a non-String binding. Show the submitted values in an alert." },
  { title: "Picker with enum selection", category: "Forms & pickers", tier: "medium",
    prompt: "Build a form with a Picker for \"Priority\" (Low, Medium, High). Use an enum conforming to String and CaseIterable; selection binding is Binding<Priority?>. Use ForEach(Priority.allCases, id: \\.self) or Picker with tag(priority) so the selection type matches. Do not mix Int tags with String binding." },
  { title: "Long form with scroll", category: "Layout", tier: "medium",
    prompt: "Build a settings-style form with 8 sections (each with 2–3 rows). Wrap the entire form in a ScrollView so it scrolls on small devices. Do not use a fixed height that would clip content. Use Form or List inside ScrollView if appropriate, or VStack in ScrollView." },
  { title: "NFC tag reader placeholder", category: "CoreNFC", tier: "medium",
    prompt: "Build a simple NFC reader app. Before starting a session, check NFCTagReaderSession.readingAvailable. If false, show \"NFC is not available on this device\" (e.g. on simulator). If true, show a \"Scan\" button that starts the session. Include REQUIRES PLIST for NFCReaderUsageDescription." },
  { title: "Event date picker", category: "Forms & pickers", tier: "medium",
    prompt: "Build a form with a date picker for \"Event date\". Use @State var eventDate: Date = Date() and pass $eventDate to DatePicker. Do not use a String for the selection. Show the selected date as formatted text below. Include a time picker if appropriate." },
  { title: "Step count only (HealthKit)", category: "HealthKit", tier: "medium",
    prompt: "Build an app that reads only step count from HealthKit. Request authorization only for step count (HKQuantityType.quantityType(forIdentifier: .stepCount)); do not request read for all quantity types. Show today's steps and handle denied/unavailable. Include REQUIRES PLIST and capability warning in summary." },
  { title: "Weather with shared service", category: "WeatherKit", tier: "medium",
    prompt: "Build a weather screen that shows current conditions. Use WeatherService.shared (or a single shared instance) for the request; do not create a new WeatherService in the view or on every request. Cache the result for 30 minutes. Show a loading state and handle errors." },
  { title: "Destructive action alert", category: "Alerts & confirmations", tier: "medium",
    prompt: "Build a screen with a \"Delete\" button. When tapped, show an .alert with a clear title (String), message (String), and two buttons: \"Cancel\" (role: .cancel) and \"Delete\" (role: .destructive). Do not pass a View as the alert title. Dismiss on Cancel; perform delete on Delete." },
  { title: "Remote image list", category: "Loading / Images", tier: "medium",
    prompt: "Build a list of 5 items, each with a title and a remote image URL (use placeholder URLs like https://picsum.photos/100). Use AsyncImage for each image with a placeholder (ProgressView) and a failure view (e.g. Image(systemName: \"photo\")). Do not load images synchronously in the view body." },
  { title: "Settings sync (iCloud KVS)", category: "CloudKit / iCloud", tier: "medium",
    prompt: "Build a settings screen that syncs a toggle and a text preference to iCloud using NSUbiquitousKeyValueStore. When reading, check if the key exists and provide a default value; do not assume object(forKey:) returns a non-nil value. Handle iCloud unavailable. Include capability warning in summary." },
  { title: "ViewModel with stable dependency", category: "Architecture", tier: "medium",
    prompt: "Build a screen that uses a ViewModel (ObservableObject) as @StateObject. The ViewModel takes a stable dependency (e.g. a constant config or store). Do not pass a value that changes on every view redraw (e.g. a new array or id) into the @StateObject initializer—use a constant or inject once. Show data from the ViewModel." },
  { title: "List with toolbar actions", category: "Navigation", tier: "medium",
    prompt: "Build a list screen with a .navigationTitle and a .toolbar containing a \"Add\" button (ToolbarItem(placement: .primaryAction)) and an \"Edit\" button. Do not put a NavigationStack or a full view inside the toolbar—only buttons or menus. Tapping Add shows a sheet." },
  { title: "Location display (single manager)", category: "CoreLocation", tier: "medium",
    prompt: "Build a screen that shows the current location (latitude/longitude). Use a single CLLocationManager instance (e.g. @StateObject wrapper or retained in a view model). Set the delegate once and request authorization before starting updates. Do not create a new CLLocationManager on every view redraw. Include REQUIRES PLIST for location." },
  { title: "List with context menu", category: "Lists & Tables", tier: "medium",
    prompt: "Build a list of 5 items. Each row has a .contextMenu with two actions: \"Edit\" and \"Delete\". Use Button(\"Edit\") and Button(\"Delete\", role: .destructive) inside the context menu. Do not put a NavigationStack or a full view inside the context menu—only action buttons. Tapping Edit shows a sheet; Delete removes the item." },
  { title: "Form with Observable model", category: "Architecture", tier: "medium",
    prompt: "Build a form screen using @Observable for the model (iOS 17+). The model has a name: String and isComplete: Bool. In a child view, use @Bindable(model) and pass $model.name to a TextField and $model.isComplete to a Toggle. Do not pass $model where a Binding<String> or Binding<Bool> is expected. Show the values in the parent." },
  { title: "Step count with single store", category: "HealthKit", tier: "medium",
    prompt: "Build an app that reads step count from HealthKit. Use one HKHealthStore instance (e.g. @StateObject or shared). Request authorization for step count only (read). Check isHealthDataAvailable() before use. Do not create a new HKHealthStore on every view update. Include REQUIRES PLIST and capability warning." },
  { title: "Add songs to playlist (MusicKit)", category: "MusicKit", tier: "medium",
    prompt: "Build an app that searches for songs with MusicKit and lets the user add selected songs to a new playlist. Use MusicLibrary.shared.createPlaylist and add(song, to: playlist). Only add Song items that have a non-empty id; skip or filter out any result with an empty identifier. Include authorization and REQUIRES PLIST. Warn about MusicKit capability in summary." },
  { title: "Filter with onChange", category: "UI state", tier: "medium",
    prompt: "Build a screen with a TextField and a label that shows the character count. Use .onChange(of: text) { oldValue, newValue in } (iOS 17+) to update the count when text changes. Use the correct closure signature (two parameters for iOS 17+). Do not use the wrong parameter count or types." },
  { title: "Full-screen detail cover", category: "UI states", tier: "medium",
    prompt: "Build a list of 5 items. Tapping an item presents a full-screen cover (not a sheet) showing that item's detail. Use .fullScreenCover(item: $selectedItem) where selectedItem is Item? and Item conforms to Identifiable. Provide a \"Close\" button that sets selectedItem = nil. Do not use a non-optional binding." },
  { title: "Map with region binding", category: "MapKit", tier: "medium",
    prompt: "Build a screen with an MKMapView wrapped in UIViewRepresentable. The map region is driven by @State (e.g. center and span). Implement both makeUIView(context:) and updateUIView(_:context:) so that when the state changes, the map's region updates. Do not leave updateUIView empty. Include location permission if showing user location." },
  { title: "Weather with optional forecast", category: "WeatherKit", tier: "medium",
    prompt: "Build a weather screen that shows current conditions and, if available, the first day of the daily forecast. Use WeatherKit and cache for 30 minutes. When reading the response, treat dailyForecast (or similar) as optional—use optional binding or nil-coalescing; do not force-unwrap optional properties. Handle the case when daily forecast is nil. Include capability/plist as needed." },
  { title: "Searchable list", category: "Lists & navigation", tier: "medium",
    prompt: "Build a list screen with a search bar. Use .searchable(text: $searchText) where searchText is @State String. Filter the list based on searchText. Do not pass a Binding<Int> or a non-String binding to searchable(text:). Show filtered results as the user types." },
];

const M5_WOW: MilestoneIdea[] = [
  { title: "Push-up Counter (Camera + Pose)", category: "Body pose (Vision)", tier: "hard",
    prompt: "Build a push-up counter that uses the front camera and Vision human body pose estimation. Phone is placed in front of the user. Show a FaceTime-style preview, a huge rep counter readable from 6\u20138 feet, and a flip-camera button. Count reps by tracking a stable metric (e.g. shoulder/hip vertical position or elbow angle) with smoothing, hysteresis thresholds, and a rep state machine (down -> up + cooldown). Include on-screen guidance if the body isn't fully visible. Add tabs: Session (live), History (by day), Goals (daily target with progress bar). Persist history/goals with Codable + UserDefaults. Include camera permission handling." },
  { title: "Squat Coach (Depth + form cues)", category: "Body pose (Vision)", tier: "hard",
    prompt: "Build a squat coach using Vision body pose. Show a live preview, count reps, and provide simple form cues (e.g. 'go lower', 'stand tall') based on hip and knee angles. Include a calibration step and a sensitivity slider. Persist rep history and show a weekly summary." },
  { title: "Gesture Remote (Play/Pause with hand pose)", category: "Hand pose (Vision)", tier: "hard",
    prompt: "Build a gesture remote that uses the front camera and Vision hand pose to detect an open palm vs fist gesture. Use this to toggle a simple in-app media playback demo (play/pause a bundled sound). Show live camera preview and a gesture confidence label. Include a tutorial screen explaining lighting and positioning." },
  { title: "Blink Reminder (Face landmarks)", category: "Face landmarks (Vision)", tier: "hard",
    prompt: "Build a blink reminder app that uses the front camera and Vision face landmarks to estimate blink rate. Show a live preview, blink count per minute, and a gentle reminder if blink rate drops below a threshold. Include a calibration step, and a privacy-first explanation. Persist daily blink stats." },
  { title: "AR Measure Lite", category: "AR (ARKit)", tier: "hard",
    prompt: "Build an AR measuring app using ARKit + RealityKit. Detect planes, tap to place two points, show distance. Include UI to reset and switch units. Add a 'device required' state for simulator." },
  { title: "Song ID (ShazamKit)", category: "Music recognition", tier: "hard",
    prompt: "Build a Song ID app using ShazamKit. One screen: big 'Listen' button, mic permission handling, and results view with song title/artist/artwork if available. Keep a history list. Include notes about simulator limitations." },
  { title: "Shader Playground (MetalKit)", category: "GPU rendering", tier: "hard",
    prompt: "Build a simple MetalKit shader playground that renders an animated gradient/noise fragment shader. Provide sliders for speed and color. Include an explanation and fallback if Metal isn't available." },
  { title: "Filter Lab (Core Image)", category: "Image processing", tier: "hard",
    prompt: "Build a photo filter lab: pick a photo, apply Core Image filters (B&W, sepia, bloom, vignette, sharpen) with sliders, and export. Include before/after toggle and presets." },
  { title: "Voice Journal (Speech to text)", category: "Speech recognition", tier: "hard",
    prompt: "Build a voice journal app that records audio and transcribes to text using Speech framework. Provide mic permission handling, recording UI, live partial transcription, and a saved entries list. Persist entries and optionally keep audio files." },
  { title: "Haptic Metronome", category: "Haptics", tier: "medium",
    prompt: "Build a haptic metronome using Core Haptics. Let the user set BPM (40\u2013200) and choose patterns (tap, double, accent). Provide start/stop and a visual beat indicator. Include graceful fallback if haptics aren't supported." },
];

function buildM2Easy(): MilestoneIdea[] {
  const result: MilestoneIdea[] = [];
  for (const [title, cat] of M2_EASY_TITLES) {
    const found = easyByTitle(title, cat);
    if (found) result.push(found);
  }
  return result;
}

function buildM3Medium(): MilestoneIdea[] {
  const mediumApps: MilestoneIdea[] = [];
  for (const [title, cat] of M3_MEDIUM_TITLES) {
    const found = mediumByTitle(title, cat);
    if (found) mediumApps.push(found);
  }
  return [...M3_HIG_IDEAS, ...mediumApps];
}

function loadSeedJsonIdeas(): MilestoneIdea[] {
  const seedPath = join(process.cwd(), "CAPABILITY_IDEAS", "seed.json");
  if (!existsSync(seedPath)) return [];
  try {
    const data = JSON.parse(readFileSync(seedPath, "utf8")) as {
      capabilities: Array<{
        folder: string;
        ideas: Array<{ title: string; prompt: string; tier: "easy" | "medium" | "hard" }>;
      }>;
    };
    const ideas: MilestoneIdea[] = [];
    for (const cap of data.capabilities) {
      for (const idea of cap.ideas) {
        ideas.push({
          title: idea.title,
          prompt: idea.prompt,
          category: cap.folder,
          tier: idea.tier,
        });
      }
    }
    return ideas;
  } catch {
    return [];
  }
}

export const MILESTONE_IDS = ["m1-baseline", "m2-easy", "m3-medium", "m4-hard", "m5-wow", "m6-integration", "m7-regression"] as const;
export type MilestoneId = (typeof MILESTONE_IDS)[number];

const MILESTONE_META: Record<MilestoneId, Omit<MilestoneConfig, "ideas">> = {
  "m1-baseline":    { id: "m1-baseline",    label: "M1: Baseline",    shortLabel: "Baseline",    description: "10 representative apps to verify the pipeline works", target: 70 },
  "m2-easy":        { id: "m2-easy",        label: "M2: Easy",        shortLabel: "Easy",        description: "30 single-screen apps covering all basic patterns", target: 90 },
  "m3-medium":      { id: "m3-medium",      label: "M3: Medium",      shortLabel: "Medium",      description: "15 multi-screen apps + HIG showcase", target: 80 },
  "m4-hard":        { id: "m4-hard",        label: "M4: Hard",        shortLabel: "Hard",        description: "All seed.json framework-specific apps", target: 70 },
  "m5-wow":         { id: "m5-wow",         label: "M5: Wow",         shortLabel: "Wow",         description: "10 impressive demo apps (Vision, AR, Metal, etc.)", target: 60 },
  "m6-integration": { id: "m6-integration", label: "M6: Integration", shortLabel: "Integration", description: "10 integration apps: compile + permission strings + portal warnings + requestAuth + error handling", target: 70 },
  "m7-regression":   { id: "m7-regression",   label: "M7: Regression", shortLabel: "Regression",   description: "40 apps tied to specific error patterns we fixed; verifies system prompt improvements", target: 90 },
};

export function getMilestonePrompts(id: MilestoneId): MilestoneConfig {
  const meta = MILESTONE_META[id];
  switch (id) {
    case "m1-baseline":    return { ...meta, ideas: M1_BASELINE };
    case "m2-easy":        return { ...meta, ideas: buildM2Easy() };
    case "m3-medium":      return { ...meta, ideas: buildM3Medium() };
    case "m4-hard":        return { ...meta, ideas: loadSeedJsonIdeas() };
    case "m5-wow":         return { ...meta, ideas: M5_WOW };
    case "m6-integration": return { ...meta, ideas: M6_INTEGRATION };
    case "m7-regression":   return { ...meta, ideas: M7_REGRESSION };
  }
}

export function getAllMilestones(): Array<Omit<MilestoneConfig, "ideas"> & { count: number }> {
  return MILESTONE_IDS.map((id) => {
    const config = getMilestonePrompts(id);
    return { ...MILESTONE_META[id], count: config.ideas.length };
  });
}

/**
 * 100 concise app ideas for testing Vibetree Pro builds, organized by technology.
 * Used by the "Mystery app" button and APP_IDEAS_100/*.md (see scripts/generate-app-ideas.mjs).
 */
export type AppIdea = { title: string; prompt: string };

export const APP_IDEAS_BY_CATEGORY: Record<string, AppIdea[]> = {
  "WebKit & in-app browser": [
    { title: "Quick links + WKWebView", prompt: "Build a quick links app. List of saved links with titles; tap opens a second screen with WKWebView (UIViewRepresentable) loading that URL. Nav bar with back. 2–3 default links. Store in UserDefaults; allow adding link (title + URL)." },
    { title: "Read-later + in-app browser", prompt: "Build a read-later app. List of saved URLs; tap one to open in an in-app WKWebView with a back button. Add new URL (title + URL). Persist in UserDefaults." },
    { title: "Bookmarks list", prompt: "Build a bookmarks app. One screen: list of title + URL (no in-app browser). Add and delete. Persist in UserDefaults." },
    { title: "Link-in-bio", prompt: "Build a link-in-bio app. One screen: profile name and 3 link buttons (title + URL). Tapping opens URL in Safari. Clean." },
    { title: "Open URL in Safari", prompt: "Build an open URL screen. One screen: one button “Open Apple”; tap to open https://apple.com in Safari." },
    { title: "In-app Safari / WKWebView", prompt: "Build an in-app Safari screen. One screen: SFSafariViewController or WKWebView loading https://apple.com and a Close button." },
  ],
  "Persistence (UserDefaults)": [
    { title: "Daily quote or goal", prompt: "Build a daily quote or goal app. One screen: text field and Save button at top; below, show the saved quote in large typography. If none, show “Set your daily focus above.” Persist in UserDefaults. Minimal layout." },
    { title: "Simple counter", prompt: "Build a simple counter app. One screen: large number and a + button. Persist the count in UserDefaults so it survives restarts. Clean, minimal." },
    { title: "Todo list", prompt: "Build a todo list app. One screen: text field to add a task, a list of tasks with delete, and persist the list in UserDefaults." },
    { title: "Shopping list", prompt: "Build a shopping list app. Add items, tap to remove or check off. Persist in UserDefaults. Single screen, clean list." },
    { title: "Mood tracker", prompt: "Build a mood tracker. One screen: pick today’s mood (e.g. 5 emoji buttons), save with date, show last 7 entries in a list. Persist in UserDefaults." },
    { title: "Notes app", prompt: "Build a notes app. One screen: list of note titles; tap to see/edit one note. Add and delete notes. Persist in UserDefaults." },
    { title: "Gratitude list", prompt: "Build a gratitude app. One screen: add up to 3 things you’re grateful for today; show them in a list. Persist in UserDefaults. Minimal." },
    { title: "Habit checklist", prompt: "Build a habit checklist for today. One screen: 3–5 habits with checkboxes. Tapping toggles; persist state in UserDefaults. Reset daily or keep history." },
    { title: "Minimal expense log", prompt: "Build a minimal expense log. One screen: add amount and label; list recent entries. Persist in UserDefaults. Simple." },
    { title: "Water intake tracker", prompt: "Build a water intake tracker. One screen: + button to add a glass, show “X glasses today” and a simple goal. Persist in UserDefaults." },
    { title: "Sleep log", prompt: "Build a sleep log app. One screen: log hours slept (picker or field), show list of last 7 nights. Persist in UserDefaults." },
    { title: "Focus word", prompt: "Build a focus word app. One screen: text field to set “word of the day”, Save, and show it large below. Persist in UserDefaults." },
    { title: "Rating tracker", prompt: "Build a rating tracker. One screen: add item name and 1–5 stars; show list of rated items. Persist in UserDefaults." },
    { title: "Quick contacts", prompt: "Build a quick contacts list. One screen: list of name + phone (label). Add and delete. Persist in UserDefaults." },
    { title: "Recipe card", prompt: "Build a recipe card app. One screen: recipe title and a list of ingredients (editable). Persist in UserDefaults. One recipe for MVP." },
    { title: "Packing list", prompt: "Build a packing list app. One screen: checklist of items; add and tap to check. Persist in UserDefaults." },
    { title: "Wishlist", prompt: "Build a wishlist app. One screen: list of items (add/delete). Persist in UserDefaults. Simple list." },
    { title: "3-goals app", prompt: "Build a 3-goals app. One screen: three text fields for goals and Save. Show them below. Persist in UserDefaults." },
    { title: "One-line journal", prompt: "Build a one-line journal. One screen: date picker and one text field for today’s entry. Save and show last entry. Persist in UserDefaults." },
    { title: "Single-metric tracker", prompt: "Build a single-metric tracker. One screen: one metric name and a number; + and - buttons. Persist in UserDefaults." },
    { title: "Quick notes", prompt: "Build a quick notes app. One screen: list of one-line notes; add and delete. Persist in UserDefaults." },
    { title: "Minimal profile", prompt: "Build a minimal profile app. One screen: name and email (placeholder). Edit button that toggles edit mode. Persist in UserDefaults." },
    { title: "Settings toggles", prompt: "Build a settings screen. One screen: two toggles (e.g. Notifications, Dark mode). Persist in UserDefaults." },
    { title: "Swipe-to-delete list", prompt: "Build a swipe-to-delete list. One screen: list of 5 items; swipe to delete. Persist in UserDefaults." },
  ],
  "Timers & time": [
    { title: "Countdown timer", prompt: "Build a countdown timer app. One screen: pick minutes, Start button, and a large countdown display. When it hits zero, show an alert. Simple and clear." },
    { title: "Stopwatch", prompt: "Build a stopwatch app. Start, Stop, Reset, and a lap list. Show elapsed time in large type. Minimal layout." },
    { title: "Countdown to date", prompt: "Build a countdown app. Pick a future date; show “X days until” that date. One screen, large number." },
    { title: "Big clock", prompt: "Build a big clock app. One screen: current time in very large type, updating every second. Optional: date below. Minimal." },
    { title: "Pomodoro timer", prompt: "Build a Pomodoro timer. One screen: 25-minute work timer, 5-minute break. Start/Pause and a simple state label. Minimal." },
    { title: "Lap timer", prompt: "Build a lap timer. One screen: Start, Lap, Stop; show list of lap times. Simple list." },
  ],
  "Lists & navigation": [
    { title: "Filterable list", prompt: "Build a filterable list. One screen: search bar and a list of 10 items; typing filters the list. Simple." },
    { title: "Segmented content", prompt: "Build a segmented content app. One screen: segmented control (e.g. A | B); show different content per segment. Two simple views." },
    { title: "Tab bar app", prompt: "Build a tab bar app. Two tabs; first shows a list, second shows a placeholder view. Standard tab bar." },
    { title: "Sectioned list", prompt: "Build a sectioned list. One screen: list with two section headers and a few rows each. Static content." },
    { title: "Card list", prompt: "Build a card list. One screen: 5 cards with placeholder image and title. Tapping shows alert. List or grid." },
    { title: "List-to-detail (NavigationStack)", prompt: "Build a list-to-detail app. One screen: list of 5 items; tap to push detail with title and body. NavigationStack." },
    { title: "Grid layout", prompt: "Build a grid app. One screen: 6 items in a 2-column grid. Each cell shows a number or icon. Tapping shows alert." },
    { title: "Horizontal scroll", prompt: "Build a horizontal scroll app. One screen: 5 cards in a horizontal ScrollView. Each card has title. Paging optional." },
    { title: "Pull-to-refresh", prompt: "Build a pull-to-refresh list. One screen: list of 5 items; pull to refresh shows spinner then “Updated.”" },
    { title: "Long-press context menu", prompt: "Build a long-press menu app. One screen: list of 3 items; long-press shows context menu with one action. Action shows alert." },
    { title: "Placeholder list with SF Symbols", prompt: "Build a placeholder list with icons. One screen: list of 5 rows, each with an SF Symbol on the left and a title. Tapping shows alert. Clean list style." },
  ],
  "Forms & pickers": [
    { title: "Feedback form", prompt: "Build a feedback form. One screen: text field and a Submit button. Submit shows a thank-you alert. No backend." },
    { title: "Simple form", prompt: "Build a simple form. One screen: name field, email field, and Submit. Submit shows alert. No backend." },
    { title: "Picker", prompt: "Build a picker screen. One screen: picker with 5 options; show selected below. Single picker." },
    { title: "Slider", prompt: "Build a slider screen. One screen: slider 0–100 and show value. Persist value in UserDefaults." },
    { title: "Toggle list", prompt: "Build a toggle list. One screen: 3 rows with toggles (e.g. Option A, B, C). Persist in UserDefaults." },
    { title: "Stepper", prompt: "Build a stepper screen. One screen: label and stepper (+/-); show value. Persist in UserDefaults." },
    { title: "Date picker", prompt: "Build a date picker screen. One screen: date picker and show selected date below. Persist in UserDefaults." },
    { title: "Time picker", prompt: "Build a time picker screen. One screen: time picker and show selected time below. Persist in UserDefaults." },
  ],
  "Calculators & tools": [
    { title: "Color picker", prompt: "Build a color picker app. One screen: three sliders (R, G, B), a color preview, and the hex code below. Tapping hex copies to clipboard. Clean layout." },
    { title: "Dice roller", prompt: "Build a dice roller app. One screen: a single die icon and a Roll button. Show result 1–6. Optional: second die and sum. Fun, minimal." },
    { title: "Random number", prompt: "Build a random number app. One screen: two fields (min and max), a Generate button, and a large result. Simple and clear." },
    { title: "Tip calculator", prompt: "Build a tip calculator. Input: bill amount and tip %. Show tip and total. Optional: split among N people. One screen." },
    { title: "Unit converter", prompt: "Build a unit converter. One screen: e.g. miles ↔ km. One input, two segments (miles / km), show converted value. Clean." },
    { title: "BMI calculator", prompt: "Build a BMI calculator. Input height and weight; show BMI and a simple category (e.g. Normal). One screen." },
    { title: "Random name picker", prompt: "Build a random name picker. One screen: list of names (editable), a Pick button, and show the chosen name. Persist list in UserDefaults." },
    { title: "Decision wheel", prompt: "Build a decision wheel. One screen: list of options (editable), a Spin button, and an animated or random selection. Fun, minimal." },
    { title: "Coin flip", prompt: "Build a coin flip app. One screen: coin graphic and a Flip button; show Heads or Tails. Optional: short animation." },
    { title: "Yes/No fortune", prompt: "Build a Yes/No fortune app. One screen: a button; tap to show a random “Yes”, “No”, or “Maybe”. Playful." },
  ],
  "UI states & patterns": [
    { title: "Profile placeholder", prompt: "Build a profile placeholder. One screen: avatar (placeholder image or initial), name, and a short bio. Static for MVP." },
    { title: "Onboarding flow", prompt: "Build a 3-screen onboarding flow. Swipe or Next; last screen has Get Started. No persistence." },
    { title: "About screen", prompt: "Build an About screen. One screen: app name, version (e.g. 1.0), and a short description. Static." },
    { title: "Empty state", prompt: "Build an empty state screen. One screen: icon, title “No items”, and subtitle. Single state." },
    { title: "Loading state", prompt: "Build a loading state screen. One screen: spinner and “Loading…” for 2 seconds then show “Done.”" },
    { title: "Error state", prompt: "Build an error state screen. One screen: error icon, message “Something went wrong”, and a Retry button. Retry shows alert." },
    { title: "Success screen", prompt: "Build a success screen. One screen: checkmark and “Success!” message. Single state." },
    { title: "Detail screen", prompt: "Build a detail screen. One screen: title, subtitle, and body text. Static content, clean typography." },
    { title: "Action sheet", prompt: "Build an action sheet screen. One screen: button “Show options”; tap to show action sheet with two options. Alert for each." },
    { title: "Alert / confirm", prompt: "Build an alert screen. One screen: button “Confirm”; tap to show confirm dialog with OK/Cancel. Show result." },
    { title: "Modal sheet", prompt: "Build a modal screen. One screen: button that presents a sheet with “Close” that dismisses. Simple content in sheet." },
    { title: "Full-screen cover", prompt: "Build a full-screen cover. One screen: button that presents fullScreenCover with “Dismiss”. Minimal content." },
  ],
  "Accessibility & system": [
    { title: "Haptic feedback", prompt: "Build a haptic feedback button. One screen: one button; on tap trigger light haptic. Label says “Tap for haptic.”" },
    { title: "Button with sound", prompt: "Build a button with sound. One screen: one button; on tap play system sound. Label says “Tap for sound.”" },
    { title: "Dark mode", prompt: "Build a dark mode aware screen. One screen: background and text that adapt to light/dark. One label and one button." },
    { title: "Dynamic Type", prompt: "Build a Dynamic Type screen. One screen: one title and one body label that scale with accessibility size. Single screen." },
    { title: "Accessibility labels", prompt: "Build an accessibility label screen. One screen: one image or icon and one button; add accessibility labels. Minimal UI." },
    { title: "Share sheet", prompt: "Build a share sheet screen. One screen: one button “Share”; tap to present share sheet with fixed text “Hello from Vibetree.”" },
    { title: "Copy to clipboard", prompt: "Build a copy button screen. One screen: one button “Copy”; tap to copy “Copied!” to clipboard and show brief “Copied” confirmation." },
  ],
  "Placeholders & demos": [
    { title: "Step counter placeholder", prompt: "Build a simple step counter placeholder. One screen: label “Steps” and a number (e.g. 0 or mock value). Clean layout for testing." },
    { title: "Random quote (display)", prompt: "Build a random quote app. One screen: one quote (from a fixed list of 5–10) and a Next button to show another. Clean typography." },
    { title: "Affirmation app", prompt: "Build an affirmation app. One screen: one affirmation per tap (from a list of 10). Large, centered text. Calm design." },
    { title: "Minimal calendar", prompt: "Build a minimal calendar. One screen: current month in a grid; tap a day to show it selected. No events for MVP." },
    { title: "Weather placeholder", prompt: "Build a weather placeholder app. One screen: city name and “Sunny, 72°” (fixed). Clean card layout." },
    { title: "Map placeholder", prompt: "Build a map placeholder. One screen: Map view with one pin at a fixed coordinate. No interaction." },
    { title: "Image picker placeholder", prompt: "Build an image picker placeholder. One screen: button “Pick image”; tap shows alert “Picker not configured.” (No real picker for MVP.)" },
    { title: "Camera placeholder", prompt: "Build a camera placeholder. One screen: button “Take photo”; tap shows alert “Camera not configured.” (No real camera for MVP.)" },
    { title: "Skeleton loading", prompt: "Build a skeleton loading list. One screen: 5 rows that look like skeleton placeholders (gray rectangles); after 2 seconds replace with real text." },
  ],
  "Design & visual": [
    { title: "Liquid Glass (iOS 26)", prompt: "Build a Liquid Glass style screen. One screen: use iOS 26 design if available (e.g. glassEffect), or a frosted card. Single card with title and subtitle." },
    { title: "Card with shadow", prompt: "Build a card with shadow. One screen: one card (rounded rect) with shadow and a title inside. Clean, elevated look." },
    { title: "Gradient background", prompt: "Build a gradient background app. One screen: gradient as background (e.g. purple to blue) and one centered title. Minimal." },
    { title: "Animated transition", prompt: "Build an animated transition. One screen: list of 3 items; tap to navigate to detail with a simple transition animation." },
  ],
  "Misc (display & interaction)": [
    { title: "Flashcard app", prompt: "Build a flashcard app. One screen: one card (question on front); tap to flip and show answer. Next/Previous. 5 fixed cards for MVP." },
    { title: "Word of the day", prompt: "Build a word-of-the-day app. One screen: one word and its definition (fixed for MVP). Clean, readable typography." },
    { title: "Speed dial", prompt: "Build a speed dial app. One screen: 3 buttons (e.g. Call Mom, Work, Friend) with labels. Tapping shows an alert (no real call)." },
  ],
};

const _flattened = Object.values(APP_IDEAS_BY_CATEGORY).flat();
export const APP_IDEA_PROMPTS: readonly string[] = _flattened.map((idea) => idea.prompt);

export function getRandomAppIdeaPrompt(): string {
  const i = Math.floor(Math.random() * APP_IDEA_PROMPTS.length);
  return APP_IDEA_PROMPTS[i];
}

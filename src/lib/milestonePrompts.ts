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

export const MILESTONE_IDS = ["m1-baseline", "m2-easy", "m3-medium", "m4-hard", "m5-wow"] as const;
export type MilestoneId = (typeof MILESTONE_IDS)[number];

const MILESTONE_META: Record<MilestoneId, Omit<MilestoneConfig, "ideas">> = {
  "m1-baseline": { id: "m1-baseline", label: "M1: Baseline", shortLabel: "Baseline", description: "10 representative apps to verify the pipeline works", target: 70 },
  "m2-easy":     { id: "m2-easy",     label: "M2: Easy",     shortLabel: "Easy",     description: "30 single-screen apps covering all basic patterns", target: 90 },
  "m3-medium":   { id: "m3-medium",   label: "M3: Medium",   shortLabel: "Medium",   description: "15 multi-screen apps + HIG showcase", target: 80 },
  "m4-hard":     { id: "m4-hard",     label: "M4: Hard",     shortLabel: "Hard",     description: "All seed.json framework-specific apps", target: 70 },
  "m5-wow":      { id: "m5-wow",      label: "M5: Wow",      shortLabel: "Wow",      description: "10 impressive demo apps (Vision, AR, Metal, etc.)", target: 60 },
};

export function getMilestonePrompts(id: MilestoneId): MilestoneConfig {
  const meta = MILESTONE_META[id];
  switch (id) {
    case "m1-baseline": return { ...meta, ideas: M1_BASELINE };
    case "m2-easy":     return { ...meta, ideas: buildM2Easy() };
    case "m3-medium":   return { ...meta, ideas: buildM3Medium() };
    case "m4-hard":     return { ...meta, ideas: loadSeedJsonIdeas() };
    case "m5-wow":      return { ...meta, ideas: M5_WOW };
  }
}

export function getAllMilestones(): Array<Omit<MilestoneConfig, "ideas"> & { count: number }> {
  return MILESTONE_IDS.map((id) => {
    const config = getMilestonePrompts(id);
    return { ...MILESTONE_META[id], count: config.ideas.length };
  });
}

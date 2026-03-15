# Build failure analysis & skill priority

From `data/build-results.jsonl`, admin test-suite error patterns, and the auto-fix route. Summary of which Apple frameworks/proxy APIs show up most in failures, which already have skills, and a ranked list of what needs new or improved skill files.

---

## Data sources

- **Build results:** 354 rows in `data/build-results.jsonl` (324 compiled, 30 failed; 133 used auto-fix). Analyzed with `node scripts/analyze-builds.mjs` and custom aggregation.
- **Error patterns:** `src/app/admin/test-suite/page.tsx` — `ERROR_PATTERNS` (member_not_found, missing_import, trailing_closure, etc.).
- **Auto-fix:** `src/app/api/projects/[id]/auto-fix-build/route.ts` — `AUTO_FIX_SYSTEM_PROMPT` with explicit fix rules for Published, accentColor, NSAttributedString, Widget/Live Activity, UIView, Context, ForEach/Binding, etc.
- **Skills:** 52 JSON files in `data/skills/` (registry keyword-based + loader trigger/alwaysLoad).

---

## 1. Which frameworks/APIs already have skill files

| Framework / API | Skill file(s) | Notes |
|-----------------|---------------|--------|
| **HealthKit** | `healthkit.json` | ✅ |
| **Workout / fitness** | `workout-fitness.json` | Rep counting, run tracking UI, breathing; **no** Live Activity / WorkoutAttributes |
| **Widget / Live Activity / ActivityKit** | `widget-live-activities.json`, `widgetkit-live-activities.json` | Loader + registry; canonicalCode has DeliveryAttributes, AddWidgetGuideView |
| **MapKit / Core Location** | `location-maps.json` | Places proxy, MapKit SwiftUI |
| **Weather** | `weatherkit.json` | ✅ |
| **Camera / AVFoundation** | `camera-capture.json`, `camera-photos.json` | ✅ |
| **Vision / VisionKit** | `vision-body-pose.json`, `vision-hand-pose.json`, `vision-text-recognition.json`, `vision-barcode-from-image.json`, `visionkit-scanner.json`, `document-scanning.json` | ✅ |
| **MusicKit** | `musickit.json` | ✅ |
| **Combine** | — | **No skill**; covered in system prompt + auto-fix (import Combine for @Published) |
| **UIKit (UIView, NSAttributedString)** | — | **No skill**; auto-fix has import UIKit, .foregroundColor for NSAttributedString |
| **SwiftUI (Binding, ForEach, Context)** | — | **No skill**; base prompt + auto-fix |
| **StoreKit** | — | No dedicated skill (mentioned in system prompt only) |
| **NFC** | `corenfc.json` | ✅ |
| **ARKit** | `arkit.json` | ✅ |
| **Notifications** | `notifications.json` | ✅ |
| **Bluetooth** | `bluetooth.json` | ✅ |
| **CloudKit / iCloud** | `cloudkit-icloud.json` | ✅ |
| **Other** | `apple-hig.json`, `backgrounds.json`, `finance-currency.json`, `education-flashcards.json`, `share-sheet.json`, `social-*`, `email.json`, `sign-in-with-apple.json`, `local-auth.json`, `text-to-speech.json`, `speech-recognition.json`, `audio-recording.json`, `calendar-reminders.json`, `apple-notes*.json`, `swift-charts.json`, `liquid-glass.json`, etc. | Many domain skills |

**Commonly requested app types (weather, fitness, maps, camera):** All four have at least one skill. Gaps are **workout + Live Activity** (workout-fitness does not cover ActivityAttributes / WorkoutAttributes) and **unified “maps + location”** is one skill only.

---

## 2. Which frameworks/APIs generate the most errors

Errors from build-results (including errorHistory) were bucketed. Counts below are **total error occurrences** across all builds, not unique builds.

| Rank | Bucket | Count | Representative errors |
|------|--------|-------|------------------------|
| 1 | **Other** (unclassified) | 14 | Various; many one-off or generic |
| 2 | **accentColor (Theme/custom)** | 9 | `type 'Theme' has no member 'accentColor'`, `type 'HapticPattern' has no member 'accentColor'`, `type 'BeatPattern' has no member 'accentColor'` |
| 3 | **Live Activity / WidgetKit** | 9 | `cannot find type 'WorkoutAttributes' in scope`, `cannot find type 'DeliveryStage' in scope`, `DeliveryAttributes.ContentState` does not conform to `Decodable`/`Encodable`/`Hashable`/`Equatable` |
| 4 | **Combine / Published** | 6 | `unknown attribute 'Published'` (missing `import Combine`) |
| 5 | **UIKit / UIView / Context** | 5 | `cannot find type 'UIView' in scope`, `cannot find type 'Context' in scope`, `cannot find type 'UIViewRepresentable'` |
| 6 | **Binding / SwiftUI** | 4 | `cannot find type 'Binding' in scope`, `cannot convert value of type '[X]' to expected argument type 'Binding<C>'`, ForEach/Binding misuse |
| 7 | **NSAttributedString / UIKit** | 3 | `type 'NSAttributedString.Key' has no member 'foregroundStyle'` |
| 8 | **ForEach / generic C** | 3 | `generic parameter 'C' could not be inferred` |
| 9 | **Color / foregroundStyle** | 2 | `member 'indigo'` / `HierarchicalShapeStyle` vs `Color`, `Color.quaternary` |
| 10 | **ObservableObject / StateObject** | 2 | `StateObject requires that 'X' conform to 'ObservableObject'` |
| 11 | **Trailing closure** | 1 | `extra trailing closure passed in call` |

**Top raw errors (from `analyze-builds.mjs`):**

1. **6×** `unknown attribute 'Published'` → Combine  
2. **4×** `type 'Theme' has no member 'accentColor'` → accentColor  
3. **3×** `type 'HapticPattern' has no member 'accentColor'` → accentColor  
4. **3×** `generic parameter 'C' could not be inferred` → ForEach  
5. **3×** `type 'NSAttributedString.Key' has no member 'foregroundStyle'` → NSAttributedString  
6. **3×** `cannot find type 'WorkoutAttributes' in scope` → Live Activity  
7. **2×** `type 'BeatPattern' has no member 'accentColor'` → accentColor  
8. **2×** `cannot find type 'UIView' in scope` → UIKit  
9. **2×** `cannot find type 'Context' in scope` → SwiftUI/WidgetKit  
10. **2×** `cannot find type 'DeliveryStage' in scope` → Live Activity  

So in practice the highest-impact areas are: **accentColor (custom types)**, **Live Activity / Widget (WorkoutAttributes, DeliveryStage, ContentState)**, **Combine (Published)**, **UIKit (UIView, Context)**, **Binding/ForEach**, and **NSAttributedString**.

---

## 3. Failed builds by app type (prompt keyword)

Failed builds only (`compiled: false`), by keyword in prompt:

| Keyword | Failed count | Has skill? |
|---------|--------------|------------|
| workout | 6 | workout-fitness (no Live Activity / WorkoutAttributes) |
| widget | 6 | widget-live-activities, widgetkit-live-activities |
| live activity | 6 | widget-live-activities, widgetkit-live-activities |
| timer | 4 | — (no dedicated “timer” skill; often combined with widget/live activity) |
| flashcard | 2 | education-flashcards |
| delivery | 2 | widgetkit-live-activities (DeliveryAttributes in canonicalCode) |
| music | 1 | musickit |
| health | 1 | healthkit |
| event | 1 | — |
| calendar | 1 | calendar-reminders |
| budget | 1 | finance-currency |
| habit | 1 | — |
| journal | 1 | — |

**Weather, fitness (generic), maps, camera:** No failures in this run for prompts that only mention “weather”, “map”, “camera”, or “photo”. So **weather, maps, camera** have skills and are not the main failure drivers; **fitness/workout** failures are mostly **workout + widget/live activity** (WorkoutAttributes, placement, ContentState conformance).

---

## 4. Ranked list: what needs skill files or improvements

### High priority (errors frequent and/or many failed builds)

1. **Live Activity / Widget — WorkoutAttributes & ContentState**  
   - **Problem:** “WorkoutAttributes” in scope, “DeliveryStage”, “DeliveryAttributes.ContentState” protocol conformance. Failed prompts: workout (6), widget (6), live activity (6).  
   - **Current:** widgetkit-live-activities has DeliveryAttributes + DeliveryLiveActivityWidget in canonicalCode; WorkoutAttributes is not.  
   - **Action:** Add **WorkoutAttributes** (and optional WorkoutLiveActivityWidget) to widgetkit-live-activities canonicalCode; in promptInjection, state explicitly that **any** ActivityAttributes (FocusTimer, Workout, Delivery, etc.) must live in LiveActivity/ or Models/, and that **ContentState** must conform to Codable, Hashable, Equatable. Optionally add a short “WorkoutAttributes” example in the skill.

2. **accentColor on custom types (Theme, HapticPattern, BeatPattern, etc.)**  
   - **Problem:** 9 errors (Theme, HapticPattern, BeatPattern “has no member 'accentColor'”).  
   - **Current:** Auto-fix and system prompt say “use Color(\"AccentColor\") or .tint(...), never Color.accentColor”. apple-hig Theme.swift uses `Color.appAccent = Color.accentColor`, which can encourage custom types to expose `.accentColor`.  
   - **Action:** **Improve apple-hig** (and any theme-related snippet): state “Never add a property named accentColor to custom types (Theme, HapticPattern, etc.); use Color(\"AccentColor\") or a named property like themeAccent or primaryTint.” Add this to system prompt or a small “theme/color” rule so generation avoids custom .accentColor. No new skill file required if the rule is in prompt + apple-hig.

3. **Combine / @Published**  
   - **Problem:** 6× “unknown attribute 'Published'”.  
   - **Current:** Auto-fix already says “Add import Combine”.  
   - **Action:** Add a **one-line rule in the main system prompt** (claudeAdapter): “Any file that uses @Published must import Combine at the top.” Reduces reliance on auto-fix. Optional: very small “Combine” note in a shared “SwiftUI basics” or apple-hig skill. No need for a full Combine skill unless we see more Combine-specific errors.

### Medium priority (several errors or recurring pattern)

4. **UIKit (UIView, Context, UIViewRepresentable)**  
   - **Problem:** 5 errors (UIView, Context, UIViewRepresentable in scope).  
   - **Current:** Auto-fix covers “import UIKit” and “import SwiftUI” for Context.  
   - **Action:** Add a **short “UIKit in SwiftUI” skill** (or a section in apple-hig) that is keyword-triggered (e.g. “camera”, “UIViewRepresentable”, “AVCapture”, “custom view”): “Files using UIView, UIVideoPreviewLayer, or UIViewRepresentable’s makeUIView(context:) must import UIKit; Context in makeUIView(context: Context) requires import SwiftUI.” Reduces first-time failures.

5. **Binding / ForEach misuse**  
   - **Problem:** 4 Binding + 3 generic `C` (often ForEach).  
   - **Current:** Auto-fix has ForEach(items, id:) and Binding rules.  
   - **Action:** Strengthen **system prompt** (or SwiftUI “list” section): “ForEach: use ForEach(collection, id: \\.id) or ForEach(indices, id: \\.self); do not pass a Binding as the first argument where a collection is expected.” Consider one canonical ForEach/Binding example in a skill if errors persist.

6. **NSAttributedString.Key.foregroundStyle**  
   - **Problem:** 3 errors.  
   - **Current:** Auto-fix and system prompt already say use .foregroundColor, not .foregroundStyle.  
   - **Action:** If these still appear after deployment, add an **antiPattern** in a skill that touches rich text (e.g. document-scanning, notes, or a new “rich-text” skill): “NSAttributedString.Key.foregroundStyle does not exist; use .foregroundColor.” No new skill required if prompt/auto-fix is enough.

### Lower priority (fewer errors or already well handled)

7. **Color / foregroundStyle / quaternary**  
   - **Problem:** 2 (indigo/HierarchicalShapeStyle, Color.quaternary).  
   - **Current:** System prompt already restricts Color and .foregroundStyle.  
   - **Action:** Add “Color has no .quaternary” and “use Color.white explicitly in foregroundStyle, not .white” to system prompt if not already there. Optional: single line in apple-hig.

8. **ObservableObject / StateObject**  
   - **Problem:** 2 errors.  
   - **Current:** Auto-fix explains conformance.  
   - **Action:** One sentence in system prompt: “@StateObject’s type must conform to ObservableObject.” No new skill unless it recurs.

9. **Timer / focus / pomodoro (without “widget”)**  
   - **Problem:** 4 failed builds with “timer” in prompt; some may be timer + live activity.  
   - **Current:** No dedicated “timer” or “focus” skill.  
   - **Action:** Low priority; consider a **timer/focus/pomodoro** skill only if we see repeated timer-specific compile or runtime failures (e.g. Timer, Notification scheduling). Could be folded into widgetkit-live-activities if the ask is “timer widget”.

10. **Flashcard / education**  
    - **Problem:** 2 failed builds.  
    - **Current:** education-flashcards exists.  
    - **Action:** Review failure logs for those two; if errors are Binding/import/ForEach, the general fixes above help; if flashcard-specific, extend education-flashcards (e.g. task completion UI, session reset).

---

## 5. Summary table

| Priority | Area | Errors / impact | Has skill? | Action |
|----------|------|------------------|------------|--------|
| **P1** | Live Activity WorkoutAttributes / ContentState | 9 LA/Widget, 6 workout + 6 widget + 6 live activity fails | Yes (widget ×2) | Add WorkoutAttributes + ContentState rules/canonicalCode to widgetkit-live-activities |
| **P1** | accentColor on custom types | 9 | apple-hig (Theme has accent) | Rule: never add .accentColor to custom types; tighten apple-hig / system prompt |
| **P1** | Combine @Published | 6 | No | One-line rule in system prompt: file with @Published must import Combine |
| **P2** | UIKit (UIView, Context) | 5 | No | Small “UIKit in SwiftUI” skill or apple-hig section (camera/AVCapture/UIViewRepresentable) |
| **P2** | Binding / ForEach | 4 + 3 | No | Strengthen system prompt; optional canonical ForEach/Binding in skill |
| **P2** | NSAttributedString.foregroundStyle | 3 | No | Already in auto-fix; add antiPattern in rich-text skill if needed |
| **P3** | Color.quaternary / foregroundStyle | 2 | — | System prompt line if missing |
| **P3** | StateObject/ObservableObject | 2 | — | One line in system prompt |
| **P3** | Timer/focus (no widget) | 4 fails | No | Optional timer/focus skill if more data supports it |
| **P3** | Flashcard | 2 fails | Yes | Debug and extend education-flashcards if needed |

**Weather, fitness (non–live-activity), maps, camera:** All have skills; none are in the top failure buckets. The main gaps are **workout + Live Activity** (WorkoutAttributes, ContentState), **accentColor on custom types**, and **Combine import**; then UIKit/Binding/ForEach and small prompt tweaks.

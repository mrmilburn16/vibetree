# Pro implementation: system prompt and reference

This file holds the **Pro (Swift/SwiftUI) system prompt** for the LLM and is the single source of truth for the prompt the Pro plan should use.

---

## Exact flow: creating a Pro app

1. **Dashboard** – Create a new app (or open an existing project).
2. **Editor** – In the chat header, set the dropdown to **Pro (Swift)**. (Stored in `localStorage` as `vibetree-project-type`.)
3. **First message** – Type what you want (e.g. “A habit tracker with daily check-ins”) and send.
   - Request goes to `POST /api/projects/[id]/message` with `projectType: "pro"`.
   - Backend uses the **Swift/SwiftUI** system prompt; LLM returns `{ summary, files: [ { path, content } ] }` with `.swift` files.
   - Server saves those files into the project file store and returns the summary + `editedFiles` to the UI.
4. **Build status** – Status goes to **live**; the assistant message shows the summary and the list of Swift files (e.g. App.swift, ContentView.swift).
5. **Follow-ups** – Send another message (e.g. “Make the title blue”). The server sends the **current Swift files** from the store with your message; the LLM returns the full updated set; the store is overwritten. Order is preserved; you can send multiple messages in a row (they’re queued and processed one at a time).
6. **Get the app on your phone** (pick one):
   - **Run on device** (toolbar) → modal opens → **Download for Xcode (.zip)** → unzip → double‑click `VibetreeApp.xcodeproj` → connect iPhone → Run in Xcode.
   - **Or** in the same modal: “Or download single .swift file” for the concatenated Swift (manual Xcode project).
   - **Or** Project settings (gear) → **Download source** (uses `projectType` from localStorage; Pro gets Swift-only export).
7. **Preview pane** – For Pro, the right-hand pane shows “Pro (Swift): Download your app and open in Xcode…” and a link that opens the Run on device modal (no Expo QR).

End-to-end: choose Pro → describe app → send → (optional follow-ups) → Download for Xcode → unzip → open in Xcode → Run on iPhone.

---

## Pro system prompt (Swift/SwiftUI)

Use this as `SYSTEM_PROMPT_SWIFT` in `src/lib/llm/claudeAdapter.ts` when `projectType === "pro"`. The response shape must stay the same as Standard: a single JSON object with `summary` and `files` (path + content).

```
You are an expert Swift and SwiftUI developer. You build native iOS apps that run on iPhone and iPad. Reply message-by-message: if the user sends a follow-up (e.g. "change the button color to blue"), you will receive the current project files and their request; apply the change and output the full updated JSON. If there are no current files, create a new app from scratch.

Output format: Respond with a single JSON object only. No other text before or after.
Shape: { "summary": "1-2 sentence description of what you built or changed", "files": [ { "path": "App.swift", "content": "full Swift source..." }, { "path": "ContentView.swift", "content": "..." }, ... ] }

Rules:
- Use only Swift and SwiftUI. Target iOS 17+ (or latest). No UIKit unless necessary; prefer SwiftUI APIs.
- The app entry must be "App.swift" at the project root: a struct conforming to App with @main and a WindowGroup that shows the main view (e.g. ContentView()).
- Include at least "App.swift" and "ContentView.swift". Use paths relative to project root. You may add "Models/", "Views/", or "ViewModels/" subfolders (e.g. "Models/Item.swift", "Views/DetailView.swift").
- All file paths must end with ".swift". No placeholders; produce complete, compilable Swift code.
- Use modern Swift: SwiftUI View bodies, @State, @Binding, ObservableObject, or @Observable where appropriate. Prefer native controls (Text, Button, List, Form, NavigationStack, etc.) and system styling.
- Design and UX: Every screen must feel like it was crafted by world-class product designers—modern, polished, and visually outstanding. Apply thoughtful spacing, clear hierarchy, excellent typography (e.g. .font(.title2), .fontWeight(.semibold), scale for readability), and subtle animations or transitions where they add clarity. Avoid generic or template-looking UI; aim for the level of care you would expect from an elite team of thousands of senior UI/UX designers with decades of combined experience. The result should feel like an App Store editor’s choice.
- Keep the app simple and single-window unless the user asks for multiple screens or navigation. No explanations outside the summary.
- If the user asks for Liquid Glass, iOS 26 design, or glass effect: set deployment target to iOS 26 and apply .glassEffect() (and GlassEffectContainer / .glassEffectID() where appropriate) to cards, buttons, or containers so the UI matches the new design language.

Produce the full set of files (new or updated) in one reply. No markdown, no code fences around the JSON—only the raw JSON object.
```

---

## Copy-paste version (no extra newlines)

For pasting into a template literal in code:

```ts
const SYSTEM_PROMPT_SWIFT = `You are an expert Swift and SwiftUI developer. You build native iOS apps that run on iPhone and iPad. Reply message-by-message: if the user sends a follow-up (e.g. "change the button color to blue"), you will receive the current project files and their request; apply the change and output the full updated JSON. If there are no current files, create a new app from scratch.

Output format: Respond with a single JSON object only. No other text before or after.
Shape: { "summary": "1-2 sentence description of what you built or changed", "files": [ { "path": "App.swift", "content": "full Swift source..." }, { "path": "ContentView.swift", "content": "..." }, ... ] }

Rules:
- Use only Swift and SwiftUI. Target iOS 17+ (or latest). No UIKit unless necessary; prefer SwiftUI APIs.
- The app entry must be "App.swift" at the project root: a struct conforming to App with @main and a WindowGroup that shows the main view (e.g. ContentView()).
- Include at least "App.swift" and "ContentView.swift". Use paths relative to project root. You may add "Models/", "Views/", or "ViewModels/" subfolders (e.g. "Models/Item.swift", "Views/DetailView.swift").
- All file paths must end with ".swift". No placeholders; produce complete, compilable Swift code.
- Use modern Swift: SwiftUI View bodies, @State, @Binding, ObservableObject, or @Observable where appropriate. Prefer native controls (Text, Button, List, Form, NavigationStack, etc.) and system styling.
- Design and UX: Every screen must feel like it was crafted by world-class product designers—modern, polished, and visually outstanding. Apply thoughtful spacing, clear hierarchy, excellent typography (e.g. .font(.title2), .fontWeight(.semibold)), and subtle animations or transitions where they add clarity. Avoid generic or template-looking UI; aim for the level of care you would expect from an elite team of thousands of senior UI/UX designers with decades of combined experience. The result should feel like an App Store editor’s choice.
- Keep the app simple and single-window unless the user asks for multiple screens or navigation. No explanations outside the summary.
- If the user asks for Liquid Glass, iOS 26 design, or glass effect: set deployment target to iOS 26 and apply .glassEffect() (and GlassEffectContainer / .glassEffectID() where appropriate) to cards, buttons, or containers.

Produce the full set of files (new or updated) in one reply. No markdown, no code fences around the JSON—only the raw JSON object.`;
```

---

## Ways a user can get the app

| # | Option | App type | Typical time | Notes |
|---|--------|----------|---------------|--------|
| **1** | **Xcode + USB** | Pro (Swift) | 1–3 min first time, then ~30–60 s | Download source (.swift) from Vibetree, create a new iOS app in Xcode, paste or add the Swift files, connect iPhone, Run. Manual project setup. |
| **2** | **Download for Xcode (zip)** | Pro (Swift) | ~30–60 s after unzip | In Vibetree: Run on device → “Download for Xcode (.zip)”. Unzip, double‑click `VibetreeApp.xcodeproj`, connect iPhone, Run. Ready-to-open project; no manual file wiring. Implemented: `GET /api/projects/[id]/export-xcode`. |
| **3** | **Expo Go (QR)** | Standard (Expo) only | Often &lt; 30 s | Use Standard (Expo) in the editor. Run on device starts Expo tunnel; scan QR in Expo Go. Not native Swift; runs in Expo Go. |
| **4** | **Mac build service** | Pro (Swift) | ~1–2 min (when implemented) | Future: one click in browser → backend tells a Mac runner to build and install to a connected device (Rork-style). Requires Mac fleet + device pairing; not yet implemented. |

- For **Pro**, the fastest path today is **#2** (Download for Xcode zip).
- For **Standard**, **#3** (Expo Go) is the only in-browser “on device” path.

---

## Liquid Glass (iOS 26)

**Reference:** [Liquid Glass | Apple Developer Documentation](https://developer.apple.com/documentation/technologyoverviews/liquid-glass/)

**Liquid Glass** is Apple’s new design language introduced at WWDC 2025 (iOS 26, iPadOS 26, macOS Tahoe, watchOS 26, tvOS 26, CarPlay). It’s a translucent, dynamic material that refracts content behind it, reflects light, and adds a lensing effect along edges. Elements can scale, bounce, and shimmer on interaction; text gets automatic contrast/saturation; shadows and highlights adapt to background and device tilt.

**SwiftUI API (iOS 26):**

- **`.glassEffect()`** — main modifier; applies the glass material. Variants: `.regular` (default), `.clear` (more transparent), `.identity` (off).
- **`GlassEffectContainer`** — coordinates multiple glass elements.
- **`.glassEffectID()`** — supports smooth morphing/transitions between glass views.

Example: `Text("Hello").padding().glassEffect()`.

**In Vibetree Pro:**

- When the user asks for **Liquid Glass** (e.g. “Use Liquid Glass design”, “iOS 26 style”, “glass effect”), the AI should:
  - Target **iOS 26** (or “latest”) in the generated project/deployment target.
  - Apply `.glassEffect()` (and optionally `GlassEffectContainer` / `.glassEffectID()`) to cards, buttons, or containers where it fits.
- The Pro system prompt in this plan and in `src/lib/llm/claudeAdapter.ts` (SYSTEM_PROMPT_SWIFT) include a Liquid Glass rule so the LLM applies it when the user asks.
- The in-app docs already mention this: *“When your app targets iOS 26 (or ‘latest’), you can ask the AI to use Liquid Glass in the generated UI.”*
- No change to the Vibetree web UI; this is handled in the generated Swift and Xcode project (deployment target + modifiers).

**Accessibility:** Users can tune Liquid Glass in Settings (Display & Brightness) and via Reduce Motion / Increase Contrast / Reduce Transparency.

---

## Edge cases and retries

**Retry on parse failure (Pro/Standard):** When the LLM returns a response that fails to parse as JSON (e.g. markdown wrap, truncated, or malformed), the message route **retries once** with the same request. If the second attempt also throws `"Invalid structured response"`, the API returns 422 and the client shows “AI response could not be parsed (retried once)”. No retry for other errors (e.g. network, 503, timeout).

**Pro: only store .swift files.** Before calling `setProjectFiles`, the message route filters `parsedFiles` to entries whose `path` ends with `.swift`. That way a mistaken `.js` (or other) file from the model is not persisted for a Pro project. The client’s `editedFiles` list is set from the filtered list so the UI matches what was stored.

**Other edge cases (no automatic retry):**
- **Timeout:** Client aborts after ~130 s; user must resend. Consider a “Retry” button in the UI that re-sends the last message.
- **429 (rate limit):** Returns 503; no backoff/retry. Could add retry-with-backoff for 429 in the route later.
- **Empty or no entry point:** If the model returns only non-Swift or no `App.swift`-style entry, the project may not build; export/export-xcode still work with whatever is stored. No server-side validation that an entry point exists.
- **Very large current files:** Full file set is sent to the LLM; very large projects could hit token limits. No truncation or summarization yet.
- **Queue:** If a message fails (422/503), the user sees the error and the queue moves on to the next message; the failed message is not re-queued. User can manually resend.

---

## Differences from Standard (Expo) prompt

| Aspect        | Standard (Expo)              | Pro (Swift)                          |
|---------------|------------------------------|--------------------------------------|
| Entry file    | `App.js`, default export     | `App.swift`, `@main` + `WindowGroup`  |
| Paths         | `.js`                        | `.swift` only                         |
| Stack         | React Native, Expo Go        | Swift, SwiftUI, iOS 17+               |
| Structure     | Single `App.js` typical      | `App.swift` + `ContentView.swift` + optional Models/Views |
| JSON shape    | Same                         | Same (`summary` + `files`)           |

# VibeTree Companion – Setup Guide

## 1. Open the project in Xcode

- In Finder, go to: `vibetree/ios/VibeTreeCompanion/`
- Double-click **VibeTreeCompanion.xcodeproj**

Or in Terminal:

```bash
open /Users/mikemilburn/vibetree/ios/VibeTreeCompanion/VibeTreeCompanion.xcodeproj
```

---

## 2. Pick the right scheme (important)

In the Xcode toolbar, use the **scheme** dropdown (next to the Run/Stop buttons).

- Choose **VibeTreeCompanion** (the app).
- Do **not** choose **BuildActivityExtension** (that will hang).

If you only see BuildActivityExtension:

- **Product → Scheme → Edit Scheme…**
- Select **Run** on the left.
- Set **Executable** to **VibeTreeCompanion**.
- Close the window.

---

## 3. Choose where to run

In the **device** dropdown (next to the scheme):

- **iPhone (your model)** – real device (best for Live Activities and notifications).
- **iPhone 15** (or any simulator) – simulator (no real push; Live Activity may be limited).

For a real device: connect it with USB (and allow the device to trust the computer if asked).

---

## 4. Code signing (first time on device)

1. In the left sidebar, click the **blue project icon** (top: “VibeTreeCompanion”).
2. Under **TARGETS**, select **VibeTreeCompanion**.
3. Open the **Signing & Capabilities** tab.
4. Check **Automatically manage signing**.
5. Choose your **Team** (your Apple ID or “Personal Team”).  
   If no team: **Xcode → Settings → Accounts**, add your Apple ID, then pick it as Team here.
6. Under **TARGETS**, select **BuildActivityExtension** and do the same (same Team).

---

## 5. Run the app

- Press **Run** (▶) or **⌘R**.
- First time on a **real device**: on the iPhone go to **Settings → General → VPN & Device Management**, tap your developer profile, and **Trust** it. Then open the VibeTree app from the home screen.

The app should open and show the main screen (title “VibeTree”, possibly “No active builds”).

---

## 6. Configure the app

1. In the app, tap the **gear icon** (top right) to open **Settings**.
2. **Server URL**  
   - Local dev: `http://YOUR_MAC_IP:3001` (e.g. `http://192.168.1.10:3001`).  
   - Production: your real VibTree URL (e.g. `https://your-app.vercel.app`).  
   - Simulator can use `http://localhost:3001`; a physical phone cannot (use your Mac’s IP).
3. **API Token**  
   - Use the same value as `MAC_RUNNER_TOKEN` from your server’s `.env.local` (so the app can call the same APIs).  
   - Optional: you can add a separate “viewer” token on the server later if you prefer.
4. Tap **Test Connection**. It should show “Connected” if the URL and token are correct.
5. Tap **Enable** under Push Notifications and allow notifications when iOS prompts.

---

## 7. What “working” looks like

- **Main screen**  
  Shows “No active builds” until a build exists. Pull down to refresh.

- **When you start a build in the web app**  
  - The companion app will show it under “Active Builds” (and pull-to-refresh will update it).
  - If you lock your iPhone, a **Live Activity** can appear on the lock screen (progress bar, elapsed time, step).  
  - **Dynamic Island** (iPhone 14 Pro and later): same activity in compact form.

- **When the build finishes**  
  - You get a **notification**: “Your app is ready!” (success) or “Build failed” (failure).  
  - The build moves to “Recent Builds”; the Live Activity ends after a short time.

---

## 8. Troubleshooting

| Issue | What to do |
|-------|------------|
| “Attaching to buildactivity” / stuck | You’re running **BuildActivityExtension**. Stop (■), switch scheme to **VibeTreeCompanion**, run again. |
| “Show Notification Center Widget timed out” | Simulator quirk. Ignore, or run on a **real device**. |
| Live Activity never appears (but Activity IDs update in logs) | Ensure the widget extension has an entry point (`@main` on `BuildActivityExtensionBundle`) and **reinstall** the app on device after changes to the extension. |
| `Failed to show Widget 'com.vibetree.companion.buildactivity'` / SpringBoard request denied | This is an **Xcode widget-debugging** failure (it tries to open **SpringBoard**) and does **not** necessarily mean Live Activities are broken. Workaround: run the **VibeTreeCompanion** app scheme and trigger a Live Activity from inside the app (Settings → Live Activities → **Start Test**, then lock the phone). If it persists: unlock the phone, reboot the device, and ensure **Signing & Capabilities** uses the same Team for both app + extension, then delete and reinstall the app. |
| Test Connection fails | Check Server URL (use Mac IP from phone, not `localhost`), check API token, and that the Next.js server is running. |
| No Live Activity on lock screen | Start a build from the web app with the app open or recently used; then lock the phone. Ensure notification permission is granted. |
| No “Allow Notifications” prompt | Open **Settings** in the app and tap **Enable** under Push Notifications. |

---

## 9. Quick checklist

- [ ] Opened **VibeTreeCompanion.xcodeproj**
- [ ] Scheme = **VibeTreeCompanion** (not BuildActivityExtension)
- [ ] Device = your iPhone or a simulator
- [ ] Signing set for both **VibeTreeCompanion** and **BuildActivityExtension**
- [ ] App runs and opens (▶ / ⌘R)
- [ ] Settings: Server URL and API Token set, Test Connection = Connected
- [ ] Notifications enabled (Enable in Settings)
- [ ] Started a build in the web app and confirmed it appears in the app (and, on device, on the lock screen as Live Activity)

# Recent features – manual test plan

Use this list to verify the recent changes. To **click the circle** to mark an item done: open this file, then open **Markdown Preview** (e.g. right‑click tab → Open Preview). The checkboxes in the preview are often clickable and will toggle `[ ]` ↔ `[x]`. Otherwise edit the file (change `- [ ]` to `- [x]`).

---

## 1. New blank app = fresh slate (iOS)

- [✓] Tap a suggestion chip or submit a prompt so a project is created with that prompt.
- [ ] Go back to the project list.
- [ ] Tap **“New blank app”**.
- [ ] **Expected:** Editor opens with an empty prompt; no previous prompt is shown and nothing auto-sends.
- [ ] From the list, tap an **existing project** (any row).
- [ ] **Expected:** Editor opens without auto-sending any old prompt.

---

## 2. Duplicate app titles (Web + iOS)

- [ ] Create an app with a prompt like **“build a to do list”** → it should be named something like **“To-Do List”**.
- [ ] Create **another** app with the same prompt **“build a to do list”**.
- [ ] **Expected:** Second app is named **“To-Do List (2)”** (and further duplicates get (3), (4), etc.).
- [ ] **Expected:** No overwriting; each project has its own name and ID.

---

## 3. Live stream + file list order (Web + iOS)

- [ ] In the editor, send a prompt that generates an app (e.g. **“build a simple counter app”**).
- [ ] **Expected (during generation):** You see live progress: phases (e.g. “Receiving code…”) and **actual file names** (e.g. **App.swift, ContentView.swift…**) as they’re written, not only “Writing N files…”.
- [ ] **Expected (after completion):** The list of Swift files is in **chronological order** (first written at the top, last at the bottom), not grouped by folder or alphabetically.

---

## 4. Recent apps row – tap anywhere (iOS)

- [ ] On the Projects tab, in **Recent apps**, tap on the **middle of a row** (e.g. the app name or the “Updated X ago” text), not on the chevron.
- [ ] **Expected:** The app opens. Tapping anywhere on the row opens the app, not only the chevron.

---

## 5. Editor nav title shows app name (iOS)

- [ ] Create an app with a prompt like **“build a to do list”** and wait for the first response to finish.
- [ ] **Expected:** The **navigation bar at the top** shows **“To Do List”** (or the derived name), not “Untitled app”.
- [ ] Go back to the list, then open **that same project** again.
- [ ] **Expected:** The nav bar still shows **“To Do List”** (or the correct name), not “Untitled app”.

---

## 6. Delete app – same modal as web (iOS)

- [ ] On the Projects tab, long-press a recent app and choose **Delete**.
- [ ] **Expected:** A **sheet** appears with title **“Delete app”**, warning text, and a field to type **DELETE**.
- [ ] **Expected:** The red **Delete** button is **disabled** until you type **DELETE** exactly (capital letters).
- [ ] Type **DELETE** in the field.
- [ ] **Expected:** **Delete** becomes enabled; tapping it deletes the app and dismisses the sheet.
- [ ] Long-press another app → Delete again; tap **Cancel** (or dismiss without typing DELETE).
- [ ] **Expected:** The app is **not** deleted; the sheet closes.

---

## Quick reference

| Area              | What to test briefly |
|-------------------|----------------------|
| New blank app     | No carried-over prompt; no auto-send. |
| Duplicate titles  | Second same-prompt app gets “(2)”. |
| Live stream       | File names during generation; chronological file list after. |
| Row tap           | Tap anywhere on recent app row to open. |
| Nav title         | Shows real app name after build and when reopening. |
| Delete            | Sheet, type DELETE to enable Delete; Cancel doesn’t delete. |

---

*Last updated: from recent implementation work (new blank slate, duplicate names, live stream/order, full-row tap, nav title, delete modal).*

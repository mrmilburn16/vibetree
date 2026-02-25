# QA System Enhancer

How to test apps, report issues, and improve the generation system — all from the browser.

---

## The Big Picture

Every time you test an app and write a note, the system gets smarter. Your notes are auto-classified into issue tags, aggregated across all builds, and turned into suggested prompt rules. One click applies a rule to every future generation. No code changes, no restarts, no Cursor needed.

**Data flow:**

```
You test in Xcode
    ↓
Write notes in Test Suite or Builds page
    ↓
Issue classifier auto-tags your notes (instant, no LLM)
    ↓
QA Insights page aggregates tags across all builds
    ↓
Suggested fixes appear with "Apply" button
    ↓
Applied rules inject into system prompt for all future generations
```

---

## Step-by-Step Walkthrough

### Step 1: Run the app in Xcode

After a build succeeds (from test suite or the editor), run it on the simulator or your device. Use the app naturally — tap every button, navigate between screens, scroll around, type in inputs. You're checking functionality, not design.

### Step 2: Go to the Test Suite and find the build entry

URL: `localhost:3001/admin/test-suite`

Each entry has a QA section that appears when the build is complete (succeeded or failed). You'll see:
- **Design rating** (1-5 stars) — how it looks
- **Functionality rating** (1-5 stars) — how it works
- **QA Notes** textarea — where you describe what's broken

If you're looking at older builds not from a test suite run, go to `/admin/builds` instead. The notes field works identically there.

### Step 3: Write your notes

Just describe what's broken or off in plain English. The system recognizes natural language — you don't need any special format, tags, or codes. Separate issues with commas, bullet points, or periods.

**What to report:**

| Category | Example phrases the system recognizes |
|---|---|
| **Overlapping elements** | "menu overlaps the start button", "slider covers the text", "behind the button" |
| **Buttons not working** | "settings button doesn't work", "nothing happens when I tap", "dead button" |
| **Can't tap things** | "can't tap the X", "button is too small", "hard to press" |
| **Navigation broken** | "can't go back", "stuck on this screen", "navigation doesn't work" |
| **Safe area issues** | "too far up in the top left", "behind the notch", "cuts off at the top" |
| **Tab bar problems** | "tab bar overlaps content", "bottom bar covers the button" |
| **State not updating** | "counter doesn't increment", "doesn't update when I tap", "data doesn't show" |
| **Scroll issues** | "can't scroll", "content cut off", "goes past the screen" |
| **Crashes** | "crashes on launch", "black screen", "won't open" |
| **Missing content** | "missing text", "blank area", "nothing shows", "placeholder text" |
| **Keyboard issues** | "keyboard covers the input", "can't see text field" |
| **Dark mode** | "can't read the text", "white on white", "contrast issue" |
| **Camera** | "camera is flipped", "orientation is wrong" |
| **Permissions** | "no camera access", "permission denied" |
| **Animations** | "animation is janky", "flicker", "glitch" |
| **Empty states** | "blank screen when no data", "no empty state message" |
| **Text truncation** | "text cut off", "label truncated", "ellipsis" |
| **Positioning** | "wrong position", "misaligned", "alignment is off" |

**Example notes:**

- `menu overlaps the start button, can't tap settings, counter doesn't update`
- `too far up behind the notch. navigation doesn't go back. keyboard covers input.`
- `crashes on launch`
- `slider covers the text, button doesn't do anything, tab bar overlaps content`

### Step 4: Save your notes

- **In the Test Suite**: Notes auto-save as you type (debounced 800ms). Green issue tag pills appear below the textarea after saving.
- **In Builds**: Press **Enter** or click away from the field. You'll see "Saved — tags auto-detected" and green tag pills.

That's all you do. Repeat for each build you test.

---

## Reviewing & Applying Improvements

### Step 5: Go to QA Insights

URL: `localhost:3001/admin/qa`

This page is the brain of the system. It automatically:

1. **Aggregates** all your notes across every build
2. **Ranks** issues by frequency and severity
3. **Generates** specific suggested rules to fix recurring patterns

You'll see:
- **Top Issues** — which problems appear most often (with severity badges: critical/major/minor)
- **Issues by Tier** — are hard apps failing differently than easy ones?
- **Issues by Skill** — which framework skills have the most problems?
- **Suggested System Fixes** — actionable rules with an "Apply" button

### Step 6: Apply fixes

Each suggestion card shows:
- What the fix does (e.g. "Prevent overlapping controls")
- The exact rule text that will be injected
- How many builds triggered this suggestion
- An **Apply** button

Click **Apply** and the rule is immediately active for all future app generations. No restart needed. The suggestion card shows an "Applied" badge.

**Safety rails:**
- **Duplicate detection**: If a similar rule already exists (>60% word overlap), the apply is blocked and tells you which existing rule conflicts.
- **25-rule cap**: If you hit 25 active rules, the oldest one auto-deactivates to keep the prompt lean.
- **Toggle on/off**: Applied rules can be disabled without deleting them (bottom of the QA page, "Applied QA Rules" section).
- **Delete**: Remove a rule permanently if it's not helping.

---

## Where Things Live

| What | Where |
|---|---|
| Test suite UI | `localhost:3001/admin/test-suite` |
| Builds (all history) | `localhost:3001/admin/builds` |
| QA Insights + Apply | `localhost:3001/admin/qa` |
| Build results data | `data/build-results.jsonl` |
| Applied QA rules | `data/qa-applied-rules.json` |
| Issue classifier | `src/lib/qa/issueClassifier.ts` |
| Insights engine | `src/lib/qa/qaInsights.ts` |
| Applied rules store | `src/lib/qa/appliedRules.ts` |
| Rules API | `src/app/api/admin/qa-rules/route.ts` |
| Injection point | `src/lib/llm/claudeAdapter.ts` (reads rules at runtime) |

---

## Important Notes

- **Test Suite vs Builds**: The test suite syncs notes to the builds log automatically (for new runs). They share the same underlying data. Use whichever page is convenient.
- **Old M4 runs**: Builds from before this system was added don't have a `buildResultId` link, so their notes must be added via `/admin/builds`. All future test suite runs will sync automatically.
- **No LLM cost**: The entire classification and suggestion system is regex-based. Zero API calls, instant results.
- **The more you annotate, the better**: Suggestions are ranked by occurrence count. One report of "overlap" is a data point. Five reports across different apps is a pattern worth fixing.

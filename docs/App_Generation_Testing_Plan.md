# App Generation Testing Plan

## The Goal

Right now your platform can generate apps that compile. The goal is to get to apps that **work** — meaning a user types a prompt, gets an app, installs it on their phone, and everything functions correctly. No crashes, no blank screens, no broken buttons, no API errors.

---

## The Testing Process

You're going to do this in three phases. Each phase catches a different type of problem.

**Phase 1: Generate and Build**

This is the simplest loop. You type a prompt into your platform, your agent generates the code, your pipeline builds it. You check: did it compile? If not, what error? You fix the error pattern in your system prompt or skills, then try again.

You're already doing this. The issue is that compilation doesn't mean the app works.

**Phase 2: Visual Verification**

This is where you actually look at the app. You install it on a simulator or real device via TestFlight and open it. You check: does the screen look right? Is there content? Are the buttons visible? Does it match what the user asked for? Is there a blank screen or a crash?

This is where most of your failures will be. An app can compile perfectly and still show a blank white screen because the data source is empty, or crash on launch because of a force unwrap, or look completely wrong because a layout is off.

**Phase 3: Interaction Testing**

You actually use the app. Tap every button. Fill out every form. Navigate to every screen. Try the edge cases: what happens when you type nothing and hit submit? What happens when you deny a permission? What happens when you rotate the phone?

This catches the functional bugs that visual inspection misses.

---

## How to Actually Do This, Step by Step

### Step 1: Pick Your 8 Launch Categories

These are the app types you're going to make sure work perfectly at launch. Here they are with 3 test prompts each. You'll run all 24 prompts through your platform.

---

### Category 1: Weather

**Prompt 1:**
```
Build a weather app that shows the current temperature, humidity, and a 5-day forecast for my current location. Use a clean blue gradient background.
```

**Prompt 2:**
```
Create a simple weather app where I can search for any city and see the current weather conditions with an icon showing sun, clouds, or rain.
```

**Prompt 3:**
```
Make a weather dashboard that shows today's weather, hourly forecast for the next 12 hours, and a weekly outlook. Include sunrise and sunset times.
```

**What you're testing:** Does CoreLocation permission work? Does the weather API call succeed through your proxy? Does the UI display real data or placeholder text? Does it handle the case where location permission is denied?

---

### Category 2: Fitness / Health

**Prompt 1:**
```
Build a workout tracker where I can log exercises with the name, sets, reps, and weight. Show my workout history organized by date.
```

**Prompt 2:**
```
Create a step counter app that reads my step count from HealthKit and shows today's steps, a progress ring toward my goal of 10,000 steps, and a weekly bar chart.
```

**Prompt 3:**
```
Make a water intake tracker. I tap a button each time I drink a glass of water. Show my daily total, a progress bar toward 8 glasses, and a simple history of the past 7 days.
```

**What you're testing:** Does HealthKit permission request work? Does data persist between app launches (UserDefaults/CoreData)? Do charts render correctly? Does the empty state look good (first launch with no data)?

---

### Category 3: Finance / Budget

**Prompt 1:**
```
Build a simple expense tracker. I can add expenses with a name, amount, and category (food, transport, entertainment, other). Show a list of expenses and a total at the top.
```

**Prompt 2:**
```
Create a budget app where I set a monthly budget amount, add expenses throughout the month, and see how much I have remaining. Show a progress bar of spending vs budget.
```

**Prompt 3:**
```
Make a tip calculator. I enter the bill amount, choose a tip percentage (15%, 18%, 20%, 25%, or custom), enter the number of people, and see the tip amount and per-person total.
```

**What you're testing:** Does text input work correctly (numeric keyboard for money)? Does the data persist? Do calculations work? Is the empty state handled? Does the list scroll when there are many items?

---

### Category 4: Productivity / Todo

**Prompt 1:**
```
Build a todo list app where I can add tasks, mark them complete, and delete them. Show completed tasks in a separate section with strikethrough text.
```

**Prompt 2:**
```
Create a habit tracker with 5 daily habits I can customize. Each day I check off which habits I completed. Show a weekly grid of my streaks.
```

**Prompt 3:**
```
Make a notes app with a list of notes on the main screen. Tap to open a note and edit it. Swipe to delete. Notes should save automatically.
```

**What you're testing:** Does add/delete/edit work? Does data persist between launches? Does swipe-to-delete work? Does the empty state look good? Does navigation (list → detail → back) work smoothly?

---

### Category 5: Food / Recipe

**Prompt 1:**
```
Build a recipe saver app. I can add recipes with a name, ingredients list, and step-by-step instructions. Show all my recipes in a searchable list.
```

**Prompt 2:**
```
Create a calorie counter where I log what I eat with the food name and calories. Show today's total calories, a list of what I've eaten, and a simple weekly summary.
```

**Prompt 3:**
```
Make a meal planner. I can assign meals (breakfast, lunch, dinner) to each day of the week. Show the current week with all my planned meals.
```

**What you're testing:** Does the search function work? Do forms with multiple fields work correctly? Does the weekly view layout properly? Can I add and view items without crashes?

---

### Category 6: Education

**Prompt 1:**
```
Build a flashcard app. I can create decks of flashcards with a front and back. When studying, show the front, tap to reveal the back, then swipe right for "got it" and left for "need practice."
```

**Prompt 2:**
```
Create a quiz app with 10 multiple-choice questions about world geography. Show my score at the end and let me retry.
```

**Prompt 3:**
```
Make a Pomodoro timer. 25 minutes of focus time, then 5 minutes break, repeating. Show a big countdown timer, start/pause/reset buttons, and how many pomodoros I've completed today.
```

**What you're testing:** Does the card flip animation work? Does the timer work correctly (not drift, not crash)? Does the quiz flow (question → answer → next → results) navigate properly? Does state persist?

---

### Category 7: Utility

**Prompt 1:**
```
Build a unit converter that handles length (miles/km/meters/feet), weight (pounds/kg), and temperature (F/C). Clean, simple design with a picker for unit type.
```

**Prompt 2:**
```
Create a QR code scanner. The camera opens, I point at a QR code, and it shows me the content. Include a button to copy the result.
```

**Prompt 3:**
```
Make a color palette generator. Tap a button to generate 5 random harmonious colors. Show each color as a big swatch with the hex code. Let me tap to copy a hex code.
```

**What you're testing:** Does the camera permission flow work? Does the unit conversion math work correctly? Does copy-to-clipboard work? Are the pickers functional?

---

### Category 8: Social / Personal

**Prompt 1:**
```
Build a personal journal app. I can write dated entries. Show a list of entries with the date and a preview of the text. Tap to read the full entry.
```

**Prompt 2:**
```
Create a contacts manager. I can add people with their name, phone number, and email. Show a searchable alphabetical list. Tap a contact to see details and call or email them.
```

**Prompt 3:**
```
Make a countdown app. I can create multiple countdowns to future events (vacation, birthday, deadline). Show all countdowns on the main screen with the days remaining, updating live.
```

**What you're testing:** Does text editing work for long-form content? Does the tel: and mailto: linking work? Do countdown timers update correctly? Does search work?

---

## Step 2: Run All 24 Prompts

Do this over 2-3 days. For each prompt:

1. Type the prompt into your platform exactly as written above
2. Let your agent generate the code
3. Let your pipeline build it
4. Record the result in a spreadsheet with these columns:

| Prompt # | Category | Compile? | Install? | Launches? | UI Correct? | Functions Work? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Weather | Yes/No | Yes/No | Yes/No | Yes/No | Yes/No | What broke |

For "Functions Work" — spend 2 minutes actually using the app. Tap every button. Try the main flow.

---

## Step 3: Categorize the Failures

After running all 24, you'll have a list of failures. They'll fall into patterns:

**Pattern A: Compilation failures** — Your system prompt has a gap. The agent generated code with a specific Swift error that your prompt doesn't prevent. Fix: add the rule to your system prompt.

**Pattern B: Blank screen / crash on launch** — Usually a force unwrap, missing import, or a view body that depends on data that doesn't exist yet. Fix: these are system prompt rules (you already have many of these).

**Pattern C: UI looks wrong** — Layout is broken, text is cut off, colors don't match the theme. Fix: these are design rules in your system prompt.

**Pattern D: Buttons don't work / navigation broken** — Tapping a button does nothing, or navigating to a screen shows the wrong content. Fix: usually a wiring issue. Your system prompt rule about "never create buttons with empty actions" should catch this, but you may need more specific rules.

**Pattern E: Data doesn't persist** — I add a todo item, close the app, reopen, and my items are gone. Fix: your system prompt mentions UserDefaults persistence, but the agent might not be applying it consistently. May need stronger guidance.

**Pattern F: Permission/integration failure** — HealthKit doesn't request permission, camera doesn't open, location doesn't work. Fix: your skills system should handle these. If they're failing, the skill content needs to be more specific.

---

## Step 4: Fix the Top 5 Patterns

Don't try to fix everything. Find the 5 most common failure patterns and fix those. Each fix is either:
- A new rule or clarification in your system prompt
- A new or improved skill file
- A fix in your build pipeline (like a missing entitlement)

Then re-run the prompts that failed. Repeat until your pass rate is above 80%.

---

## Step 5: The Follow-Up Test

After the initial generation works, test the follow-up flow. For each app that passed, send these follow-up messages:

```
Change the background to a dark purple gradient
```

```
Add a settings screen with an option to change the theme color
```

```
Make the main title bigger and bold
```

These test whether your agent correctly applies incremental changes without breaking the existing app. This is where "change the button color to blue" and getting back a completely regenerated app with different features is a common failure mode.

---

## Step 6: Automated Checks (After Manual Pass)

Once you've manually verified 20+ apps work, you have a baseline. Now you can start automating:

1. **Screenshot comparison**: Use your Appetize + Claude Vision setup to take screenshots of generated apps and check them against expected patterns ("does this look like a weather app?")
2. **Smoke test**: For each generated app, your pipeline takes a screenshot at launch. If the screenshot is a blank white or black screen, flag it as failed.
3. **Regression suite**: Save the 24 test prompts and their expected outputs. Run them weekly. If something that used to work breaks, you know immediately.

---

## What "Done" Looks Like

When you can run all 24 prompts and get this:

- 22+ out of 24 compile successfully (90%+)
- 20+ out of 24 launch without crashing (83%+)
- 18+ out of 24 look correct and function as expected (75%+)
- Follow-up changes work on 90%+ of apps

You have a launchable product. The remaining failures become your post-launch priority list.

**The most important thing: start running these prompts today.** Every day you spend testing and fixing is a day your launch product gets better. Every day you spend building infrastructure instead of testing is a day you don't know if your product actually works.

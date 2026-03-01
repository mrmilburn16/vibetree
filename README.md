# Vibetree

Build real iOS apps in your browser. Describe your app in plain language; AI writes Swift, you preview live, and ship to your iPhone or the App Store.

## Stack

- **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS v4**
- Design tokens in `src/styles/tokens.css` (no raw hex in UI)
- Mock-first: chat, build status, and project CRUD work without LLM or Mac

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

**Run on iPhone (Companion app):** To get "Mac runner" and "iPhone" green in the iOS Companion app, run `npm run dev:full` on your Mac instead of `npm run dev`. That starts both the Next.js server and the Mac runner; add `MAC_RUNNER_TOKEN` to `.env.local` (same value as the API Token in the app’s Settings). See `ios/VibeTreeCompanion/SETUP.md` for full setup.

Sign up or sign in (mock session), create a project, and use the editor: send a message to see mock assistant replies and build status.

## Project layout

- `src/app/` — Routes: `/`, `/pricing`, `/sign-in`, `/sign-up`, `/dashboard`, `/editor/[id]`
- `src/app/api/projects/` — Project CRUD and `POST [id]/message` (mock agent)
- `src/components/ui/` — Button, Card, Input, Badge, Modal, Toast (design tokens only)
- `src/components/landing/` — Landing nav, hero, how it works, features, footer
- `src/components/editor/` — Editor layout, chat panel, preview pane, modals (settings, run on device, publish)
- `src/lib/` — `projects.ts` (client localStorage), `projectStore.ts` (server in-memory), `featureFlags.ts`

## Pricing

The app includes a **credit system** and **three plans** (Creator, Pro, Team) with monthly and annual billing and a 14-day free trial for Pro and Team. See the [Pricing](http://localhost:3000/pricing) page in the app and [design.md](docs/plans/design.md) for the credit breakdown and plan details.

## Feature flags

- `NEXT_PUBLIC_USE_REAL_LLM=true` — Use real LLM for chat (default: mock)
- `NEXT_PUBLIC_USE_REAL_MAC=true` — Use real Mac fleet for build/streaming (default: mock)

### Testing the chat UX with mock (no API key)

You **don’t need to remove or disable** your API key. To try the new checklist/step UX without calling the real API:

1. **Easiest:** Run the app in mock mode so the client never uses the real LLM:
   ```bash
   npm run dev:mock
   ```
   This sets `NEXT_PUBLIC_USE_REAL_LLM=false` and starts the app on **port 3002**. Open http://localhost:3002, send a message, and you’ll see the same step list (Planning next moves, Thinking…, Creating files, Finalizing, Done) and summary as with the real API, but driven by the in-app mock.

2. **Alternative:** Leave your `.env.local` as-is and either:
   - Omit `NEXT_PUBLIC_USE_REAL_LLM` (or set it to anything other than the string `"true"`). Then `npm run dev` uses the mock.
   - Or keep `NEXT_PUBLIC_USE_REAL_LLM=true` when you want real API calls; switch to `false` or unset when you want to test the UI with mock only.

## Next steps (Phase C/D)

- **Real LLM:** Replace mock in `useChat` or API `message` route with Claude/OpenAI; parse edits, run xcodebuild on Mac.
- **Real streaming:** Mac runner + WebRTC or VNC to stream Simulator to the preview pane.
- **Device install:** Desktop agent (Mac) or TestFlight link.
- **App Store submit:** Apple Developer OAuth, store credentials, run upload from backend.

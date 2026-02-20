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

Open [http://localhost:3000](http://localhost:3000). Sign up or sign in (mock session), create a project, and use the editor: send a message to see mock assistant replies and build status.

## Project layout

- `src/app/` — Routes: `/`, `/pricing`, `/sign-in`, `/sign-up`, `/dashboard`, `/editor/[id]`
- `src/app/api/projects/` — Project CRUD and `POST [id]/message` (mock agent)
- `src/components/ui/` — Button, Card, Input, Badge, Modal, Toast (design tokens only)
- `src/components/landing/` — Landing nav, hero, how it works, features, footer
- `src/components/editor/` — Editor layout, chat panel, preview pane, modals (settings, run on device, publish)
- `src/lib/` — `projects.ts` (client localStorage), `projectStore.ts` (server in-memory), `featureFlags.ts`

## Pricing

The app includes a **credit system** and **three plans** (Creator, Pro, Team) with monthly and annual billing and a 14-day free trial for Pro and Team. See the [Pricing](http://localhost:3000/pricing) page in the app and [docs/PRICING.md](docs/PRICING.md) for the credit breakdown and plan details.

## Feature flags

- `NEXT_PUBLIC_USE_REAL_LLM=true` — Use real LLM for chat (default: mock)
- `NEXT_PUBLIC_USE_REAL_MAC=true` — Use real Mac fleet for build/streaming (default: mock)

## Next steps (Phase C/D)

- **Real LLM:** Replace mock in `useChat` or API `message` route with Claude/OpenAI; parse edits, run xcodebuild on Mac.
- **Real streaming:** Mac runner + WebRTC or VNC to stream Simulator to the preview pane.
- **Device install:** Desktop agent (Mac) or TestFlight link.
- **App Store submit:** Apple Developer OAuth, store credentials, run upload from backend.

# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Vibetree is a monolithic Next.js 16 (App Router) application — an AI-powered iOS app builder. It runs entirely in **mock mode** by default (no external services required). See `README.md` for project layout and feature flags.

### Running the app

- **Dev server:** `npm run dev` (port 3001)
- **Build:** `npm run build`
- **Lint:** `npm run lint` — pre-existing lint errors/warnings exist in the codebase; these are not regressions

### Key gotchas

- The dev server runs on **port 3001** (not the default 3000). This is configured in `package.json` scripts.
- The app uses **mock auth** (stub demo tokens). Sign up/in with any email+password to get a session stored in `localStorage`.
- All AI/LLM responses are **mocked** unless `NEXT_PUBLIC_USE_REAL_LLM=true` is set with a valid `ANTHROPIC_API_KEY`.
- Mac fleet builds are mocked unless `NEXT_PUBLIC_USE_REAL_MAC=true` is set.
- Project data is stored **in-memory** on the server and in `localStorage` on the client — restarting the dev server clears server-side state.
- The `expo-template/` directory is a sub-project used for standard (non-Pro) app previews; its dependencies are not needed for development of the main app.
- ESLint uses flat config (v9). The lint command is simply `eslint` (no explicit config file path needed).

### UI rules

- All UI must use design tokens from `src/styles/tokens.css` (no raw hex).
- Dropdowns must use `DropdownSelect` from `@/components/ui`, not native `<select>`.
- Theme is "Twilight Violet" — dark backgrounds, light text, purple accents.

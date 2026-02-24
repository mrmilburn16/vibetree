# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Vibetree is a monolithic Next.js 16 (App Router) application — an AI-powered iOS app builder. It runs entirely in **mock mode** by default (no external services required). See `README.md` for project layout and feature flags.

### Running the app

- **Dev server:** `npm run dev` (port 3001)
- **Build:** `npm run build`
- **Lint:** `npm run lint` — should pass with 0 errors, 0 warnings
- **Tests:** `npm test` (Vitest, 102 tests across 9 test files)

### Key gotchas

- The dev server runs on **port 3001** (not the default 3000). This is configured in `package.json` scripts.
- The app uses in-memory JWT auth with bcrypt password hashing (`src/lib/auth.ts`). Sign up/in with any email+password. Server restart clears user store.
- All AI/LLM responses are **mocked** unless `NEXT_PUBLIC_USE_REAL_LLM=true` is set with a valid `ANTHROPIC_API_KEY`.
- Mac fleet builds are mocked unless `NEXT_PUBLIC_USE_REAL_MAC=true` is set.
- Project data is stored **in-memory** on the server and in `localStorage` on the client — restarting the dev server clears server-side state.
- The `expo-template/` directory is a sub-project used for standard (non-Pro) app previews; its dependencies are not needed for development of the main app.
- ESLint uses flat config (v9). The lint command is simply `eslint` (no explicit config file path needed).
- API rate limiting is applied to auth (10/min) and LLM message (10/min) endpoints. See `src/lib/rateLimit.ts`.
- Shared types live in `src/types/index.ts` — use `CodeFile`, `ProjectType`, `TokenUsage`, etc. from `@/types`.

### Testing

- Test framework: **Vitest** with path alias `@/` → `src/`
- Config: `vitest.config.ts`
- Run: `npm test` (single run) or `npm run test:watch` (watch mode)
- Test files are colocated in `src/lib/__tests__/`

### UI rules

- All UI must use design tokens from `src/styles/tokens.css` (no raw hex).
- Dropdowns must use `DropdownSelect` from `@/components/ui`, not native `<select>`.
- 20 theme variants (10 dark + 10 light) defined in `src/styles/themes.css`. Default is "Forest" (emerald, dark).
- Use `ErrorBoundary` from `@/components/ErrorBoundary` to wrap major page sections.

### Key modules

- `src/lib/llm/fixSwift.ts` — 20+ rule-based fixes for Swift code (auto-imports, deprecation upgrades, dedup)
- `src/lib/preBuildLint.ts` — Static analysis for generated Swift (orphaned views, layout issues, accessibility)
- `src/lib/llm/multiPass.ts` — Multi-pass generation pipeline (complexity estimation, architecture planning, self-review)
- `src/lib/rateLimit.ts` — In-memory sliding-window rate limiter
- `src/lib/auth.ts` — JWT + bcrypt authentication

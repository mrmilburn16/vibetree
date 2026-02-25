# AGENTS.md

## Cursor Cloud specific instructions

**Vibetree** is an AI-powered iOS app builder (Next.js 16 / React 19 / TypeScript). It uses a mock-first architecture — all features (chat, builds, auth) work without external API keys or services.

### Running the app

- `npm run dev` starts the Next.js dev server on **port 3001**.
- No environment variables or external services are required for development. Mock adapters handle LLM and build functionality.
- Auth is mock-based: any email/password combination works for sign-in/sign-up.

### Key commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (port 3001) |
| Lint | `npm run lint` |
| Build | `npm run build` |

### Caveats

- ESLint exits with code 1 due to pre-existing warnings/errors in the codebase; this is expected and does not indicate a setup problem.
- No lockfile (`package-lock.json`) is committed; `npm install` generates one locally.
- The `expo-template/` directory is a separate Expo project and is not required for the main web app.
- See `package.json` scripts and `docs/README.md` for additional details.

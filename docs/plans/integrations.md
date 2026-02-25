# Integrations Feature — Design & Scope

## Overview

An "Integrations" feature lets users toggle pre-configured backend services (Firebase, Supabase, etc.) that augment the LLM system prompt so the generated app includes the chosen backend out of the box.

## User Experience

1. **Where it lives:** An "Integrations" section in Project Settings (or a dedicated panel in the chat header).
2. **How it works:** Each integration is a toggle with a brief description. When enabled, the LLM receives additional system prompt instructions and boilerplate for that service.
3. **Per-project:** Enabled integrations are stored in `localStorage` per project ID, matching the existing pattern for project type and team ID.

## Priority Integrations

| # | Service | Category | Why |
|---|---------|----------|-----|
| 1 | **Firebase** (Firestore + Auth) | Backend + Auth | Most common iOS backend, generous free tier, extensive docs |
| 2 | **Supabase** (Postgres + Auth) | Backend + Auth | Open-source Firebase alternative, strong developer adoption |
| 3 | **CloudKit** | Backend (Apple-native) | Zero config for Apple ID users, free, native Swift support |
| 4 | **RevenueCat** | Monetization | De facto standard for in-app purchases and subscriptions |
| 5 | **Algolia** | Search | If the app needs full-text search beyond local filtering |

## Technical Architecture

### Data Model

```typescript
interface Integration {
  id: string;           // e.g. "firebase", "supabase"
  name: string;         // Display name
  description: string;  // One-line description
  icon: string;         // Icon path or component
  promptAugmentation: string;  // Instructions appended to LLM system prompt
  requiredPackages?: string[]; // Swift packages to include
  setupInstructions?: string;  // Shown to user after generation
}
```

### Files to Create/Modify

- `src/lib/integrations.ts` — Integration definitions, prompt augmentation strings, storage helpers
- `src/components/editor/IntegrationsPanel.tsx` — UI for toggling integrations (used in settings or chat header)
- `src/lib/llm/claudeAdapter.ts` — Append enabled integration prompts to the system message
- `src/components/editor/ProjectSettingsModal.tsx` — Add integrations section

### Prompt Augmentation Strategy

Each integration appends a block to the system prompt, e.g.:

```
## Firebase Integration (enabled by user)
- Use Firebase Firestore for data persistence
- Use FirebaseFirestoreSwift for Codable support
- Include GoogleService-Info.plist setup instructions in the summary
- Use Firebase Auth for user authentication
- Add FirebaseFirestore and FirebaseAuth as Swift Package Manager dependencies
```

### Storage

```typescript
// localStorage key pattern
`vibetree-integrations:${projectId}` → ["firebase", "revenueCat"]
```

## Effort Estimate

- **Small:** Integration definitions, localStorage storage, settings UI toggle (~2-3 hours)
- **Medium:** Prompt engineering per integration, testing output quality (~1-2 days)
- **Large:** Setup validation (does the generated code actually build with the integration?), guided API key input (~1 week)

## Recommended Approach

1. Start with Firebase only — it's the most requested and has the best Swift support
2. Validate that the LLM consistently generates working Firebase code with the prompt augmentation
3. Add Supabase and CloudKit once the pattern is proven
4. RevenueCat and Algolia are lower priority — add when users request them

## Dependencies

- Existing `CAPABILITY_IDEAS/seed.json` already follows a similar "capability + prompt" pattern
- No backend changes required for v1 (pure prompt augmentation)
- Future: could validate integration setup in the Mac runner build step

## Open Questions

- Should integrations require API keys upfront, or just generate the code structure and let users add keys later?
- Should we show a "setup guide" after generation for each enabled integration?
- How do we handle integration conflicts (e.g., Firebase Auth + Supabase Auth)?

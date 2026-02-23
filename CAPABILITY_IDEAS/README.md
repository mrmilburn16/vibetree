## Capability prompt library

This directory is a **capability-indexed** prompt library for Vibetree Pro (SwiftUI).

- **Goal**: browse iOS capabilities by folder (e.g. Barcode scanning, OCR, Core Motion, Live Activities).
- **Structure**: one folder per capability, **2 app-idea prompt files** per capability.
- **Prompt format**: matches existing `APP_IDEAS_*` markdown files:
  - first line is the title (`# ...`)
  - the copy/paste prompt is inside a fenced code block

### Generate the folders + prompt files

The full library (≈50 folders / 100 files) is generated from `seed.json`:

```bash
cd /Users/mikemilburn/vibetree
node scripts/generate-capability-ideas.mjs
```

To overwrite existing generated files:

```bash
node scripts/generate-capability-ideas.mjs --force
```

### Notes

- Some capabilities (e.g. Apple Pay, HealthKit, HomeKit) require **entitlements** and/or a **real device**. Prompts call this out so builds remain predictable.
- This library is intended for **idea testing** and **prompt engineering** (what the agent struggles with per capability).


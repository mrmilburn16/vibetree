# Cursor Rules

Quick reference for where to find things in this project's Cursor configuration.

## Structure

```
.cursor/
├── README.md          ← You are here
└── rules/
    ├── workflow/      ← Dev automation, git, server
    │   └── automate-dev-actions.mdc
    └── ui/            ← Theme, components, design system
        └── theme-and-dropdowns.mdc
```

## Rules by category

| Category | File | What it covers |
|----------|------|----------------|
| **Workflow** | `rules/workflow/automate-dev-actions.mdc` | Restart Next.js dev server yourself, push to GitHub yourself — don't ask the user |
| **UI** | `rules/ui/theme-and-dropdowns.mdc` | Twilight Violet theme, design tokens, use `DropdownSelect` instead of native `<select>` |

## Adding new rules

- **Workflow / automation** → `rules/workflow/`
- **UI / design / components** → `rules/ui/`
- **Other** → `rules/` (root) or create a new subfolder

Use `.mdc` extension and include frontmatter with `description` and `alwaysApply` as needed.

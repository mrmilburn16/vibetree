# VibeTree Codebase — Development Cost Estimate

**Prepared:** March 2025  
**Scope:** Full codebase (web app, API, iOS companion, build pipeline, skills system)  
**Methodology:** Senior full-stack equivalent hours × market rates × organizational overhead

---

## 1. Codebase Metrics & Complexity

| Metric | Value |
|--------|--------|
| **TypeScript/TSX** (src/) | 41,652 lines, 250 files |
| **Swift** (iOS companion) | 7,788 lines, 43 files |
| **Scripts** (Node .mjs) | 4,144 lines |
| **CSS** | 920 lines |
| **Tests** (Vitest, __tests__) | 6,809 lines, 23 test files |
| **Documentation** (docs/) | 2,303 lines |
| **Skills config** (data/skills/*.json) | 1,960 lines, 35 skills |
| **API routes** | 78 route handlers |
| **Total production LOC** (excl. tests) | **54,504** |
| **Total with tests** | **61,313** |

### Architectural Complexity

| Area | Description |
|------|-------------|
| **Frameworks** | Next.js 16 (App Router), React 19, SwiftUI (iOS 17+), Tailwind 4 |
| **Integrations** | Firebase Auth & Firestore, Anthropic/Google LLM APIs, Sentry, Vercel |
| **Advanced features** | LLM streaming & tool use, auto-fix build pipeline, skill-based prompt injection, Xcode/devicectl automation (mac-runner), iOS Live Activities, Appetize simulator proxy |
| **Testing** | Vitest, React Testing Library, integration tests for LLM/build flows |

### Complexity Factors Applied

- **Simple CRUD/UI:** ~35% of TS/TSX (dashboard, editor shell, admin UI) → 40 lines/hr
- **Complex business logic:** ~50% (LLM adapter, streaming, build jobs, auth, Firestore) → 25 lines/hr
- **Swift/native iOS:** Companion app, Live Activities → 18 lines/hr
- **Scripts:** Build runner, migrations, analytics → 25 lines/hr
- **Tests:** 32 lines/hr (comprehensive tests)
- **Documentation:** 40 lines/hr
- **Learning curve:** Next 16, Firebase, LLM APIs, iOS tooling → +15% on coding time

---

## 2. Development Hours Calculation

### Base Coding Hours (senior full-stack, 5+ years)

| Category | Lines | Rate (lines/hr) | Hours |
|----------|-------|-----------------|-------|
| Simple CRUD/UI (TS/TSX) | 14,578 | 40 | 364 |
| Complex logic (TS/TSX) | 20,826 | 25 | 833 |
| Swift (iOS) | 7,788 | 18 | 433 |
| Scripts | 4,144 | 25 | 166 |
| CSS | 920 | 45 | 20 |
| Tests | 6,809 | 32 | 213 |
| Documentation | 2,303 | 40 | 58 |
| Skills/config JSON | 1,960 | 50 | 39 |
| **Base coding subtotal** | | | **2,126** |

### Additional Time (overhead multipliers)

| Factor | % of coding | Hours |
|--------|-------------|-------|
| Architecture & design | 18% | 383 |
| Debugging & troubleshooting | 27% | 574 |
| Code review & refactoring | 12% | 255 |
| Documentation (inline, ADRs) | 12% | 255 |
| Integration & testing | 22% | 468 |
| Learning curve (new frameworks) | 15% | 319 |
| **Overhead subtotal** | | **2,254** |

### Total Raw Development Hours

| | Hours |
|---|-------|
| Base coding | 2,126 |
| Overhead | 2,254 |
| **Total raw dev hours** | **4,380** |

*Confidence: ±12%. Range: **3,850 – 4,900 hours**.*

---

## 3. Market Rates (2025, United States)

| Context | Low | Mid | High |
|---------|-----|-----|------|
| **Senior full-stack (employee, annual)** | $139K | $175K | $224K |
| **Contractor hourly (regional)** | $75 | $120 | $150 |
| **Contractor hourly (SF/NYC/specialized)** | $120 | $165 | $220 |
| **Used in table (contractor, blended)** | **$95** | **$140** | **$185** |

*Sources: Salary.com, Glassdoor, PayScale, contractrates.fyi (2025). Contractor rates 20–40% above employee equivalent.*

---

## 4. Calendar Time (Organizational Overhead)

Coding efficiency factor: **55%** (growth-stage: ~22 hrs/week coding per developer).

```
Calendar weeks = 4,380 ÷ (40 × 0.55) ≈ 199 weeks
```

| Company type | Efficiency | Coding hrs/week | Calendar weeks (4,380 hrs) |
|--------------|------------|-----------------|----------------------------|
| Solo/lean startup | 65% | 26 | 168 |
| Growth | 55% | 22 | **199** |
| Enterprise | 45% | 18 | 243 |

*At 1 FTE: **~4.0 calendar years** (growth). At 2 FTE: **~2 years**.*

---

## 5. Engineering Cost (Contractor, 4,380 Hours)

| Rate tier | $/hr | Engineering cost |
|-----------|------|------------------|
| Low | $95 | **$416,100** |
| Mid | $140 | **$613,200** |
| High | $185 | **$810,300** |

---

## 6. Full Team Cost (Loaded)

| Stage | Multiplier | Low | Mid | High |
|-------|------------|-----|-----|------|
| Solo/Founder | 1.0× | $416K | $613K | $810K |
| Lean startup | 1.45× | $603K | $889K | $1,175K |
| Growth | 2.2× | $915K | $1,349K | $1,783K |
| Enterprise | 2.65× | $1,103K | $1,625K | $2,147K |

**Role breakdown (growth, 2.2×):** Engineering 1.0×, Product/Design 0.4×, DevOps/Platform 0.2×, QA 0.25×, Management 0.35×.

---

## 7. Claude ROI — Value Per Claude Hour

### Commit-derived session estimate

- **Total commits (repo history):** 120  
- **Span:** 2026-02-20 → 2026-03-05 (~14 days)  
- **Sessions:** Commits clustered into 4-hour windows → **~32 distinct session windows**.  
- **Estimated Claude-active time:** 32 × 1.75 hrs/session ≈ **56 hours** (range: 45–70).

*Assumption: Not every commit is AI-only; human review and small edits included. 56 hrs is conservative.*

### Human-equivalent value

| Metric | Value |
|--------|--------|
| Human dev hours (total) | 4,380 |
| Claude active hours (est.) | 56 |
| **Speed multiplier** | **4,380 ÷ 56 ≈ 78×** |
| **Value per Claude hour** (mid rate) | $613,200 ÷ 56 ≈ **$10,950/hr** |

### ROI (if Claude cost ≈ $50/hr equivalent)

| | Amount |
|---|--------|
| Human cost (mid) | $613,200 |
| Claude cost (56 × $50) | $2,800 |
| **ROI** | **(613,200 − 2,800) ÷ 2,800 ≈ 218×** |

*Interpretation: Each Claude hour replaced ~78 human hours at mid contractor rate; at $50/hr Claude equivalent, ROI is very high. Actual Claude cost depends on usage and product pricing.*

---

## 8. Grand Total Summary

| Item | Low | Mid | High |
|------|-----|-----|------|
| **Raw dev hours** | 3,850 | 4,380 | 4,900 |
| **Engineering cost (contractor)** | $416K | $613K | $810K |
| **Full team (growth, 2.2×)** | $915K | $1,349K | $1,783K |
| **Calendar time (1 FTE, growth)** | 3.5 yr | 4.0 yr | 4.5 yr |

### Key assumptions

1. **Senior full-stack** productivity (5+ years); blended 28 lines/hour for production code.
2. **Overhead** (design, debug, review, docs, integration, learning) totals ~106% of base coding.
3. **Rates** are US contractor, blended geography; SF/NYC premium can push high end to $200+/hr.
4. **Claude hours** derived from 120 commits over 14 days with 4-hour session clustering; value = human-equivalent cost of 4,380 hrs at chosen rate.

---

*This estimate is for stakeholder discussion and planning. Refine with actuals (tickets, sprints, invoices) where available.*

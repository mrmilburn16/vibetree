# Plan: Pricing & credits

**Purpose:** Credit system and plan definitions. Implementation: `src/lib/pricing.ts` and `/pricing` page.

---

## Credit costs

| Action | Credits |
|--------|--------|
| 1 AI chat (standard, e.g. Haiku) | 1 |
| 1 AI chat (premium, e.g. Opus, GPT-4o) | 3 |
| 1 build (simulator / live) | 5 |
| 1 Run on device | 10 |
| 1 App Store publish | 25 |

- [ ] **Refresh:** Credits reset each billing period (TBD: 30-day rolling or calendar 1st). No rollover.
- [ ] **Overage:** Block AI/builds until next period, upgrade, or buy more credits.
- [ ] **Buy credits:** Prepay packs (e.g. 100, 250, 500). One-time purchase; add to balance; long expiry (e.g. 12 mo). Expose "Buy credits" when low/zero; checkout (e.g. Stripe).
- [ ] **KPI:** Track % of users with leftover credits at reset (tune amounts, spot churn).

---

## Final plans

| Plan | Monthly | Annual | Credits/mo | Trial |
|------|--------|--------|------------|-------|
| **Creator** | $0 | $0 | 50 | — |
| **Pro** | $29 | $290 | 500 | 14 days |
| **Team** | $79 | $790 | 2,000 | 14 days |

- [ ] **Creator:** 1 app, Haiku-only AI, no Run on device, no Publish.
- [ ] **Pro:** 5 apps, all AI models, Run on device, Publish, 14-day trial.
- [ ] **Team:** Unlimited apps, 2,000 credits, Pro + (future) 5 seats, priority, SSO, 14-day trial.

---

## Reference (strategist synthesis)

- Value-based: Free → Pro (ship) → Team (scale). Pro $25–35/mo, Team $70–90/mo.
- Usage-based: Free 50 credits, Pro 500, Team 2000. Pro $29/mo, Team $79/mo.
- Competitive: 14-day Pro trial, no card. Pro $29/mo or $290/yr, Team $79/mo or $790/yr.

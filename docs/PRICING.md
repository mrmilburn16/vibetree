# Vibetree pricing and credit system

## Credit system

**Credits** are the universal meter for AI and build usage. One balance applies across all billable actions.

| Action | Credits |
|--------|--------|
| 1 AI chat message (standard model, e.g. Claude 3.5 Haiku) | 1 |
| 1 AI chat message (premium model, e.g. Opus, GPT-4o) | 3 |
| 1 build (simulator preview / live) | 5 |
| 1 Run on device (TestFlight or desktop agent install) | 10 |
| 1 App Store publish submission | 25 |

- **Refresh:** Credits reset each billing period. Reset rule TBD: **30-day rolling** (e.g. reset 30 days after subscription start) or **calendar 1st** (reset on the 1st of each month). No rollover of included credits in the current design.
- **Overage:** When credits run out, AI and builds are blocked until the next period, upgrade, or **purchase of additional credits**.
- **Buy additional credits:** Users can prepay for credit packs (e.g. 100, 250, 500 credits) as one-time purchases. Purchased credits are added to balance immediately; they do not reset with the plan period (or use a long expiry, e.g. 12 months). Product must expose "Buy credits" / "Add credits" when balance is low or zero (e.g. header, account/billing page, or out-of-credits modal) and a checkout flow (Stripe or similar) for credit packs.

**KPI:** Track **% of users who don’t use all their credits** per period (e.g. % of Pro users with leftover credits at reset). Use it to tune included amounts and to spot churn or under-use.

---

## Three strategist perspectives (synthesis)

Three pricing strategists (each with ~20 years’ experience) reviewed Vibetree’s feature set and proposed tier names, feature split, and price ranges. Synthesis below.

### Strategist 1 — Value-based (outcome pricing)

- **Focus:** Price by outcome: “ship an app,” “publish to the store.”
- **Tiers:** Free (learn) → Pro (ship) → Team (scale).
- **Recommendation:** Free = 1 app, minimal credits, no publish. Pro = $25–35/mo with publish and Run on device. Team = $70–90/mo with seats and priority. Annual at ~17% off (2 months free).

### Strategist 2 — Usage-based (credit transparency)

- **Focus:** Clear credit system; users see exactly what they pay for.
- **Recommendation:** Free = 50 credits/mo (enough to try). Pro = 500 credits, all LLMs, publish. Team = 2000 credits, unlimited apps. Price Pro at $29/mo and Team at $79/mo so credit-per-dollar is easy to communicate.

### Strategist 3 — Competitive (land and expand)

- **Focus:** Compare to no-code builders and dev tools; free tier for adoption, trial to convert.
- **Recommendation:** 14-day Pro trial (no card required). Pro $29/mo or $290/yr. Team $79/mo or $790/yr. Free tier stays generous enough to build one real prototype.

---

## Final plans

| Plan | Monthly | Annual | Credits/mo | Free trial |
|------|--------|--------|------------|------------|
| **Creator** | $0 | $0 | 50 | — |
| **Pro** | $29 | $290 (~$24.17/mo) | 500 | 14 days |
| **Team** | $79 | $790 (~$65.83/mo) | 2,000 | 14 days |

- **Creator:** 1 app, Haiku-only AI, no Run on device, no Publish.
- **Pro:** 5 apps, all AI models, Run on device, Publish, 14-day free trial.
- **Team:** Unlimited apps, 2,000 credits, everything in Pro + (future) 5 seats, priority support, SSO; 14-day free trial.

Feature-to-plan mapping is implemented in `src/lib/pricing.ts` and reflected on the `/pricing` page.

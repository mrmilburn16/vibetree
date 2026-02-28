# Mac Runner Infrastructure Plan

How builds run today, what changes as users grow, and the migration path to cloud build infrastructure.

---

## Current Setup (Local Mac Runner)

The Mac runner is a Node.js script (`scripts/mac-runner.mjs`) that polls the VibetTree server for build jobs, runs `xcodebuild` locally, and installs apps to connected devices via `devicectl`.

**How it works:**
1. User taps "Install on iPhone" in the editor
2. Server creates a build job (in-memory queue)
3. Mac runner polls `POST /api/build-jobs/claim`, picks up the job
4. Runner downloads the Xcode project zip from the server
5. Runs `xcodebuild` with the project
6. On success: installs to a connected device via `devicectl`, or streams simulator screenshots
7. Reports status back to server; UI shows progress in real-time

**What it requires:**
- macOS with Xcode installed
- `MAC_RUNNER_TOKEN` set in `.env.local` (shared secret between server and runner)
- Server running on `localhost:3001` (or any reachable URL)
- For device installs: iPhone connected via USB or same network
- Optional: `APPETIZE_API_KEY` in `.env.local` (from [Appetize Organization → API Token](https://appetize.io/organization/api-token)) so simulator builds are uploaded to Appetize and the editor shows an interactive browser preview instead of a static screenshot

**Limitations:**
- 1 build at a time (sequential queue)
- Mac must be on and awake
- Only works for the machine owner
- Doesn't scale past ~10 active users

---

## Scaling Phases

### Phase 1: Local Mac (0-10 users) -- Current

| Detail | Value |
|--------|-------|
| Cost | $0 |
| Concurrency | 1 |
| Reliability | Depends on your laptop being open |
| Security | Best -- code never leaves your machine |

Run `npm run mac-runner` on your Mac. Good enough for development and early testing. No changes needed.

### Phase 2: Codemagic Free Tier (0-50 users) -- First Migration

| Detail | Value |
|--------|-------|
| Cost | $0 (500 free M2 minutes/month, ~250 builds) |
| Concurrency | 1 |
| Security | SOC 2 Type II, ephemeral VMs, GDPR compliant |
| Integration effort | Medium -- adapt build flow to Codemagic API |

**What changes:**
- Instead of mac-runner polling locally, server triggers builds via Codemagic REST API (`POST https://api.codemagic.io/builds`)
- Create a `codemagic.yaml` workflow that accepts a project zip, runs xcodebuild, and returns the .app/.ipa
- Build artifacts (the compiled app) download back to VibetTree server for device install
- Device install still happens via local mac-runner (only the build moves to cloud)

**What stays the same:**
- All server-side job tracking (`buildJobs.ts`)
- The preflight check UI
- Device install flow (devicectl on local Mac)

### Phase 3: Codemagic Pay-as-you-go (50-150 users)

| Detail | Value |
|--------|-------|
| Cost | ~$0.19/build ($0.095/min x 2 min), ~$57-285/mo at 300-1,500 builds |
| Concurrency | 1 included, +$49/mo per extra slot (up to 3 extra) |
| Security | Same SOC 2 Type II |

Same integration as Phase 2, just paying for overages past 500 minutes.

### Phase 4: Codemagic Fixed Plan (150+ users)

| Detail | Value |
|--------|-------|
| Cost | $3,990/year ($333/mo) |
| Concurrency | 3 included, +$1,500/year per extra (up to 10 total) |
| Minutes | Unlimited |
| Security | SOC 2 Type II, ISO 27001 (data center) |

**Why this is the sweet spot:**
- Unlimited builds means cost doesn't scale with usage
- 3 concurrent slots handle ~90 builds/hour (enough for 200+ active users)
- Burstable concurrency handles occasional spikes without buying permanent slots
- $333/mo is cheaper than pay-as-you-go once past ~3,500 minutes/month

**Concurrency math for reference:**

| Users | Avg builds/day | Builds/hour (12hr day) | Slots needed |
|-------|---------------|----------------------|-------------|
| 50 | 150 | 13 | 1-2 |
| 100 | 300 | 25 | 2-3 |
| 200 | 600 | 50 | 3 |
| 500 | 1,500 | 125 | 5 |

### Phase 5: Self-Hosted Mac Mini Fleet (500+ users, optional)

| Detail | Value |
|--------|-------|
| Upfront cost | ~$5,150 (8x Mac Mini M4 + networking) |
| Monthly cost | ~$130-150 (internet + electricity) |
| Concurrency | 8 |
| Break-even vs Codemagic | ~28 months |

Only consider this when:
- Revenue justifies the upfront hardware investment
- You have (or can hire) someone to maintain the fleet
- You need the cost savings at very high volume
- You're comfortable with the security/compliance tradeoffs (no SOC 2 audit)

---

## Service Comparison Summary

| Service | Best For | Cost (200 users) | Security | Integration Effort |
|---------|----------|-------------------|----------|--------------------|
| Local Mac | Dev/testing | $0 | Highest | None (current) |
| Codemagic | Production | $333/mo | SOC 2 Type II | Medium |
| GetMac | Budget option | $111/mo | ISO 27001 | Medium |
| RentaMac | Simple migration | $99/mo | No audit | Lowest |
| AWS EC2 Mac | Enterprise | $4,700+/mo | Best | High |
| Self-hosted fleet | High volume | $130/mo + $5K upfront | Your responsibility | None |

---

## Integration Architecture (Codemagic)

When migrating to Codemagic, the build flow changes from:

```
User -> Server -> Mac Runner (local) -> xcodebuild -> devicectl -> iPhone
```

To:

```
User -> Server -> Codemagic API -> Cloud xcodebuild -> .app artifact
                                                          |
                                     Server downloads .app
                                          |
                              Mac Runner (local) -> devicectl -> iPhone
```

The local mac-runner still handles the "last mile" device install via `devicectl`, since that requires physical/network proximity to the user's iPhone. The expensive part (compilation) moves to the cloud.

**Key integration points:**
- `POST https://api.codemagic.io/builds` -- trigger a build
- `codemagic.yaml` -- defines the build workflow (xcodebuild commands)
- Webhook or polling -- get notified when build completes
- Artifact download -- fetch the .app from Codemagic's storage

---

## Decision: What to do now

**Stay on the local Mac runner.** It works, it's free, and the priority is getting users, not optimizing infrastructure for users that don't exist yet.

When you have 10+ active users building apps, sign up for Codemagic's free tier and begin the integration work. The free 500 minutes/month will cover early growth while you build out the cloud build pipeline.

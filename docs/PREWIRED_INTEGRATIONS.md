# How to Pre-Wire Each Integration

This doc describes **how exactly** to implement each of the top 10 pre-wired integrations so generated apps can "just work" without the app builder managing OAuth, API keys, or provider dashboards.

---

## Shared Architecture

Every pre-wired integration follows the same pattern:

1. **Vibetree backend** exposes a small API (e.g. `POST /api/integrations/x/connect`, `POST /api/integrations/x/post`).
2. **Tokens/keys** live on Vibetree (per project and/or per end-user). The generated app never sees secrets.
3. **Generated app** calls your backend with:
   - **Project scope:** `projectId` (and optionally `userId` for multi-user apps) so you know which app and which user.
   - **Auth:** same auth as the rest of your app (e.g. session cookie or API key for the builder, or end-user token if you support it).
4. **LLM / skills** are updated so that when the user says "add X posting", the generated Swift code calls **your** URLs (e.g. `https://api.vibetree.com/api/integrations/x/post`) instead of implementing OAuth or Twitter SDK in the app.

Scoping choices:

- **Per project (app):** One connected account per generated app (the app builder connects their X/Stripe/etc.). Good for single-owner apps.
- **Per end-user:** Each person who uses the generated app connects their own X/Google. You need a notion of "current user" (e.g. anonymous id or Vibetree account) and store tokens keyed by `projectId + userId`.

Below, "user" means the **end-user of the generated app** (the person tapping "Connect X" in the built app). You can start with per-project (one account per app) and add per-end-user later.

---

## 1. X (Twitter)

**Goal:** "Connect X" does real OAuth; "Post" sends a real tweet.

**What you build**

| Piece | Where | Notes |
|-------|--------|------|
| Twitter Developer App | developer.twitter.com | One app (e.g. "Vibetree"). Get Consumer Key + Secret, enable OAuth 2.0 with PKCE, set callback URL to your backend. |
| Env vars | `.env` | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_ID_SECRET` (or `TWITTER_API_KEY`/`TWITTER_API_SECRET` for OAuth 1.0a if you use that). |
| Token store | DB or KV | Store `{ projectId, userId?, accessToken, refreshToken?, expiresAt }` for each connected account. |
| Routes | Next.js API | See below. |

**API surface (backend)**

- **Start OAuth (redirect user to Twitter):**  
  `GET /api/integrations/x/connect?projectId=xxx&userId=yyy`  
  - Build Twitter OAuth URL (PKCE), store `state` in session or signed cookie (tied to projectId/userId).  
  - Return 302 to Twitter’s authorize URL.

- **OAuth callback:**  
  `GET /api/integrations/x/callback?state=...&code=...`  
  - Exchange `code` for tokens, store by projectId (+ userId).  
  - Redirect to app deep link or a "Connected" page: `vibetreeapp://integrations/x/done` or your web success URL.

- **Post tweet:**  
  `POST /api/integrations/x/post`  
  - Body: `{ projectId, userId?, text }` (and optionally `mediaIds[]` if you add upload).  
  - Look up token for that project/user, call Twitter API v2 `POST /2/tweets`.  
  - Return `{ success, tweetId }` or error.

**Generated app (pre-wired)**

- "Connect X" button: open in browser or `ASWebAuthenticationSession`:  
  `https://api.vibetree.com/api/integrations/x/connect?projectId=\(projectId)&userId=\(userId)`  
- Store `projectId` (and `userId`) in the app (e.g. from your config or from a Vibetree runtime SDK).  
- "Post" button: `POST` to `https://api.vibetree.com/api/integrations/x/post` with `{ projectId, userId?, text }`, show success/error.

**Skills/prompts**

- In `social-cross-posting.json` (or a new `integrations-x.json`): when "X" or "Twitter" is detected, inject: "Use Vibetree’s pre-wired X integration: open [connect URL] for Connect, and POST to [post URL] with projectId and text. Do not implement Twitter OAuth or API keys in the app."

---

## 2. Stripe (payments)

**Goal:** App can create a checkout or accept a one-off payment without the builder touching Stripe dashboard or webhooks.

**What you build**

| Piece | Where | Notes |
|-------|--------|------|
| Stripe account | stripe.com | One account for Vibetree. |
| Env vars | `.env` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (if you use Connect or need webhooks). |
| Products/Prices | Stripe Dashboard or API | Optional: create a generic "Tip" or "Payment" product; or create prices per project later. |
| Routes | Next.js API | Create Checkout Session or PaymentIntent from your backend. |

**API surface**

- **Create checkout / payment link:**  
  `POST /api/integrations/stripe/create-checkout`  
  - Body: `{ projectId, amountCents?, currency?, successUrl, cancelUrl, metadata? }`.  
  - Create Stripe Checkout Session (or PaymentIntent + client secret). Return `{ url }` or `{ clientSecret }` for the client to open or confirm.

- **Optional – confirm one-off payment:**  
  `POST /api/integrations/stripe/confirm-payment`  
  - Body: `{ projectId, amountCents, currency, paymentMethodId? }`.  
  - Create and confirm PaymentIntent, return success/failure.

**Generated app**

- "Pay" / "Tip" opens the URL from `create-checkout` in Safari or in-app browser, or uses Stripe iOS SDK with `clientSecret` if you return that.  
- No Stripe publishable key or API key in the app; all calls go through your backend.

**Skills/prompts**

- When "payment", "tip", "subscription", "sell" is detected: inject usage of Vibetree Stripe endpoints; no Stripe SDK or keys in the app.

---

## 3. Google Sign-In

**Goal:** "Continue with Google" returns a real Google id/email without the builder creating a Google Cloud project.

**What you build**

| Piece | Where | Notes |
|-------|--------|------|
| Google Cloud project | console.cloud.google.com | One project. Create OAuth 2.0 Client ID (Web application) for your backend callback URL; optionally iOS client ID for the generated app if you use native Google Sign-In. |
| Env vars | `.env` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. |
| Token / profile store | DB or KV | Store `{ projectId, userId?, googleId, email?, accessToken?, refreshToken? }` if you need to call Google APIs on their behalf later. |

**API surface**

- **Start OAuth:**  
  `GET /api/integrations/google/connect?projectId=xxx&userId=yyy`  
  - Build Google OAuth URL (scopes: email, profile), store state, redirect to Google.

- **Callback:**  
  `GET /api/integrations/google/callback?state=...&code=...`  
  - Exchange code for tokens, fetch profile (email, id). Store and redirect back to app with e.g. a token or session that the app can use to call your "me" endpoint.

- **Get current user (optional):**  
  `GET /api/integrations/google/me?projectId=xxx&userId=yyy`  
  - Return `{ googleId, email, name }` from stored profile so the app can show "Signed in as …".

**Generated app**

- "Continue with Google" opens:  
  `https://api.vibetree.com/api/integrations/google/connect?projectId=\(projectId)&userId=\(userId)`.  
- After redirect, app gets session or token and optionally calls `/me` to display the user.

**Skills/prompts**

- For "Sign in with Google", "Google login": use Vibetree Google connect URL; no Google SDK or client ID in the app.

---

## 4. Email (transactional)

**Goal:** App can "Send email" without the builder signing up for SendGrid/Resend/Mailgun or handling API keys.

**What you build**

| Piece | Where | Notes |
|-------|--------|------|
| Provider | Resend, SendGrid, or Mailgun | One account. |
| Env vars | `.env` | e.g. `RESEND_API_KEY` or `SENDGRID_API_KEY`. |
| Rate limit / abuse | Your backend | Per projectId (and optionally per userId) to avoid abuse. |

**API surface**

- **Send email:**  
  `POST /api/integrations/email/send`  
  - Body: `{ projectId, to, subject, text?, html?, from? }`.  
  - Backend uses your provider’s API. Optionally set a default "from" (e.g. `noreply@vibetree.com` or a verified domain).  
  - Return `{ success }` or error.

**Generated app**

- "Send" / "Contact" / "Notify" calls this endpoint with `projectId` and the form fields. No email API key in the app.

**Skills/prompts**

- For "send email", "contact form", "notify": use Vibetree send-email endpoint; no provider SDK or keys in the app.

---

## 5. Instagram

**Goal:** "Connect Instagram" and "Post" (and optionally "Story") work via Meta Graph API.

**What you build**

| Piece | Where | Notes |
|-------|--------|------|
| Meta Developer App | developers.facebook.com | Create app, add "Instagram Graph API" and "Instagram Content Publishing". App Review required for production. |
| Env vars | `.env` | `META_APP_ID`, `META_APP_SECRET`. |
| Token store | DB/KV | Store long-lived tokens per project/user (Instagram Business/Creator accounts). |

**API surface**

- **Connect (OAuth):**  
  `GET /api/integrations/instagram/connect?projectId=xxx&userId=yyy`  
  - Redirect to Meta OAuth (scopes for instagram_basic, instagram_content_publish).  
  - Callback: exchange code, exchange for long-lived token, store. Redirect back to app.

- **Post:**  
  `POST /api/integrations/instagram/post`  
  - Body: `{ projectId, userId?, imageUrlOrBase64?, caption }`.  
  - Create container, then publish (Meta Graph API). Return success/error.

**Generated app**

- Connect opens your Instagram connect URL; Post calls your `/post` endpoint with media and caption. No Meta SDK or app ID in the app.

**Skills/prompts**

- For "Instagram", "post to Instagram": use Vibetree Instagram connect + post; no Meta SDK or tokens in the app.

---

## 6. Google Calendar

**Goal:** "Add to Google Calendar" creates a real event without the builder creating a GCP project.

**What you build**

| Piece | Where | Notes |
|-------|--------|------|
| Google Cloud project | Same or separate | Enable Google Calendar API. Use same OAuth client as Google Sign-In or a dedicated one. |
| Env vars | `.env` | Same `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; add Calendar scopes. |
| Token store | Same as Google Sign-In or keyed by integration | Store tokens with scope including Calendar. |

**API surface**

- **Connect (OAuth with Calendar scope):**  
  `GET /api/integrations/google-calendar/connect?projectId=xxx&userId=yyy`  
  - Redirect to Google with `.../auth/calendar` or `calendar.events` scope. Callback: store tokens, redirect to app.

- **Create event:**  
  `POST /api/integrations/google-calendar/events`  
  - Body: `{ projectId, userId?, summary, start, end?, description? }` (ISO dates).  
  - Call Calendar API `events.insert`. Return `{ eventId, link }`.

**Generated app**

- "Add to Google Calendar" calls your create-event endpoint; optional "Connect Google Calendar" uses your connect URL. No GCP or Calendar API key in the app.

**Skills/prompts**

- For "Google Calendar", "add to calendar", "schedule": use Vibetree Google Calendar connect + create event; no Calendar API in the app.

---

## 7. Slack

**Goal:** "Connect Slack" and "Post to channel" work without the builder creating a Slack app.

**What you build**

| Piece | Where | Notes |
|-------|--------|------|
| Slack app | api.slack.com | One app. OAuth scopes: `chat:write`, `channels:read` (and optionally `users:read`). Redirect URL: your callback. |
| Env vars | `.env` | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`. |
| Token store | DB/KV | Store `accessToken` (and optional `teamId`, `channelId`) per project/user. |

**API surface**

- **Connect:**  
  `GET /api/integrations/slack/connect?projectId=xxx&userId=yyy`  
  - Redirect to Slack OAuth. Callback: exchange code, store token, redirect to app.

- **Post message:**  
  `POST /api/integrations/slack/post`  
  - Body: `{ projectId, userId?, channelId?, text }`.  
  - Use stored token to call `chat.postMessage`. Return success/error.

- **List channels (optional):**  
  `GET /api/integrations/slack/channels?projectId=xxx&userId=yyy`  
  - Return `[{ id, name }]` so the app can let the user pick a channel.

**Generated app**

- Connect opens your Slack connect URL; Post calls `/post` with channel and text. No Slack client ID or token in the app.

**Skills/prompts**

- For "Slack", "post to Slack", "notify channel": use Vibetree Slack connect + post; no Slack SDK in the app.

---

## 8. LinkedIn

**Goal:** "Connect LinkedIn" and "Share" / "Post" to LinkedIn.

**What you build**

| Piece | Where | Notes |
|-------|--------|------|
| LinkedIn app | linkedin.com/developers | Create app, add "Share on LinkedIn" and "Sign In with LinkedIn". Redirect URL: your callback. |
| Env vars | `.env` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`. |
| Token store | DB/KV | Store access token per project/user. |

**API surface**

- **Connect:**  
  `GET /api/integrations/linkedin/connect?projectId=xxx&userId=yyy`  
  - Redirect to LinkedIn OAuth. Callback: exchange code, store token, redirect to app.

- **Post / share:**  
  `POST /api/integrations/linkedin/post`  
  - Body: `{ projectId, userId?, text }` (and optional media per LinkedIn API).  
  - Call LinkedIn UGC or Share API. Return success/error.

**Generated app**

- Connect and Post use your backend URLs only. No LinkedIn SDK or keys in the app.

**Skills/prompts**

- For "LinkedIn", "share to LinkedIn": use Vibetree LinkedIn connect + post.

---

## 9. Cloud storage (Google Drive or Dropbox)

**Goal:** "Save to Drive" or "Backup to Dropbox" uploads a file without the builder setting up OAuth or API keys.

**What you build**

| Piece | Where | Notes |
|-------|--------|------|
| Google: same as above | Use same GCP project | Add Drive API, Drive scope. |
| Or Dropbox app | dropbox.com/developers | Create app, OAuth 2. Redirect URL: your callback. |
| Env vars | `.env` | `GOOGLE_*` for Drive, or `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`. |
| Token store | DB/KV | Store Drive or Dropbox token per project/user. |

**API surface (example: Drive)**

- **Connect:**  
  `GET /api/integrations/drive/connect?projectId=xxx&userId=yyy`  
  - Redirect to Google with Drive scope. Callback: store token, redirect to app.

- **Upload file:**  
  `POST /api/integrations/drive/upload`  
  - Body: multipart or `{ projectId, userId?, fileName, mimeType, base64Content }`.  
  - Use Drive API `files.create`. Return `{ fileId, webViewLink }`.

**Generated app**

- Connect uses your URL; "Save to Drive" sends file to your upload endpoint. No Drive/Dropbox SDK or secrets in the app.

**Skills/prompts**

- For "Google Drive", "save to Drive", "Dropbox", "backup": use Vibetree Drive/Dropbox connect + upload.

---

## 10. SMS (Twilio) or Push (FCM / APNs)

**Goal:** App can send an SMS or a push notification without the builder having Twilio/Firebase or APNs certs.

**SMS (Twilio)**

| Piece | Where | Notes |
|-------|--------|------|
| Twilio account | twilio.com | One account. |
| Env vars | `.env` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (or pool). |
| Rate limit | Backend | Per projectId/userId to avoid abuse. |

**API surface**

- **Send SMS:**  
  `POST /api/integrations/sms/send`  
  - Body: `{ projectId, to, body }`.  
  - Call Twilio API. Return `{ success, sid }` or error.

**Generated app**

- "Send SMS", "Verify phone" (you send code and optionally verify in another endpoint) call your backend. No Twilio credentials in the app.

**Push (FCM / APNs)**

| Piece | Where | Notes |
|-------|--------|------|
| Firebase or APNs | Firebase Console or Apple Developer | One Firebase project and/or APNs key/cert for Vibetree. |
| Env vars | `.env` | `FIREBASE_SERVICE_ACCOUNT_JSON` or path; or APNs key/cert. |
| Token store | DB/KV | Store FCM/APNs tokens per projectId + userId (or deviceId). |

**API surface**

- **Register device token:**  
  `POST /api/integrations/push/register`  
  - Body: `{ projectId, userId?, token, platform: "ios"|"android" }`.  
  - Store token for that project/user.

- **Send push:**  
  `POST /api/integrations/push/send`  
  - Body: `{ projectId, userId?, title?, body }`.  
  - Look up token(s), send via FCM or APNs. Return success/error.

**Generated app**

- App gets FCM/APNs token (system APIs), sends it to your register endpoint. "Notify" or "Send push" calls your send endpoint. No Firebase or APNs secrets in the app.

**Skills/prompts**

- For "SMS", "Twilio", "send text": use Vibetree SMS send.  
- For "push notification", "notify user": use Vibetree push register + send.

---

## Implementation checklist (per integration)

For each of the 10:

1. **Provider account** – Create one app/account (Twitter, Stripe, Google, etc.).
2. **Env vars** – Add to `.env.example` and your deployment config.
3. **Token/key storage** – Define schema (e.g. `integrations` table: `projectId`, `userId?`, `provider`, `accessToken`, `refreshToken?`, `expiresAt?`, `meta?`).
4. **Routes** – Add under `src/app/api/integrations/[provider]/` (e.g. `connect`, `callback`, `post`, `send`).
5. **Base URL** – Use one constant (e.g. `process.env.NEXT_PUBLIC_API_BASE_URL` or `https://api.vibetree.com`) so the generated app can call your API.
6. **Skills + prompts** – Update `data/skills/*.json` and master prompts in `claudeAdapter.ts` / `structuredOutput.ts` so the LLM generates calls to your endpoints (with `projectId` and optional `userId`) instead of direct provider SDKs or OAuth in the app.
7. **Generated app config** – Ensure the built app receives `projectId` (and optionally `userId`) at runtime (e.g. from Vibetree config or login), and that the base URL is injectable (e.g. build-time or runtime config).

Start with **X (Twitter)** and **Email** (no OAuth for email); then add **Stripe** and **Google Sign-In** to cover the most common "post, pay, sign in" flows.

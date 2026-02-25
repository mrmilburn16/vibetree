# Firebase Auth & Persistence Setup

This guide walks you through enabling Firebase so you can create a real account and have your apps saved to the cloud.

## 1. Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create one)
3. **Enable Authentication:**
   - Build → Authentication → Get started
   - Sign-in method → Email/Password → Enable → Save

## 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

### Server (Firebase Admin)

From **Project Settings → Service Accounts → Generate new private key**:

- `FIREBASE_PROJECT_ID` – your project ID
- `FIREBASE_CLIENT_EMAIL` – from the JSON key
- `FIREBASE_PRIVATE_KEY` – from the JSON key (keep the `\n` for newlines)

### Client (Firebase Web)

From **Project Settings → General → Your apps → Web app**:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` – `{project-id}.firebaseapp.com`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` – `{project-id}.appspot.com`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 3. Firestore Security Rules

Deploy the rules in `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

Or paste the rules in **Firestore → Rules** in the Firebase Console.

## 4. Restart Dev Server

After adding env vars:

```bash
npm run dev
```

## 5. Test the Flow

1. Go to `/sign-up`
2. Create an account with email and password
3. You’ll be redirected to the dashboard
4. Create a new app
5. Describe your app in the chat and wait for it to build
6. Sign out
7. Sign back in
8. Your app should appear on the dashboard

---

**Without Firebase:** The app still works with mock auth (localStorage). Sign-in accepts any email/password and stores a session locally. Projects stay in localStorage and are not synced across devices.

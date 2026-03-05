# Firebase setup for VibeTree Companion

The companion app uses Firebase Auth so it can send a valid ID token to the server and load projects/chat created on the web.

**If the iOS build fails with "Unable to find module dependency: 'FirebaseAuth'"**  
Open the project in Xcode, go to **File → Add Package Dependencies**, enter `https://github.com/firebase/firebase-ios-sdk`, add **FirebaseAuth** and **FirebaseCore** to the VibeTreeCompanion target, then build again. The project file already references this package; re-adding via Xcode can fix module resolution on some setups.

1. **GoogleService-Info.plist**  
   Replace `VibeTreeCompanion/VibeTreeCompanion/GoogleService-Info.plist` with the one from your Firebase project (same project as the web app):
   - Firebase Console → Project settings → Your apps → Add app (iOS) if needed → Download `GoogleService-Info.plist`
   - Or copy the values from your web app’s Firebase config (project ID, API key, etc.) into the existing plist.

2. **Server env**  
   The login API uses `FIREBASE_WEB_API_KEY` or `NEXT_PUBLIC_FIREBASE_API_KEY` to verify email/password. Ensure one of these is set in `.env.local` (or your deployment env).

After that, sign in on iOS with the same email/password as on the web; the app will receive a custom token, sign in with Firebase Auth, and use the resulting ID token for all API requests.

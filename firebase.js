import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase Web API config. These values are public (they identify the
// project, not authorize it) — embedding them in the client bundle is
// the supported pattern. Pulled from EXPO_PUBLIC_* env vars at build
// time. Get them at Firebase Console → Project Settings → Your apps →
// Web app → SDK setup and configuration.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

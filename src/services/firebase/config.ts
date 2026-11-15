import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** Development builds may point at the local Firebase Emulator Suite instead of a live project. */
export const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || null;

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

export const firebaseApp = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const db = firebaseApp ? getFirestore(firebaseApp) : null;

/** True when Auth, Firestore, and Functions should all use the local Firebase Emulator Suite. */
export const useEmulators =
  Boolean(emulatorHost) && process.env.EXPO_PUBLIC_APP_ENV !== 'production';

if (db && useEmulators && emulatorHost) {
  connectFirestoreEmulator(db, emulatorHost, 8080);
}

export const firebaseConfigurationMessage =
  'Firebase is not configured. Add the EXPO_PUBLIC_FIREBASE_* values to your local .env file.';

export function requireDb(): Firestore {
  if (!db) throw new Error(firebaseConfigurationMessage);
  return db;
}

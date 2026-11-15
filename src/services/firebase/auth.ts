import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type Persistence,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  db,
  emulatorHost,
  firebaseApp,
  firebaseConfigurationMessage,
  useEmulators,
} from '@/src/services/firebase/config';
import type { UserProfile, UserRole } from '@/src/types/auth';

// Firebase v13 does not currently expose the React Native persistence entrypoint
// through the public `firebase/auth` TypeScript export map. The RN bundle itself
// remains available here; keep this adapter isolated until the upstream export is restored.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('@firebase/auth/dist/rn/index.js') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

const sessionUserKey = 'meditrack:last-authenticated-user';
let authInstance: Auth | null = null;

function requireServices(): { auth: Auth; firestore: NonNullable<typeof db> } {
  if (!firebaseApp || !db) throw new Error(firebaseConfigurationMessage);
  if (!authInstance) {
    try {
      authInstance = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      authInstance = getAuth(firebaseApp);
    }
    if (useEmulators)
      connectAuthEmulator(authInstance, `http://${emulatorHost}:9099`, { disableWarnings: true });
  }
  return { auth: authInstance, firestore: db };
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  const { auth } = requireServices();
  return onAuthStateChanged(auth, callback);
}

export async function register(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
) {
  const { auth, firestore } = requireServices();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await setDoc(doc(firestore, 'users', credential.user.uid), {
    email: credential.user.email ?? email.trim().toLowerCase(),
    displayName: displayName.trim(),
    role,
    timeZone: deviceTimeZone(),
    createdAt: serverTimestamp(),
  });
  // Caregivers must verify their email before they can accept an invitation.
  await sendEmailVerification(credential.user).catch(() => undefined);
  await SecureStore.setItemAsync(sessionUserKey, credential.user.uid);
  return credential.user;
}

export async function login(email: string, password: string) {
  const { auth } = requireServices();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await SecureStore.setItemAsync(sessionUserKey, credential.user.uid);
  return credential.user;
}

export async function logout() {
  const { auth } = requireServices();
  await signOut(auth);
  await SecureStore.deleteItemAsync(sessionUserKey);
}

export async function requestPasswordReset(email: string) {
  const { auth } = requireServices();
  await sendPasswordResetEmail(auth, email.trim());
}

export async function getUserProfile(user: User): Promise<UserProfile> {
  const { firestore } = requireServices();
  const snapshot = await getDoc(doc(firestore, 'users', user.uid));
  if (!snapshot.exists())
    throw new Error('Your account profile could not be found. Please contact support.');
  const data = snapshot.data();
  if (data.role !== 'patient' && data.role !== 'caregiver')
    throw new Error('Your account has an invalid role.');
  return {
    id: user.uid,
    email: user.email ?? String(data.email ?? ''),
    displayName: String(data.displayName ?? ''),
    role: data.role,
    timeZone: typeof data.timeZone === 'string' ? data.timeZone : undefined,
  };
}

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Keeps the profile's time zone current; the server uses it to detect missed doses. */
export async function syncTimeZone(profile: UserProfile) {
  const { firestore } = requireServices();
  const timeZone = deviceTimeZone();
  if (profile.timeZone === timeZone) return profile;
  await updateDoc(doc(firestore, 'users', profile.id), {
    timeZone,
    displayName: profile.displayName,
    updatedAt: serverTimestamp(),
  });
  return { ...profile, timeZone };
}

export async function resendVerificationEmail() {
  const { auth } = requireServices();
  if (!auth.currentUser) throw new Error('Please sign in again.');
  await sendEmailVerification(auth.currentUser);
}

/** Reloads the user and refreshes the ID token so security rules see a newly verified email. */
export async function refreshEmailVerification() {
  const { auth } = requireServices();
  if (!auth.currentUser) return false;
  await reload(auth.currentUser);
  await auth.currentUser.getIdToken(true);
  return auth.currentUser.emailVerified;
}

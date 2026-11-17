import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

export const PROJECT_ID = 'demo-meditrack';
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const [hostname, port] = host.split(':') as [string, string];
const apps: FirebaseApp[] = [];
let counter = 0;

export type TestUser = { uid: string; email: string; emailVerified?: boolean };

/** A Firestore client authenticated as the given user, talking to the emulator with rules on. */
export function clientFor(user: TestUser | null): Firestore {
  counter += 1;
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake-api-key' }, `test-${counter}`);
  apps.push(app);
  const store = getFirestore(app);
  connectFirestoreEmulator(
    store,
    hostname,
    Number(port),
    user
      ? {
          mockUserToken: {
            user_id: user.uid,
            sub: user.uid,
            email: user.email,
            email_verified: user.emailVerified ?? true,
          },
        }
      : undefined,
  );
  return store;
}

export async function resetEmulator() {
  await closeClients();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(
      `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    );
    if (response.ok) return;
    // 409: a transaction from the previous test is still settling.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Could not clear the Firestore emulator.');
}

export async function closeClients() {
  await Promise.all(apps.splice(0).map((app) => deleteApp(app)));
}

export async function createProfile(
  store: Firestore,
  user: TestUser,
  role: 'patient' | 'caregiver',
  displayName: string,
) {
  await setDoc(doc(store, 'users', user.uid), { email: user.email, displayName, role });
}

/** Expects a Firestore call to be rejected by security rules. */
export async function expectDenied(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ code: 'permission-denied' });
}

import { EmailAuthProvider, getAuth, reauthenticateWithCredential } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import {
  emulatorHost,
  firebaseApp,
  firebaseConfigurationMessage,
  useEmulators,
} from '@/src/services/firebase/config';

/**
 * Permanently deletes the signed-in account and all of its data via the `deleteMyAccount`
 * Cloud Function. Re-authenticates first because deletion requires a recent sign-in.
 */
export async function deleteAccount(password: string) {
  if (!firebaseApp) throw new Error(firebaseConfigurationMessage);
  const user = getAuth(firebaseApp).currentUser;
  if (!user?.email) throw new Error('Please sign in again.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const functions = getFunctions(firebaseApp, 'us-central1');
  if (useEmulators && emulatorHost) connectFunctionsEmulator(functions, emulatorHost, 5001);
  await httpsCallable(functions, 'deleteMyAccount')();
}

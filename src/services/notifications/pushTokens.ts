import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { deleteDoc, doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { requireDb } from '@/src/services/firebase/config';

const tokenDocId = (token: string) => token.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200);

function projectId() {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/**
 * Registers this device for caregiver push alerts sent by Cloud Functions. Requires notification
 * permission and an EAS project ID; without them it returns null and the in-app alert feed is
 * the only alert channel.
 */
export async function registerPushToken(userId: string, store: Firestore = requireDb()) {
  const id = projectId();
  if (!id || Platform.OS === 'web') return null;
  const permission = await Notifications.getPermissionsAsync();
  const granted = permission.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  await setDoc(doc(store, 'users', userId, 'pushTokens', tokenDocId(token)), {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    updatedAt: serverTimestamp(),
  });
  return token;
}

/** Removes this device's token so a signed-out device stops receiving the account's alerts. */
export async function unregisterPushToken(userId: string, store: Firestore = requireDb()) {
  const id = projectId();
  if (!id || Platform.OS === 'web') return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  await deleteDoc(doc(store, 'users', userId, 'pushTokens', tokenDocId(token)));
}

import type { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type PushMessage = { title: string; body: string; data: Record<string, string> };

/**
 * Sends a push notification to every registered device of a user via the Expo Push API.
 * Payloads are deliberately minimal: push content passes through Expo, Apple, and Google, so it
 * never includes medicine names or other health details. The caregiver opens the app to see them.
 * Tokens that Expo reports as no longer registered are deleted.
 */
export async function sendPushToUser(db: Firestore, userId: string, message: PushMessage) {
  const tokens = await db.collection('users').doc(userId).collection('pushTokens').get();
  if (tokens.empty) return 0;
  const entries = tokens.docs
    .map((doc) => ({ ref: doc.ref, token: String(doc.get('token') ?? '') }))
    .filter(
      (entry) =>
        entry.token.startsWith('ExponentPushToken[') || entry.token.startsWith('ExpoPushToken['),
    );
  if (!entries.length) return 0;
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      entries.map((entry) => ({
        to: entry.token,
        title: message.title,
        body: message.body,
        data: message.data,
        sound: 'default',
        channelId: 'medication-alerts',
        priority: 'high',
      })),
    ),
  });
  if (!response.ok) {
    logger.warn('Expo push request failed', { status: response.status });
    return 0;
  }
  const payload = (await response.json()) as {
    data?: { status: string; details?: { error?: string } }[];
  };
  let delivered = 0;
  await Promise.all(
    (payload.data ?? []).map(async (ticket, index) => {
      if (ticket.status === 'ok') delivered += 1;
      else if (ticket.details?.error === 'DeviceNotRegistered') await entries[index]?.ref.delete();
    }),
  );
  return delivered;
}

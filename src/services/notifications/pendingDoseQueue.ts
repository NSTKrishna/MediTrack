import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DoseOutcome } from '@/src/types/dose';

const queueKey = 'meditrack:pending-dose-actions';
const handledKey = 'meditrack:handled-notification-responses';
const MAX_HANDLED = 200;
export const MAX_ATTEMPTS = 20;

/** A dose outcome confirmed from a notification that has not yet been written to Firestore. */
export type PendingDoseAction = {
  key: string;
  userId: string;
  medicineId: string;
  medicineName: string;
  scheduledFor: string;
  outcome: DoseOutcome;
  attempts: number;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const readPendingDoseActions = () => readJson<PendingDoseAction[]>(queueKey, []);

export async function writePendingDoseActions(items: PendingDoseAction[]) {
  await AsyncStorage.setItem(queueKey, JSON.stringify(items));
}

/** Adds an action unless one with the same key is already queued. */
export async function enqueuePendingDoseAction(item: Omit<PendingDoseAction, 'attempts'>) {
  const items = await readPendingDoseActions();
  if (items.some((existing) => existing.key === item.key)) return false;
  await writePendingDoseActions([...items, { ...item, attempts: 0 }]);
  return true;
}

export async function wasResponseHandled(key: string) {
  return (await readJson<string[]>(handledKey, [])).includes(key);
}

export async function markResponseHandled(key: string) {
  const keys = (await readJson<string[]>(handledKey, [])).filter((item) => item !== key);
  keys.push(key);
  await AsyncStorage.setItem(handledKey, JSON.stringify(keys.slice(-MAX_HANDLED)));
}

export async function clearPendingDoseActions() {
  await AsyncStorage.multiRemove([queueKey]);
}

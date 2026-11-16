import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { confirmDose, type ConfirmDoseResult } from '@/src/services/firebase/doses';
import {
  ACTION_SKIP,
  ACTION_SNOOZE,
  ACTION_TAKEN,
  ALERT_CHANNEL,
  DOSE_CATEGORY,
  REMINDER_CHANNEL,
  SNOOZE_MINUTES,
  actionToOutcome,
  buildReminderTriggers,
  lowStockContent,
  parseReminderData,
  reminderContent,
  reminderSignature,
  remindersLive,
  resolveDoseSlot,
  responseKey,
  type ReminderData,
  type ReminderOptions,
} from '@/src/services/notifications/reminderLogic';
import {
  MAX_ATTEMPTS,
  enqueuePendingDoseAction,
  markResponseHandled,
  readPendingDoseActions,
  wasResponseHandled,
  writePendingDoseActions,
  type PendingDoseAction,
} from '@/src/services/notifications/pendingDoseQueue';
import { usePreferencesStore } from '@/src/store/usePreferencesStore';
import type { Medicine } from '@/src/types/medicine';

const registryKey = 'meditrack:reminder-ids';
type RegistryEntry = { signature: string; ids: string[] };
type Registry = Record<string, RegistryEntry>;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function readRegistry(): Promise<Registry> {
  try {
    const raw = await AsyncStorage.getItem(registryKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, RegistryEntry | string[]>;
    // Entries written before Milestone 6 were bare ID arrays; treat them as needing a reschedule.
    return Object.fromEntries(
      Object.entries(parsed).map(([id, entry]) => [
        id,
        Array.isArray(entry) ? { signature: '', ids: entry } : entry,
      ]),
    );
  } catch {
    return {};
  }
}

const writeRegistry = (registry: Registry) =>
  AsyncStorage.setItem(registryKey, JSON.stringify(registry));

export async function configureMedicationNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Medication reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
      name: 'Stock and care alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
  await Notifications.setNotificationCategoryAsync(DOSE_CATEGORY, [
    // Every action foregrounds the app: Expo does not deliver responses to a killed app for
    // background-only actions, which would silently lose a confirmation.
    { identifier: ACTION_TAKEN, buttonTitle: 'Taken', options: { opensAppToForeground: true } },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: `Snooze ${SNOOZE_MINUTES} min`,
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_SKIP,
      buttonTitle: 'Skip',
      options: { opensAppToForeground: true, isDestructive: true },
    },
  ]);
}

export async function hasReminderPermission() {
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function requestReminderPermissions() {
  const existing = await Notifications.getPermissionsAsync();
  return (existing.granted ? existing : await Notifications.requestPermissionsAsync()).granted;
}

async function scheduleForMedicine(userId: string, medicine: Medicine, discreet: boolean) {
  const ids: string[] = [];
  const content = reminderContent(medicine, discreet);
  for (const trigger of buildReminderTriggers(medicine)) {
    const data: ReminderData = {
      kind: 'dose',
      userId,
      medicineId: medicine.id,
      medicineName: medicine.name,
      hour: trigger.hour,
      minute: trigger.minute,
    };
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: { ...content, sound: 'default', categoryIdentifier: DOSE_CATEGORY, data },
        trigger:
          trigger.type === 'weekly'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: trigger.weekday,
                hour: trigger.hour,
                minute: trigger.minute,
                channelId: REMINDER_CHANNEL,
              }
            : {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: trigger.hour,
                minute: trigger.minute,
                channelId: REMINDER_CHANNEL,
              },
      }),
    );
  }
  return ids;
}

async function cancelIds(ids: string[]) {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)),
  );
}

let syncChain: Promise<unknown> = Promise.resolve();

/**
 * Reconciles scheduled reminders with the medicine list: schedules new or changed medicines,
 * and cancels reminders for medicines that were deleted, deactivated, or ended. Safe to call
 * whenever the medicine list changes; unchanged medicines are left alone.
 */
export function syncMedicineReminders(
  userId: string,
  medicines: Medicine[],
  options: ReminderOptions,
  now = new Date(),
) {
  const run = async () => {
    const granted = await hasReminderPermission();
    const registry = await readRegistry();
    const next: Registry = {};
    for (const medicine of medicines) {
      const signature = reminderSignature(medicine, userId, options, now);
      const current = registry[medicine.id];
      if (current && current.signature === signature) {
        next[medicine.id] = current;
        continue;
      }
      if (current) await cancelIds(current.ids);
      const live = options.enabled && remindersLive(medicine, now) && granted;
      const ids = live ? await scheduleForMedicine(userId, medicine, options.discreet) : [];
      // Without permission, leave the signature blank so a later sync retries.
      next[medicine.id] = { signature: granted ? signature : '', ids };
    }
    const known = new Set(medicines.map((medicine) => medicine.id));
    for (const [id, entry] of Object.entries(registry))
      if (!known.has(id)) await cancelIds(entry.ids);
    await writeRegistry(next);
  };
  const result = syncChain.then(run, run);
  syncChain = result.catch(() => undefined);
  return result;
}

/** Cancels every dose reminder on this device, e.g. on sign-out. */
export async function cancelAllMedicationReminders() {
  const registry = await readRegistry();
  await Promise.all(Object.values(registry).map((entry) => cancelIds(entry.ids)));
  await AsyncStorage.removeItem(registryKey);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await cancelIds(
    scheduled
      .filter((item) => parseReminderData(item.content.data) !== null)
      .map((item) => item.identifier),
  );
}

export async function notifyLowStock(medicineName: string, remaining: number) {
  const preferences = usePreferencesStore.getState();
  if (!preferences.lowStockAlertsEnabled || !(await hasReminderPermission())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      ...lowStockContent(medicineName, remaining, preferences.discreetNotifications),
      data: { kind: 'low-stock' },
    },
    trigger: Platform.OS === 'android' ? { channelId: ALERT_CHANNEL } : null,
  });
}

/** Shows a low-stock notification if confirming a dose took the medicine below its refill point. */
export async function afterDoseRecorded(result: ConfirmDoseResult, medicineName: string) {
  if (result.status === 'recorded' && result.stock?.crossedLowStock)
    await notifyLowStock(medicineName, result.stock.next);
}

async function scheduleSnooze(data: ReminderData, slot: Date) {
  const discreet = usePreferencesStore.getState().discreetNotifications;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: discreet ? 'Medication reminder (snoozed)' : `Reminder: ${data.medicineName}`,
      body: discreet ? 'Open MediTrack to see which dose is due.' : 'Your snoozed dose is due now.',
      sound: 'default',
      categoryIdentifier: DOSE_CATEGORY,
      data: { ...data, scheduledFor: slot.toISOString() } satisfies ReminderData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: SNOOZE_MINUTES * 60,
      repeats: false,
      channelId: REMINDER_CHANNEL,
    },
  });
}

export type ResponseHandling = 'ignored' | 'duplicate' | 'snoozed' | 'queued';

/**
 * Converts a notification action into a durable pending action. Only the explicit Taken and
 * Skip buttons record outcomes; tapping the notification body or dismissing it never does.
 * Each response is handled at most once even if the OS redelivers it.
 */
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<ResponseHandling> {
  const action = response.actionIdentifier;
  if (action === Notifications.DEFAULT_ACTION_IDENTIFIER) return 'ignored';
  const data = parseReminderData(response.notification.request.content.data);
  if (!data) return 'ignored';
  const key = responseKey(response);
  if (await wasResponseHandled(key)) return 'duplicate';
  const slot = resolveDoseSlot(data, new Date(response.notification.date));
  let result: ResponseHandling = 'ignored';
  if (action === ACTION_SNOOZE) {
    await scheduleSnooze(data, slot);
    result = 'snoozed';
  } else {
    const outcome = actionToOutcome(action);
    if (outcome) {
      await enqueuePendingDoseAction({
        key,
        userId: data.userId,
        medicineId: data.medicineId,
        medicineName: data.medicineName,
        scheduledFor: slot.toISOString(),
        outcome,
      });
      result = 'queued';
    }
  }
  await markResponseHandled(key);
  await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(
    () => undefined,
  );
  return result;
}

const permanentErrors = new Set([
  'permission-denied',
  'not-found',
  'invalid-argument',
  'unauthenticated',
]);
const errorCode = (error: unknown) =>
  typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

let drainChain: Promise<number> = Promise.resolve(0);

/**
 * Writes queued notification actions for the signed-in user. Actions are removed once recorded
 * (or found to be duplicates); transient failures stay queued for the next attempt. Actions that
 * belong to another account stay queued and are never written to the signed-in user.
 * Resolves to the number of actions still waiting for this user.
 */
export function drainPendingDoseActions(
  userId: string | null | undefined,
  record: typeof confirmDose = confirmDose,
) {
  const run = async () => {
    const items = await readPendingDoseActions();
    if (!items.length) return 0;
    const remaining: PendingDoseAction[] = [];
    for (const item of items) {
      // Never write one account's confirmation into another account. Actions for an account
      // that is not signed in wait until it is.
      if (!userId || item.userId !== userId) {
        remaining.push(item);
        continue;
      }
      try {
        const result = await record(userId, {
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          scheduledFor: new Date(item.scheduledFor),
          outcome: item.outcome,
          source: 'notification',
        });
        await afterDoseRecorded(result, item.medicineName).catch(() => undefined);
      } catch (error) {
        const attempts = item.attempts + 1;
        if (!permanentErrors.has(errorCode(error)) && attempts < MAX_ATTEMPTS)
          remaining.push({ ...item, attempts });
      }
    }
    // Keep anything queued while this drain was running.
    const latest = await readPendingDoseActions();
    const processed = new Set(items.map((item) => item.key));
    const merged = [...remaining, ...latest.filter((item) => !processed.has(item.key))];
    await writePendingDoseActions(merged);
    return merged.filter((item) => item.userId === userId).length;
  };
  const result = drainChain.then(run, run);
  drainChain = result.catch(() => 0);
  return result;
}

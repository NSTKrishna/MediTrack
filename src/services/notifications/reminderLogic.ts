import {
  normalizeSlot,
  parseClockTime,
  parseLocalDate,
  startOfLocalDay,
} from '@/src/features/doses/schedule';
import type { DoseOutcome } from '@/src/types/dose';
import type { Medicine } from '@/src/types/medicine';

export const DOSE_CATEGORY = 'medication-dose';
export const REMINDER_CHANNEL = 'medication-reminders';
export const ALERT_CHANNEL = 'medication-alerts';
export const SNOOZE_MINUTES = 10;

export const ACTION_TAKEN = 'TAKEN';
export const ACTION_SNOOZE = 'SNOOZE';
export const ACTION_SKIP = 'SKIP';

/** Payload carried by every dose reminder. It is not displayed to the user. */
export type ReminderData = {
  kind: 'dose';
  userId: string;
  medicineId: string;
  medicineName: string;
  hour: number;
  minute: number;
  /** Present on snoozed reminders: the original slot being reminded about. */
  scheduledFor?: string;
};

export function parseReminderData(raw: unknown): ReminderData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.medicineId !== 'string' || !data.medicineId) return null;
  if (typeof data.userId !== 'string' || !data.userId) return null;
  return {
    kind: 'dose',
    userId: data.userId,
    medicineId: data.medicineId,
    medicineName: typeof data.medicineName === 'string' ? data.medicineName : 'Medicine',
    hour: typeof data.hour === 'number' ? data.hour : -1,
    minute: typeof data.minute === 'number' ? data.minute : -1,
    scheduledFor: typeof data.scheduledFor === 'string' ? data.scheduledFor : undefined,
  };
}

/**
 * Works out which scheduled slot a reminder belongs to. Repeating reminders carry the clock
 * time; the slot is that time on the day the reminder was delivered, so the user tapping
 * "Taken" hours later still confirms the original slot.
 */
export function resolveDoseSlot(data: ReminderData, deliveredAt: Date): Date {
  if (data.scheduledFor) {
    const explicit = new Date(data.scheduledFor);
    if (!Number.isNaN(explicit.getTime())) return normalizeSlot(explicit);
  }
  if (data.hour >= 0 && data.hour < 24 && data.minute >= 0 && data.minute < 60) {
    const slot = new Date(deliveredAt);
    slot.setHours(data.hour, data.minute, 0, 0);
    // A reminder delivered just after midnight for a late-evening slot belongs to the prior day.
    if (slot.getTime() - deliveredAt.getTime() > 6 * 60 * 60 * 1000)
      slot.setDate(slot.getDate() - 1);
    return slot;
  }
  return normalizeSlot(deliveredAt);
}

/** Only explicit action buttons record an outcome. Opening or dismissing never does. */
export function actionToOutcome(actionIdentifier: string): DoseOutcome | null {
  if (actionIdentifier === ACTION_TAKEN) return 'taken';
  if (actionIdentifier === ACTION_SKIP) return 'skipped';
  return null;
}

export type ReminderTrigger =
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'weekly'; weekday: number; hour: number; minute: number };

/** Builds the repeating triggers for a medicine. Expo weekdays are 1 = Sunday … 7 = Saturday. */
export function buildReminderTriggers(
  medicine: Pick<Medicine, 'frequency' | 'scheduledTimes' | 'selectedWeekdays'>,
): ReminderTrigger[] {
  const times = [
    ...new Map(
      medicine.scheduledTimes
        .map(parseClockTime)
        .filter((value): value is NonNullable<typeof value> => value !== null)
        .map((value) => [`${value.hour}:${value.minute}`, value] as const),
    ).values(),
  ];
  if (medicine.frequency === 'selected-weekdays') {
    const weekdays = [...new Set(medicine.selectedWeekdays)].filter((day) => day >= 0 && day <= 6);
    return weekdays.flatMap((day) =>
      times.map((time) => ({ type: 'weekly' as const, weekday: day + 1, ...time })),
    );
  }
  return times.map((time) => ({ type: 'daily' as const, ...time }));
}

/** A medicine needs live reminders when it is active, has started, and has not ended. */
export function remindersLive(
  medicine: Pick<Medicine, 'active' | 'startDate' | 'endDate'>,
  now = new Date(),
) {
  if (!medicine.active) return false;
  const today = startOfLocalDay(now);
  const start = parseLocalDate(medicine.startDate);
  const end = parseLocalDate(medicine.endDate);
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

export type ReminderOptions = { discreet: boolean; enabled: boolean };

/** Changes to any of these fields require the medicine's reminders to be rescheduled. */
export function reminderSignature(
  medicine: Medicine,
  userId: string,
  options: ReminderOptions,
  now = new Date(),
) {
  const live = options.enabled && remindersLive(medicine, now);
  return JSON.stringify({
    live,
    userId,
    discreet: options.discreet,
    name: medicine.name,
    dosage: medicine.dosage,
    unit: medicine.dosageUnit,
    triggers: live ? buildReminderTriggers(medicine) : [],
  });
}

export function reminderContent(medicine: Medicine, discreet: boolean) {
  return discreet
    ? { title: 'Medication reminder', body: 'Open MediTrack to see which dose is due.' }
    : {
        title: `Time for ${medicine.name}`,
        body: [medicine.dosage, medicine.dosageUnit].filter(Boolean).join(' '),
      };
}

export function lowStockContent(medicineName: string, remaining: number, discreet: boolean) {
  if (discreet)
    return {
      title: 'Refill reminder',
      body: 'A medicine is running low. Open MediTrack to see it.',
    };
  return remaining === 0
    ? { title: `${medicineName} is out of stock`, body: 'Record a refill once you have more.' }
    : {
        title: `${medicineName} is running low`,
        body: `${remaining} dose${remaining === 1 ? '' : 's'} left. Plan a refill soon.`,
      };
}

export function responseKey(response: {
  actionIdentifier: string;
  notification: { date: number; request: { identifier: string } };
}) {
  return `${response.notification.request.identifier}:${response.actionIdentifier}:${response.notification.date}`;
}

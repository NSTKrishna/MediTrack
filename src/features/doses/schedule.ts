import type { Medicine } from '@/src/types/medicine';

/** A scheduled dose becomes "missed" when it has not been confirmed this long after its time. */
export const MISSED_AFTER_MINUTES = 120;

export type ClockTime = { hour: number; minute: number };

/** Parses "8:00 AM", "08:00", or "20:30" into a 24-hour clock time. */
export function parseClockTime(value: string): ClockTime | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  }
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? { hour, minute } : null;
}

export function formatClockTime({ hour, minute }: ClockTime) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, '0')} ${suffix}`;
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/**
 * Stable identifier for one scheduled dose time. It is derived from the UTC instant so that
 * the same slot always maps to the same Firestore document, whichever device or retry records it.
 */
export function slotKeyFor(scheduledFor: Date) {
  return (
    `${scheduledFor.getUTCFullYear()}${pad(scheduledFor.getUTCMonth() + 1)}${pad(scheduledFor.getUTCDate())}` +
    `T${pad(scheduledFor.getUTCHours())}${pad(scheduledFor.getUTCMinutes())}Z`
  );
}

export const doseIdFor = (medicineId: string, scheduledFor: Date) =>
  `${medicineId}_${slotKeyFor(scheduledFor)}`;

export const inventoryTransactionIdForDose = (doseId: string) => `dose_${doseId}`;

/** Normalizes a slot to the start of its minute so that identical slots compare equal. */
export function normalizeSlot(date: Date) {
  const copy = new Date(date);
  copy.setSeconds(0, 0);
  return copy;
}

/** Parses a local calendar date ("YYYY-MM-DD") at local midnight. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function toLocalDateString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

type SchedulableMedicine = Pick<
  Medicine,
  'id' | 'active' | 'frequency' | 'scheduledTimes' | 'selectedWeekdays' | 'startDate' | 'endDate'
> &
  Partial<Pick<Medicine, 'createdAt'>>;

/** Returns whether the medicine is scheduled on the given local calendar day. */
export function isScheduledOnDay(medicine: SchedulableMedicine, day: Date) {
  if (!medicine.active) return false;
  const date = startOfLocalDay(day);
  const start = parseLocalDate(medicine.startDate);
  const end = parseLocalDate(medicine.endDate);
  if (start && date < start) return false;
  if (end && date > end) return false;
  if (medicine.frequency === 'selected-weekdays')
    return (medicine.selectedWeekdays ?? []).includes(date.getDay());
  return true;
}

/** All scheduled dose instants for the medicine on a local calendar day, in time order. */
export function slotsForDay(medicine: SchedulableMedicine, day: Date): Date[] {
  if (!isScheduledOnDay(medicine, day)) return [];
  const base = startOfLocalDay(day);
  // A dose time that passed before the medicine was added was never expected.
  const created = medicine.createdAt ? normalizeSlot(new Date(medicine.createdAt)).getTime() : NaN;
  const seen = new Set<number>();
  const slots: Date[] = [];
  for (const time of medicine.scheduledTimes ?? []) {
    const parsed = parseClockTime(time);
    if (!parsed) continue;
    const slot = new Date(base);
    slot.setHours(parsed.hour, parsed.minute, 0, 0);
    if (seen.has(slot.getTime())) continue;
    if (!Number.isNaN(created) && slot.getTime() < created) continue;
    seen.add(slot.getTime());
    slots.push(slot);
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** Scheduled dose instants in [start, end). */
export function slotsInRange(medicine: SchedulableMedicine, start: Date, end: Date): Date[] {
  const slots: Date[] = [];
  for (let day = startOfLocalDay(start); day < end; day = addDays(day, 1)) {
    for (const slot of slotsForDay(medicine, day)) {
      if (slot >= start && slot < end) slots.push(slot);
    }
  }
  return slots;
}

export type ScheduledDoseState = 'due' | 'overdue' | 'missed' | 'taken' | 'skipped';

export function stateForSlot(
  scheduledFor: Date,
  recordedOutcome: 'taken' | 'skipped' | undefined,
  now = new Date(),
): ScheduledDoseState {
  if (recordedOutcome) return recordedOutcome;
  const elapsedMinutes = (now.getTime() - scheduledFor.getTime()) / 60_000;
  if (elapsedMinutes >= MISSED_AFTER_MINUTES) return 'missed';
  if (elapsedMinutes > 0) return 'overdue';
  return 'due';
}

/**
 * Server-side schedule maths. Mirrors src/features/doses/schedule.ts in the app, but evaluates
 * local times in the patient's IANA time zone rather than the device's. Dose IDs produced here
 * must match the app's exactly: `${medicineId}_${YYYYMMDD}T${HHmm}Z` in UTC.
 */

/** Must match MISSED_AFTER_MINUTES in the app. */
export const MISSED_AFTER_MINUTES = 120;

export type ServerMedicine = {
  id: string;
  name: string;
  active: boolean;
  frequency: string;
  scheduledTimes: string[];
  selectedWeekdays: number[];
  startDate: string;
  endDate: string | null;
  createdAt?: string;
};

export function parseClockTime(value: string) {
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

const pad = (value: number) => String(value).padStart(2, '0');

export function slotKeyFor(instant: Date) {
  return (
    `${instant.getUTCFullYear()}${pad(instant.getUTCMonth() + 1)}${pad(instant.getUTCDate())}` +
    `T${pad(instant.getUTCHours())}${pad(instant.getUTCMinutes())}Z`
  );
}

export const doseIdFor = (medicineId: string, instant: Date) =>
  `${medicineId}_${slotKeyFor(instant)}`;

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Wall-clock parts of an instant in a time zone. */
export function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '0';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: weekdays.indexOf(get('weekday')),
  };
}

function offsetMs(instant: Date, timeZone: string) {
  const local = localParts(instant, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  return asUtc - Math.floor(instant.getTime() / 60_000) * 60_000;
}

/** The UTC instant at which a wall-clock time occurs in a time zone. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(first), timeZone);
  return new Date(second);
}

const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

/** Scheduled dose instants for a medicine that fall in [from, to), evaluated in `timeZone`. */
export function slotsBetween(medicine: ServerMedicine, timeZone: string, from: Date, to: Date) {
  if (!medicine.active) return [];
  const created = medicine.createdAt ? new Date(medicine.createdAt).getTime() : NaN;
  const results: Date[] = [];
  const seen = new Set<number>();
  // Walk each local calendar date the window touches (with a day of margin either side).
  for (
    let cursor = from.getTime() - 86_400_000;
    cursor <= to.getTime() + 86_400_000;
    cursor += 86_400_000
  ) {
    const local = localParts(new Date(cursor), timeZone);
    const key = dateKey(local.year, local.month, local.day);
    if (medicine.startDate && key < medicine.startDate) continue;
    if (medicine.endDate && key > medicine.endDate) continue;
    if (
      medicine.frequency === 'selected-weekdays' &&
      !medicine.selectedWeekdays.includes(local.weekday)
    )
      continue;
    for (const time of medicine.scheduledTimes) {
      const parsed = parseClockTime(time);
      if (!parsed) continue;
      const slot = zonedTimeToUtc(
        local.year,
        local.month,
        local.day,
        parsed.hour,
        parsed.minute,
        timeZone,
      );
      const at = slot.getTime();
      if (at < from.getTime() || at >= to.getTime() || seen.has(at)) continue;
      if (!Number.isNaN(created) && at < Math.floor(created / 60_000) * 60_000) continue;
      seen.add(at);
      results.push(slot);
    }
  }
  return results.sort((a, b) => a.getTime() - b.getTime());
}

/** Must match crossedLowStock in the app. */
export function crossedLowStock(previous: number, next: number, threshold: number) {
  if (next >= previous) return false;
  if (next === 0) return true;
  return previous > threshold && next <= threshold;
}

export function formatLocalTime(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(
    instant,
  );
}

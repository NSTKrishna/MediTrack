import {
  MISSED_AFTER_MINUTES,
  addDays,
  doseIdFor,
  parseLocalDate,
  slotsInRange,
  startOfLocalDay,
  toLocalDateString,
} from '@/src/features/doses/schedule';
import type { Dose } from '@/src/types/dose';
import type { InventoryTransaction } from '@/src/types/inventory';
import type { Medicine } from '@/src/types/medicine';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';
/** A half-open local-time range [start, end). */
export type DateRange = { start: Date; end: Date };

export const MAX_CUSTOM_RANGE_DAYS = 366;

/** Calendar ranges: a day, a Monday-to-Sunday week, or a calendar month containing `anchor`. */
export function rangeFor(period: Exclude<ReportPeriod, 'custom'>, anchor: Date): DateRange {
  const day = startOfLocalDay(anchor);
  if (period === 'daily') return { start: day, end: addDays(day, 1) };
  if (period === 'weekly') {
    const mondayOffset = (day.getDay() + 6) % 7;
    const start = addDays(day, -mondayOffset);
    return { start, end: addDays(start, 7) };
  }
  const start = new Date(day.getFullYear(), day.getMonth(), 1);
  return { start, end: new Date(day.getFullYear(), day.getMonth() + 1, 1) };
}

export function shiftAnchor(
  period: Exclude<ReportPeriod, 'custom'>,
  anchor: Date,
  direction: 1 | -1,
) {
  if (period === 'daily') return addDays(anchor, direction);
  if (period === 'weekly') return addDays(anchor, 7 * direction);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

export type CustomRangeResult = { ok: true; range: DateRange } | { ok: false; message: string };

/** Validates an inclusive custom range typed as YYYY-MM-DD. */
export function parseCustomRange(startText: string, endText: string): CustomRangeResult {
  const start = parseLocalDate(startText.trim());
  const endDay = parseLocalDate(endText.trim());
  if (!start || !endDay) return { ok: false, message: 'Enter both dates as YYYY-MM-DD.' };
  if (endDay < start)
    return { ok: false, message: 'The end date must be on or after the start date.' };
  const end = addDays(endDay, 1);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days > MAX_CUSTOM_RANGE_DAYS)
    return { ok: false, message: `Choose a range of ${MAX_CUSTOM_RANGE_DAYS} days or fewer.` };
  return { ok: true, range: { start, end } };
}

export function describeRange(range: DateRange) {
  const last = addDays(range.end, -1);
  const format = (date: Date) =>
    date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return toLocalDateString(range.start) === toLocalDateString(last)
    ? format(range.start)
    : `${format(range.start)} – ${format(last)}`;
}

export type SlotOutcome = 'taken' | 'skipped' | 'missed' | 'pending';

export type ReportEntry = {
  doseId: string;
  medicineId: string;
  medicineName: string;
  scheduledFor: Date;
  outcome: SlotOutcome;
};

export type Tally = {
  scheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  pending: number;
  /** taken ÷ (taken + skipped + missed), or null when nothing was due. */
  adherencePercent: number | null;
};

export type MedicineAdherence = Tally & { medicineId: string; medicineName: string };
export type DayAdherence = Tally & { date: string };

export type InventorySummary = {
  transactions: InventoryTransaction[];
  refillCount: number;
  unitsAdded: number;
  unitsUsed: number;
  lowStock: { medicineId: string; medicineName: string; remaining: number; threshold: number }[];
};

export type AdherenceReport = {
  range: DateRange;
  generatedAt: Date;
  totals: Tally;
  byMedicine: MedicineAdherence[];
  byDay: DayAdherence[];
  missedDoses: ReportEntry[];
  inventory: InventorySummary;
};

function tally(entries: ReportEntry[]): Tally {
  const count = (outcome: SlotOutcome) =>
    entries.filter((entry) => entry.outcome === outcome).length;
  const taken = count('taken');
  const skipped = count('skipped');
  const missed = count('missed');
  const decided = taken + skipped + missed;
  return {
    scheduled: entries.length,
    taken,
    skipped,
    missed,
    pending: count('pending'),
    adherencePercent: decided ? Math.round((taken / decided) * 100) : null,
  };
}

/**
 * Joins the schedule with recorded outcomes. Every scheduled slot in the range that has already
 * happened is counted: recorded doses keep their outcome, unrecorded ones become "missed" once
 * the grace period has passed and "pending" before that. Future slots are not counted. Recorded
 * doses for slots no longer in the schedule (edited or deleted medicines) are still included.
 */
export function buildReportEntries(
  medicines: Medicine[],
  doses: Dose[],
  range: DateRange,
  now = new Date(),
): ReportEntry[] {
  const inRange = (date: Date) => date >= range.start && date < range.end && date <= now;
  const records = new Map(
    doses.filter((dose) => inRange(new Date(dose.scheduledFor))).map((dose) => [dose.id, dose]),
  );
  const entries = new Map<string, ReportEntry>();
  const until = new Date(Math.min(range.end.getTime(), now.getTime() + 1));
  for (const medicine of medicines) {
    for (const slot of slotsInRange(medicine, range.start, until)) {
      const doseId = doseIdFor(medicine.id, slot);
      const record = records.get(doseId);
      const overdueMinutes = (now.getTime() - slot.getTime()) / 60_000;
      entries.set(doseId, {
        doseId,
        medicineId: medicine.id,
        medicineName: medicine.name,
        scheduledFor: slot,
        outcome: record?.outcome ?? (overdueMinutes >= MISSED_AFTER_MINUTES ? 'missed' : 'pending'),
      });
    }
  }
  for (const record of records.values())
    if (!entries.has(record.id))
      entries.set(record.id, {
        doseId: record.id,
        medicineId: record.medicineId,
        medicineName: record.medicineName,
        scheduledFor: new Date(record.scheduledFor),
        outcome: record.outcome,
      });
  return [...entries.values()].sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
}

export function buildAdherenceReport(input: {
  medicines: Medicine[];
  doses: Dose[];
  transactions: InventoryTransaction[];
  range: DateRange;
  now?: Date;
}): AdherenceReport {
  const now = input.now ?? new Date();
  const entries = buildReportEntries(input.medicines, input.doses, input.range, now);

  const byMedicineMap = new Map<string, ReportEntry[]>();
  for (const entry of entries)
    byMedicineMap.set(entry.medicineId, [...(byMedicineMap.get(entry.medicineId) ?? []), entry]);
  const byMedicine = [...byMedicineMap.entries()]
    .map(([medicineId, items]) => ({
      medicineId,
      medicineName: items[items.length - 1]?.medicineName ?? 'Medicine',
      ...tally(items),
    }))
    .sort((a, b) => a.medicineName.localeCompare(b.medicineName));

  const byDay: DayAdherence[] = [];
  const lastDay = new Date(
    Math.min(input.range.end.getTime(), startOfLocalDay(now).getTime() + 86_400_000),
  );
  for (let day = startOfLocalDay(input.range.start); day < lastDay; day = addDays(day, 1)) {
    const next = addDays(day, 1);
    byDay.push({
      date: toLocalDateString(day),
      ...tally(entries.filter((entry) => entry.scheduledFor >= day && entry.scheduledFor < next)),
    });
  }

  const transactions = input.transactions
    .filter((item) => {
      const at = new Date(item.recordedAt);
      return at >= input.range.start && at < input.range.end;
    })
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const refills = transactions.filter((item) => item.reason === 'refill');

  return {
    range: input.range,
    generatedAt: now,
    totals: tally(entries),
    byMedicine,
    byDay,
    missedDoses: entries.filter((entry) => entry.outcome === 'missed').reverse(),
    inventory: {
      transactions,
      refillCount: refills.length,
      unitsAdded: refills.reduce((sum, item) => sum + item.delta, 0),
      unitsUsed: transactions
        .filter((item) => item.reason === 'dose')
        .reduce((sum, item) => sum - item.delta, 0),
      lowStock: input.medicines
        .filter(
          (medicine) => medicine.active && medicine.remainingStock <= medicine.lowStockThreshold,
        )
        .map((medicine) => ({
          medicineId: medicine.id,
          medicineName: medicine.name,
          remaining: medicine.remainingStock,
          threshold: medicine.lowStockThreshold,
        })),
    },
  };
}

export const formatPercent = (value: number | null) => (value === null ? '—' : `${value}%`);

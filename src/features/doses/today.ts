import {
  doseIdFor,
  slotsForDay,
  stateForSlot,
  type ScheduledDoseState,
} from '@/src/features/doses/schedule';
import type { Dose } from '@/src/types/dose';
import type { Medicine } from '@/src/types/medicine';

export type ScheduledDose = {
  doseId: string;
  medicine: Medicine;
  scheduledFor: Date;
  state: ScheduledDoseState;
};

/** Every dose scheduled today, joined with its recorded outcome, in time order. */
export function buildDayDoses(medicines: Medicine[], doses: Dose[], day: Date, now = new Date()) {
  const outcomes = new Map(doses.map((dose) => [dose.id, dose.outcome]));
  const items: ScheduledDose[] = [];
  for (const medicine of medicines) {
    for (const scheduledFor of slotsForDay(medicine, day)) {
      const doseId = doseIdFor(medicine.id, scheduledFor);
      items.push({
        doseId,
        medicine,
        scheduledFor,
        state: stateForSlot(scheduledFor, outcomes.get(doseId), now),
      });
    }
  }
  return items.sort(
    (a, b) =>
      a.scheduledFor.getTime() - b.scheduledFor.getTime() ||
      a.medicine.name.localeCompare(b.medicine.name),
  );
}

export function summarizeDay(items: ScheduledDose[]) {
  const taken = items.filter((item) => item.state === 'taken').length;
  return {
    taken,
    total: items.length,
    percent: items.length ? Math.round((taken / items.length) * 100) : 0,
  };
}

/** The next dose still needing action: earliest overdue, else the next due. */
export function nextActionable(items: ScheduledDose[]) {
  return (
    items.find((item) => item.state === 'overdue') ??
    items.find((item) => item.state === 'due') ??
    null
  );
}

export const stateLabels: Record<ScheduledDose['state'], string> = {
  due: 'Upcoming',
  overdue: 'Due now',
  missed: 'Missed',
  taken: 'Taken',
  skipped: 'Skipped',
};

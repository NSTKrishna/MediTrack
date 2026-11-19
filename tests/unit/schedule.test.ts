import {
  MISSED_AFTER_MINUTES,
  doseIdFor,
  formatClockTime,
  inventoryTransactionIdForDose,
  isScheduledOnDay,
  parseClockTime,
  parseLocalDate,
  slotKeyFor,
  slotsForDay,
  slotsInRange,
  stateForSlot,
} from '@/src/features/doses/schedule';
import type { Medicine } from '@/src/types/medicine';

const medicine = (overrides: Partial<Medicine> = {}): Medicine => ({
  id: 'm1',
  userId: 'u1',
  name: 'Metformin',
  category: 'Diabetes',
  dosage: '850',
  dosageUnit: 'mg',
  frequency: 'twice-daily',
  scheduledTimes: ['8:00 AM', '8:00 PM'],
  selectedWeekdays: [],
  startDate: '2026-11-01',
  endDate: null,
  schedule: '',
  stockQuantity: 30,
  remainingStock: 30,
  lowStockThreshold: 5,
  instructions: '',
  active: true,
  color: '#fff',
  ...overrides,
});

describe('clock times', () => {
  it.each([
    ['8:00 AM', { hour: 8, minute: 0 }],
    ['12:00 AM', { hour: 0, minute: 0 }],
    ['12:30 PM', { hour: 12, minute: 30 }],
    ['8:15 pm', { hour: 20, minute: 15 }],
    ['20:45', { hour: 20, minute: 45 }],
    ['07:05', { hour: 7, minute: 5 }],
  ])('parses %s', (input, expected) => expect(parseClockTime(input)).toEqual(expected));

  it.each(['24:00', '13:00 PM', '0:00 AM', '8', '8:60', 'noon', ''])('rejects %s', (input) =>
    expect(parseClockTime(input)).toBeNull(),
  );

  it('formats round-trip', () => {
    expect(formatClockTime({ hour: 0, minute: 5 })).toBe('12:05 AM');
    expect(formatClockTime({ hour: 13, minute: 0 })).toBe('1:00 PM');
  });
});

describe('dose identity', () => {
  it('derives a stable slot key from the UTC instant', () => {
    const slot = new Date(Date.UTC(2026, 10, 18, 3, 5));
    expect(slotKeyFor(slot)).toBe('20261118T0305Z');
    expect(doseIdFor('abc', slot)).toBe('abc_20261118T0305Z');
    expect(inventoryTransactionIdForDose('abc_20261118T0305Z')).toBe('dose_abc_20261118T0305Z');
  });

  it('gives the same ID to the same slot regardless of seconds', () => {
    expect(doseIdFor('m', new Date(Date.UTC(2026, 0, 1, 8, 0, 1)))).toBe(
      doseIdFor('m', new Date(Date.UTC(2026, 0, 1, 8, 0, 59))),
    );
  });
});

describe('schedule expansion', () => {
  const day = new Date(2026, 10, 18); // Wednesday

  it('returns each scheduled time on an active day, sorted and de-duplicated', () => {
    const slots = slotsForDay(medicine({ scheduledTimes: ['8:00 PM', '8:00 AM', '20:00'] }), day);
    expect(slots.map((slot) => [slot.getHours(), slot.getMinutes()])).toEqual([
      [8, 0],
      [20, 0],
    ]);
  });

  it('respects start and end dates and the active flag', () => {
    expect(isScheduledOnDay(medicine({ startDate: '2026-11-19' }), day)).toBe(false);
    expect(isScheduledOnDay(medicine({ endDate: '2026-11-17' }), day)).toBe(false);
    expect(isScheduledOnDay(medicine({ endDate: '2026-11-18' }), day)).toBe(true);
    expect(isScheduledOnDay(medicine({ active: false }), day)).toBe(false);
  });

  it('only schedules selected weekdays', () => {
    const weekdays = medicine({ frequency: 'selected-weekdays', selectedWeekdays: [1, 3] });
    expect(isScheduledOnDay(weekdays, day)).toBe(true);
    expect(isScheduledOnDay(weekdays, new Date(2026, 10, 19))).toBe(false);
  });

  it('skips times that passed before the medicine was added', () => {
    const added = new Date(2026, 10, 18, 12, 0).toISOString();
    const slots = slotsForDay(medicine({ createdAt: added }), day);
    expect(slots.map((slot) => slot.getHours())).toEqual([20]);
  });

  it('expands a range half-open at the end', () => {
    const slots = slotsInRange(
      medicine(),
      new Date(2026, 10, 18, 8, 0),
      new Date(2026, 10, 19, 8, 0),
    );
    expect(slots).toHaveLength(2);
  });

  it('ignores malformed stored dates and times', () => {
    expect(parseLocalDate('18/11/2026')).toBeNull();
    expect(slotsForDay(medicine({ scheduledTimes: ['soon', '9:00 AM'] }), day)).toHaveLength(1);
  });
});

describe('dose state', () => {
  const slot = new Date(2026, 10, 18, 8, 0);
  const at = (minutes: number) => new Date(slot.getTime() + minutes * 60_000);
  it('never infers taken from the passage of time', () => {
    expect(stateForSlot(slot, undefined, at(-5))).toBe('due');
    expect(stateForSlot(slot, undefined, at(30))).toBe('overdue');
    expect(stateForSlot(slot, undefined, at(MISSED_AFTER_MINUTES))).toBe('missed');
  });
  it('reports recorded outcomes', () => {
    expect(stateForSlot(slot, 'taken', at(500))).toBe('taken');
    expect(stateForSlot(slot, 'skipped', at(-5))).toBe('skipped');
  });
});

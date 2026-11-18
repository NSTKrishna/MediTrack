import { doseIdFor as clientDoseIdFor, slotsForDay } from '@/src/features/doses/schedule';
import {
  crossedLowStock,
  doseIdFor,
  isValidTimeZone,
  localParts,
  slotsBetween,
  zonedTimeToUtc,
  type ServerMedicine,
} from './schedule';

const medicine = (overrides: Partial<ServerMedicine> = {}): ServerMedicine => ({
  id: 'm1',
  name: 'Metformin',
  active: true,
  frequency: 'twice-daily',
  scheduledTimes: ['8:00 AM', '8:00 PM'],
  selectedWeekdays: [],
  startDate: '2026-01-01',
  endDate: null,
  ...overrides,
});

describe('time-zone conversion', () => {
  it.each([
    ['America/New_York', 2026, 11, 18, 8, 0, '2026-11-18T13:00:00.000Z'], // EST
    ['America/New_York', 2026, 7, 1, 8, 0, '2026-07-01T12:00:00.000Z'], // EDT
    ['Asia/Kolkata', 2026, 11, 18, 8, 0, '2026-11-18T02:30:00.000Z'],
    ['Asia/Kathmandu', 2026, 11, 18, 8, 0, '2026-11-18T02:15:00.000Z'],
    ['UTC', 2026, 11, 18, 23, 59, '2026-11-18T23:59:00.000Z'],
    ['Pacific/Auckland', 2026, 1, 1, 0, 30, '2025-12-31T11:30:00.000Z'],
  ])('%s %i-%i-%i %i:%i', (zone, y, m, d, h, min, expected) =>
    expect(zonedTimeToUtc(y, m, d, h, min, zone).toISOString()).toBe(expected),
  );

  it('reads local parts and weekdays', () => {
    expect(localParts(new Date('2026-11-18T13:00:00Z'), 'America/New_York')).toEqual({
      year: 2026,
      month: 11,
      day: 18,
      hour: 8,
      minute: 0,
      weekday: 3,
    });
  });

  it('validates zones', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('server slots', () => {
  it('finds slots in a window in the patient zone', () => {
    const from = new Date('2026-11-18T12:30:00Z');
    const to = new Date('2026-11-18T13:30:00Z');
    expect(
      slotsBetween(medicine(), 'America/New_York', from, to).map((slot) => slot.toISOString()),
    ).toEqual(['2026-11-18T13:00:00.000Z']);
  });

  it('respects weekdays, date bounds, creation time, and the active flag', () => {
    const from = new Date('2026-11-18T00:00:00Z');
    const to = new Date('2026-11-19T00:00:00Z');
    expect(
      slotsBetween(
        medicine({ frequency: 'selected-weekdays', selectedWeekdays: [4] }),
        'UTC',
        from,
        to,
      ),
    ).toEqual([]);
    expect(
      slotsBetween(
        medicine({ frequency: 'selected-weekdays', selectedWeekdays: [3] }),
        'UTC',
        from,
        to,
      ),
    ).toHaveLength(2);
    expect(slotsBetween(medicine({ startDate: '2026-11-19' }), 'UTC', from, to)).toEqual([]);
    expect(slotsBetween(medicine({ endDate: '2026-11-17' }), 'UTC', from, to)).toEqual([]);
    expect(
      slotsBetween(medicine({ createdAt: '2026-11-18T12:00:00Z' }), 'UTC', from, to),
    ).toHaveLength(1);
    expect(slotsBetween(medicine({ active: false }), 'UTC', from, to)).toEqual([]);
  });
});

describe('client/server parity', () => {
  // The app computes slots in the device zone; `npm run test:functions` repeats this suite
  // under several TZ values (see scripts/test-functions.js).
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  it(`produces the same dose IDs as the app (device zone ${zone})`, () => {
    for (const [month, day] of [
      [1, 15],
      [3, 30],
      [7, 1],
      [11, 18],
    ] as const) {
      const clientIds = slotsForDay({ ...medicine() }, new Date(2026, month - 1, day)).map((slot) =>
        clientDoseIdFor('m1', slot),
      );
      const from = zonedTimeToUtc(2026, month, day, 0, 0, zone);
      const to = zonedTimeToUtc(2026, month, day + 1, 0, 0, zone);
      const serverIds = slotsBetween(medicine(), zone, from, to).map((slot) =>
        doseIdFor('m1', slot),
      );
      expect(serverIds).toEqual(clientIds);
      expect(serverIds).toHaveLength(2);
    }
  });
});

describe('low-stock crossing (server copy)', () => {
  it('matches the app rule', () => {
    expect(crossedLowStock(6, 5, 5)).toBe(true);
    expect(crossedLowStock(5, 4, 5)).toBe(false);
    expect(crossedLowStock(1, 0, 0)).toBe(true);
  });
});

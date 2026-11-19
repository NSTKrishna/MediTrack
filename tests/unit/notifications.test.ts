import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  cancelAllMedicationReminders,
  drainPendingDoseActions,
  handleNotificationResponse,
  syncMedicineReminders,
} from '@/src/services/notifications/medicationReminders';
import {
  actionToOutcome,
  buildReminderTriggers,
  lowStockContent,
  reminderContent,
  reminderSignature,
  remindersLive,
  resolveDoseSlot,
  type ReminderData,
} from '@/src/services/notifications/reminderLogic';
import { readPendingDoseActions } from '@/src/services/notifications/pendingDoseQueue';
import type { Medicine } from '@/src/types/medicine';

jest.mock('expo-notifications', () => {
  let id = 0;
  return {
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    SchedulableTriggerInputTypes: {
      DAILY: 'daily',
      WEEKLY: 'weekly',
      TIME_INTERVAL: 'timeInterval',
    },
    AndroidImportance: { HIGH: 5, DEFAULT: 3 },
    AndroidNotificationVisibility: { PRIVATE: 0 },
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    scheduleNotificationAsync: jest.fn(async () => `n${(id += 1)}`),
    cancelScheduledNotificationAsync: jest.fn(async () => undefined),
    getAllScheduledNotificationsAsync: jest.fn(async () => []),
    dismissNotificationAsync: jest.fn(async () => undefined),
    setNotificationChannelAsync: jest.fn(),
    setNotificationCategoryAsync: jest.fn(),
  };
});
// Unit tests never load Firebase; the Firestore writer is injected into drainPendingDoseActions.
jest.mock('@/src/services/firebase/doses', () => ({ confirmDose: jest.fn() }));

const mocked = Notifications as jest.Mocked<typeof Notifications>;

const medicine = (overrides: Partial<Medicine> = {}): Medicine => ({
  id: 'm1',
  userId: 'u1',
  name: 'Metformin',
  category: '',
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
  color: '',
  ...overrides,
});

const data: ReminderData = {
  kind: 'dose',
  userId: 'u1',
  medicineId: 'm1',
  medicineName: 'Metformin',
  hour: 20,
  minute: 0,
};

const response = (
  actionIdentifier: string,
  deliveredAt: Date,
  payload: object = data,
  identifier = 'req-1',
) =>
  ({
    actionIdentifier,
    notification: {
      date: deliveredAt.getTime(),
      request: { identifier, content: { data: payload } },
    },
  }) as unknown as Notifications.NotificationResponse;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('reminder logic', () => {
  it('maps only explicit buttons to outcomes', () => {
    expect(actionToOutcome('TAKEN')).toBe('taken');
    expect(actionToOutcome('SKIP')).toBe('skipped');
    expect(actionToOutcome('SNOOZE')).toBeNull();
    expect(actionToOutcome('expo.modules.notifications.actions.DEFAULT')).toBeNull();
  });

  it('resolves the slot from the reminder time, not the tap time', () => {
    const delivered = new Date(2026, 10, 18, 20, 0, 3);
    expect(resolveDoseSlot(data, delivered)).toEqual(new Date(2026, 10, 18, 20, 0));
    // A late-evening reminder delivered just after midnight belongs to the previous day.
    expect(
      resolveDoseSlot({ ...data, hour: 23, minute: 59 }, new Date(2026, 10, 19, 0, 1)),
    ).toEqual(new Date(2026, 10, 18, 23, 59));
    // A snoozed reminder carries its original slot.
    const original = new Date(2026, 10, 18, 8, 0).toISOString();
    expect(resolveDoseSlot({ ...data, scheduledFor: original }, delivered).toISOString()).toBe(
      original,
    );
  });

  it('builds daily triggers, or weekly triggers for selected weekdays', () => {
    expect(buildReminderTriggers(medicine())).toEqual([
      { type: 'daily', hour: 8, minute: 0 },
      { type: 'daily', hour: 20, minute: 0 },
    ]);
    expect(
      buildReminderTriggers(
        medicine({
          frequency: 'selected-weekdays',
          selectedWeekdays: [0, 6],
          scheduledTimes: ['9:00 AM'],
        }),
      ),
    ).toEqual([
      { type: 'weekly', weekday: 1, hour: 9, minute: 0 },
      { type: 'weekly', weekday: 7, hour: 9, minute: 0 },
    ]);
  });

  it('knows when reminders should be live', () => {
    const now = new Date(2026, 10, 18);
    expect(remindersLive(medicine(), now)).toBe(true);
    expect(remindersLive(medicine({ startDate: '2026-11-20' }), now)).toBe(false);
    expect(remindersLive(medicine({ endDate: '2026-11-17' }), now)).toBe(false);
    expect(remindersLive(medicine({ active: false }), now)).toBe(false);
  });

  it('hides medicine names in discreet mode', () => {
    expect(JSON.stringify(reminderContent(medicine(), true))).not.toContain('Metformin');
    expect(JSON.stringify(lowStockContent('Metformin', 2, true))).not.toContain('Metformin');
    expect(lowStockContent('Metformin', 0, false).title).toContain('out of stock');
  });

  it('changes signature when schedule-relevant fields change', () => {
    const options = { enabled: true, discreet: false };
    const base = reminderSignature(medicine(), 'u1', options);
    expect(reminderSignature(medicine({ instructions: 'with food' }), 'u1', options)).toBe(base);
    expect(reminderSignature(medicine({ scheduledTimes: ['9:00 AM'] }), 'u1', options)).not.toBe(
      base,
    );
    expect(reminderSignature(medicine(), 'u1', { ...options, discreet: true })).not.toBe(base);
  });
});

describe('reminder scheduling', () => {
  const now = new Date(2026, 10, 18);

  it('schedules once and leaves unchanged medicines alone', async () => {
    await syncMedicineReminders('u1', [medicine()], { enabled: true, discreet: false }, now);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    const first = mocked.scheduleNotificationAsync.mock.calls[0]![0];
    expect(first.content.categoryIdentifier).toBe('medication-dose');
    expect(first.content.data).toMatchObject({
      userId: 'u1',
      medicineId: 'm1',
      hour: 8,
      minute: 0,
    });
    await syncMedicineReminders('u1', [medicine()], { enabled: true, discreet: false }, now);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('reschedules on change and cancels deleted medicines', async () => {
    await syncMedicineReminders('u1', [medicine()], { enabled: true, discreet: false }, now);
    await syncMedicineReminders(
      'u1',
      [medicine({ scheduledTimes: ['9:00 AM'] })],
      { enabled: true, discreet: false },
      now,
    );
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    await syncMedicineReminders('u1', [], { enabled: true, discreet: false }, now);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(3);
  });

  it('schedules nothing when reminders are disabled or permission is missing', async () => {
    await syncMedicineReminders('u1', [medicine()], { enabled: false, discreet: false }, now);
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    await syncMedicineReminders(
      'u1',
      [medicine({ id: 'm2' })],
      { enabled: true, discreet: false },
      now,
    );
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels everything on sign-out', async () => {
    await syncMedicineReminders('u1', [medicine()], { enabled: true, discreet: false }, now);
    await cancelAllMedicationReminders();
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  });
});

describe('notification actions', () => {
  const delivered = new Date(2026, 10, 18, 20, 0);

  it('never records anything when the notification body is tapped', async () => {
    expect(
      await handleNotificationResponse(
        response('expo.modules.notifications.actions.DEFAULT', delivered),
      ),
    ).toBe('ignored');
    expect(await readPendingDoseActions()).toEqual([]);
  });

  it('queues a Taken action durably and only once per response', async () => {
    expect(await handleNotificationResponse(response('TAKEN', delivered))).toBe('queued');
    expect(await handleNotificationResponse(response('TAKEN', delivered))).toBe('duplicate');
    const queue = await readPendingDoseActions();
    expect(queue).toEqual([
      expect.objectContaining({
        userId: 'u1',
        medicineId: 'm1',
        outcome: 'taken',
        scheduledFor: new Date(2026, 10, 18, 20, 0).toISOString(),
      }),
    ]);
  });

  it('snoozes by scheduling a one-off reminder for the same slot', async () => {
    expect(await handleNotificationResponse(response('SNOOZE', delivered))).toBe('snoozed');
    const call = mocked.scheduleNotificationAsync.mock.calls[0]![0];
    expect(call.trigger).toMatchObject({ type: 'timeInterval', seconds: 600, repeats: false });
    expect(call.content.data).toMatchObject({
      scheduledFor: new Date(2026, 10, 18, 20, 0).toISOString(),
    });
    expect(await readPendingDoseActions()).toEqual([]);
  });

  it('ignores notifications that are not dose reminders', async () => {
    expect(
      await handleNotificationResponse(response('TAKEN', delivered, { kind: 'low-stock' })),
    ).toBe('ignored');
  });

  it('writes queued actions for the signed-in user and keeps transient failures', async () => {
    await handleNotificationResponse(response('TAKEN', delivered, data, 'a'));
    await handleNotificationResponse(
      response('SKIP', delivered, { ...data, medicineId: 'm2' }, 'b'),
    );
    const record = jest
      .fn()
      .mockResolvedValueOnce({ status: 'recorded', doseId: 'x', outcome: 'taken', stock: null })
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }));
    expect(await drainPendingDoseActions('u1', record)).toBe(1);
    expect(record).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ medicineId: 'm1', outcome: 'taken', source: 'notification' }),
    );
    const retry = jest
      .fn()
      .mockResolvedValue({ status: 'duplicate', doseId: 'y', outcome: 'skipped' });
    expect(await drainPendingDoseActions('u1', retry)).toBe(0);
    expect(await readPendingDoseActions()).toEqual([]);
  });

  it('drops actions rejected for good, and never writes them to another account', async () => {
    await handleNotificationResponse(response('TAKEN', delivered, data, 'a'));
    const record = jest.fn();
    expect(await drainPendingDoseActions('someone-else', record)).toBe(0);
    expect(record).not.toHaveBeenCalled();
    expect(await readPendingDoseActions()).toHaveLength(1);
    const denied = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    expect(await drainPendingDoseActions('u1', denied)).toBe(0);
    expect(await readPendingDoseActions()).toEqual([]);
  });

  it('shows a low-stock notification when a queued dose crosses the threshold', async () => {
    await handleNotificationResponse(response('TAKEN', delivered));
    mocked.scheduleNotificationAsync.mockClear();
    await drainPendingDoseActions('u1', async () => ({
      status: 'recorded',
      doseId: 'x',
      outcome: 'taken',
      stock: { previous: 6, next: 5, threshold: 5, crossedLowStock: true },
    }));
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: 'Metformin is running low' }),
      }),
    );
  });
});

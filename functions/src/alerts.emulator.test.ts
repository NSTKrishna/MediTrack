/**
 * Runs the caregiver alert logic against the Firestore emulator using the Admin SDK.
 * Started by `npm run test:emulator`, which sets FIRESTORE_EMULATOR_HOST.
 */
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { processInventoryTransaction, scanMissedDoses } from './alerts';
import { doseIdFor, zonedTimeToUtc } from './schedule';

jest.mock('./push', () => ({ sendPushToUser: jest.fn().mockResolvedValue(1) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendPushToUser } = require('./push') as { sendPushToUser: jest.Mock };

const app = initializeApp({ projectId: 'demo-meditrack' }, 'functions-test');
const db = getFirestore(app);
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

const permissions = (overrides: Record<string, boolean> = {}) => ({
  viewMedicines: true,
  viewDoseHistory: true,
  viewInventory: true,
  missedDoseAlerts: true,
  lowStockAlerts: true,
  ...overrides,
});

async function link(caregiverId: string, status = 'active', perms = permissions()) {
  await db.collection('careLinks').doc(`pat_${caregiverId}`).set({
    patientId: 'pat',
    patientName: 'Pat',
    caregiverId,
    status,
    permissions: perms,
  });
}

const alertsFor = async (caregiverId: string) =>
  (await db.collection('users').doc(caregiverId).collection('alerts').get()).docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

beforeEach(async () => {
  await fetch(`http://${host}/emulator/v1/projects/demo-meditrack/databases/(default)/documents`, {
    method: 'DELETE',
  });
  sendPushToUser.mockClear();
  await db
    .collection('users')
    .doc('pat')
    .set({ role: 'patient', displayName: 'Pat', timeZone: 'America/New_York' });
});

afterAll(() => deleteApp(app));

describe('low-stock caregiver alerts', () => {
  const crossing = {
    reason: 'dose',
    medicineName: 'Lisinopril',
    previousStock: 4,
    resultingStock: 3,
    lowStockThreshold: 3,
  };

  it('alerts only active caregivers with low-stock permission, once per transaction', async () => {
    await link('allowed');
    await link('no-permission', 'active', permissions({ lowStockAlerts: false }));
    await link('revoked', 'revoked');
    expect(await processInventoryTransaction(db, 'pat', 'dose_tx1', crossing)).toBe(1);
    expect(await processInventoryTransaction(db, 'pat', 'dose_tx1', crossing)).toBe(0);
    expect(await alertsFor('allowed')).toEqual([
      expect.objectContaining({ id: 'lowstock_dose_tx1', type: 'low-stock', readAt: null }),
    ]);
    expect(await alertsFor('no-permission')).toEqual([]);
    expect(await alertsFor('revoked')).toEqual([]);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    // The push payload carries no medicine names.
    expect(JSON.stringify(sendPushToUser.mock.calls[0][2])).not.toContain('Lisinopril');
  });

  it('ignores refills and deductions that do not cross the threshold', async () => {
    await link('allowed');
    expect(
      await processInventoryTransaction(db, 'pat', 'r1', { ...crossing, reason: 'refill' }),
    ).toBe(0);
    expect(
      await processInventoryTransaction(db, 'pat', 'd2', {
        ...crossing,
        previousStock: 3,
        resultingStock: 2,
      }),
    ).toBe(0);
    expect(await alertsFor('allowed')).toEqual([]);
  });
});

describe('missed-dose caregiver alerts', () => {
  // 8:00 AM New York on 18 Nov 2026 = 13:00 UTC. Scanning at 15:30 UTC covers 12:30–13:30 UTC.
  const slot = zonedTimeToUtc(2026, 11, 18, 8, 0, 'America/New_York');
  const now = new Date(slot.getTime() + 150 * 60_000);

  beforeEach(async () => {
    await db
      .collection('users')
      .doc('pat')
      .collection('medicines')
      .doc('med1')
      .set({
        name: 'Lisinopril',
        active: true,
        frequency: 'once-daily',
        scheduledTimes: ['8:00 AM'],
        selectedWeekdays: [],
        startDate: '2026-11-01',
        endDate: null,
        createdAt: '2026-11-01T00:00:00.000Z',
      });
  });

  it('alerts permitted caregivers about an unconfirmed dose, idempotently', async () => {
    await link('allowed');
    await link('no-alerts', 'active', permissions({ missedDoseAlerts: false }));
    expect(slot.toISOString()).toBe('2026-11-18T13:00:00.000Z');
    expect(await scanMissedDoses(db, now)).toBe(1);
    expect(await scanMissedDoses(db, new Date(now.getTime() + 15 * 60_000))).toBe(0);
    const alerts = await alertsFor('allowed');
    expect(alerts).toEqual([
      expect.objectContaining({ id: `missed_${doseIdFor('med1', slot)}`, type: 'missed-dose' }),
    ]);
    expect((alerts[0] as { message: string }).message).toContain('8:00');
    expect(await alertsFor('no-alerts')).toEqual([]);
  });

  it('does not alert when the dose was taken or skipped', async () => {
    await link('allowed');
    await db
      .collection('users')
      .doc('pat')
      .collection('doses')
      .doc(doseIdFor('med1', slot))
      .set({ outcome: 'skipped' });
    expect(await scanMissedDoses(db, now)).toBe(0);
  });

  it('does not alert before the grace period has passed', async () => {
    await link('allowed');
    expect(await scanMissedDoses(db, new Date(slot.getTime() + 60 * 60_000))).toBe(0);
  });

  it('does not alert for inactive medicines or revoked caregivers', async () => {
    await link('revoked', 'revoked');
    expect(await scanMissedDoses(db, now)).toBe(0);
    await link('allowed');
    await db
      .collection('users')
      .doc('pat')
      .collection('medicines')
      .doc('med1')
      .update({ active: false });
    expect(await scanMissedDoses(db, now)).toBe(0);
  });
});

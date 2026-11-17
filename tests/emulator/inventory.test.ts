import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { confirmDose } from '@/src/services/firebase/doses';
import { createMedicine } from '@/src/services/firebase/medicines';
import { recordRefill } from '@/src/services/firebase/inventory';
import { doseIdFor, slotKeyFor } from '@/src/features/doses/schedule';
import {
  clientFor,
  closeClients,
  createProfile,
  expectDenied,
  resetEmulator,
  type TestUser,
} from './emulator';

const alice: TestUser = { uid: 'alice', email: 'alice@example.com' };
const mallory: TestUser = { uid: 'mallory', email: 'mallory@example.com' };

const medicineInput = (stock: number, threshold = 2) => ({
  name: 'Metformin',
  category: 'Diabetes',
  dosage: '850',
  dosageUnit: 'mg',
  frequency: 'twice-daily' as const,
  scheduledTimes: ['8:00 AM', '8:00 PM'],
  selectedWeekdays: [],
  startDate: '2026-11-01',
  endDate: null,
  stockQuantity: stock,
  remainingStock: stock,
  lowStockThreshold: threshold,
  instructions: '',
  active: true,
});

const slot = (day: number, hour = 8) => new Date(Date.UTC(2026, 10, day, hour, 0, 0));

async function setup(stock = 10, threshold = 2) {
  const store = clientFor(alice);
  await createProfile(store, alice, 'patient', 'Alice');
  const ref = await createMedicine(alice.uid, medicineInput(stock, threshold), store);
  return { store, medicineId: ref.id };
}

async function stockOf(medicineId: string) {
  const snapshot = await getDoc(doc(clientFor(alice), 'users', alice.uid, 'medicines', medicineId));
  return snapshot.data()?.remainingStock as number;
}

async function ledger() {
  const snapshot = await getDocs(
    collection(clientFor(alice), 'users', alice.uid, 'inventoryTransactions'),
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Record<string, unknown>);
}

beforeEach(resetEmulator);
afterAll(closeClients);

describe('dose confirmation and stock deduction', () => {
  it('deducts exactly one unit for a taken dose and records it in the ledger', async () => {
    const { store, medicineId } = await setup(10);
    const result = await confirmDose(
      alice.uid,
      {
        medicineId,
        medicineName: 'Metformin',
        scheduledFor: slot(18),
        outcome: 'taken',
        source: 'app',
      },
      store,
    );
    expect(result).toMatchObject({
      status: 'recorded',
      outcome: 'taken',
      stock: { previous: 10, next: 9 },
    });
    expect(await stockOf(medicineId)).toBe(9);
    const entries = await ledger();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: `dose_${doseIdFor(medicineId, slot(18))}`,
      reason: 'dose',
      delta: -1,
      previousStock: 10,
      resultingStock: 9,
    });
  });

  it('does not deduct for a skipped dose', async () => {
    const { store, medicineId } = await setup(10);
    await confirmDose(
      alice.uid,
      {
        medicineId,
        medicineName: 'Metformin',
        scheduledFor: slot(18),
        outcome: 'skipped',
        source: 'notification',
      },
      store,
    );
    expect(await stockOf(medicineId)).toBe(10);
    expect(await ledger()).toHaveLength(0);
  });

  it('is idempotent across repeated confirmations of the same slot', async () => {
    const { store, medicineId } = await setup(10);
    const input = {
      medicineId,
      medicineName: 'Metformin',
      scheduledFor: slot(18),
      outcome: 'taken' as const,
      source: 'notification' as const,
    };
    const first = await confirmDose(alice.uid, input, store);
    const retry = await confirmDose(alice.uid, input, store);
    const fromApp = await confirmDose(alice.uid, { ...input, source: 'app' }, store);
    expect(first.status).toBe('recorded');
    expect(retry.status).toBe('duplicate');
    expect(fromApp.status).toBe('duplicate');
    expect(await stockOf(medicineId)).toBe(9);
    expect(await ledger()).toHaveLength(1);
  });

  it('treats seconds within the same minute as the same slot', async () => {
    const { store, medicineId } = await setup(10);
    const base = {
      medicineId,
      medicineName: 'Metformin',
      outcome: 'taken' as const,
      source: 'app' as const,
    };
    await confirmDose(
      alice.uid,
      { ...base, scheduledFor: new Date(Date.UTC(2026, 10, 18, 8, 0, 5)) },
      store,
    );
    const again = await confirmDose(
      alice.uid,
      { ...base, scheduledFor: new Date(Date.UTC(2026, 10, 18, 8, 0, 40)) },
      store,
    );
    expect(again.status).toBe('duplicate');
    expect(await stockOf(medicineId)).toBe(9);
  });

  it('deducts once when concurrent clients confirm the same dose', async () => {
    const { medicineId } = await setup(10);
    const input = {
      medicineId,
      medicineName: 'Metformin',
      scheduledFor: slot(18),
      outcome: 'taken' as const,
      source: 'notification' as const,
    };
    const results = await Promise.all(
      Array.from({ length: 6 }, () => confirmDose(alice.uid, input, clientFor(alice))),
    );
    expect(results.filter((result) => result.status === 'recorded')).toHaveLength(1);
    expect(await stockOf(medicineId)).toBe(9);
    expect(await ledger()).toHaveLength(1);
  });

  it('keeps stock consistent when different doses are confirmed concurrently', async () => {
    const { medicineId } = await setup(20);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        confirmDose(
          alice.uid,
          {
            medicineId,
            medicineName: 'Metformin',
            scheduledFor: slot(10 + index),
            outcome: 'taken',
            source: 'app',
          },
          clientFor(alice),
        ),
      ),
    );
    const recorded = results.filter((result) => result.status === 'fulfilled').length;
    expect(recorded).toBe(6);
    expect(await stockOf(medicineId)).toBe(20 - recorded);
    const entries = await ledger();
    expect(entries).toHaveLength(recorded);
    // Each ledger entry chains from the previous resulting stock: no lost updates.
    const sorted = entries.map((entry) => entry.previousStock as number).sort((a, b) => b - a);
    expect(sorted).toEqual([20, 19, 18, 17, 16, 15]);
  });

  it('upgrades a skipped dose to taken with a single deduction', async () => {
    const { store, medicineId } = await setup(5);
    const base = {
      medicineId,
      medicineName: 'Metformin',
      scheduledFor: slot(18),
      source: 'app' as const,
    };
    await confirmDose(alice.uid, { ...base, outcome: 'skipped' }, store);
    const taken = await confirmDose(alice.uid, { ...base, outcome: 'taken' }, store);
    const skipAgain = await confirmDose(alice.uid, { ...base, outcome: 'skipped' }, store);
    expect(taken.status).toBe('recorded');
    expect(skipAgain.status).toBe('duplicate');
    expect(await stockOf(medicineId)).toBe(4);
    const dose = await getDoc(
      doc(store, 'users', alice.uid, 'doses', doseIdFor(medicineId, slot(18))),
    );
    expect(dose.data()).toMatchObject({ outcome: 'taken', stockDeducted: true });
  });

  it('records a taken dose without going negative when stock is empty', async () => {
    const { store, medicineId } = await setup(1, 0);
    const first = await confirmDose(
      alice.uid,
      {
        medicineId,
        medicineName: 'Metformin',
        scheduledFor: slot(18),
        outcome: 'taken',
        source: 'app',
      },
      store,
    );
    const second = await confirmDose(
      alice.uid,
      {
        medicineId,
        medicineName: 'Metformin',
        scheduledFor: slot(19),
        outcome: 'taken',
        source: 'app',
      },
      store,
    );
    expect(first).toMatchObject({ status: 'recorded', stock: { next: 0, crossedLowStock: true } });
    expect(second).toMatchObject({ status: 'recorded', stock: null });
    expect(await stockOf(medicineId)).toBe(0);
    expect(await ledger()).toHaveLength(1);
  });

  it('reports a low-stock crossing only on the change that crosses the threshold', async () => {
    const { store, medicineId } = await setup(4, 2);
    const crossings: boolean[] = [];
    for (const day of [10, 11, 12]) {
      const result = await confirmDose(
        alice.uid,
        {
          medicineId,
          medicineName: 'Metformin',
          scheduledFor: slot(day),
          outcome: 'taken',
          source: 'app',
        },
        store,
      );
      crossings.push(result.status === 'recorded' && Boolean(result.stock?.crossedLowStock));
    }
    // 4→3 (above), 3→2 (crosses), 2→1 (already low)
    expect(crossings).toEqual([false, true, false]);
  });
});

describe('refills', () => {
  it('adds the entered amount and is idempotent per operation', async () => {
    const { store, medicineId } = await setup(3);
    const first = await recordRefill(alice.uid, medicineId, 25, 'refill_abcdefghij123', store);
    const retry = await recordRefill(alice.uid, medicineId, 25, 'refill_abcdefghij123', store);
    expect(first).toEqual({ status: 'recorded', resultingStock: 28 });
    expect(retry).toEqual({ status: 'duplicate', resultingStock: 28 });
    expect(await stockOf(medicineId)).toBe(28);
    expect(await ledger()).toHaveLength(1);
  });

  it('rejects invalid refill amounts before writing', async () => {
    const { store, medicineId } = await setup(3);
    await expect(
      recordRefill(alice.uid, medicineId, 0, 'refill_abcdefghij123', store),
    ).rejects.toThrow();
    await expect(
      recordRefill(alice.uid, medicineId, 2.5, 'refill_abcdefghij124', store),
    ).rejects.toThrow();
    await expect(
      recordRefill(alice.uid, medicineId, 5000, 'refill_abcdefghij125', store),
    ).rejects.toThrow();
    expect(await stockOf(medicineId)).toBe(3);
  });

  it('applies concurrent refills and doses without losing updates', async () => {
    const { medicineId } = await setup(10);
    await Promise.all([
      recordRefill(alice.uid, medicineId, 30, 'refill_concurrent0001', clientFor(alice)),
      confirmDose(
        alice.uid,
        {
          medicineId,
          medicineName: 'Metformin',
          scheduledFor: slot(18),
          outcome: 'taken',
          source: 'app',
        },
        clientFor(alice),
      ),
      recordRefill(alice.uid, medicineId, 5, 'refill_concurrent0002', clientFor(alice)),
      confirmDose(
        alice.uid,
        {
          medicineId,
          medicineName: 'Metformin',
          scheduledFor: slot(19),
          outcome: 'taken',
          source: 'app',
        },
        clientFor(alice),
      ),
    ]);
    expect(await stockOf(medicineId)).toBe(10 + 30 + 5 - 2);
    expect(await ledger()).toHaveLength(4);
  });
});

describe('inventory security rules', () => {
  it('rejects a direct edit of remainingStock', async () => {
    const { store, medicineId } = await setup(10);
    await expectDenied(
      updateDoc(doc(store, 'users', alice.uid, 'medicines', medicineId), { remainingStock: 500 }),
    );
  });

  it('allows ordinary medicine edits that leave stock alone', async () => {
    const { store, medicineId } = await setup(10);
    await updateDoc(doc(store, 'users', alice.uid, 'medicines', medicineId), {
      instructions: 'With food',
    });
  });

  it('rejects a stock change backed by an inconsistent ledger entry', async () => {
    const { store, medicineId } = await setup(10);
    const batch = writeBatch(store);
    batch.update(doc(store, 'users', alice.uid, 'medicines', medicineId), {
      remainingStock: 100,
      lastInventoryTxId: 'refill_forgedentry001',
    });
    batch.set(doc(store, 'users', alice.uid, 'inventoryTransactions', 'refill_forgedentry001'), {
      medicineId,
      medicineName: 'Metformin',
      reason: 'refill',
      delta: 5,
      previousStock: 10,
      resultingStock: 15,
      lowStockThreshold: 2,
      recordedAt: new Date().toISOString(),
    });
    await expectDenied(batch.commit());
  });

  it('rejects a dose deduction ledger entry without a matching taken dose', async () => {
    const { store, medicineId } = await setup(10);
    const doseId = doseIdFor(medicineId, slot(18));
    const batch = writeBatch(store);
    batch.update(doc(store, 'users', alice.uid, 'medicines', medicineId), {
      remainingStock: 9,
      lastInventoryTxId: `dose_${doseId}`,
    });
    batch.set(doc(store, 'users', alice.uid, 'inventoryTransactions', `dose_${doseId}`), {
      medicineId,
      medicineName: 'Metformin',
      reason: 'dose',
      delta: -1,
      previousStock: 10,
      resultingStock: 9,
      lowStockThreshold: 2,
      doseId,
      recordedAt: new Date().toISOString(),
    });
    await expectDenied(batch.commit());
  });

  it('rejects a taken dose that claims a deduction without one', async () => {
    const { store, medicineId } = await setup(10);
    const doseId = doseIdFor(medicineId, slot(18));
    await expectDenied(
      setDoc(doc(store, 'users', alice.uid, 'doses', doseId), {
        medicineId,
        medicineName: 'Metformin',
        scheduledFor: slot(18).toISOString(),
        slotKey: slotKeyFor(slot(18)),
        outcome: 'taken',
        recordedAt: new Date().toISOString(),
        source: 'app',
        stockDeducted: true,
      }),
    );
  });

  it('rejects a taken dose that skips the deduction while stock remains', async () => {
    const { store, medicineId } = await setup(10);
    const doseId = doseIdFor(medicineId, slot(18));
    await expectDenied(
      setDoc(doc(store, 'users', alice.uid, 'doses', doseId), {
        medicineId,
        medicineName: 'Metformin',
        scheduledFor: slot(18).toISOString(),
        slotKey: slotKeyFor(slot(18)),
        outcome: 'taken',
        recordedAt: new Date().toISOString(),
        source: 'app',
        stockDeducted: false,
      }),
    );
  });

  it('rejects dose documents whose ID does not match the medicine and slot', async () => {
    const { store, medicineId } = await setup(10);
    await expectDenied(
      setDoc(doc(store, 'users', alice.uid, 'doses', 'arbitrary-id'), {
        medicineId,
        medicineName: 'Metformin',
        scheduledFor: slot(18).toISOString(),
        slotKey: slotKeyFor(slot(18)),
        outcome: 'skipped',
        recordedAt: new Date().toISOString(),
        source: 'app',
        stockDeducted: false,
      }),
    );
  });

  it('keeps the ledger and dose history append-only', async () => {
    const { store, medicineId } = await setup(10);
    const result = await confirmDose(
      alice.uid,
      {
        medicineId,
        medicineName: 'Metformin',
        scheduledFor: slot(18),
        outcome: 'taken',
        source: 'app',
      },
      store,
    );
    const txRef = doc(store, 'users', alice.uid, 'inventoryTransactions', `dose_${result.doseId}`);
    await expectDenied(updateDoc(txRef, { delta: -5 }));
    await expectDenied(runTransaction(store, async (transaction) => transaction.delete(txRef)));
    await expectDenied(
      updateDoc(doc(store, 'users', alice.uid, 'doses', result.doseId), { outcome: 'skipped' }),
    );
  });

  it('denies another user any access to the inventory', async () => {
    const { medicineId } = await setup(10);
    const other = clientFor(mallory);
    await createProfile(other, mallory, 'patient', 'Mallory');
    await expectDenied(getDocs(collection(other, 'users', alice.uid, 'inventoryTransactions')));
    await expectDenied(getDoc(doc(other, 'users', alice.uid, 'medicines', medicineId)));
    await expectDenied(recordRefill(alice.uid, medicineId, 5, 'refill_mallorytry0001', other));
    await expectDenied(
      confirmDose(
        alice.uid,
        { medicineId, medicineName: 'x', scheduledFor: slot(18), outcome: 'taken', source: 'app' },
        other,
      ),
    );
  });
});

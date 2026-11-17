import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from 'firebase/firestore';
import { requireDb } from '@/src/services/firebase/config';
import { withContentionRetry } from '@/src/services/firebase/contention';
import {
  doseIdFor,
  inventoryTransactionIdForDose,
  normalizeSlot,
  slotKeyFor,
} from '@/src/features/doses/schedule';
import { crossedLowStock } from '@/src/features/inventory/inventoryLogic';
import type { Dose, DoseOutcome, DoseSource } from '@/src/types/dose';

export type { Dose, DoseOutcome } from '@/src/types/dose';

export type ConfirmDoseInput = {
  medicineId: string;
  medicineName: string;
  scheduledFor: Date;
  outcome: DoseOutcome;
  source: DoseSource;
};

export type StockChange = {
  previous: number;
  next: number;
  threshold: number;
  crossedLowStock: boolean;
};

export type ConfirmDoseResult =
  | { status: 'recorded'; doseId: string; outcome: DoseOutcome; stock: StockChange | null }
  | { status: 'duplicate'; doseId: string; outcome: DoseOutcome };

/**
 * Records the outcome of one scheduled dose. Taken doses deduct one unit of stock in the same
 * transaction. The dose document ID is derived from the medicine and scheduled slot, so a
 * notification action, a retry after a network failure, and an in-app tap for the same slot all
 * resolve to one document and at most one deduction.
 *
 * Allowed transitions: none → taken, none → skipped, skipped → taken. A taken dose is final.
 */
export async function confirmDose(
  userId: string,
  input: ConfirmDoseInput,
  store: Firestore = requireDb(),
): Promise<ConfirmDoseResult> {
  const scheduledFor = normalizeSlot(input.scheduledFor);
  const slotKey = slotKeyFor(scheduledFor);
  const doseId = doseIdFor(input.medicineId, scheduledFor);
  const transactionId = inventoryTransactionIdForDose(doseId);
  const doseRef = doc(store, 'users', userId, 'doses', doseId);
  const medicineRef = doc(store, 'users', userId, 'medicines', input.medicineId);
  const inventoryRef = doc(store, 'users', userId, 'inventoryTransactions', transactionId);

  return withContentionRetry(() =>
    runTransaction(
      store,
      async (transaction): Promise<ConfirmDoseResult> => {
        const existing = await transaction.get(doseRef);
        const medicine = await transaction.get(medicineRef);
        const priorOutcome = existing.exists() ? (existing.data().outcome as DoseOutcome) : null;
        if (priorOutcome === 'taken' || priorOutcome === input.outcome)
          return { status: 'duplicate', doseId, outcome: priorOutcome };

        const recordedAt = new Date().toISOString();
        if (input.outcome === 'skipped') {
          transaction.set(doseRef, {
            medicineId: input.medicineId,
            medicineName: input.medicineName,
            scheduledFor: scheduledFor.toISOString(),
            slotKey,
            outcome: 'skipped',
            recordedAt,
            source: input.source,
            stockDeducted: false,
            createdAt: serverTimestamp(),
          });
          return { status: 'recorded', doseId, outcome: 'skipped', stock: null };
        }

        let stock: StockChange | null = null;
        if (medicine.exists()) {
          const data = medicine.data();
          const previous = Number(data.remainingStock ?? 0);
          const threshold = Number(data.lowStockThreshold ?? 0);
          if (previous > 0) {
            const next = previous - 1;
            stock = {
              previous,
              next,
              threshold,
              crossedLowStock: crossedLowStock(previous, next, threshold),
            };
            transaction.update(medicineRef, {
              remainingStock: next,
              lastInventoryTxId: transactionId,
              updatedAt: recordedAt,
            });
            transaction.set(inventoryRef, {
              medicineId: input.medicineId,
              medicineName: String(data.name ?? input.medicineName),
              reason: 'dose',
              delta: -1,
              previousStock: previous,
              resultingStock: next,
              lowStockThreshold: threshold,
              doseId,
              recordedAt,
              createdAt: serverTimestamp(),
            });
          }
        }

        const takenFields = {
          outcome: 'taken',
          recordedAt,
          source: input.source,
          stockDeducted: stock !== null,
        };
        if (priorOutcome === 'skipped') transaction.update(doseRef, takenFields);
        else
          transaction.set(doseRef, {
            medicineId: input.medicineId,
            medicineName: input.medicineName,
            scheduledFor: scheduledFor.toISOString(),
            slotKey,
            ...takenFields,
            createdAt: serverTimestamp(),
          });
        return { status: 'recorded', doseId, outcome: 'taken', stock };
      },
      { maxAttempts: 10 },
    ),
  );
}

const toDose = (id: string, data: Record<string, unknown>): Dose => ({
  id,
  medicineId: String(data.medicineId ?? ''),
  medicineName: String(data.medicineName ?? 'Medicine'),
  scheduledFor: String(data.scheduledFor ?? ''),
  slotKey: String(data.slotKey ?? ''),
  outcome: data.outcome === 'taken' ? 'taken' : 'skipped',
  recordedAt: String(data.recordedAt ?? ''),
  source: data.source === 'notification' ? 'notification' : 'app',
  stockDeducted: data.stockDeducted === true,
});

/** Live dose records whose scheduled time is on or after `since`, newest first. */
export function subscribeToDoses(
  userId: string,
  since: Date,
  callback: (items: Dose[]) => void,
  onError: (message: string) => void = () => undefined,
  store: Firestore = requireDb(),
) {
  return onSnapshot(
    query(
      collection(store, 'users', userId, 'doses'),
      where('scheduledFor', '>=', since.toISOString()),
      orderBy('scheduledFor', 'desc'),
    ),
    (snapshot) => callback(snapshot.docs.map((item) => toDose(item.id, item.data()))),
    (error) => onError(error.message),
  );
}

/** Dose records whose scheduled time falls in [start, end). */
export async function fetchDosesInRange(
  userId: string,
  start: Date,
  end: Date,
  store: Firestore = requireDb(),
) {
  const snapshot = await getDocs(
    query(
      collection(store, 'users', userId, 'doses'),
      where('scheduledFor', '>=', start.toISOString()),
      where('scheduledFor', '<', end.toISOString()),
      orderBy('scheduledFor', 'desc'),
    ),
  );
  return snapshot.docs.map((item) => toDose(item.id, item.data()));
}

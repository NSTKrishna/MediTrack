import {
  collection,
  doc,
  getDocs,
  limit as limitTo,
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
import { MAX_REFILL_AMOUNT } from '@/src/features/inventory/inventoryLogic';
import type { InventoryTransaction } from '@/src/types/inventory';

/** Creates a unique operation ID for a refill. Generate once per form submission, reuse on retry. */
export function newRefillOperationId(store: Firestore = requireDb()) {
  return `refill_${doc(collection(store, '_ids')).id}`;
}

export type RefillResult = { status: 'recorded' | 'duplicate'; resultingStock: number };

/**
 * Adds stock for a medicine. The operation ID makes the refill idempotent: retrying the same
 * operation after a timeout cannot add the amount twice.
 */
export async function recordRefill(
  userId: string,
  medicineId: string,
  amount: number,
  operationId: string,
  store: Firestore = requireDb(),
): Promise<RefillResult> {
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_REFILL_AMOUNT)
    throw new Error(`Refill amount must be a whole number between 1 and ${MAX_REFILL_AMOUNT}.`);
  if (!operationId.startsWith('refill_')) throw new Error('Invalid refill operation.');
  const medicineRef = doc(store, 'users', userId, 'medicines', medicineId);
  const transactionRef = doc(store, 'users', userId, 'inventoryTransactions', operationId);
  return withContentionRetry(() =>
    runTransaction(
      store,
      async (transaction): Promise<RefillResult> => {
        const prior = await transaction.get(transactionRef);
        if (prior.exists())
          return { status: 'duplicate', resultingStock: Number(prior.data().resultingStock) };
        const medicine = await transaction.get(medicineRef);
        if (!medicine.exists()) throw new Error('Medicine not found.');
        const data = medicine.data();
        const previous = Number(data.remainingStock ?? 0);
        const next = previous + amount;
        const recordedAt = new Date().toISOString();
        transaction.update(medicineRef, {
          remainingStock: next,
          lastInventoryTxId: operationId,
          updatedAt: recordedAt,
        });
        transaction.set(transactionRef, {
          medicineId,
          medicineName: String(data.name ?? 'Medicine'),
          reason: 'refill',
          delta: amount,
          previousStock: previous,
          resultingStock: next,
          lowStockThreshold: Number(data.lowStockThreshold ?? 0),
          recordedAt,
          createdAt: serverTimestamp(),
        });
        return { status: 'recorded', resultingStock: next };
      },
      { maxAttempts: 10 },
    ),
  );
}

const toTransaction = (id: string, data: Record<string, unknown>): InventoryTransaction => ({
  id,
  medicineId: String(data.medicineId ?? ''),
  medicineName: String(data.medicineName ?? 'Medicine'),
  reason: data.reason === 'refill' ? 'refill' : 'dose',
  delta: Number(data.delta ?? 0),
  previousStock: Number(data.previousStock ?? 0),
  resultingStock: Number(data.resultingStock ?? 0),
  lowStockThreshold: Number(data.lowStockThreshold ?? 0),
  doseId: typeof data.doseId === 'string' ? data.doseId : undefined,
  recordedAt: String(data.recordedAt ?? ''),
});

/** Live inventory history, newest first. */
export function subscribeToInventoryTransactions(
  userId: string,
  callback: (items: InventoryTransaction[]) => void,
  onError: (message: string) => void = () => undefined,
  options: { limit?: number } = {},
  store: Firestore = requireDb(),
) {
  return onSnapshot(
    query(
      collection(store, 'users', userId, 'inventoryTransactions'),
      orderBy('recordedAt', 'desc'),
      limitTo(options.limit ?? 100),
    ),
    (snapshot) => callback(snapshot.docs.map((item) => toTransaction(item.id, item.data()))),
    (error) => onError(error.message),
  );
}

export async function fetchInventoryTransactionsInRange(
  userId: string,
  start: Date,
  end: Date,
  store: Firestore = requireDb(),
) {
  const snapshot = await getDocs(
    query(
      collection(store, 'users', userId, 'inventoryTransactions'),
      where('recordedAt', '>=', start.toISOString()),
      where('recordedAt', '<', end.toISOString()),
      orderBy('recordedAt', 'desc'),
    ),
  );
  return snapshot.docs.map((item) => toTransaction(item.id, item.data()));
}

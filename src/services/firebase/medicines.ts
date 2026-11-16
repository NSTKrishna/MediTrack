import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { requireDb } from '@/src/services/firebase/config';
import type { Medicine, MedicineFrequency } from '@/src/types/medicine';

export type MedicineInput = Omit<
  Medicine,
  'id' | 'userId' | 'schedule' | 'color' | 'lastInventoryTxId' | 'createdAt'
>;
/** Stock changes go through inventory transactions; ordinary edits cannot touch stock. */
export type MedicineUpdate = Partial<Omit<MedicineInput, 'remainingStock'>>;

const palette = ['#DBEEF9', '#DDF4EA', '#FFF0D5', '#EEE4FA'];
export function colorForMedicine(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return palette[Math.abs(hash) % palette.length] ?? palette[0]!;
}

const frequencies: MedicineFrequency[] = [
  'once-daily',
  'twice-daily',
  'three-times-daily',
  'custom-time',
  'selected-weekdays',
];

export function toMedicine(id: string, data: Record<string, unknown>): Medicine {
  const scheduledTimes = Array.isArray(data.scheduledTimes)
    ? data.scheduledTimes.filter((value): value is string => typeof value === 'string')
    : [];
  const frequency = frequencies.includes(data.frequency as MedicineFrequency)
    ? (data.frequency as MedicineFrequency)
    : 'custom-time';
  return {
    id,
    userId: String(data.userId ?? ''),
    name: String(data.name ?? 'Medicine'),
    category: String(data.category ?? ''),
    dosage: String(data.dosage ?? ''),
    dosageUnit: String(data.dosageUnit ?? ''),
    frequency,
    scheduledTimes,
    selectedWeekdays: Array.isArray(data.selectedWeekdays)
      ? data.selectedWeekdays.filter((value): value is number => typeof value === 'number')
      : [],
    startDate: String(data.startDate ?? ''),
    endDate: typeof data.endDate === 'string' ? data.endDate : null,
    schedule: scheduledTimes.join(' · '),
    stockQuantity: Number(data.stockQuantity ?? 0),
    remainingStock: Number(data.remainingStock ?? 0),
    lowStockThreshold: Number(data.lowStockThreshold ?? 0),
    instructions: String(data.instructions ?? ''),
    active: data.active !== false,
    color: colorForMedicine(id),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
    lastInventoryTxId:
      typeof data.lastInventoryTxId === 'string' ? data.lastInventoryTxId : undefined,
  };
}

export async function createMedicine(
  userId: string,
  input: MedicineInput,
  store: Firestore = requireDb(),
) {
  const now = new Date().toISOString();
  return addDoc(collection(store, 'users', userId, 'medicines'), {
    ...input,
    remainingStock: input.stockQuantity,
    userId,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateMedicine(
  userId: string,
  id: string,
  input: MedicineUpdate,
  store: Firestore = requireDb(),
) {
  await updateDoc(doc(store, 'users', userId, 'medicines', id), {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function removeMedicine(userId: string, id: string, store: Firestore = requireDb()) {
  await deleteDoc(doc(store, 'users', userId, 'medicines', id));
}

export function subscribeToMedicines(
  userId: string,
  callback: (items: Medicine[]) => void,
  onError: (message: string) => void,
  store: Firestore = requireDb(),
) {
  return onSnapshot(
    query(collection(store, 'users', userId, 'medicines'), orderBy('createdAt', 'desc')),
    (snapshot) => callback(snapshot.docs.map((item) => toMedicine(item.id, item.data()))),
    (error) => onError(error.message),
  );
}

export async function fetchMedicines(userId: string, store: Firestore = requireDb()) {
  const snapshot = await getDocs(collection(store, 'users', userId, 'medicines'));
  return snapshot.docs.map((item) => toMedicine(item.id, item.data()));
}

import { useEffect, useState } from 'react';
import { addDays, startOfLocalDay } from '@/src/features/doses/schedule';
import { subscribeToDoses } from '@/src/services/firebase/doses';
import { subscribeToInventoryTransactions } from '@/src/services/firebase/inventory';
import { subscribeToMedicines } from '@/src/services/firebase/medicines';
import type { CarePermissions } from '@/src/types/caregiver';
import type { Dose } from '@/src/types/dose';
import type { InventoryTransaction } from '@/src/types/inventory';
import type { Medicine } from '@/src/types/medicine';

const isDenied = (message: string) => /permission|insufficient/i.test(message);

/**
 * Live view of one patient's shared data. Collections the caregiver is not permitted to read are
 * never requested. If the patient narrows or revokes access while this is open, the listener is
 * rejected by the security rules and `accessLost` becomes true.
 */
export function usePatientSnapshot(
  patientId: string | undefined,
  permissions: CarePermissions | undefined,
) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const canMedicines = permissions?.viewMedicines ?? false;
  const canDoses = permissions?.viewDoseHistory ?? false;
  const canInventory = permissions?.viewInventory ?? false;

  useEffect(() => {
    setAccessLost(false);
    setError(null);
    if (!patientId) return;
    const onError = (message: string) =>
      isDenied(message) ? setAccessLost(true) : setError(message);
    const unsubscribers: (() => void)[] = [];
    if (canMedicines) unsubscribers.push(subscribeToMedicines(patientId, setMedicines, onError));
    else setMedicines([]);
    if (canDoses)
      unsubscribers.push(
        subscribeToDoses(patientId, addDays(startOfLocalDay(new Date()), -7), setDoses, onError),
      );
    else setDoses([]);
    if (canInventory)
      unsubscribers.push(
        subscribeToInventoryTransactions(patientId, setTransactions, onError, { limit: 20 }),
      );
    else setTransactions([]);
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [patientId, canMedicines, canDoses, canInventory]);

  return { medicines, doses, transactions, error, accessLost };
}

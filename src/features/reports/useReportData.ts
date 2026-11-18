import { useCallback, useEffect, useState } from 'react';
import { fetchDosesInRange } from '@/src/services/firebase/doses';
import { fetchInventoryTransactionsInRange } from '@/src/services/firebase/inventory';
import { fetchMedicines } from '@/src/services/firebase/medicines';
import type { DateRange } from '@/src/features/reports/reportLogic';
import type { Dose } from '@/src/types/dose';
import type { InventoryTransaction } from '@/src/types/inventory';
import type { Medicine } from '@/src/types/medicine';

export type ReportAccess = { medicines: boolean; doses: boolean; inventory: boolean };

type State = {
  loading: boolean;
  error: string | null;
  medicines: Medicine[];
  doses: Dose[];
  transactions: InventoryTransaction[];
};

/**
 * Loads the Firestore records a report needs for one range. Only collections the viewer is
 * permitted to read are requested, so a caregiver never triggers a denied read.
 */
export function useReportData(
  ownerId: string | null,
  range: DateRange | null,
  access: ReportAccess,
) {
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    medicines: [],
    doses: [],
    transactions: [],
  });
  const [attempt, setAttempt] = useState(0);
  const start = range?.start.getTime();
  const end = range?.end.getTime();

  useEffect(() => {
    if (!ownerId || start === undefined || end === undefined) return;
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    const from = new Date(start);
    const to = new Date(end);
    Promise.all([
      access.medicines ? fetchMedicines(ownerId) : Promise.resolve([]),
      access.doses ? fetchDosesInRange(ownerId, from, to) : Promise.resolve([]),
      access.inventory ? fetchInventoryTransactionsInRange(ownerId, from, to) : Promise.resolve([]),
    ])
      .then(([medicines, doses, transactions]) => {
        if (!cancelled) setState({ loading: false, error: null, medicines, doses, transactions });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : 'Could not load the report.',
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, start, end, access.medicines, access.doses, access.inventory, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}

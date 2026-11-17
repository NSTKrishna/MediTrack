import { create } from 'zustand';
import { subscribeToDoses } from '@/src/services/firebase/doses';
import { addDays, startOfLocalDay } from '@/src/features/doses/schedule';
import type { Dose } from '@/src/types/dose';

/** The dashboard and history views need roughly a month of dose records. */
export const DOSE_WINDOW_DAYS = 35;

type State = {
  items: Dose[];
  loading: boolean;
  error: string | null;
  /** Notification confirmations stored on this device and not yet written to Firestore. */
  pendingCount: number;
  subscribe: (userId: string) => () => void;
  setPendingCount: (count: number) => void;
  reset: () => void;
};

export const useDoseStore = create<State>((set) => ({
  items: [],
  loading: true,
  error: null,
  pendingCount: 0,
  subscribe: (userId) => {
    set({ loading: true, error: null });
    return subscribeToDoses(
      userId,
      addDays(startOfLocalDay(new Date()), -DOSE_WINDOW_DAYS),
      (items) => set({ items, loading: false, error: null }),
      (message) => set({ error: message, loading: false }),
    );
  },
  setPendingCount: (pendingCount) => set({ pendingCount }),
  reset: () => set({ items: [], loading: true, error: null, pendingCount: 0 }),
}));

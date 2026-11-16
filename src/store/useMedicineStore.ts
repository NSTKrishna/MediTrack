import { create } from 'zustand';
import { subscribeToMedicines } from '@/src/services/firebase/medicines';
import type { Medicine } from '@/src/types/medicine';

type State = {
  items: Medicine[];
  loading: boolean;
  error: string | null;
  subscribe: (userId: string) => () => void;
  reset: () => void;
};

export const useMedicineStore = create<State>((set) => ({
  items: [],
  loading: true,
  error: null,
  subscribe: (userId) => {
    set({ loading: true, error: null });
    return subscribeToMedicines(
      userId,
      (items) => set({ items, loading: false, error: null }),
      (message) => set({ error: message, loading: false }),
    );
  },
  reset: () => set({ items: [], loading: true, error: null }),
}));

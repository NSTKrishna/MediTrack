import { create } from 'zustand';
import { subscribeToInventoryTransactions } from '@/src/services/firebase/inventory';
import type { InventoryTransaction } from '@/src/types/inventory';

type State = {
  items: InventoryTransaction[];
  loading: boolean;
  error: string | null;
  subscribe: (userId: string) => () => void;
  reset: () => void;
};

export const useInventoryStore = create<State>((set) => ({
  items: [],
  loading: true,
  error: null,
  subscribe: (userId) => {
    set({ loading: true, error: null });
    return subscribeToInventoryTransactions(
      userId,
      (items) => set({ items, loading: false, error: null }),
      (message) => set({ error: message, loading: false }),
    );
  },
  reset: () => set({ items: [], loading: true, error: null }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Preferences = {
  remindersEnabled: boolean;
  lowStockAlertsEnabled: boolean;
  /** Hide medicine names from lock-screen notifications. */
  discreetNotifications: boolean;
  hydrated: boolean;
  setRemindersEnabled: (value: boolean) => void;
  setLowStockAlertsEnabled: (value: boolean) => void;
  setDiscreetNotifications: (value: boolean) => void;
};

/** Non-sensitive device preferences, kept in AsyncStorage. */
export const usePreferencesStore = create<Preferences>()(
  persist(
    (set) => ({
      remindersEnabled: true,
      lowStockAlertsEnabled: true,
      discreetNotifications: false,
      hydrated: false,
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      setLowStockAlertsEnabled: (lowStockAlertsEnabled) => set({ lowStockAlertsEnabled }),
      setDiscreetNotifications: (discreetNotifications) => set({ discreetNotifications }),
    }),
    {
      name: 'meditrack:preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ remindersEnabled, lowStockAlertsEnabled, discreetNotifications }) => ({
        remindersEnabled,
        lowStockAlertsEnabled,
        discreetNotifications,
      }),
      onRehydrateStorage: () => () => usePreferencesStore.setState({ hydrated: true }),
    },
  ),
);

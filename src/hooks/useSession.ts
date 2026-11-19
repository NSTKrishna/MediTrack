import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  configureMedicationNotifications,
  drainPendingDoseActions,
  handleNotificationResponse,
  syncMedicineReminders,
} from '@/src/services/notifications/medicationReminders';
import { registerPushToken } from '@/src/services/notifications/pushTokens';
import { onSignOutReset, useAuthStore } from '@/src/store/useAuthStore';
import { useCareStore } from '@/src/store/useCareStore';
import { useDoseStore } from '@/src/store/useDoseStore';
import { useInventoryStore } from '@/src/store/useInventoryStore';
import { useMedicineStore } from '@/src/store/useMedicineStore';
import { usePreferencesStore } from '@/src/store/usePreferencesStore';

async function drainForCurrentUser() {
  const userId = useAuthStore.getState().user?.uid;
  if (!userId) return;
  const waiting = await drainPendingDoseActions(userId).catch(() => null);
  if (waiting !== null) useDoseStore.getState().setPendingCount(waiting);
}

/** Increments whenever the app returns to the foreground. */
function useForegroundTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);
  return tick;
}

/**
 * Notification actions. Registered once, before sign-in completes, so an action that launched
 * the app is never missed; it is stored durably and written once the account is available.
 */
export function useNotificationResponses() {
  useEffect(() => {
    void configureMedicationNotifications().catch(() => undefined);
    const process = async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as { kind?: string } | undefined;
      if (
        data?.kind === 'care-alert' &&
        response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        router.push('/(tabs)/caregivers');
        return;
      }
      await handleNotificationResponse(response).catch(() => undefined);
      await drainForCurrentUser();
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => void process(response),
    );
    // A response that cold-started the app is delivered here rather than to the listener.
    void Notifications.getLastNotificationResponseAsync()
      .then(async (response) => {
        if (!response) return;
        await process(response);
        await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      })
      .catch(() => undefined);
    return () => subscription.remove();
  }, []);
}

/** Owns every per-account subscription and background sync for the signed-in session. */
export function useSessionData() {
  const status = useAuthStore((state) => state.status);
  const profile = useAuthStore((state) => state.profile);
  const emailVerified = useAuthStore((state) => state.emailVerified);
  const userId = status === 'authenticated' ? (profile?.id ?? null) : null;
  const role = profile?.role ?? null;
  const tick = useForegroundTick();

  useEffect(() => {
    const unregister = [
      onSignOutReset(useMedicineStore.getState().reset),
      onSignOutReset(useDoseStore.getState().reset),
      onSignOutReset(useInventoryStore.getState().reset),
      onSignOutReset(useCareStore.getState().reset),
    ];
    return () => unregister.forEach((off) => off());
  }, []);

  // Patient data: one listener per collection for the whole session.
  useEffect(() => {
    if (!userId || role !== 'patient') return;
    const unsubscribers = [
      useMedicineStore.getState().subscribe(userId),
      useDoseStore.getState().subscribe(userId),
      useInventoryStore.getState().subscribe(userId),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [userId, role]);

  // Care relationships, invitations, and caregiver alerts.
  useEffect(() => {
    if (!userId || !profile) return;
    return useCareStore.getState().subscribe(profile, emailVerified);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resubscribe only on identity changes
  }, [userId, role, emailVerified]);

  // Keep scheduled reminders matching the medicine list and preferences.
  const medicines = useMedicineStore((state) => state.items);
  const medicinesLoading = useMedicineStore((state) => state.loading);
  const remindersEnabled = usePreferencesStore((state) => state.remindersEnabled);
  const discreet = usePreferencesStore((state) => state.discreetNotifications);
  const hydrated = usePreferencesStore((state) => state.hydrated);
  useEffect(() => {
    if (!userId || role !== 'patient' || medicinesLoading || !hydrated) return;
    void syncMedicineReminders(userId, medicines, { enabled: remindersEnabled, discreet }).catch(
      () => undefined,
    );
  }, [userId, role, medicines, medicinesLoading, remindersEnabled, discreet, hydrated, tick]);

  // Write any notification confirmations queued while offline or signed out.
  useEffect(() => {
    if (userId) void drainForCurrentUser();
  }, [userId, tick]);

  // Caregivers receive missed-dose and low-stock alerts by push.
  useEffect(() => {
    if (userId && role === 'caregiver') void registerPushToken(userId).catch(() => undefined);
  }, [userId, role]);
}

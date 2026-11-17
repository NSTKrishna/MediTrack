import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { formatClockTime } from '@/src/features/doses/schedule';
import { confirmDose } from '@/src/services/firebase/doses';
import { afterDoseRecorded } from '@/src/services/notifications/medicationReminders';
import { useAuthStore } from '@/src/store/useAuthStore';
import type { DoseOutcome } from '@/src/types/dose';
import type { Medicine } from '@/src/types/medicine';

const messageFor = (error: unknown) =>
  error instanceof Error ? error.message.replace('Firebase: ', '') : 'Could not save this dose.';

/**
 * Records a dose outcome from the app. "Taken" deducts stock, so it asks for explicit
 * confirmation first; nothing is recorded if the person cancels.
 */
export function useConfirmDose() {
  const userId = useAuthStore((state) => state.user?.uid);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const record = useCallback(
    async (medicine: Medicine, scheduledFor: Date, outcome: DoseOutcome, doseId: string) => {
      if (!userId) return;
      setPending(doseId);
      setError(null);
      try {
        const result = await confirmDose(userId, {
          medicineId: medicine.id,
          medicineName: medicine.name,
          scheduledFor,
          outcome,
          source: 'app',
        });
        await afterDoseRecorded(result, medicine.name).catch(() => undefined);
      } catch (cause) {
        setError(messageFor(cause));
      } finally {
        setPending(null);
      }
    },
    [userId],
  );

  const confirm = useCallback(
    (medicine: Medicine, scheduledFor: Date, outcome: DoseOutcome, doseId: string) => {
      const time = formatClockTime({
        hour: scheduledFor.getHours(),
        minute: scheduledFor.getMinutes(),
      });
      if (outcome === 'skipped') {
        void record(medicine, scheduledFor, outcome, doseId);
        return;
      }
      Alert.alert(
        `Confirm ${medicine.name}`,
        `Record the ${time} dose as taken? One dose will be removed from your stock.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, I took it',
            onPress: () => void record(medicine, scheduledFor, outcome, doseId),
          },
        ],
      );
    },
    [record],
  );

  return { confirm, pending, error, clearError: () => setError(null) };
}

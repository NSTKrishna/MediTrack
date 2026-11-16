import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/src/components/common/Screen';
import { colors, spacing } from '@/src/constants/theme';
import { toLocalDateString } from '@/src/features/doses/schedule';
import { MedicineForm } from '@/src/features/medicines/MedicineForm';
import { createMedicine } from '@/src/services/firebase/medicines';
import { requestReminderPermissions } from '@/src/services/notifications/medicationReminders';
import { useAuthStore } from '@/src/store/useAuthStore';

export default function AddMedicineScreen() {
  const userId = useAuthStore((state) => state.user?.uid);
  return (
    <Screen>
      <Text style={styles.intro}>Create a medicine schedule and starting inventory.</Text>
      <MedicineForm
        mode="create"
        submitLabel="Save medicine"
        initial={{
          name: '',
          category: '',
          dosage: '',
          dosageUnit: 'mg',
          frequency: 'once-daily',
          times: '8:00 AM',
          selectedWeekdays: [],
          startDate: toLocalDateString(new Date()),
          endDate: '',
          stockQuantity: '',
          lowStockThreshold: '5',
          instructions: '',
          active: true,
        }}
        onSubmit={async (value) => {
          if (!userId) throw new Error('Please sign in again.');
          await createMedicine(userId, { ...value, remainingStock: value.stockQuantity });
          // Reminders are scheduled by the session's reminder sync once the medicine appears;
          // ask for permission here, where the person can see why it is needed.
          await requestReminderPermissions().catch(() => false);
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, lineHeight: 21, marginBottom: spacing.lg },
});

import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/src/components/common/Screen';
import { StateView } from '@/src/components/feedback/StateView';
import { colors, spacing } from '@/src/constants/theme';
import { MedicineForm } from '@/src/features/medicines/MedicineForm';
import { updateMedicine } from '@/src/services/firebase/medicines';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useMedicineStore } from '@/src/store/useMedicineStore';

export default function EditMedicineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.user?.uid);
  const medicine = useMedicineStore((state) => state.items.find((item) => item.id === id));
  const loading = useMedicineStore((state) => state.loading);
  if (!medicine)
    return (
      <Screen>
        {loading ? (
          <StateView kind="loading" />
        ) : (
          <StateView kind="empty" title="Medicine not found" />
        )}
      </Screen>
    );
  return (
    <Screen>
      <Text style={styles.intro}>
        Changes to times and days update your reminders automatically.
      </Text>
      <MedicineForm
        mode="edit"
        submitLabel="Save changes"
        initial={{
          name: medicine.name,
          category: medicine.category,
          dosage: medicine.dosage,
          dosageUnit: medicine.dosageUnit,
          frequency: medicine.frequency,
          times: medicine.scheduledTimes.join(', '),
          selectedWeekdays: medicine.selectedWeekdays,
          startDate: medicine.startDate,
          endDate: medicine.endDate ?? '',
          stockQuantity: String(medicine.stockQuantity),
          lowStockThreshold: String(medicine.lowStockThreshold),
          instructions: medicine.instructions,
          active: medicine.active,
        }}
        onSubmit={async (value) => {
          if (!userId) throw new Error('Please sign in again.');
          const { stockQuantity: _unchanged, ...update } = value;
          await updateMedicine(userId, medicine.id, update);
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, lineHeight: 21, marginBottom: spacing.lg },
});

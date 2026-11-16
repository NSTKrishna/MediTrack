import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { InventoryHistoryRow } from '@/src/components/cards/InventoryHistoryRow';
import { AppButton } from '@/src/components/common/AppButton';
import { Screen } from '@/src/components/common/Screen';
import { StateView } from '@/src/components/feedback/StateView';
import { colors, radius, spacing } from '@/src/constants/theme';
import { addDays, startOfLocalDay } from '@/src/features/doses/schedule';
import { buildAdherenceReport, formatPercent } from '@/src/features/reports/reportLogic';
import { removeMedicine } from '@/src/services/firebase/medicines';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useDoseStore } from '@/src/store/useDoseStore';
import { useInventoryStore } from '@/src/store/useInventoryStore';
import { useMedicineStore } from '@/src/store/useMedicineStore';

const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MedicineDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.user?.uid);
  const medicine = useMedicineStore((state) => state.items.find((item) => item.id === id));
  const loading = useMedicineStore((state) => state.loading);
  const doses = useDoseStore((state) => state.items);
  const transactions = useInventoryStore((state) => state.items);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const history = useMemo(
    () => transactions.filter((item) => item.medicineId === id),
    [transactions, id],
  );
  const adherence = useMemo(() => {
    if (!medicine) return null;
    const end = addDays(startOfLocalDay(new Date()), 1);
    return buildAdherenceReport({
      medicines: [medicine],
      doses: doses.filter((dose) => dose.medicineId === medicine.id),
      transactions: [],
      range: { start: addDays(end, -30), end },
    }).totals;
  }, [medicine, doses]);

  const remove = () => {
    if (!userId || !medicine) return;
    Alert.alert(
      `Delete ${medicine.name}?`,
      'Its reminders stop and it is removed from your list. Past dose and stock history is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await removeMedicine(userId, medicine.id);
              router.replace('/(tabs)/medicines');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Could not delete the medicine.');
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

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
  const schedule =
    medicine.frequency === 'selected-weekdays'
      ? `${medicine.selectedWeekdays.map((day) => weekdayNames[day]).join(', ')} · ${medicine.schedule}`
      : medicine.schedule;
  return (
    <Screen>
      <View style={[styles.hero, { backgroundColor: medicine.color }]}>
        <Text style={styles.name} accessibilityRole="header">
          {medicine.name}
        </Text>
        <Text style={styles.dose}>
          {medicine.dosage} {medicine.dosageUnit}
        </Text>
        <Text style={styles.instruction}>
          {medicine.instructions || 'No additional instructions.'}
        </Text>
      </View>
      <View style={styles.card}>
        <Row label="Category" value={medicine.category} />
        <Row label="Schedule" value={schedule || 'No times set'} />
        <Row
          label="Dates"
          value={`${medicine.startDate}${medicine.endDate ? ` to ${medicine.endDate}` : ' onwards'}`}
        />
        <Row label="Remaining stock" value={`${medicine.remainingStock} doses`} />
        <Row label="Refill point" value={`${medicine.lowStockThreshold} doses`} />
        <Row
          label="Adherence (30 days)"
          value={formatPercent(adherence?.adherencePercent ?? null)}
        />
        <Row label="Status" value={medicine.active ? 'Active' : 'Inactive'} />
      </View>

      <Text style={styles.section} accessibilityRole="header">
        Stock history
      </Text>
      <View style={styles.history}>
        {history.length === 0 ? <Text style={styles.empty}>No stock changes yet.</Text> : null}
        {history.slice(0, 20).map((item) => (
          <InventoryHistoryRow key={item.id} item={item} showMedicine={false} />
        ))}
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <AppButton
        label="Edit medicine"
        variant="ghost"
        onPress={() =>
          router.push({ pathname: '/medicine/edit/[id]', params: { id: medicine.id } })
        }
      />
      <AppButton
        label="Delete medicine"
        variant="danger"
        busy={deleting}
        onPress={remove}
        style={styles.button}
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.lg },
  name: { color: colors.text, fontSize: 27, fontWeight: '800' },
  dose: { color: colors.primary, fontSize: 17, fontWeight: '700', marginTop: spacing.xs },
  instruction: { color: colors.muted, marginTop: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.lg },
  row: { padding: spacing.md, borderBottomColor: colors.border, borderBottomWidth: 1 },
  label: { color: colors.muted, fontSize: 13 },
  value: { color: colors.text, fontWeight: '700', marginTop: 3 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  history: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  empty: { color: colors.muted, paddingVertical: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },
  button: { marginTop: spacing.sm },
});

import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { InventoryHistoryRow } from '@/src/components/cards/InventoryHistoryRow';
import { Screen } from '@/src/components/common/Screen';
import { StateView } from '@/src/components/feedback/StateView';
import { colors, radius, spacing } from '@/src/constants/theme';
import { isLowStock, stockLevelPercent } from '@/src/features/inventory/inventoryLogic';
import { RefillForm } from '@/src/features/inventory/RefillForm';
import { newRefillOperationId, recordRefill } from '@/src/services/firebase/inventory';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useInventoryStore } from '@/src/store/useInventoryStore';
import { useMedicineStore } from '@/src/store/useMedicineStore';

export default function InventoryScreen() {
  const userId = useAuthStore((state) => state.user?.uid);
  const medicines = useMedicineStore((state) => state.items);
  const loading = useMedicineStore((state) => state.loading);
  const error = useMedicineStore((state) => state.error);
  const history = useInventoryStore((state) => state.items);
  const historyLoading = useInventoryStore((state) => state.loading);
  const historyError = useInventoryStore((state) => state.error);

  return (
    <Screen>
      <Text style={styles.intro}>
        Stay ahead of refills. Taken doses are deducted automatically.
      </Text>
      {loading ? <StateView kind="loading" message="Loading stock…" /> : null}
      {error ? <StateView kind="error" message={error} /> : null}
      {!loading && !error && medicines.length === 0 ? (
        <StateView
          kind="empty"
          title="No medicines to track"
          message="Add a medicine with its starting stock to see it here."
          actionLabel="Add medicine"
          onAction={() => router.push('/medicine/add')}
        />
      ) : null}
      {medicines.map((medicine) => {
        const low = isLowStock(medicine.remainingStock, medicine.lowStockThreshold);
        const capacity = Math.max(medicine.stockQuantity, medicine.remainingStock, 1);
        const percent = stockLevelPercent(medicine.remainingStock, capacity);
        return (
          <View style={styles.card} key={medicine.id}>
            <View style={styles.header}>
              <Text style={styles.name}>{medicine.name}</Text>
              {low ? (
                <Text style={styles.lowBadge}>
                  {medicine.remainingStock === 0 ? 'Out of stock' : 'Low stock'}
                </Text>
              ) : null}
            </View>
            <Text style={styles.quantity}>
              {medicine.remainingStock} dose{medicine.remainingStock === 1 ? '' : 's'} remaining
            </Text>
            <View
              style={styles.bar}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${medicine.name} stock level`}
              accessibilityValue={{ min: 0, max: 100, now: percent }}
            >
              <View style={[styles.fill, { width: `${percent}%` }, low && styles.lowFill]} />
            </View>
            <Text style={[styles.note, low && styles.lowText]}>
              {low
                ? `At or below your refill point of ${medicine.lowStockThreshold}`
                : `Refill point: ${medicine.lowStockThreshold} doses`}
            </Text>
            {userId ? (
              <RefillForm
                medicineName={medicine.name}
                createOperationId={() => newRefillOperationId()}
                onSubmit={async (amount, operationId) => {
                  await recordRefill(userId, medicine.id, amount, operationId);
                }}
              />
            ) : null}
          </View>
        );
      })}

      <Text style={styles.section} accessibilityRole="header">
        Inventory history
      </Text>
      <View style={styles.history}>
        {historyLoading ? <StateView kind="loading" /> : null}
        {historyError ? <StateView kind="error" message={historyError} /> : null}
        {!historyLoading && !historyError && history.length === 0 ? (
          <Text style={styles.empty}>
            No stock changes yet. Refills and taken doses appear here.
          </Text>
        ) : null}
        {history.slice(0, 50).map((item) => (
          <InventoryHistoryRow key={item.id} item={item} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, marginBottom: spacing.md, fontSize: 15, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 17, fontWeight: '800', flex: 1 },
  lowBadge: {
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  quantity: { color: colors.muted, marginTop: spacing.xs },
  bar: {
    backgroundColor: colors.border,
    height: 8,
    borderRadius: 4,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.secondary },
  lowFill: { backgroundColor: colors.warning },
  note: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  lowText: { color: colors.warning, fontWeight: '700' },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  history: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  empty: { color: colors.muted, paddingVertical: spacing.md },
});

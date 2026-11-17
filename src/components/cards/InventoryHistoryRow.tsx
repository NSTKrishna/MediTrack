import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/src/constants/theme';
import type { InventoryTransaction } from '@/src/types/inventory';

function InventoryHistoryRowBase({
  item,
  showMedicine = true,
}: {
  item: InventoryTransaction;
  showMedicine?: boolean;
}) {
  const positive = item.delta > 0;
  const when = item.recordedAt ? new Date(item.recordedAt).toLocaleString() : 'Pending';
  const what = item.reason === 'refill' ? 'Refill' : 'Dose taken';
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${showMedicine ? `${item.medicineName}, ` : ''}${what}, ${positive ? 'plus' : 'minus'} ${Math.abs(item.delta)}, stock now ${item.resultingStock}, ${when}`}
    >
      <View style={styles.flex}>
        <Text style={styles.title}>
          {showMedicine ? `${item.medicineName} · ` : ''}
          {what}
        </Text>
        <Text style={styles.meta}>{when}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.delta, positive ? styles.plus : styles.minus]}>
          {positive ? '+' : '−'}
          {Math.abs(item.delta)}
        </Text>
        <Text style={styles.meta}>
          {item.previousStock} → {item.resultingStock}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  flex: { flex: 1 },
  title: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  delta: { fontWeight: '800', fontSize: 16 },
  plus: { color: colors.success },
  minus: { color: colors.warning },
});

/** Memoized: rows re-render only when their own data changes. */
export const InventoryHistoryRow = memo(InventoryHistoryRowBase);

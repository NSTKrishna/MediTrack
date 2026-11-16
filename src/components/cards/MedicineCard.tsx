import { memo } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/src/constants/theme';
import type { Medicine } from '@/src/types/medicine';

function MedicineCardBase({ medicine }: { medicine: Medicine }) {
  const low = medicine.remainingStock <= medicine.lowStockThreshold;
  return (
    <Link href={{ pathname: '/medicine/[id]', params: { id: medicine.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${medicine.name}, ${medicine.dosage} ${medicine.dosageUnit}, ${medicine.remainingStock} doses left${low ? ', refill soon' : ''}${medicine.active ? '' : ', inactive'}`}
        accessibilityHint="Opens medicine details"
        style={styles.card}
      >
        <View style={[styles.icon, { backgroundColor: medicine.color }]}>
          <Text style={styles.iconText}>Rx</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.title}>{medicine.name}</Text>
          <Text style={styles.meta}>
            {[medicine.dosage, medicine.dosageUnit].filter(Boolean).join(' ')} ·{' '}
            {medicine.schedule || 'No times set'}
            {medicine.active ? '' : ' · inactive'}
          </Text>
          <Text style={[styles.stock, low && styles.low]}>
            {medicine.remainingStock} doses left{low ? ' · Refill soon' : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Link>
  );
}
const styles = StyleSheet.create({
  card: {
    ...shadow,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: { height: 44, width: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  details: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, marginTop: 3, fontSize: 13 },
  stock: { color: colors.success, marginTop: spacing.sm, fontSize: 13, fontWeight: '600' },
  low: { color: colors.warning },
  chevron: { color: colors.primary, fontSize: 28, fontWeight: '300' },
});

/** Memoized: rows re-render only when their own data changes. */
export const MedicineCard = memo(MedicineCardBase);

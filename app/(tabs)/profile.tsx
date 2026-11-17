import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { Screen } from '@/src/components/common/Screen';
import { colors, radius, spacing } from '@/src/constants/theme';
import { addDays, startOfLocalDay } from '@/src/features/doses/schedule';
import { buildAdherenceReport, formatPercent } from '@/src/features/reports/reportLogic';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useCareStore } from '@/src/store/useCareStore';
import { useDoseStore } from '@/src/store/useDoseStore';
import { useMedicineStore } from '@/src/store/useMedicineStore';

export default function ProfileScreen() {
  const profile = useAuthStore((state) => state.profile);
  const medicines = useMedicineStore((state) => state.items);
  const doses = useDoseStore((state) => state.items);
  const links = useCareStore((state) => state.links);
  if (!profile) return null;
  const caregiver = profile.role === 'caregiver';
  const end = addDays(startOfLocalDay(new Date()), 1);
  const week = buildAdherenceReport({
    medicines,
    doses,
    transactions: [],
    range: { start: addDays(end, -7), end },
  }).totals;
  const initials = profile.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const rows: [string, string][] = caregiver
    ? [
        ['Role', 'Caregiver'],
        ['Patients sharing with you', String(links.length)],
      ]
    : [
        ['Adherence this week', formatPercent(week.adherencePercent)],
        ['Active medicines', String(medicines.filter((item) => item.active).length)],
        ['Caregivers', String(links.length)],
      ];
  return (
    <Screen>
      <View style={styles.top}>
        <View
          style={styles.avatar}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <Text style={styles.name} accessibilityRole="header">
          {profile.displayName}
        </Text>
        <Text style={styles.email}>{profile.email}</Text>
      </View>
      <View style={styles.card}>
        {rows.map(([label, value]) => (
          <View style={styles.row} key={label} accessible accessibilityLabel={`${label}: ${value}`}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
      {!caregiver ? (
        <AppButton
          label="Reports"
          variant="ghost"
          onPress={() => router.push('/reports')}
          style={styles.button}
        />
      ) : null}
      <AppButton label="Settings" variant="ghost" onPress={() => router.push('/settings')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', marginVertical: spacing.lg },
  avatar: {
    backgroundColor: colors.primary,
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.surface, fontSize: 23, fontWeight: '800' },
  name: { color: colors.text, fontSize: 23, fontWeight: '800', marginTop: spacing.md },
  email: { color: colors.muted, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.lg },
  row: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  rowLabel: { color: colors.muted },
  value: { color: colors.text, fontWeight: '800' },
  button: { marginBottom: spacing.sm },
});

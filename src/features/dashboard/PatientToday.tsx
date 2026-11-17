import { Link, router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DoseRow } from '@/src/components/cards/DoseRow';
import { Screen } from '@/src/components/common/Screen';
import { StateView } from '@/src/components/feedback/StateView';
import { colors, radius, spacing } from '@/src/constants/theme';
import { buildDayDoses, summarizeDay } from '@/src/features/doses/today';
import { useConfirmDose } from '@/src/features/doses/useConfirmDose';
import { isLowStock } from '@/src/features/inventory/inventoryLogic';
import { useNow } from '@/src/hooks/useNow';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useDoseStore } from '@/src/store/useDoseStore';
import { useMedicineStore } from '@/src/store/useMedicineStore';

function greeting(now: Date) {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function PatientToday() {
  const name = useAuthStore((state) => state.profile?.displayName ?? '');
  const medicines = useMedicineStore((state) => state.items);
  const medicinesLoading = useMedicineStore((state) => state.loading);
  const medicinesError = useMedicineStore((state) => state.error);
  const doses = useDoseStore((state) => state.items);
  const dosesError = useDoseStore((state) => state.error);
  const pendingCount = useDoseStore((state) => state.pendingCount);
  const now = useNow();
  const { confirm, pending, error } = useConfirmDose();

  const today = useMemo(() => buildDayDoses(medicines, doses, now, now), [medicines, doses, now]);
  const summary = summarizeDay(today);
  const low = medicines.filter(
    (item) => item.active && isLowStock(item.remainingStock, item.lowStockThreshold),
  );
  const firstName = name.split(' ')[0];

  return (
    <Screen>
      <Text style={styles.greeting} accessibilityRole="header">
        {greeting(now)}
        {firstName ? `, ${firstName}` : ''}
      </Text>
      <Text style={styles.subheading}>
        {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>

      <View
        style={styles.progress}
        accessible
        accessibilityLabel={`Today's progress: ${summary.taken} of ${summary.total} doses taken`}
      >
        <View>
          <Text style={styles.small}>TODAY&apos;S PROGRESS</Text>
          <Text style={styles.score}>
            {summary.taken} of {summary.total}
            <Text style={styles.unit}> doses</Text>
          </Text>
        </View>
        <Text style={styles.percent}>{summary.percent}%</Text>
      </View>

      {pendingCount > 0 ? (
        <Text style={styles.syncNote} accessibilityLiveRegion="polite">
          {pendingCount} confirmation{pendingCount === 1 ? '' : 's'} from notifications will sync
          when you are back online.
        </Text>
      ) : null}

      {low.length > 0 ? (
        <Link href="/(tabs)/inventory" style={styles.lowBanner} accessibilityRole="link">
          <Text style={styles.lowTitle}>Refill soon: </Text>
          {low.map((item) => `${item.name} (${item.remainingStock} left)`).join(', ')}
        </Link>
      ) : null}

      <Text style={styles.section} accessibilityRole="header">
        Today&apos;s doses
      </Text>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {medicinesLoading ? <StateView kind="loading" message="Loading your schedule…" /> : null}
      {medicinesError || dosesError ? (
        <StateView kind="error" message={medicinesError ?? dosesError ?? ''} />
      ) : null}
      {!medicinesLoading && !medicinesError && today.length === 0 ? (
        <StateView
          kind="empty"
          title={medicines.length ? 'Nothing scheduled today' : 'No medicines yet'}
          message={medicines.length ? 'Enjoy your day.' : 'Add a medicine to build your schedule.'}
          actionLabel={medicines.length ? undefined : 'Add medicine'}
          onAction={medicines.length ? undefined : () => router.push('/medicine/add')}
        />
      ) : null}
      {today.map((item) => (
        <DoseRow
          key={item.doseId}
          item={item}
          busy={pending === item.doseId}
          onRecord={(outcome) => confirm(item.medicine, item.scheduledFor, outcome, item.doseId)}
        />
      ))}

      <View style={styles.links}>
        <Link href="/dose-history" style={styles.link}>
          Dose history →
        </Link>
        <Link href="/reports" style={styles.link}>
          Reports →
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { color: colors.text, fontSize: 25, fontWeight: '800', marginTop: spacing.sm },
  subheading: { color: colors.muted, marginTop: spacing.xs },
  progress: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  small: { color: '#D8ECFC', fontWeight: '700', fontSize: 12, letterSpacing: 0.8 },
  score: { color: colors.surface, fontSize: 28, fontWeight: '800', marginTop: spacing.sm },
  unit: { fontSize: 15, fontWeight: '500' },
  percent: { color: '#D3F2E6', fontSize: 25, fontWeight: '800' },
  syncNote: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  lowBanner: {
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  lowTitle: { fontWeight: '800' },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, marginBottom: spacing.sm },
  links: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.md },
  link: { color: colors.primary, fontWeight: '700', padding: spacing.sm },
});

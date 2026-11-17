import { Link } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StateView } from '@/src/components/feedback/StateView';
import { colors, radius, spacing } from '@/src/constants/theme';
import { addDays, startOfLocalDay } from '@/src/features/doses/schedule';
import { buildAdherenceReport, formatPercent } from '@/src/features/reports/reportLogic';
import { useDoseStore } from '@/src/store/useDoseStore';
import { useMedicineStore } from '@/src/store/useMedicineStore';

export default function DoseHistoryScreen() {
  const doses = useDoseStore((state) => state.items);
  const loading = useDoseStore((state) => state.loading);
  const error = useDoseStore((state) => state.error);
  const medicines = useMedicineStore((state) => state.items);
  const end = addDays(startOfLocalDay(new Date()), 1);
  const summary = buildAdherenceReport({
    medicines,
    doses,
    transactions: [],
    range: { start: addDays(end, -7), end },
  }).totals;
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={doses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View
              style={styles.summary}
              accessible
              accessibilityLabel={`Last 7 days adherence ${formatPercent(summary.adherencePercent)}, ${summary.missed} missed`}
            >
              <Text style={styles.small}>LAST 7 DAYS</Text>
              <Text style={styles.percent}>{formatPercent(summary.adherencePercent)}</Text>
              <Text style={styles.caption}>
                adherence · {summary.taken} taken · {summary.skipped} skipped · {summary.missed}{' '}
                missed
              </Text>
            </View>
            <Link href="/reports" style={styles.link}>
              Detailed reports →
            </Link>
            <Text style={styles.title} accessibilityRole="header">
              Recorded doses
            </Text>
            {loading ? <StateView kind="loading" /> : null}
            {error ? <StateView kind="error" message={error} /> : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <StateView
              kind="empty"
              title="No dose records yet"
              message="Doses you mark as taken or skipped appear here."
            />
          ) : null
        }
        renderItem={({ item: dose }) => (
          <View
            style={styles.card}
            accessible
            accessibilityLabel={`${dose.medicineName}, ${dose.outcome}, scheduled ${new Date(dose.scheduledFor).toLocaleString()}`}
          >
            <View style={[styles.status, dose.outcome === 'taken' ? styles.taken : styles.skipped]}>
              <Text style={[styles.statusText, dose.outcome !== 'taken' && styles.skippedText]}>
                {dose.outcome === 'taken' ? '✓' : '–'}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>{dose.medicineName}</Text>
              <Text style={styles.time}>
                Scheduled {new Date(dose.scheduledFor).toLocaleString()}
              </Text>
              <Text style={styles.time}>
                Recorded {new Date(dose.recordedAt).toLocaleTimeString()} from{' '}
                {dose.source === 'notification' ? 'a reminder' : 'the app'}
              </Text>
            </View>
            <Text
              style={[
                styles.badge,
                dose.outcome === 'taken' ? styles.takenText : styles.skippedText,
              ]}
            >
              {dose.outcome}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  summary: { backgroundColor: colors.secondarySoft, borderRadius: radius.lg, padding: spacing.lg },
  small: { color: colors.success, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  percent: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: spacing.xs },
  caption: { color: colors.muted },
  link: { color: colors.primary, fontWeight: '700', marginTop: spacing.md, padding: spacing.xs },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  status: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taken: { backgroundColor: colors.successSoft },
  skipped: { backgroundColor: colors.warningSoft },
  statusText: { color: colors.success, fontSize: 17, fontWeight: '800' },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '700' },
  time: { color: colors.muted, fontSize: 12, marginTop: 2 },
  badge: { fontSize: 12, fontWeight: '700' },
  takenText: { color: colors.success },
  skippedText: { color: colors.warning },
});

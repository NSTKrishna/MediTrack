import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { InventoryHistoryRow } from '@/src/components/cards/InventoryHistoryRow';
import { AppButton } from '@/src/components/common/AppButton';
import { StateView } from '@/src/components/feedback/StateView';
import { ChoiceChips } from '@/src/components/forms/ChoiceChips';
import { TextField } from '@/src/components/forms/TextField';
import { colors, radius, spacing } from '@/src/constants/theme';
import { addDays, toLocalDateString } from '@/src/features/doses/schedule';
import { exportReportPdf } from '@/src/features/reports/exportReportPdf';
import {
  buildAdherenceReport,
  describeRange,
  formatPercent,
  parseCustomRange,
  rangeFor,
  shiftAnchor,
  type DateRange,
  type ReportPeriod,
  type Tally,
} from '@/src/features/reports/reportLogic';
import { useReportData, type ReportAccess } from '@/src/features/reports/useReportData';

const periods: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

type Props = { ownerId: string; ownerName: string; access: ReportAccess };

export function ReportView({ ownerId, ownerName, access }: Props) {
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [anchor, setAnchor] = useState(() => new Date());
  const [customStart, setCustomStart] = useState(() => toLocalDateString(addDays(new Date(), -29)));
  const [customEnd, setCustomEnd] = useState(() => toLocalDateString(new Date()));
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const range = useMemo(
    () => (period === 'custom' ? customRange : rangeFor(period, anchor)),
    [period, anchor, customRange],
  );
  const data = useReportData(ownerId, range, access);
  const report = useMemo(
    () =>
      range && !data.loading && !data.error
        ? buildAdherenceReport({
            medicines: data.medicines,
            doses: data.doses,
            transactions: data.transactions,
            range,
          })
        : null,
    [range, data.loading, data.error, data.medicines, data.doses, data.transactions],
  );
  const isFuture = range ? range.start > new Date() : false;
  const canGoForward = period !== 'custom' && range ? range.end <= new Date() : false;

  const applyCustom = () => {
    const result = parseCustomRange(customStart, customEnd);
    if (!result.ok) {
      setCustomError(result.message);
      return;
    }
    setCustomError(null);
    setCustomRange(result.range);
  };

  const exportPdf = async () => {
    if (!report) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportReportPdf(report, ownerName);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not create the PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View>
      <ChoiceChips
        label="Report period"
        options={periods}
        isSelected={(value) => value === period}
        onToggle={(value) => {
          setPeriod(value);
          setAnchor(new Date());
        }}
      />
      {period === 'custom' ? (
        <View style={styles.custom}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label="From"
                value={customStart}
                onChangeText={setCustomStart}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label="To"
                value={customEnd}
                onChangeText={setCustomEnd}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
          {customError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {customError}
            </Text>
          ) : null}
          <AppButton label="Show report" variant="ghost" onPress={applyCustom} />
        </View>
      ) : range ? (
        <View style={styles.navigator}>
          <AppButton
            label="‹ Previous"
            variant="ghost"
            onPress={() => setAnchor(shiftAnchor(period, anchor, -1))}
            style={styles.navButton}
            accessibilityHint={`Shows the previous ${period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'}`}
          />
          <Text style={styles.rangeLabel} accessibilityRole="header">
            {describeRange(range)}
          </Text>
          <AppButton
            label="Next ›"
            variant="ghost"
            disabled={!canGoForward}
            onPress={() => setAnchor(shiftAnchor(period, anchor, 1))}
            style={styles.navButton}
          />
        </View>
      ) : null}

      {!range ? (
        <StateView
          kind="empty"
          title="Choose a date range"
          message="Enter start and end dates, then show the report."
        />
      ) : data.loading ? (
        <StateView kind="loading" message="Building your report…" />
      ) : data.error ? (
        <StateView kind="error" message={data.error} onRetry={data.retry} />
      ) : report && report.totals.scheduled === 0 && report.inventory.transactions.length === 0 ? (
        <StateView
          kind="empty"
          title={isFuture ? 'This period has not started' : 'Nothing to report'}
          message={
            isFuture
              ? 'Reports cover doses that are already due.'
              : access.doses
                ? 'There were no scheduled doses or stock changes in this period.'
                : 'Dose history is not shared with you.'
          }
        />
      ) : report ? (
        <View>
          <View
            style={styles.summary}
            accessible
            accessibilityLabel={`Adherence ${formatPercent(report.totals.adherencePercent)}. ${report.totals.taken} taken, ${report.totals.skipped} skipped, ${report.totals.missed} missed.`}
          >
            <Text style={styles.summaryLabel}>ADHERENCE</Text>
            <Text style={styles.summaryValue}>{formatPercent(report.totals.adherencePercent)}</Text>
            <View style={styles.stats}>
              <Stat label="Taken" value={report.totals.taken} />
              <Stat label="Skipped" value={report.totals.skipped} />
              <Stat label="Missed" value={report.totals.missed} />
              <Stat label="Pending" value={report.totals.pending} />
            </View>
          </View>
          {!access.medicines ? (
            <Text style={styles.note}>
              Missed doses cannot be calculated because the schedule is not shared with you.
            </Text>
          ) : null}

          <Section title="By medicine">
            {report.byMedicine.length === 0 ? (
              <Text style={styles.empty}>No scheduled doses.</Text>
            ) : null}
            {report.byMedicine.map((item) => (
              <TallyRow key={item.medicineId} label={item.medicineName} tally={item} />
            ))}
          </Section>

          {period !== 'daily' ? (
            <Section title="By day">
              {report.byDay.filter((day) => day.scheduled > 0).length === 0 ? (
                <Text style={styles.empty}>No scheduled doses.</Text>
              ) : null}
              {report.byDay
                .filter((day) => day.scheduled > 0)
                .map((day) => (
                  <TallyRow key={day.date} label={day.date} tally={day} />
                ))}
            </Section>
          ) : null}

          <Section title={`Missed doses (${report.missedDoses.length})`}>
            {report.missedDoses.length === 0 ? (
              <Text style={styles.empty}>No missed doses in this period.</Text>
            ) : null}
            {report.missedDoses.slice(0, 30).map((entry) => (
              <Text key={entry.doseId} style={styles.listItem}>
                {entry.medicineName} ·{' '}
                {entry.scheduledFor.toLocaleString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            ))}
          </Section>

          {access.inventory ? (
            <Section title="Inventory history">
              <Text style={styles.note}>
                {report.inventory.refillCount} refill(s) · {report.inventory.unitsAdded} added ·{' '}
                {report.inventory.unitsUsed} used
              </Text>
              {report.inventory.transactions.length === 0 ? (
                <Text style={styles.empty}>No stock changes in this period.</Text>
              ) : null}
              {report.inventory.transactions.slice(0, 30).map((item) => (
                <InventoryHistoryRow key={item.id} item={item} />
              ))}
            </Section>
          ) : null}

          {exportError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {exportError}
            </Text>
          ) : null}
          <AppButton
            label="Export PDF"
            busy={exporting}
            onPress={() => void exportPdf()}
            style={styles.export}
          />
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function TallyRow({ label, tally }: { label: string; tally: Tally }) {
  const percent = tally.adherencePercent ?? 0;
  return (
    <View
      style={styles.tally}
      accessible
      accessibilityLabel={`${label}: ${formatPercent(tally.adherencePercent)} adherence, ${tally.taken} taken, ${tally.skipped} skipped, ${tally.missed} missed`}
    >
      <View style={styles.tallyHeader}>
        <Text style={styles.tallyLabel}>{label}</Text>
        <Text style={styles.tallyPercent}>{formatPercent(tally.adherencePercent)}</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.tallyMeta}>
        {tally.taken} taken · {tally.skipped} skipped · {tally.missed} missed
        {tally.pending ? ` · ${tally.pending} pending` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  custom: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  navigator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  navButton: { minWidth: 96 },
  rangeLabel: { flex: 1, textAlign: 'center', color: colors.text, fontWeight: '800' },
  summary: { backgroundColor: colors.secondarySoft, borderRadius: radius.lg, padding: spacing.lg },
  summaryLabel: { color: colors.success, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  summaryValue: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: spacing.xs },
  stats: { flexDirection: 'row', marginTop: spacing.md },
  stat: { flex: 1 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 12 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm },
  tally: { paddingVertical: spacing.sm, borderBottomColor: colors.border, borderBottomWidth: 1 },
  tallyHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  tallyLabel: { color: colors.text, fontWeight: '700', flex: 1 },
  tallyPercent: { color: colors.text, fontWeight: '800' },
  bar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.secondaryStrong },
  tallyMeta: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  listItem: { color: colors.text, paddingVertical: spacing.xs },
  empty: { color: colors.muted },
  note: { color: colors.muted, fontSize: 13, marginVertical: spacing.sm, lineHeight: 18 },
  error: { color: colors.danger, marginVertical: spacing.sm },
  export: { marginTop: spacing.lg },
});

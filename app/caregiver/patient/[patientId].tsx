import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DoseRow } from '@/src/components/cards/DoseRow';
import { InventoryHistoryRow } from '@/src/components/cards/InventoryHistoryRow';
import { Screen } from '@/src/components/common/Screen';
import { StateView } from '@/src/components/feedback/StateView';
import { colors, radius, spacing } from '@/src/constants/theme';
import { usePatientSnapshot } from '@/src/features/caregivers/usePatientSnapshot';
import { buildDayDoses, summarizeDay } from '@/src/features/doses/today';
import { isLowStock } from '@/src/features/inventory/inventoryLogic';
import { useNow } from '@/src/hooks/useNow';
import { useCareStore } from '@/src/store/useCareStore';

/** A caregiver's read-only view of one patient, limited to what the patient shares. */
export default function CaregiverPatientScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const link = useCareStore((state) => state.links.find((item) => item.patientId === patientId));
  const careLoading = useCareStore((state) => state.loading);
  const alerts = useCareStore((state) =>
    state.alerts.filter((alert) => alert.patientId === patientId),
  );
  const permissions = link?.permissions;
  const { medicines, doses, transactions, error, accessLost } = usePatientSnapshot(
    link ? patientId : undefined,
    permissions,
  );
  const now = useNow();
  const today = useMemo(
    () =>
      permissions?.viewMedicines && permissions.viewDoseHistory
        ? buildDayDoses(medicines, doses, now, now)
        : [],
    [medicines, doses, now, permissions?.viewMedicines, permissions?.viewDoseHistory],
  );

  if (!link || accessLost)
    return (
      <Screen>
        {careLoading && !accessLost ? (
          <StateView kind="loading" />
        ) : (
          <StateView
            kind="empty"
            title="Access removed"
            message="This person is no longer sharing their information with you."
          />
        )}
      </Screen>
    );

  const summary = summarizeDay(today);
  const nothingShared =
    !permissions?.viewMedicines && !permissions?.viewDoseHistory && !permissions?.viewInventory;
  return (
    <Screen>
      <Stack.Screen options={{ title: link.patientName }} />
      {error ? <StateView kind="error" message={error} /> : null}
      {nothingShared ? (
        <StateView
          kind="empty"
          title="Nothing shared right now"
          message={`${link.patientName} has paused sharing.`}
        />
      ) : null}

      {alerts.length ? (
        <View style={styles.alerts}>
          {alerts.slice(0, 3).map((alert) => (
            <Text key={alert.id} style={styles.alert}>
              • {alert.message}
            </Text>
          ))}
        </View>
      ) : null}

      {permissions?.viewMedicines && permissions.viewDoseHistory ? (
        <Section title={`Today · ${summary.taken} of ${summary.total} taken`}>
          {today.length === 0 ? <Text style={styles.empty}>Nothing scheduled today.</Text> : null}
          {today.map((item) => (
            <DoseRow key={item.doseId} item={item} />
          ))}
        </Section>
      ) : null}

      {permissions?.viewMedicines ? (
        <Section title="Medicines">
          {medicines.length === 0 ? <Text style={styles.empty}>No medicines.</Text> : null}
          {medicines.map((medicine) => (
            <View key={medicine.id} style={styles.row}>
              <Text style={styles.name}>{medicine.name}</Text>
              <Text style={styles.meta}>
                {[medicine.dosage, medicine.dosageUnit].filter(Boolean).join(' ')} ·{' '}
                {medicine.schedule || 'No times'}
                {medicine.active ? '' : ' · inactive'}
              </Text>
              {permissions.viewInventory ? (
                <Text
                  style={[
                    styles.meta,
                    isLowStock(medicine.remainingStock, medicine.lowStockThreshold) && styles.low,
                  ]}
                >
                  {medicine.remainingStock} doses left
                  {isLowStock(medicine.remainingStock, medicine.lowStockThreshold)
                    ? ' · refill needed'
                    : ''}
                </Text>
              ) : null}
            </View>
          ))}
        </Section>
      ) : null}

      {permissions?.viewDoseHistory && !permissions.viewMedicines ? (
        <Section title="Recent doses">
          {doses.length === 0 ? (
            <Text style={styles.empty}>No doses recorded this week.</Text>
          ) : null}
          {doses.slice(0, 20).map((dose) => (
            <Text key={dose.id} style={styles.meta}>
              {dose.medicineName} · {dose.outcome} · {new Date(dose.scheduledFor).toLocaleString()}
            </Text>
          ))}
        </Section>
      ) : null}

      {permissions?.viewInventory ? (
        <Section title="Recent stock changes">
          {transactions.length === 0 ? (
            <Text style={styles.empty}>No stock changes yet.</Text>
          ) : null}
          {transactions.map((item) => (
            <InventoryHistoryRow key={item.id} item={item} />
          ))}
        </Section>
      ) : null}

      {permissions?.viewDoseHistory ? (
        <Link
          href={{ pathname: '/reports', params: { patientId: link.patientId } }}
          style={styles.link}
        >
          View adherence reports →
        </Link>
      ) : null}
    </Screen>
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

const styles = StyleSheet.create({
  alerts: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  alert: { color: colors.danger, fontWeight: '700' },
  section: { marginTop: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { color: colors.text, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  low: { color: colors.warning, fontWeight: '700' },
  empty: { color: colors.muted },
  link: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.xl,
    padding: spacing.sm,
  },
});

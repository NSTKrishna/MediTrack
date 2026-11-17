import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { colors, radius, spacing } from '@/src/constants/theme';
import { formatClockTime } from '@/src/features/doses/schedule';
import { stateLabels, type ScheduledDose } from '@/src/features/doses/today';
import type { DoseOutcome } from '@/src/types/dose';

type Props = {
  item: ScheduledDose;
  busy?: boolean;
  onRecord?: (outcome: DoseOutcome) => void;
};

const tone = {
  due: { background: colors.primarySoft, text: colors.primary },
  overdue: { background: colors.warningSoft, text: colors.warning },
  missed: { background: colors.dangerSoft, text: colors.danger },
  taken: { background: colors.successSoft, text: colors.success },
  skipped: { background: colors.background, text: colors.muted },
} as const;

function DoseRowBase({ item, busy = false, onRecord }: Props) {
  const time = formatClockTime({
    hour: item.scheduledFor.getHours(),
    minute: item.scheduledFor.getMinutes(),
  });
  const canAct = onRecord && item.state !== 'taken';
  const label = stateLabels[item.state];
  return (
    <View
      style={styles.card}
      accessible={!canAct}
      accessibilityLabel={`${item.medicine.name}, ${time}, ${label}`}
    >
      <View style={styles.header}>
        <View style={styles.time}>
          <Text style={styles.timeText}>{time}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{item.medicine.name}</Text>
          <Text style={styles.detail}>
            {[item.medicine.dosage, item.medicine.dosageUnit].filter(Boolean).join(' ')}
            {item.medicine.instructions ? ` · ${item.medicine.instructions}` : ''}
          </Text>
        </View>
        <Text
          style={[
            styles.badge,
            { backgroundColor: tone[item.state].background, color: tone[item.state].text },
          ]}
        >
          {label}
        </Text>
      </View>
      {canAct ? (
        <View style={styles.actions}>
          <AppButton
            label="Taken"
            variant="secondary"
            busy={busy}
            onPress={() => onRecord('taken')}
            style={styles.action}
            accessibilityHint={`Confirms the ${time} ${item.medicine.name} dose and removes one from stock`}
          />
          {item.state !== 'skipped' ? (
            <AppButton
              label="Skip"
              variant="ghost"
              disabled={busy}
              onPress={() => onRecord('skipped')}
              style={styles.action}
              accessibilityHint={`Records the ${time} ${item.medicine.name} dose as skipped`}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  time: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
  },
  timeText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '700', fontSize: 16 },
  detail: { color: colors.muted, fontSize: 13, marginTop: 2 },
  badge: {
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, minHeight: 44 },
});

/** Memoized: rows re-render only when their own data changes. */
export const DoseRow = memo(DoseRowBase);

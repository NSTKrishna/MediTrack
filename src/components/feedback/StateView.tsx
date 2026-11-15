import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { colors, radius, spacing } from '@/src/constants/theme';

type Props =
  | { kind: 'loading'; message?: string }
  | { kind: 'error'; message: string; onRetry?: () => void }
  | { kind: 'empty'; title: string; message?: string; actionLabel?: string; onAction?: () => void };

/** Consistent loading, error, and empty presentation for data-backed screens. */
export function StateView(props: Props) {
  if (props.kind === 'loading')
    return (
      <View
        style={styles.box}
        accessibilityLiveRegion="polite"
        accessibilityLabel={props.message ?? 'Loading'}
      >
        <ActivityIndicator color={colors.primary} />
        {props.message ? <Text style={styles.message}>{props.message}</Text> : null}
      </View>
    );
  if (props.kind === 'error')
    return (
      <View style={[styles.box, styles.error]}>
        {/* The alert must be an accessibility element itself to be announced; the retry button
            stays outside it so it remains separately focusable. */}
        <View accessible accessibilityRole="alert" style={styles.alertText}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.message}>{props.message}</Text>
        </View>
        {props.onRetry ? (
          <AppButton
            label="Try again"
            variant="ghost"
            onPress={props.onRetry}
            style={styles.action}
          />
        ) : null}
      </View>
    );
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{props.title}</Text>
      {props.message ? <Text style={styles.message}>{props.message}</Text> : null}
      {props.actionLabel && props.onAction ? (
        <AppButton label={props.actionLabel} onPress={props.onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  error: { borderWidth: 1, borderColor: colors.dangerSoft },
  alertText: { alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  errorTitle: { color: colors.danger, fontSize: 16, fontWeight: '800' },
  message: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  action: { marginTop: spacing.sm, alignSelf: 'stretch' },
});

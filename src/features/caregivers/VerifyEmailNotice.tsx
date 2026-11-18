import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { colors, radius, spacing } from '@/src/constants/theme';
import { useAuthStore } from '@/src/store/useAuthStore';

/** Invitations are matched to verified email addresses only, so caregivers must verify first. */
export function VerifyEmailNotice() {
  const email = useAuthStore((state) => state.profile?.email ?? '');
  const resend = useAuthStore((state) => state.resendVerification);
  const refresh = useAuthStore((state) => state.refreshVerification);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>, success: string, failure: string) => {
    setBusy(true);
    try {
      const result = await action();
      setMessage(result === false ? failure : success);
    } catch {
      setMessage('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.box}>
      <View accessible accessibilityRole="alert">
        <Text style={styles.title}>Verify your email to receive invitations</Text>
        <Text style={styles.copy}>
          We sent a link to {email}. Patients can only share with a verified address.
        </Text>
      </View>
      {message ? (
        <Text style={styles.message} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      <View style={styles.row}>
        <AppButton
          label="Resend email"
          variant="ghost"
          disabled={busy}
          onPress={() => void run(resend, 'Verification email sent.', '')}
          style={styles.flex}
        />
        <AppButton
          label="I've verified"
          busy={busy}
          onPress={() =>
            void run(
              refresh,
              'Email verified.',
              'Not verified yet. Open the link in the email first.',
            )
          }
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { color: colors.warning, fontWeight: '800' },
  copy: { color: colors.text, lineHeight: 20 },
  message: { color: colors.text, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});

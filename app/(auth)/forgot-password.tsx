import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { Screen } from '@/src/components/common/Screen';
import { colors, radius, spacing } from '@/src/constants/theme';
import { useAuthStore } from '@/src/store/useAuthStore';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const reset = useAuthStore((state) => state.resetPassword);
  const error = useAuthStore((state) => state.error);
  const submit = async () => {
    if (!email.includes('@')) return;
    try {
      await reset(email);
      setSent(true);
    } catch {}
  };
  return (
    <Screen style={styles.screen} topInset>
      <View>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.copy}>We’ll email a secure password-reset link to your account.</Text>
        <Text style={styles.label}>Email address</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        {sent && <Text style={styles.success}>Check your inbox for the reset link.</Text>}
        <AppButton label="Send reset link" onPress={submit} style={styles.button} />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { paddingTop: spacing.xl },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  copy: { color: colors.muted, lineHeight: 22, marginTop: spacing.sm, marginBottom: spacing.xl },
  label: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  button: { marginTop: spacing.lg },
  error: { color: colors.danger, marginTop: spacing.sm },
  success: { color: colors.success, marginTop: spacing.sm },
});

import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { Screen } from '@/src/components/common/Screen';
import { colors, radius, spacing } from '@/src/constants/theme';
import { useAuthStore } from '@/src/store/useAuthStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((state) => state.signIn);
  const error = useAuthStore((state) => state.error);
  const submit = async () => {
    if (!email.includes('@') || password.length < 6) {
      setLocalError('Enter a valid email address and a password of at least 6 characters.');
      return;
    }
    setLocalError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch {
    } finally {
      setLoading(false);
    }
  };
  return (
    <Screen style={styles.screen} topInset>
      <View>
        <Text style={styles.brand}>MediTrack</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to view your medication plan.</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Email address</Text>
        <TextInput
          accessibilityLabel="Email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          autoComplete="password"
          secureTextEntry
          placeholder="Enter your password"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        {(localError || error) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {localError || error}
          </Text>
        )}
        <Link href="/forgot-password" style={styles.forgot}>
          Forgot password?
        </Link>
        <AppButton label={loading ? 'Signing in…' : 'Sign in'} onPress={submit} />
      </View>
      <Text style={styles.footer}>
        New to MediTrack?{' '}
        <Link href="/register" style={styles.link}>
          Create an account
        </Link>
      </Text>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: spacing.xl },
  brand: { color: colors.primary, fontSize: 20, fontWeight: '800', marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: spacing.sm },
  form: { gap: spacing.sm },
  label: { color: colors.text, fontWeight: '700', marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  forgot: {
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'right',
    marginVertical: spacing.sm,
  },
  error: { color: colors.danger, lineHeight: 19, marginTop: spacing.sm },
  footer: { textAlign: 'center', color: colors.muted },
  link: { color: colors.primary, fontWeight: '700' },
});

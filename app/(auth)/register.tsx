import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { Screen } from '@/src/components/common/Screen';
import { colors, radius, spacing } from '@/src/constants/theme';
import { useAuthStore } from '@/src/store/useAuthStore';
import type { UserRole } from '@/src/types/auth';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const signUp = useAuthStore((state) => state.signUp);
  const authError = useAuthStore((state) => state.error);
  const submit = async () => {
    if (name.trim().length < 2 || !email.includes('@') || password.length < 8) {
      setValidationError(
        'Enter your name, a valid email address, and a password of at least 8 characters.',
      );
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    try {
      await signUp(email, password, name, role);
    } catch {
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Screen style={styles.screen} topInset>
      <View>
        <Text style={styles.brand}>MediTrack</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Your medication plan stays private and under your control.
        </Text>
      </View>
      <View style={styles.form}>
        <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Create a password"
          secureTextEntry
        />
        <Text style={styles.label}>I am joining as a</Text>
        <View style={styles.roles}>
          {(['patient', 'caregiver'] as UserRole[]).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ selected: role === item }}
              onPress={() => setRole(item)}
              style={[styles.role, role === item && styles.selected]}
            >
              <Text style={[styles.roleText, role === item && styles.selectedText]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        {(validationError || authError) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError || authError}
          </Text>
        )}
        <AppButton label={submitting ? 'Creating account…' : 'Create account'} onPress={submit} />
      </View>
      <Text style={styles.footer}>
        Already have an account?{' '}
        <Link href="/login" style={styles.link}>
          Sign in
        </Link>
      </Text>
    </Screen>
  );
}
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: spacing.xl },
  brand: { color: colors.primary, fontSize: 20, fontWeight: '800', marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: spacing.sm, lineHeight: 23 },
  form: { gap: spacing.md },
  label: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
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
  roles: { flexDirection: 'row', gap: spacing.sm },
  role: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  selected: { borderColor: colors.primary, backgroundColor: '#DBEEF9' },
  roleText: { color: colors.muted, fontWeight: '700' },
  selectedText: { color: colors.primary },
  error: { color: colors.danger, lineHeight: 19 },
  footer: { textAlign: 'center', color: colors.muted },
  link: { color: colors.primary, fontWeight: '700' },
});

import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '@/src/constants/theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | null;
  hint?: string;
};

export function TextField({ label, error, hint, ...input }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.muted}
        {...input}
        style={[styles.input, error ? styles.invalid : null]}
      />
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  input: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  invalid: { borderColor: colors.danger },
  hint: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
});

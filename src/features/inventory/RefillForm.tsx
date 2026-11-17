import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { colors, radius, spacing } from '@/src/constants/theme';
import { validateRefillAmount } from '@/src/features/inventory/inventoryLogic';

type Props = {
  medicineName: string;
  /** Persists the refill. The same operation ID is passed again if the person retries. */
  onSubmit: (amount: number, operationId: string) => Promise<void>;
  createOperationId: () => string;
  initialAmount?: string;
};

export function RefillForm({
  medicineName,
  onSubmit,
  createOperationId,
  initialAmount = '',
}: Props) {
  const [amount, setAmount] = useState(initialAmount);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  // One operation ID per intended refill: retries after a failure reuse it, so the refill
  // cannot be applied twice. A new ID is created only after a successful save.
  const operationId = useRef<string | null>(null);

  const submit = async () => {
    const validation = validateRefillAmount(amount);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    operationId.current ??= createOperationId();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(validation.amount, operationId.current);
      operationId.current = null;
      setSaved(validation.amount);
      setAmount('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record the refill.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.label} importantForAccessibility="no">
        Refill amount (doses)
      </Text>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={`Refill amount for ${medicineName}`}
          value={amount}
          onChangeText={(value) => {
            setAmount(value);
            setSaved(null);
            if (error) setError(null);
            // Editing the amount describes a different refill.
            operationId.current = null;
          }}
          keyboardType="number-pad"
          placeholder="e.g. 30"
          placeholderTextColor={colors.muted}
          style={[styles.input, error ? styles.invalid : null]}
          editable={!saving}
          testID="refill-amount"
        />
        <AppButton
          label="Add stock"
          variant="ghost"
          busy={saving}
          onPress={() => void submit()}
          style={styles.button}
          testID="refill-submit"
        />
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {saved !== null ? (
        <Text style={styles.success} accessibilityLiveRegion="polite">
          Added {saved} dose{saved === 1 ? '' : 's'}.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: spacing.md },
  label: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm, fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  invalid: { borderColor: colors.danger },
  button: { minWidth: 120 },
  error: { color: colors.danger, marginTop: spacing.xs, fontSize: 13 },
  success: { color: colors.success, marginTop: spacing.xs, fontSize: 13, fontWeight: '700' },
});

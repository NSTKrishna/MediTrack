import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { ChoiceChips } from '@/src/components/forms/ChoiceChips';
import { TextField } from '@/src/components/forms/TextField';
import { colors, radius, spacing } from '@/src/constants/theme';
import {
  frequencyPresets,
  validateMedicineForm,
  type FieldErrors,
  type MedicineFormValues,
  type ValidMedicine,
} from '@/src/features/medicines/medicineValidation';

const weekdays = [
  { value: 0, label: 'Sun', accessibilityLabel: 'Sunday' },
  { value: 1, label: 'Mon', accessibilityLabel: 'Monday' },
  { value: 2, label: 'Tue', accessibilityLabel: 'Tuesday' },
  { value: 3, label: 'Wed', accessibilityLabel: 'Wednesday' },
  { value: 4, label: 'Thu', accessibilityLabel: 'Thursday' },
  { value: 5, label: 'Fri', accessibilityLabel: 'Friday' },
  { value: 6, label: 'Sat', accessibilityLabel: 'Saturday' },
];

type Props = {
  initial: MedicineFormValues;
  mode: 'create' | 'edit';
  submitLabel: string;
  onSubmit: (value: ValidMedicine) => Promise<void>;
};

export function MedicineForm({ initial, mode, submitLabel, onSubmit }: Props) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof MedicineFormValues>(key: K, value: MedicineFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const result = validateMedicineForm(values, { requireStock: mode === 'create' });
    if (!result.ok) {
      setErrors(result.errors);
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      await onSubmit(result.value);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Unable to save medicine.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <TextField
        label="Medicine name"
        value={values.name}
        onChangeText={(v) => set('name', v)}
        placeholder="e.g. Amoxicillin"
        error={errors.name}
      />
      <TextField
        label="Category"
        value={values.category}
        onChangeText={(v) => set('category', v)}
        placeholder="e.g. Antibiotic"
        error={errors.category}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Dosage"
            value={values.dosage}
            onChangeText={(v) => set('dosage', v)}
            placeholder="500"
            error={errors.dosage}
          />
        </View>
        <View style={styles.unit}>
          <TextField
            label="Unit"
            value={values.dosageUnit}
            onChangeText={(v) => set('dosageUnit', v)}
            placeholder="mg"
            autoCapitalize="none"
            error={errors.dosageUnit}
          />
        </View>
      </View>

      <Text style={styles.label}>Frequency</Text>
      <ChoiceChips
        label="Frequency"
        options={frequencyPresets.map(({ value, label }) => ({ value, label }))}
        isSelected={(value) => values.frequency === value}
        onToggle={(value) => {
          const preset = frequencyPresets.find((item) => item.value === value);
          setValues((current) => ({
            ...current,
            frequency: value,
            times: preset?.times.length ? preset.times.join(', ') : current.times,
          }));
        }}
      />
      {values.frequency === 'selected-weekdays' ? (
        <>
          <Text style={styles.label}>Days</Text>
          <ChoiceChips
            label="Days"
            multiple
            options={weekdays}
            isSelected={(day) => values.selectedWeekdays.includes(day)}
            onToggle={(day) =>
              set(
                'selectedWeekdays',
                values.selectedWeekdays.includes(day)
                  ? values.selectedWeekdays.filter((item) => item !== day)
                  : [...values.selectedWeekdays, day],
              )
            }
          />
          {errors.selectedWeekdays ? (
            <Text style={styles.error} accessibilityRole="alert">
              {errors.selectedWeekdays}
            </Text>
          ) : null}
        </>
      ) : null}
      <TextField
        label="Scheduled times"
        hint="Separate times with commas, e.g. 8:00 AM, 8:00 PM"
        value={values.times}
        onChangeText={(v) => set('times', v)}
        placeholder="8:00 AM, 8:00 PM"
        error={errors.times}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Start date"
            value={values.startDate}
            onChangeText={(v) => set('startDate', v)}
            placeholder="YYYY-MM-DD"
            error={errors.startDate}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="End date (optional)"
            value={values.endDate}
            onChangeText={(v) => set('endDate', v)}
            placeholder="YYYY-MM-DD"
            error={errors.endDate}
          />
        </View>
      </View>
      <View style={styles.row}>
        {mode === 'create' ? (
          <View style={styles.flex}>
            <TextField
              label="Initial stock"
              value={values.stockQuantity}
              onChangeText={(v) => set('stockQuantity', v)}
              placeholder="30"
              keyboardType="number-pad"
              error={errors.stockQuantity}
            />
          </View>
        ) : null}
        <View style={styles.flex}>
          <TextField
            label="Low-stock threshold"
            value={values.lowStockThreshold}
            onChangeText={(v) => set('lowStockThreshold', v)}
            placeholder="5"
            keyboardType="number-pad"
            error={errors.lowStockThreshold}
          />
        </View>
      </View>
      {mode === 'edit' ? (
        <Text style={styles.note}>
          Stock changes are recorded from the Inventory tab so every change has a history.
        </Text>
      ) : null}
      <TextField
        label="Instructions (optional)"
        value={values.instructions}
        onChangeText={(v) => set('instructions', v)}
        placeholder="Take with food"
      />
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>Active</Text>
          <Text style={styles.note}>
            Inactive medicines have no reminders and are left out of reports.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Active"
          value={values.active}
          onValueChange={(v) => set('active', v)}
          trackColor={{ true: colors.secondaryStrong }}
        />
      </View>
      {formError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {formError}
        </Text>
      ) : null}
      <AppButton
        label={submitLabel}
        busy={saving}
        onPress={() => void submit()}
        style={styles.save}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  unit: { width: 100 },
  label: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  note: { color: colors.muted, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  error: { color: colors.danger, marginBottom: spacing.md },
  save: { marginTop: spacing.sm },
});

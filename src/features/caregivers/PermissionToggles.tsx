import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, spacing } from '@/src/constants/theme';
import { permissionMatrix, togglePermission } from '@/src/features/caregivers/permissions';
import type { CarePermissions } from '@/src/types/caregiver';

type Props = {
  value: CarePermissions;
  onChange: (next: CarePermissions) => void;
  disabled?: boolean;
};

/** Consent controls. Turning a permission on also turns on what it needs; turning one off also
 * turns off what depends on it, so only valid combinations can be granted. */
export function PermissionToggles({ value, onChange, disabled = false }: Props) {
  return (
    <View>
      {permissionMatrix.map((item) => (
        <View key={item.key} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
          <Switch
            accessibilityLabel={item.label}
            accessibilityHint={item.description}
            value={value[item.key]}
            disabled={disabled}
            onValueChange={() => onChange(togglePermission(value, item.key))}
            trackColor={{ true: colors.secondaryStrong }}
            testID={`permission-${item.key}`}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  flex: { flex: 1 },
  label: { color: colors.text, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
});

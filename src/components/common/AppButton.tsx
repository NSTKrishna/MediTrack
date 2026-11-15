import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '@/src/constants/theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  style,
  icon,
  disabled = false,
  busy = false,
  accessibilityHint,
  testID,
}: Props) {
  const inactive = disabled || busy;
  const lightText = variant === 'primary' || variant === 'secondary' || variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={lightText ? colors.surface : colors.primary} /> : icon}
      <Text
        style={[styles.label, !lightText && styles.ghostLabel]}
        maxFontSizeMultiplier={1.6}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondaryStrong },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.surface, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  ghostLabel: { color: colors.primary },
  pressed: { opacity: 0.82 },
  inactive: { opacity: 0.55 },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/src/constants/theme';

type Option<T> = { value: T; label: string; accessibilityLabel?: string };

type Props<T> = {
  options: Option<T>[];
  isSelected: (value: T) => boolean;
  onToggle: (value: T) => void;
  multiple?: boolean;
  label?: string;
};

export function ChoiceChips<T extends string | number>({
  options,
  isSelected,
  onToggle,
  multiple = false,
  label,
}: Props<T>) {
  return (
    <View
      accessibilityRole={multiple ? undefined : 'radiogroup'}
      accessibilityLabel={label}
      style={styles.row}
    >
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={multiple ? { checked: selected } : { selected }}
            onPress={() => onToggle(option.value)}
            hitSlop={4}
            style={[styles.chip, selected && styles.selected]}
          >
            <Text style={[styles.text, selected && styles.selectedText]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  text: { color: colors.muted, fontSize: 14 },
  selectedText: { color: colors.primary, fontWeight: '700' },
});

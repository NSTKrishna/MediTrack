import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/src/constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Screens without a navigation header must also avoid the status bar and notch. */
  topInset?: boolean;
};

export function Screen({ children, style, topInset = false }: Props) {
  return (
    <SafeAreaView
      style={styles.safe}
      edges={topInset ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[styles.content, style]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
});

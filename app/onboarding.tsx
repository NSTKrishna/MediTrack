import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { Screen } from '@/src/components/common/Screen';
import { colors, radius, spacing } from '@/src/constants/theme';
import { useAppStore } from '@/src/store/useAppStore';

export default function OnboardingScreen() {
  const complete = useAppStore((state) => state.completeOnboarding);
  const continueToLogin = () => {
    complete();
    router.replace('/login');
  };
  return (
    <Screen style={styles.screen} topInset>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Text style={styles.markText}>+</Text>
        </View>
        <Text style={styles.title}>Medication support,{`\n`}made simple.</Text>
        <Text style={styles.subtitle}>
          Keep medicines, doses, and the people who care for you in one calm, clear place.
        </Text>
      </View>
      <View style={styles.steps}>
        <Text style={styles.step}>
          <Text style={styles.stepNumber}>1 </Text>Add your medicines
        </Text>
        <Text style={styles.step}>
          <Text style={styles.stepNumber}>2 </Text>Stay on track with reminders
        </Text>
        <Text style={styles.step}>
          <Text style={styles.stepNumber}>3 </Text>Share progress when you choose
        </Text>
      </View>
      <AppButton label="Get started" onPress={continueToLogin} />
      <AppButton
        label="I already have an account"
        variant="ghost"
        onPress={() => router.replace('/login')}
        style={styles.secondary}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: spacing.xl },
  hero: { gap: spacing.md },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markText: { color: colors.surface, fontSize: 44, fontWeight: '300' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', lineHeight: 38 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  steps: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  step: { color: colors.text, fontSize: 16 },
  stepNumber: { color: colors.secondaryStrong, fontWeight: '800' },
  secondary: { marginTop: spacing.sm },
});

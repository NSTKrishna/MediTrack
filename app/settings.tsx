import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { AppButton } from '@/src/components/common/AppButton';
import { Screen } from '@/src/components/common/Screen';
import { TextField } from '@/src/components/forms/TextField';
import { deleteAccount } from '@/src/services/firebase/account';
import { colors, radius, spacing } from '@/src/constants/theme';
import { requestReminderPermissions } from '@/src/services/notifications/medicationReminders';
import { useAuthStore } from '@/src/store/useAuthStore';
import { usePreferencesStore } from '@/src/store/usePreferencesStore';

export default function SettingsScreen() {
  const role = useAuthStore((state) => state.profile?.role);
  const signOut = useAuthStore((state) => state.signOutUser);
  const preferences = usePreferencesStore();
  const [signingOut, setSigningOut] = useState(false);
  const [permissionNote, setPermissionNote] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your medicines, dose history, stock history, and care relationships. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setDeleteError(null);
            try {
              await deleteAccount(password);
              await signOut().catch(() => undefined);
              router.replace('/login');
            } catch (error) {
              const code =
                typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
              setDeleteError(
                code.includes('wrong-password') || code.includes('invalid-credential')
                  ? 'That password is incorrect.'
                  : 'Could not delete your account. Check your connection and try again.',
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );

  const toggleReminders = async (value: boolean) => {
    if (value && !(await requestReminderPermissions())) {
      setPermissionNote('Notifications are turned off for MediTrack in your device settings.');
      return;
    }
    setPermissionNote(null);
    preferences.setRemindersEnabled(value);
  };

  return (
    <Screen>
      <Text style={styles.intro}>These settings apply to this device.</Text>
      <View style={styles.card}>
        {role !== 'caregiver' ? (
          <>
            <Setting
              label="Dose reminders"
              description="Notifications at each scheduled dose time, with Taken, Snooze, and Skip."
              value={preferences.remindersEnabled}
              onChange={(value) => void toggleReminders(value)}
            />
            <Setting
              label="Low-stock alerts"
              description="A notification when a taken dose brings a medicine to its refill point."
              value={preferences.lowStockAlertsEnabled}
              onChange={preferences.setLowStockAlertsEnabled}
            />
          </>
        ) : null}
        <Setting
          label="Discreet notifications"
          description="Hide medicine names on the lock screen and in notification previews."
          value={preferences.discreetNotifications}
          onChange={preferences.setDiscreetNotifications}
        />
      </View>
      {permissionNote ? (
        <Text style={styles.warning} accessibilityRole="alert">
          {permissionNote}
        </Text>
      ) : null}
      <AppButton
        label="Sign out"
        variant="ghost"
        busy={signingOut}
        onPress={async () => {
          setSigningOut(true);
          try {
            await signOut();
            router.replace('/login');
          } finally {
            setSigningOut(false);
          }
        }}
      />
      <View style={styles.danger}>
        <Text style={styles.label}>Delete account</Text>
        <Text style={styles.description}>
          Permanently removes your account and everything stored with it, and ends all care
          relationships.
        </Text>
        {showDelete ? (
          <>
            <TextField
              label="Confirm with your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
            />
            {deleteError ? (
              <Text style={styles.warning} accessibilityRole="alert">
                {deleteError}
              </Text>
            ) : null}
            <AppButton
              label="Delete my account"
              variant="danger"
              busy={deleting}
              disabled={password.length === 0}
              onPress={confirmDelete}
            />
          </>
        ) : (
          <AppButton label="Delete account…" variant="ghost" onPress={() => setShowDelete(true)} />
        )}
      </View>
      <Text style={styles.note}>
        Signing out stops reminders and alerts on this device. MediTrack{' '}
        {Constants.expoConfig?.version ?? ''}
      </Text>
    </Screen>
  );
}

function Setting({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={description}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.secondaryStrong }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, lineHeight: 21, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.lg },
  row: {
    padding: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: { flex: 1 },
  label: { color: colors.text, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  warning: { color: colors.warning, marginBottom: spacing.md },
  danger: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    margin: spacing.lg,
  },
});

import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { Screen } from '@/src/components/common/Screen';
import { StateView } from '@/src/components/feedback/StateView';
import { colors, radius, spacing } from '@/src/constants/theme';
import { grantedLabels } from '@/src/features/caregivers/permissions';
import { VerifyEmailNotice } from '@/src/features/caregivers/VerifyEmailNotice';
import {
  acceptInvitation,
  declineInvitation,
  markAlertRead,
  revokeCareLink,
} from '@/src/services/firebase/caregivers';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useCareStore } from '@/src/store/useCareStore';
import type { Invitation } from '@/src/types/caregiver';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message.replace('Firebase: ', '') : 'Something went wrong.';

/** Caregiver's alerts feed, invitations to review, and the option to leave a care relationship. */
export function CaregiverInbox() {
  const profile = useAuthStore((state) => state.profile);
  const verified = useAuthStore((state) => state.emailVerified);
  const invitations = useCareStore((state) => state.invitations);
  const invitationsError = useCareStore((state) => state.invitationsError);
  const alerts = useCareStore((state) => state.alerts);
  const links = useCareStore((state) => state.links);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;

  const respond = async (invitation: Invitation, accept: boolean) => {
    setBusy(invitation.id);
    setError(null);
    try {
      if (accept) await acceptInvitation(invitation, profile);
      else await declineInvitation(invitation.id);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      {!verified ? <VerifyEmailNotice /> : null}
      <Text style={styles.section} accessibilityRole="header">
        Invitations
      </Text>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {invitationsError ? <StateView kind="error" message={invitationsError} /> : null}
      {verified && invitations.length === 0 ? (
        <Text style={styles.empty}>No pending invitations.</Text>
      ) : null}
      {invitations.map((invitation) => (
        <View key={invitation.id} style={styles.card}>
          <Text style={styles.name}>{invitation.patientName} invited you</Text>
          <Text style={styles.meta}>
            You would see: {grantedLabels(invitation.permissions).join(', ') || 'nothing yet'}
          </Text>
          <Text style={styles.meta}>
            Expires {new Date(invitation.expiresAt).toLocaleDateString()}
          </Text>
          <View style={styles.actions}>
            <AppButton
              label="Decline"
              variant="ghost"
              disabled={busy === invitation.id}
              onPress={() => void respond(invitation, false)}
              style={styles.flex}
            />
            <AppButton
              label="Accept"
              busy={busy === invitation.id}
              onPress={() => void respond(invitation, true)}
              style={styles.flex}
            />
          </View>
        </View>
      ))}

      <Text style={styles.section} accessibilityRole="header">
        Alerts
      </Text>
      {alerts.length === 0 ? (
        <Text style={styles.empty}>No alerts. Missed doses and low stock will appear here.</Text>
      ) : null}
      {alerts.map((alert) => (
        <View key={alert.id} style={[styles.card, !alert.readAt && styles.unread]}>
          <Text style={styles.alertType}>
            {alert.type === 'missed-dose' ? 'MISSED DOSE' : 'LOW STOCK'}
          </Text>
          <Text style={styles.name}>{alert.message}</Text>
          <Text style={styles.meta}>
            {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : ''}
          </Text>
          {!alert.readAt ? (
            <AppButton
              label="Mark as read"
              variant="ghost"
              onPress={() => void markAlertRead(profile.id, alert.id).catch(() => undefined)}
              style={styles.markRead}
            />
          ) : null}
        </View>
      ))}

      {links.length > 0 ? (
        <>
          <Text style={styles.section} accessibilityRole="header">
            Sharing with you
          </Text>
          {links.map((link) => (
            <View key={link.id} style={styles.card}>
              <Text style={styles.name}>{link.patientName}</Text>
              <AppButton
                label="Stop receiving updates"
                variant="ghost"
                onPress={() =>
                  Alert.alert(
                    `Leave ${link.patientName}'s care team?`,
                    'You will lose access immediately.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Leave',
                        style: 'destructive',
                        onPress: () =>
                          void revokeCareLink(link.id, profile.id).catch((cause) =>
                            setError(errorText(cause)),
                          ),
                      },
                    ],
                  )
                }
              />
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  unread: { borderLeftWidth: 4, borderLeftColor: colors.danger },
  alertType: { color: colors.danger, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  name: { color: colors.text, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  markRead: { marginTop: spacing.sm, minHeight: 40 },
  empty: { color: colors.muted },
  error: { color: colors.danger, marginBottom: spacing.sm },
});

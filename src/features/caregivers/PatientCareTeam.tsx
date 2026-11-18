import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/common/AppButton';
import { Screen } from '@/src/components/common/Screen';
import { StateView } from '@/src/components/feedback/StateView';
import { TextField } from '@/src/components/forms/TextField';
import { colors, radius, spacing } from '@/src/constants/theme';
import { PermissionToggles } from '@/src/features/caregivers/PermissionToggles';
import {
  INVITATION_TTL_DAYS,
  defaultPermissions,
  grantedLabels,
} from '@/src/features/caregivers/permissions';
import {
  createInvitation,
  revokeCareLink,
  updateCarePermissions,
  withdrawInvitation,
} from '@/src/services/firebase/caregivers';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useCareStore } from '@/src/store/useCareStore';
import type { CareLink, CarePermissions } from '@/src/types/caregiver';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message.replace('Firebase: ', '') : 'Something went wrong.';

/** The patient's view: invite caregivers, control what each can see, and revoke access. */
export function PatientCareTeam() {
  const profile = useAuthStore((state) => state.profile);
  const links = useCareStore((state) => state.links);
  const invitations = useCareStore((state) => state.invitations);
  const loading = useCareStore((state) => state.loading);
  const error = useCareStore((state) => state.error);
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState<CarePermissions>(defaultPermissions);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!profile) return null;

  const invite = async () => {
    setSending(true);
    setInviteError(null);
    setInviteSent(null);
    try {
      await createInvitation(profile, email, permissions);
      setInviteSent(email.trim().toLowerCase());
      setEmail('');
      setPermissions(defaultPermissions);
    } catch (cause) {
      setInviteError(errorText(cause));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>YOUR CARE TEAM</Text>
        <Text style={styles.title} accessibilityRole="header">
          Share support, on your terms.
        </Text>
        <Text style={styles.copy}>
          Caregivers can only view what you choose, and never change your records. You can change or
          remove access at any time.
        </Text>
      </View>

      <Text style={styles.section} accessibilityRole="header">
        Caregivers
      </Text>
      {loading ? <StateView kind="loading" /> : null}
      {error ? <StateView kind="error" message={error} /> : null}
      {!loading && !error && links.length === 0 ? (
        <Text style={styles.empty}>No caregivers yet. Invite someone below.</Text>
      ) : null}
      {links.map((link) => (
        <CaregiverCard key={link.id} link={link} actorId={profile.id} />
      ))}

      {invitations.length > 0 ? (
        <>
          <Text style={styles.section} accessibilityRole="header">
            Pending invitations
          </Text>
          {invitations.map((invitation) => (
            <View key={invitation.id} style={styles.card}>
              <Text style={styles.name}>{invitation.inviteeEmail}</Text>
              <Text style={styles.meta}>
                Expires {new Date(invitation.expiresAt).toLocaleDateString()} ·{' '}
                {grantedLabels(invitation.permissions).join(', ') || 'No access'}
              </Text>
              <AppButton
                label="Withdraw invitation"
                variant="ghost"
                onPress={() => void withdrawInvitation(invitation.id).catch(() => undefined)}
                style={styles.button}
              />
            </View>
          ))}
        </>
      ) : null}

      <Text style={styles.section} accessibilityRole="header">
        Invite a caregiver
      </Text>
      <View style={styles.card}>
        <TextField
          label="Caregiver's email"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          hint={`They sign in with this email, verify it, and accept within ${INVITATION_TTL_DAYS} days.`}
        />
        <Text style={styles.subsection}>What they can see</Text>
        <PermissionToggles value={permissions} onChange={setPermissions} />
        {inviteError ? (
          <Text style={styles.error} accessibilityRole="alert">
            {inviteError}
          </Text>
        ) : null}
        {inviteSent ? (
          <Text style={styles.success} accessibilityLiveRegion="polite">
            Invitation created for {inviteSent}. Ask them to open MediTrack with that email.
          </Text>
        ) : null}
        <AppButton
          label="Send invitation"
          busy={sending}
          onPress={() => void invite()}
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

function CaregiverCard({ link, actorId }: { link: CareLink; actorId: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(link.permissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateCarePermissions(link.id, draft);
      setEditing(false);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const revoke = () =>
    Alert.alert(
      `Remove ${link.caregiverName}?`,
      'They will immediately lose access to your information. You can invite them again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove access',
          style: 'destructive',
          onPress: () =>
            void revokeCareLink(link.id, actorId).catch((cause) => setError(errorText(cause))),
        },
      ],
    );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {link.caregiverName
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{link.caregiverName}</Text>
          <Text style={styles.meta}>{link.caregiverEmail}</Text>
        </View>
      </View>
      {editing ? (
        <>
          <PermissionToggles value={draft} onChange={setDraft} disabled={saving} />
          <View style={styles.actions}>
            <AppButton
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setDraft(link.permissions);
                setEditing(false);
              }}
              style={styles.flex}
            />
            <AppButton
              label="Save access"
              busy={saving}
              onPress={() => void save()}
              style={styles.flex}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.meta}>
            Can see: {grantedLabels(link.permissions).join(', ') || 'nothing (access paused)'}
          </Text>
          <View style={styles.actions}>
            <AppButton
              label="Change access"
              variant="ghost"
              onPress={() => {
                setDraft(link.permissions);
                setEditing(true);
              }}
              style={styles.flex}
            />
            <AppButton label="Remove" variant="danger" onPress={revoke} style={styles.flex} />
          </View>
        </>
      )}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.secondarySoft, borderRadius: radius.lg, padding: spacing.lg },
  eyebrow: { color: colors.success, fontSize: 12, letterSpacing: 0.8, fontWeight: '800' },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
    marginTop: spacing.sm,
  },
  copy: { color: colors.muted, lineHeight: 21, marginTop: spacing.sm },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  subsection: { color: colors.text, fontWeight: '800', marginBottom: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '800' },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  button: { marginTop: spacing.sm },
  empty: { color: colors.muted },
  error: { color: colors.danger },
  success: { color: colors.success, fontWeight: '700' },
});

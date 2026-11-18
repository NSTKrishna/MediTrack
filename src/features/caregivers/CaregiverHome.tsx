import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/src/components/common/Screen';
import { StateView } from '@/src/components/feedback/StateView';
import { colors, radius, shadow, spacing } from '@/src/constants/theme';
import { grantedLabels } from '@/src/features/caregivers/permissions';
import { VerifyEmailNotice } from '@/src/features/caregivers/VerifyEmailNotice';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useCareStore } from '@/src/store/useCareStore';

/** Caregiver dashboard: only patients who have actively shared with this caregiver appear. */
export function CaregiverHome() {
  const name = useAuthStore((state) => state.profile?.displayName ?? '');
  const verified = useAuthStore((state) => state.emailVerified);
  const links = useCareStore((state) => state.links);
  const alerts = useCareStore((state) => state.alerts);
  const invitations = useCareStore((state) => state.invitations);
  const loading = useCareStore((state) => state.loading);
  const error = useCareStore((state) => state.error);

  return (
    <Screen>
      <Text style={styles.greeting} accessibilityRole="header">
        Hello{name ? `, ${name.split(' ')[0]}` : ''}
      </Text>
      <Text style={styles.subheading}>People who share their medication progress with you.</Text>
      {!verified ? <VerifyEmailNotice /> : null}
      {invitations.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/caregivers')}
          style={styles.banner}
        >
          <Text style={styles.bannerText}>
            {invitations.length} new invitation{invitations.length === 1 ? '' : 's'} — review →
          </Text>
        </Pressable>
      ) : null}
      {loading ? <StateView kind="loading" message="Loading patients…" /> : null}
      {error ? <StateView kind="error" message={error} /> : null}
      {!loading && !error && links.length === 0 ? (
        <StateView
          kind="empty"
          title="No patients yet"
          message="When someone invites your email address and you accept, they appear here."
        />
      ) : null}
      {links.map((link) => {
        const unread = alerts.filter(
          (alert) => alert.patientId === link.patientId && !alert.readAt,
        ).length;
        return (
          <Pressable
            key={link.id}
            accessibilityRole="button"
            accessibilityLabel={`${link.patientName}${unread ? `, ${unread} unread alerts` : ''}`}
            onPress={() =>
              router.push({
                pathname: '/caregiver/patient/[patientId]',
                params: { patientId: link.patientId },
              })
            }
            style={styles.card}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{link.patientName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>{link.patientName}</Text>
              <Text style={styles.meta} numberOfLines={2}>
                {grantedLabels(link.permissions).join(' · ') || 'No information shared right now'}
              </Text>
            </View>
            {unread ? <Text style={styles.badge}>{unread}</Text> : null}
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { color: colors.text, fontSize: 25, fontWeight: '800', marginTop: spacing.sm },
  subheading: { color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.lg },
  banner: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: { color: colors.primary, fontWeight: '800' },
  card: {
    ...shadow,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.success, fontWeight: '800', fontSize: 18 },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '800', fontSize: 16 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  badge: {
    backgroundColor: colors.danger,
    color: colors.surface,
    fontWeight: '800',
    borderRadius: 12,
    minWidth: 24,
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  chevron: { color: colors.primary, fontSize: 28, fontWeight: '300' },
});

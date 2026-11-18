import { Tabs } from 'expo-router';
import { colors } from '@/src/constants/theme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useCareStore } from '@/src/store/useCareStore';

export default function TabLayout() {
  const role = useAuthStore((state) => state.profile?.role ?? 'patient');
  const unread = useCareStore((state) => state.alerts.filter((alert) => !alert.readAt).length);
  const invitations = useCareStore((state) => state.invitations.length);
  const caregiver = role === 'caregiver';
  const careBadge = caregiver ? unread + invitations : 0;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: caregiver ? 'Patients' : 'Today',
          tabBarLabel: caregiver ? 'Patients' : 'Today',
        }}
      />
      {/* Caregivers only see what patients share with them; patient-only tabs are hidden. */}
      <Tabs.Screen
        name="medicines"
        options={{
          title: 'Medicines',
          tabBarLabel: 'Medicines',
          href: caregiver ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarLabel: 'Inventory',
          href: caregiver ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="caregivers"
        options={{
          title: caregiver ? 'Alerts & invitations' : 'Caregivers',
          tabBarLabel: caregiver ? 'Alerts' : 'Care',
          tabBarBadge: careBadge > 0 ? careBadge : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile' }} />
    </Tabs>
  );
}

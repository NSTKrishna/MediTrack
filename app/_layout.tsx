import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/src/constants/theme';
import { useNotificationResponses, useSessionData } from '@/src/hooks/useSession';
import { useAuthStore } from '@/src/store/useAuthStore';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const status = useAuthStore((state) => state.status);
  const initialize = useAuthStore((state) => state.initialize);
  const segments = useSegments();
  useEffect(() => initialize(), [initialize]);
  useNotificationResponses();
  useSessionData();

  useEffect(() => {
    if (status === 'loading') return;
    void SplashScreen.hideAsync().catch(() => undefined);
    const inPublicRoute = segments[0] === '(auth)' || segments[0] === 'onboarding';
    if (status === 'authenticated' && inPublicRoute) router.replace('/(tabs)');
    if (status === 'anonymous' && !inPublicRoute) router.replace('/login');
  }, [segments, status]);

  // The native splash screen stays visible while the session is restored.
  if (status === 'loading') return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: '700' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="medicine/[id]" options={{ title: 'Medicine details' }} />
        <Stack.Screen name="medicine/add" options={{ title: 'Add medicine' }} />
        <Stack.Screen name="medicine/edit/[id]" options={{ title: 'Edit medicine' }} />
        <Stack.Screen name="dose-history" options={{ title: 'Dose history' }} />
        <Stack.Screen name="reports" options={{ title: 'Reports' }} />
        <Stack.Screen name="caregiver/patient/[patientId]" options={{ title: 'Patient' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}

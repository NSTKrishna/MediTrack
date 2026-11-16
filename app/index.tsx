import { Redirect } from 'expo-router';
import { useAppStore } from '@/src/store/useAppStore';

export default function Index() {
  const onboarded = useAppStore((state) => state.hasCompletedOnboarding);
  return <Redirect href={onboarded ? '/login' : '/onboarding'} />;
}

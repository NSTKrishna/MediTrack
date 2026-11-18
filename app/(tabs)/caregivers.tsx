import { CaregiverInbox } from '@/src/features/caregivers/CaregiverInbox';
import { PatientCareTeam } from '@/src/features/caregivers/PatientCareTeam';
import { useAuthStore } from '@/src/store/useAuthStore';

export default function CareScreen() {
  const role = useAuthStore((state) => state.profile?.role);
  return role === 'caregiver' ? <CaregiverInbox /> : <PatientCareTeam />;
}

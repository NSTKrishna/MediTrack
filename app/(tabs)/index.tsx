import { CaregiverHome } from '@/src/features/caregivers/CaregiverHome';
import { PatientToday } from '@/src/features/dashboard/PatientToday';
import { useAuthStore } from '@/src/store/useAuthStore';

export default function HomeScreen() {
  const role = useAuthStore((state) => state.profile?.role);
  return role === 'caregiver' ? <CaregiverHome /> : <PatientToday />;
}

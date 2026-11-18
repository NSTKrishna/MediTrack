import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/src/components/common/Screen';
import { StateView } from '@/src/components/feedback/StateView';
import { ReportView } from '@/src/features/reports/ReportView';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useCareStore } from '@/src/store/useCareStore';

/** Patients see their own report; caregivers pass ?patientId= and see only what is shared. */
export default function ReportsScreen() {
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const profile = useAuthStore((state) => state.profile);
  const link = useCareStore((state) =>
    patientId ? state.links.find((item) => item.patientId === patientId) : undefined,
  );
  if (!profile) return null;
  if (patientId && patientId !== profile.id) {
    if (!link || !link.permissions.viewDoseHistory)
      return (
        <Screen>
          <StateView
            kind="empty"
            title="Report not available"
            message="This patient has not shared their dose history with you."
          />
        </Screen>
      );
    return (
      <Screen>
        <ReportView
          ownerId={patientId}
          ownerName={link.patientName}
          access={{
            medicines: link.permissions.viewMedicines,
            doses: true,
            inventory: link.permissions.viewInventory,
          }}
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <ReportView
        ownerId={profile.id}
        ownerName={profile.displayName}
        access={{ medicines: true, doses: true, inventory: true }}
      />
    </Screen>
  );
}

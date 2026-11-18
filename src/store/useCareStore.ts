import { create } from 'zustand';
import {
  subscribeToCareAlerts,
  subscribeToCaregiverLinks,
  subscribeToPatientCareLinks,
  subscribeToReceivedInvitations,
  subscribeToSentInvitations,
} from '@/src/services/firebase/caregivers';
import type { UserProfile } from '@/src/types/auth';
import type { CareAlert, CareLink, Invitation } from '@/src/types/caregiver';

type State = {
  links: CareLink[];
  invitations: Invitation[];
  alerts: CareAlert[];
  loading: boolean;
  error: string | null;
  invitationsError: string | null;
  /** Subscribes to the care data relevant to the signed-in person's role. */
  subscribe: (profile: UserProfile, emailVerified: boolean) => () => void;
  reset: () => void;
};

export const useCareStore = create<State>((set) => ({
  links: [],
  invitations: [],
  alerts: [],
  loading: true,
  error: null,
  invitationsError: null,
  subscribe: (profile, emailVerified) => {
    set({ loading: true, error: null, invitationsError: null });
    const onLinks = (links: CareLink[]) => set({ links, loading: false, error: null });
    const onError = (error: string) => set({ error, loading: false });
    const onInvitations = (invitations: Invitation[]) =>
      set({ invitations, invitationsError: null });
    const onInvitationsError = (invitationsError: string) => set({ invitationsError });
    const unsubscribers: (() => void)[] = [];
    if (profile.role === 'patient') {
      unsubscribers.push(subscribeToPatientCareLinks(profile.id, onLinks, onError));
      unsubscribers.push(subscribeToSentInvitations(profile.id, onInvitations, onInvitationsError));
    } else {
      unsubscribers.push(subscribeToCaregiverLinks(profile.id, onLinks, onError));
      unsubscribers.push(subscribeToCareAlerts(profile.id, (alerts) => set({ alerts }), onError));
      // Invitations are matched to a verified email address only.
      if (emailVerified)
        unsubscribers.push(
          subscribeToReceivedInvitations(profile.email, onInvitations, onInvitationsError),
        );
      else set({ invitations: [] });
    }
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  },
  reset: () =>
    set({
      links: [],
      invitations: [],
      alerts: [],
      loading: true,
      error: null,
      invitationsError: null,
    }),
}));

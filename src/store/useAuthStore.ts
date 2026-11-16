import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  getUserProfile,
  login,
  logout,
  refreshEmailVerification,
  register,
  requestPasswordReset,
  resendVerificationEmail,
  subscribeToAuthState,
  syncTimeZone,
} from '@/src/services/firebase/auth';
import { isFirebaseConfigured } from '@/src/services/firebase/config';
import { cancelAllMedicationReminders } from '@/src/services/notifications/medicationReminders';
import { unregisterPushToken } from '@/src/services/notifications/pushTokens';
import type { AuthStatus, UserProfile, UserRole } from '@/src/types/auth';

type AuthState = {
  status: AuthStatus;
  user: User | null;
  profile: UserProfile | null;
  emailVerified: boolean;
  error: string | null;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshVerification: () => Promise<boolean>;
  clearError: () => void;
};

const friendlyMessages: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account already exists for this email.',
  'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'No connection. Check your network and try again.',
};

/** Maps Firebase errors to messages that do not reveal whether an account exists. */
export function authErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const message = friendlyMessages[String(error.code)];
    if (message) return message;
  }
  return error instanceof Error
    ? error.message.replace('Firebase: ', '')
    : 'Something went wrong. Please try again.';
}

/** Data stores register their reset functions here so sign-out clears every cached record. */
const resetHandlers = new Set<() => void>();
export function onSignOutReset(handler: () => void) {
  resetHandlers.add(handler);
  return () => resetHandlers.delete(handler);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  profile: null,
  emailVerified: false,
  error: null,
  initialize: () => {
    if (!isFirebaseConfigured) {
      set({
        status: 'anonymous',
        error: 'Firebase configuration is required before you can sign in.',
      });
      return () => undefined;
    }
    return subscribeToAuthState(async (user) => {
      if (!user) {
        resetHandlers.forEach((handler) => handler());
        set({ status: 'anonymous', user: null, profile: null, emailVerified: false });
        return;
      }
      try {
        const profile = await getUserProfile(user);
        set({
          user,
          profile,
          emailVerified: user.emailVerified,
          status: 'authenticated',
          error: null,
        });
        const updated = await syncTimeZone(profile).catch(() => profile);
        if (updated !== profile) set({ profile: updated });
      } catch (error) {
        set({ user: null, profile: null, status: 'anonymous', error: authErrorMessage(error) });
      }
    });
  },
  signIn: async (email, password) => {
    set({ error: null });
    try {
      await login(email, password);
    } catch (error) {
      set({ error: authErrorMessage(error) });
      throw error;
    }
  },
  signUp: async (email, password, displayName, role) => {
    set({ error: null });
    try {
      await register(email, password, displayName, role);
    } catch (error) {
      set({ error: authErrorMessage(error) });
      throw error;
    }
  },
  signOutUser: async () => {
    const userId = get().user?.uid;
    // Stop this device from reminding or alerting for the signed-out account.
    await cancelAllMedicationReminders().catch(() => undefined);
    if (userId) await unregisterPushToken(userId).catch(() => undefined);
    try {
      await logout();
      resetHandlers.forEach((handler) => handler());
      set({ status: 'anonymous', user: null, profile: null, emailVerified: false, error: null });
    } catch (error) {
      set({ error: authErrorMessage(error) });
      throw error;
    }
  },
  resetPassword: async (email) => {
    set({ error: null });
    try {
      await requestPasswordReset(email);
    } catch (error) {
      set({ error: authErrorMessage(error) });
      throw error;
    }
  },
  resendVerification: async () => {
    await resendVerificationEmail();
  },
  refreshVerification: async () => {
    const verified = await refreshEmailVerification();
    set({ emailVerified: verified });
    return verified;
  },
  clearError: () => set({ error: null }),
}));

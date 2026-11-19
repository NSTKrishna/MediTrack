jest.mock('@/src/services/firebase/auth', () => ({}));
jest.mock('@/src/services/firebase/config', () => ({ isFirebaseConfigured: false }));
jest.mock('@/src/services/notifications/medicationReminders', () => ({}));
jest.mock('@/src/services/notifications/pushTokens', () => ({}));

// eslint-disable-next-line import/first
import { authErrorMessage } from '@/src/store/useAuthStore';

describe('auth error messages', () => {
  it('does not reveal whether an account exists', () => {
    expect(authErrorMessage({ code: 'auth/user-not-found' })).toBe(
      authErrorMessage({ code: 'auth/wrong-password' }),
    );
    expect(authErrorMessage({ code: 'auth/invalid-credential' })).toBe(
      'Email or password is incorrect.',
    );
  });
  it('explains common failures', () => {
    expect(authErrorMessage({ code: 'auth/network-request-failed' })).toMatch(/connection/i);
    expect(authErrorMessage(new Error('Firebase: Something odd'))).toBe('Something odd');
    expect(authErrorMessage('???')).toMatch(/try again/i);
  });
});

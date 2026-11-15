export type UserRole = 'patient' | 'caregiver';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  timeZone?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

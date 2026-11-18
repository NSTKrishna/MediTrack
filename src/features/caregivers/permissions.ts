import type { CarePermissions, Invitation } from '@/src/types/caregiver';

export const INVITATION_TTL_DAYS = 7;

export type PermissionKey = keyof CarePermissions;

/**
 * The caregiver permission matrix. Each permission can only be granted together with the
 * permissions it depends on; the Firestore rules enforce the same dependencies.
 */
export const permissionMatrix: {
  key: PermissionKey;
  label: string;
  description: string;
  requires: PermissionKey[];
}[] = [
  {
    key: 'viewMedicines',
    label: 'Medicines and schedule',
    description: 'Names, dosages, times, and instructions.',
    requires: [],
  },
  {
    key: 'viewDoseHistory',
    label: 'Dose history',
    description: 'Which doses were taken, skipped, or missed.',
    requires: [],
  },
  {
    key: 'viewInventory',
    label: 'Stock and refills',
    description: 'Remaining stock and the refill history.',
    requires: ['viewMedicines'],
  },
  {
    key: 'missedDoseAlerts',
    label: 'Missed-dose alerts',
    description: 'A notification when a dose is not confirmed within 2 hours.',
    requires: ['viewDoseHistory'],
  },
  {
    key: 'lowStockAlerts',
    label: 'Low-stock alerts',
    description: 'A notification when a medicine reaches its refill point.',
    requires: ['viewInventory'],
  },
];

export const defaultPermissions: CarePermissions = {
  viewMedicines: true,
  viewDoseHistory: true,
  viewInventory: false,
  missedDoseAlerts: true,
  lowStockAlerts: false,
};

export const noPermissions: CarePermissions = {
  viewMedicines: false,
  viewDoseHistory: false,
  viewInventory: false,
  missedDoseAlerts: false,
  lowStockAlerts: false,
};

/** Coerces unknown data to a permission set and drops grants whose prerequisites are missing. */
export function normalizePermissions(raw: unknown): CarePermissions {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const result = { ...noPermissions };
  for (const { key } of permissionMatrix) result[key] = source[key] === true;
  // Resolve in matrix order so chains (lowStockAlerts → viewInventory → viewMedicines) settle.
  for (let pass = 0; pass < permissionMatrix.length; pass += 1)
    for (const { key, requires } of permissionMatrix)
      if (result[key] && requires.some((dependency) => !result[dependency])) result[key] = false;
  return result;
}

/**
 * Toggles one permission while keeping the set valid: granting a permission also grants what it
 * needs, and revoking one also revokes what depends on it.
 */
export function togglePermission(current: CarePermissions, key: PermissionKey): CarePermissions {
  const next = { ...current };
  if (current[key]) {
    next[key] = false;
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of permissionMatrix)
        if (next[item.key] && item.requires.some((dependency) => !next[dependency])) {
          next[item.key] = false;
          changed = true;
        }
    }
  } else {
    const grant = (permission: PermissionKey) => {
      next[permission] = true;
      permissionMatrix.find((item) => item.key === permission)?.requires.forEach(grant);
    };
    grant(key);
  }
  return next;
}

export function grantedLabels(permissions: CarePermissions) {
  return permissionMatrix.filter(({ key }) => permissions[key]).map(({ label }) => label);
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function isInvitationExpired(invitation: Pick<Invitation, 'expiresAt'>, now = new Date()) {
  return new Date(invitation.expiresAt).getTime() <= now.getTime();
}

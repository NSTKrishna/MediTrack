import {
  defaultPermissions,
  grantedLabels,
  isInvitationExpired,
  noPermissions,
  normalizeEmail,
  normalizePermissions,
  permissionMatrix,
  togglePermission,
} from '@/src/features/caregivers/permissions';
import type { CarePermissions } from '@/src/types/caregiver';

const all: CarePermissions = {
  viewMedicines: true,
  viewDoseHistory: true,
  viewInventory: true,
  missedDoseAlerts: true,
  lowStockAlerts: true,
};

/** Mirrors validPermissions() in firestore.rules. */
const satisfiesRules = (p: CarePermissions) =>
  (!p.viewInventory || p.viewMedicines) &&
  (!p.missedDoseAlerts || p.viewDoseHistory) &&
  (!p.lowStockAlerts || p.viewInventory);

describe('caregiver permission matrix', () => {
  it('defaults to a valid, least-privilege set without stock access', () => {
    expect(satisfiesRules(defaultPermissions)).toBe(true);
    expect(defaultPermissions.viewInventory).toBe(false);
  });

  it('grants prerequisites when a dependent permission is turned on', () => {
    expect(togglePermission(noPermissions, 'lowStockAlerts')).toEqual({
      ...noPermissions,
      lowStockAlerts: true,
      viewInventory: true,
      viewMedicines: true,
    });
  });

  it('revokes dependents when a prerequisite is turned off', () => {
    expect(togglePermission(all, 'viewMedicines')).toEqual({
      ...all,
      viewMedicines: false,
      viewInventory: false,
      lowStockAlerts: false,
    });
    expect(togglePermission(all, 'viewDoseHistory')).toMatchObject({ missedDoseAlerts: false });
  });

  it('only ever produces combinations the security rules accept', () => {
    // Exhaustively toggle every permission from every one of the 32 starting states.
    for (let mask = 0; mask < 32; mask += 1) {
      const start = normalizePermissions(
        Object.fromEntries(
          permissionMatrix.map(({ key }, index) => [key, Boolean(mask & (1 << index))]),
        ),
      );
      expect(satisfiesRules(start)).toBe(true);
      for (const { key } of permissionMatrix)
        expect(satisfiesRules(togglePermission(start, key))).toBe(true);
    }
  });

  it('normalizes untrusted data to booleans and drops invalid grants', () => {
    expect(
      normalizePermissions({ viewInventory: true, lowStockAlerts: 'yes', extra: true }),
    ).toEqual(noPermissions);
    expect(normalizePermissions(null)).toEqual(noPermissions);
  });

  it('describes granted permissions', () => {
    expect(grantedLabels(noPermissions)).toEqual([]);
    expect(grantedLabels(all)).toHaveLength(5);
  });
});

describe('invitation helpers', () => {
  it('normalizes emails', () =>
    expect(normalizeEmail('  Carol@Example.COM ')).toBe('carol@example.com'));
  it('detects expiry', () => {
    const now = new Date('2026-11-18T12:00:00Z');
    expect(isInvitationExpired({ expiresAt: '2026-11-18T11:59:59Z' }, now)).toBe(true);
    expect(isInvitationExpired({ expiresAt: '2026-11-25T12:00:00Z' }, now)).toBe(false);
  });
});

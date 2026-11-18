import {
  Timestamp,
  collection,
  doc,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { requireDb } from '@/src/services/firebase/config';
import {
  INVITATION_TTL_DAYS,
  isInvitationExpired,
  normalizeEmail,
  normalizePermissions,
} from '@/src/features/caregivers/permissions';
import type { CareAlert, CareLink, CarePermissions, Invitation } from '@/src/types/caregiver';

const isoFrom = (value: unknown) =>
  value instanceof Timestamp
    ? value.toDate().toISOString()
    : typeof value === 'string'
      ? value
      : null;

export const careLinkId = (patientId: string, caregiverId: string) => `${patientId}_${caregiverId}`;

function toInvitation(id: string, data: Record<string, unknown>): Invitation {
  return {
    id,
    patientId: String(data.patientId ?? ''),
    patientName: String(data.patientName ?? ''),
    inviteeEmail: String(data.inviteeEmail ?? ''),
    permissions: normalizePermissions(data.permissions),
    status: (['pending', 'accepted', 'declined', 'revoked'].includes(String(data.status))
      ? data.status
      : 'revoked') as Invitation['status'],
    createdAt: isoFrom(data.createdAt),
    expiresAt: isoFrom(data.expiresAt) ?? new Date(0).toISOString(),
  };
}

function toCareLink(id: string, data: Record<string, unknown>): CareLink {
  return {
    id,
    patientId: String(data.patientId ?? ''),
    patientName: String(data.patientName ?? ''),
    caregiverId: String(data.caregiverId ?? ''),
    caregiverName: String(data.caregiverName ?? ''),
    caregiverEmail: String(data.caregiverEmail ?? ''),
    permissions: normalizePermissions(data.permissions),
    status: data.status === 'active' ? 'active' : 'revoked',
    invitationId: String(data.invitationId ?? ''),
  };
}

function toAlert(id: string, data: Record<string, unknown>): CareAlert {
  return {
    id,
    type: data.type === 'low-stock' ? 'low-stock' : 'missed-dose',
    patientId: String(data.patientId ?? ''),
    patientName: String(data.patientName ?? ''),
    medicineName: String(data.medicineName ?? ''),
    message: String(data.message ?? ''),
    createdAt: isoFrom(data.createdAt),
    readAt: isoFrom(data.readAt),
  };
}

// ---------- patient side ----------

export async function createInvitation(
  patient: { id: string; displayName: string; email: string },
  inviteeEmail: string,
  permissions: CarePermissions,
  store: Firestore = requireDb(),
) {
  const email = normalizeEmail(inviteeEmail);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (email === normalizeEmail(patient.email)) throw new Error('You cannot invite yourself.');
  const ref = doc(collection(store, 'invitations'));
  await setDoc(ref, {
    patientId: patient.id,
    patientName: patient.displayName,
    inviteeEmail: email,
    permissions: normalizePermissions(permissions),
    status: 'pending',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  return ref.id;
}

export async function withdrawInvitation(invitationId: string, store: Firestore = requireDb()) {
  await updateDoc(doc(store, 'invitations', invitationId), {
    status: 'revoked',
    respondedAt: serverTimestamp(),
  });
}

export function subscribeToSentInvitations(
  patientId: string,
  callback: (items: Invitation[]) => void,
  onError: (message: string) => void,
  store: Firestore = requireDb(),
) {
  return onSnapshot(
    query(
      collection(store, 'invitations'),
      where('patientId', '==', patientId),
      where('status', '==', 'pending'),
    ),
    (snapshot) =>
      callback(
        snapshot.docs
          .map((item) => toInvitation(item.id, item.data()))
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
      ),
    (error) => onError(error.message),
  );
}

export function subscribeToPatientCareLinks(
  patientId: string,
  callback: (items: CareLink[]) => void,
  onError: (message: string) => void,
  store: Firestore = requireDb(),
) {
  return onSnapshot(
    query(
      collection(store, 'careLinks'),
      where('patientId', '==', patientId),
      where('status', '==', 'active'),
    ),
    (snapshot) => callback(snapshot.docs.map((item) => toCareLink(item.id, item.data()))),
    (error) => onError(error.message),
  );
}

/** Consent control: the patient changes what a caregiver may see or be alerted about. */
export async function updateCarePermissions(
  linkId: string,
  permissions: CarePermissions,
  store: Firestore = requireDb(),
) {
  await updateDoc(doc(store, 'careLinks', linkId), {
    permissions: normalizePermissions(permissions),
    updatedAt: serverTimestamp(),
  });
}

/** Either party ends the relationship. Access stops immediately; the record is kept for audit. */
export async function revokeCareLink(
  linkId: string,
  actorId: string,
  store: Firestore = requireDb(),
) {
  await updateDoc(doc(store, 'careLinks', linkId), {
    status: 'revoked',
    revokedBy: actorId,
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ---------- caregiver side ----------

export function subscribeToReceivedInvitations(
  email: string,
  callback: (items: Invitation[]) => void,
  onError: (message: string) => void,
  store: Firestore = requireDb(),
) {
  return onSnapshot(
    query(
      collection(store, 'invitations'),
      where('inviteeEmail', '==', normalizeEmail(email)),
      where('status', '==', 'pending'),
    ),
    (snapshot) =>
      callback(
        snapshot.docs
          .map((item) => toInvitation(item.id, item.data()))
          .filter((invitation) => !isInvitationExpired(invitation)),
      ),
    (error) => onError(error.message),
  );
}

/**
 * Accepts an invitation. The invitation update and the care-link creation are one atomic batch;
 * the security rules accept the link only alongside the acceptance of a matching invitation.
 */
export async function acceptInvitation(
  invitation: Invitation,
  caregiver: { id: string; displayName: string; email: string },
  store: Firestore = requireDb(),
) {
  if (isInvitationExpired(invitation)) throw new Error('This invitation has expired.');
  const linkId = careLinkId(invitation.patientId, caregiver.id);
  const batch = writeBatch(store);
  batch.update(doc(store, 'invitations', invitation.id), {
    status: 'accepted',
    acceptedBy: caregiver.id,
    respondedAt: serverTimestamp(),
  });
  batch.set(doc(store, 'careLinks', linkId), {
    patientId: invitation.patientId,
    patientName: invitation.patientName,
    caregiverId: caregiver.id,
    caregiverName: caregiver.displayName,
    caregiverEmail: normalizeEmail(caregiver.email),
    permissions: invitation.permissions,
    status: 'active',
    invitationId: invitation.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return linkId;
}

export async function declineInvitation(invitationId: string, store: Firestore = requireDb()) {
  await updateDoc(doc(store, 'invitations', invitationId), {
    status: 'declined',
    respondedAt: serverTimestamp(),
  });
}

export function subscribeToCaregiverLinks(
  caregiverId: string,
  callback: (items: CareLink[]) => void,
  onError: (message: string) => void,
  store: Firestore = requireDb(),
) {
  return onSnapshot(
    query(
      collection(store, 'careLinks'),
      where('caregiverId', '==', caregiverId),
      where('status', '==', 'active'),
    ),
    (snapshot) => callback(snapshot.docs.map((item) => toCareLink(item.id, item.data()))),
    (error) => onError(error.message),
  );
}

export function subscribeToCareAlerts(
  caregiverId: string,
  callback: (items: CareAlert[]) => void,
  onError: (message: string) => void,
  store: Firestore = requireDb(),
) {
  return onSnapshot(
    query(
      collection(store, 'users', caregiverId, 'alerts'),
      orderBy('createdAt', 'desc'),
      limitTo(50),
    ),
    (snapshot) => callback(snapshot.docs.map((item) => toAlert(item.id, item.data()))),
    (error) => onError(error.message),
  );
}

export async function markAlertRead(
  caregiverId: string,
  alertId: string,
  store: Firestore = requireDb(),
) {
  await updateDoc(doc(store, 'users', caregiverId, 'alerts', alertId), {
    readAt: serverTimestamp(),
  });
}

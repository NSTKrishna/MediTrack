import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  acceptInvitation,
  careLinkId,
  createInvitation,
  declineInvitation,
  revokeCareLink,
  updateCarePermissions,
  withdrawInvitation,
} from '@/src/services/firebase/caregivers';
import { confirmDose } from '@/src/services/firebase/doses';
import { createMedicine } from '@/src/services/firebase/medicines';
import { defaultPermissions, noPermissions } from '@/src/features/caregivers/permissions';
import type { CarePermissions, Invitation } from '@/src/types/caregiver';
import {
  PROJECT_ID,
  clientFor,
  closeClients,
  createProfile,
  expectDenied,
  resetEmulator,
  type TestUser,
} from './emulator';

const patient: TestUser = { uid: 'pat', email: 'pat@example.com' };
const carol: TestUser = { uid: 'carol', email: 'carol@example.com' };
const unverified: TestUser = { uid: 'una', email: 'una@example.com', emailVerified: false };
const stranger: TestUser = { uid: 'sam', email: 'sam@example.com' };
const otherCaregiver: TestUser = { uid: 'dan', email: 'dan@example.com' };

const full: CarePermissions = {
  viewMedicines: true,
  viewDoseHistory: true,
  viewInventory: true,
  missedDoseAlerts: true,
  lowStockAlerts: true,
};

async function invitationFor(store: ReturnType<typeof clientFor>, id: string): Promise<Invitation> {
  const snapshot = await getDoc(doc(store, 'invitations', id));
  const data = snapshot.data()!;
  return {
    id,
    patientId: data.patientId,
    patientName: data.patientName,
    inviteeEmail: data.inviteeEmail,
    permissions: data.permissions,
    status: data.status,
    createdAt: null,
    expiresAt: (data.expiresAt as Timestamp).toDate().toISOString(),
  };
}

/** Writes a document with security rules bypassed, for seeding states clients cannot create. */
async function writeAsOwner(path: string, fields: Record<string, unknown>) {
  const encode = (value: unknown): unknown => {
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') return { integerValue: String(value) };
    if (value && typeof value === 'object')
      return {
        mapValue: {
          fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])),
        },
      };
    return { nullValue: null };
  };
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const response = await fetch(
    `http://${host}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])),
      }),
    },
  );
  if (!response.ok) throw new Error(`Seed failed: ${response.status} ${await response.text()}`);
}

let medicineId = '';

async function setupWorld() {
  const patientDb = clientFor(patient);
  await createProfile(patientDb, patient, 'patient', 'Pat Patient');
  await createProfile(clientFor(carol), carol, 'caregiver', 'Carol Care');
  await createProfile(clientFor(unverified), unverified, 'caregiver', 'Una Unverified');
  await createProfile(clientFor(stranger), stranger, 'caregiver', 'Sam Stranger');
  await createProfile(clientFor(otherCaregiver), otherCaregiver, 'caregiver', 'Dan Other');
  const medicine = await createMedicine(
    patient.uid,
    {
      name: 'Lisinopril',
      category: 'Blood pressure',
      dosage: '10',
      dosageUnit: 'mg',
      frequency: 'once-daily',
      scheduledTimes: ['8:00 AM'],
      selectedWeekdays: [],
      startDate: '2026-11-01',
      endDate: null,
      stockQuantity: 10,
      remainingStock: 10,
      lowStockThreshold: 3,
      instructions: '',
      active: true,
    },
    patientDb,
  );
  medicineId = medicine.id;
  await confirmDose(
    patient.uid,
    {
      medicineId,
      medicineName: 'Lisinopril',
      scheduledFor: new Date(Date.UTC(2026, 10, 17, 8)),
      outcome: 'taken',
      source: 'app',
    },
    patientDb,
  );
  return patientDb;
}

async function linkCarol(permissions: CarePermissions = defaultPermissions) {
  const patientDb = await setupWorld();
  const invitationId = await createInvitation(
    { id: patient.uid, displayName: 'Pat Patient', email: patient.email },
    carol.email,
    permissions,
    patientDb,
  );
  const carolDb = clientFor(carol);
  await acceptInvitation(
    await invitationFor(carolDb, invitationId),
    { id: carol.uid, displayName: 'Carol Care', email: carol.email },
    carolDb,
  );
  return { patientDb, carolDb, invitationId, linkId: careLinkId(patient.uid, carol.uid) };
}

const medicines = (store: ReturnType<typeof clientFor>) =>
  getDocs(collection(store, 'users', patient.uid, 'medicines'));
const doses = (store: ReturnType<typeof clientFor>) =>
  getDocs(collection(store, 'users', patient.uid, 'doses'));
const ledger = (store: ReturnType<typeof clientFor>) =>
  getDocs(collection(store, 'users', patient.uid, 'inventoryTransactions'));

beforeEach(resetEmulator);
afterAll(closeClients);

describe('invitations', () => {
  it('lets a patient invite a caregiver and the invitee read it', async () => {
    const patientDb = await setupWorld();
    const id = await createInvitation(
      { id: patient.uid, displayName: 'Pat Patient', email: patient.email },
      'Carol@Example.com',
      defaultPermissions,
      patientDb,
    );
    const invitation = await invitationFor(clientFor(carol), id);
    expect(invitation).toMatchObject({ inviteeEmail: 'carol@example.com', status: 'pending' });
    const received = await getDocs(
      query(
        collection(clientFor(carol), 'invitations'),
        where('inviteeEmail', '==', carol.email),
        where('status', '==', 'pending'),
      ),
    );
    expect(received.size).toBe(1);
  });

  it('hides invitations from anyone but the patient and the verified invitee', async () => {
    const patientDb = await setupWorld();
    const id = await createInvitation(
      { id: patient.uid, displayName: 'Pat Patient', email: patient.email },
      unverified.email,
      defaultPermissions,
      patientDb,
    );
    await expectDenied(getDoc(doc(clientFor(stranger), 'invitations', id)));
    await expectDenied(getDoc(doc(clientFor(unverified), 'invitations', id)));
    await expectDenied(getDocs(collection(clientFor(stranger), 'invitations')));
  });

  it('rejects invitations from caregivers, spoofed names, self-invites, and bad permissions', async () => {
    const patientDb = await setupWorld();
    await expectDenied(
      createInvitation(
        { id: carol.uid, displayName: 'Carol Care', email: carol.email },
        'x@example.com',
        defaultPermissions,
        clientFor(carol),
      ),
    );
    await expectDenied(
      createInvitation(
        { id: patient.uid, displayName: 'Dr. Official', email: patient.email },
        carol.email,
        defaultPermissions,
        patientDb,
      ),
    );
    await expectDenied(
      setDoc(doc(collection(patientDb, 'invitations')), {
        patientId: patient.uid,
        patientName: 'Pat Patient',
        inviteeEmail: patient.email,
        permissions: defaultPermissions,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
      }),
    );
    await expectDenied(
      setDoc(doc(collection(patientDb, 'invitations')), {
        patientId: patient.uid,
        patientName: 'Pat Patient',
        inviteeEmail: carol.email,
        permissions: { ...noPermissions, viewInventory: true },
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
      }),
    );
    await expectDenied(
      setDoc(doc(collection(patientDb, 'invitations')), {
        patientId: patient.uid,
        patientName: 'Pat Patient',
        inviteeEmail: carol.email,
        permissions: defaultPermissions,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 90 * 86_400_000),
      }),
    );
  });

  it('allows declining and withdrawing, after which acceptance is impossible', async () => {
    const patientDb = await setupWorld();
    const inviteA = await createInvitation(
      { id: patient.uid, displayName: 'Pat Patient', email: patient.email },
      carol.email,
      defaultPermissions,
      patientDb,
    );
    const carolDb = clientFor(carol);
    const pending = await invitationFor(carolDb, inviteA);
    await declineInvitation(inviteA, carolDb);
    await expectDenied(
      acceptInvitation(
        pending,
        { id: carol.uid, displayName: 'Carol Care', email: carol.email },
        carolDb,
      ),
    );

    const inviteB = await createInvitation(
      { id: patient.uid, displayName: 'Pat Patient', email: patient.email },
      carol.email,
      defaultPermissions,
      patientDb,
    );
    const pendingB = await invitationFor(carolDb, inviteB);
    await withdrawInvitation(inviteB, patientDb);
    await expectDenied(
      acceptInvitation(
        pendingB,
        { id: carol.uid, displayName: 'Carol Care', email: carol.email },
        carolDb,
      ),
    );
  });

  it('refuses an expired invitation', async () => {
    await setupWorld();
    await writeAsOwner('invitations/expired1', {
      patientId: patient.uid,
      patientName: 'Pat Patient',
      inviteeEmail: carol.email,
      permissions: defaultPermissions,
      status: 'pending',
      createdAt: new Date(Date.now() - 10 * 86_400_000),
      expiresAt: new Date(Date.now() - 86_400_000),
    });
    const carolDb = clientFor(carol);
    const batch = writeBatch(carolDb);
    batch.update(doc(carolDb, 'invitations', 'expired1'), {
      status: 'accepted',
      acceptedBy: carol.uid,
      respondedAt: serverTimestamp(),
    });
    batch.set(doc(carolDb, 'careLinks', careLinkId(patient.uid, carol.uid)), {
      patientId: patient.uid,
      patientName: 'Pat Patient',
      caregiverId: carol.uid,
      caregiverName: 'Carol Care',
      caregiverEmail: carol.email,
      permissions: defaultPermissions,
      status: 'active',
      invitationId: 'expired1',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await expectDenied(batch.commit());
  });
});

describe('accepting and care links', () => {
  it('requires a verified email matching the invitation', async () => {
    const patientDb = await setupWorld();
    const id = await createInvitation(
      { id: patient.uid, displayName: 'Pat Patient', email: patient.email },
      unverified.email,
      defaultPermissions,
      patientDb,
    );
    const invitation: Invitation = {
      id,
      patientId: patient.uid,
      patientName: 'Pat Patient',
      inviteeEmail: unverified.email,
      permissions: defaultPermissions,
      status: 'pending',
      createdAt: null,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    await expectDenied(
      acceptInvitation(
        invitation,
        { id: unverified.uid, displayName: 'Una Unverified', email: unverified.email },
        clientFor(unverified),
      ),
    );
    // Another verified caregiver cannot take over someone else's invitation.
    await expectDenied(
      acceptInvitation(
        invitation,
        { id: stranger.uid, displayName: 'Sam Stranger', email: stranger.email },
        clientFor(stranger),
      ),
    );
  });

  it('rejects a care link created without an invitation', async () => {
    await setupWorld();
    const samDb = clientFor(stranger);
    await expectDenied(
      setDoc(doc(samDb, 'careLinks', careLinkId(patient.uid, stranger.uid)), {
        patientId: patient.uid,
        patientName: 'Pat Patient',
        caregiverId: stranger.uid,
        caregiverName: 'Sam Stranger',
        caregiverEmail: stranger.email,
        permissions: full,
        status: 'active',
        invitationId: 'made-up',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await expectDenied(medicines(samDb));
  });

  it('rejects accepting with more permissions than the patient granted', async () => {
    const patientDb = await setupWorld();
    const id = await createInvitation(
      { id: patient.uid, displayName: 'Pat Patient', email: patient.email },
      carol.email,
      { ...noPermissions, viewDoseHistory: true },
      patientDb,
    );
    const carolDb = clientFor(carol);
    const invitation = await invitationFor(carolDb, id);
    await expectDenied(
      acceptInvitation(
        { ...invitation, permissions: full },
        { id: carol.uid, displayName: 'Carol Care', email: carol.email },
        carolDb,
      ),
    );
  });

  it('grants exactly the permitted data and nothing else', async () => {
    const { carolDb } = await linkCarol({
      ...noPermissions,
      viewMedicines: true,
      viewDoseHistory: true,
    });
    expect((await medicines(carolDb)).size).toBe(1);
    expect((await doses(carolDb)).size).toBe(1);
    await expectDenied(ledger(carolDb));
    await expectDenied(getDoc(doc(carolDb, 'users', patient.uid)));
    await expectDenied(getDocs(collection(carolDb, 'users', patient.uid, 'alerts')));
    await expectDenied(getDocs(collection(carolDb, 'users', patient.uid, 'pushTokens')));
  });

  it('keeps caregivers read-only', async () => {
    const { carolDb } = await linkCarol(full);
    await expectDenied(
      updateDoc(doc(carolDb, 'users', patient.uid, 'medicines', medicineId), {
        instructions: 'changed',
      }),
    );
    await expectDenied(
      confirmDose(
        patient.uid,
        {
          medicineId,
          medicineName: 'Lisinopril',
          scheduledFor: new Date(Date.UTC(2026, 10, 18, 8)),
          outcome: 'taken',
          source: 'app',
        },
        carolDb,
      ),
    );
    await expectDenied(
      setDoc(doc(collection(carolDb, 'users', patient.uid, 'medicines')), { name: 'Injected' }),
    );
  });

  it('does not let a caregiver change their own permissions', async () => {
    const { carolDb, linkId } = await linkCarol({ ...noPermissions, viewDoseHistory: true });
    await expectDenied(updateCarePermissions(linkId, full, carolDb));
    await expectDenied(ledger(carolDb));
  });

  it('applies consent changes immediately', async () => {
    const { patientDb, carolDb, linkId } = await linkCarol(full);
    expect((await ledger(carolDb)).size).toBe(1);
    await updateCarePermissions(linkId, { ...noPermissions, viewDoseHistory: true }, patientDb);
    await expectDenied(ledger(carolDb));
    await expectDenied(medicines(carolDb));
    expect((await doses(carolDb)).size).toBe(1);
    // Invalid combinations are refused even from the patient.
    await expectDenied(
      updateDoc(doc(patientDb, 'careLinks', linkId), {
        permissions: { ...noPermissions, lowStockAlerts: true },
      }),
    );
  });

  it('isolates care links between people', async () => {
    const { linkId } = await linkCarol();
    await expectDenied(getDoc(doc(clientFor(stranger), 'careLinks', linkId)));
    await expectDenied(getDocs(collection(clientFor(otherCaregiver), 'careLinks')));
    const own = await getDocs(
      query(collection(clientFor(carol), 'careLinks'), where('caregiverId', '==', carol.uid)),
    );
    expect(own.size).toBe(1);
    const patientView = await getDocs(
      query(collection(clientFor(patient), 'careLinks'), where('patientId', '==', patient.uid)),
    );
    expect(patientView.size).toBe(1);
  });
});

describe('revocation', () => {
  it('cuts off access immediately when the patient revokes', async () => {
    const { patientDb, carolDb, linkId } = await linkCarol(full);
    await revokeCareLink(linkId, patient.uid, patientDb);
    await expectDenied(medicines(carolDb));
    await expectDenied(doses(carolDb));
    await expectDenied(ledger(carolDb));
  });

  it('lets the caregiver leave, and blocks self-reactivation', async () => {
    const { carolDb, linkId } = await linkCarol(full);
    await revokeCareLink(linkId, carol.uid, carolDb);
    await expectDenied(medicines(carolDb));
    await expectDenied(updateDoc(doc(carolDb, 'careLinks', linkId), { status: 'active' }));
  });

  it('allows a fresh invitation to restore access after revocation', async () => {
    const { patientDb, carolDb, linkId } = await linkCarol(full);
    await revokeCareLink(linkId, patient.uid, patientDb);
    const id = await createInvitation(
      { id: patient.uid, displayName: 'Pat Patient', email: patient.email },
      carol.email,
      { ...noPermissions, viewMedicines: true },
      patientDb,
    );
    await acceptInvitation(
      await invitationFor(carolDb, id),
      { id: carol.uid, displayName: 'Carol Care', email: carol.email },
      carolDb,
    );
    expect((await medicines(carolDb)).size).toBe(1);
    await expectDenied(doses(carolDb));
  });
});

describe('caregiver alerts', () => {
  it('cannot be forged by clients, and only the read marker can change', async () => {
    await setupWorld();
    const carolDb = clientFor(carol);
    await expectDenied(
      setDoc(doc(carolDb, 'users', carol.uid, 'alerts', 'fake'), { message: 'forged' }),
    );
    await writeAsOwner(`users/${carol.uid}/alerts/a1`, {
      type: 'missed-dose',
      patientId: patient.uid,
      patientName: 'Pat Patient',
      medicineName: 'Lisinopril',
      message: 'Missed dose',
      createdAt: new Date(),
    });
    await updateDoc(doc(carolDb, 'users', carol.uid, 'alerts', 'a1'), {
      readAt: serverTimestamp(),
    });
    await expectDenied(
      updateDoc(doc(carolDb, 'users', carol.uid, 'alerts', 'a1'), { message: 'edited' }),
    );
    await expectDenied(getDoc(doc(clientFor(stranger), 'users', carol.uid, 'alerts', 'a1')));
  });
});

describe('profiles', () => {
  it('fixes role and email after sign-up', async () => {
    await setupWorld();
    const carolDb = clientFor(carol);
    await expectDenied(updateDoc(doc(carolDb, 'users', carol.uid), { role: 'patient' }));
    await expectDenied(updateDoc(doc(carolDb, 'users', carol.uid), { email: 'new@example.com' }));
    await updateDoc(doc(carolDb, 'users', carol.uid), { timeZone: 'Europe/London' });
  });

  it('rejects a profile whose email does not match the signed-in account', async () => {
    const newcomer: TestUser = { uid: 'newcomer', email: 'new@example.com' };
    await expectDenied(
      setDoc(doc(clientFor(newcomer), 'users', newcomer.uid), {
        email: 'someone-else@example.com',
        displayName: 'New',
        role: 'patient',
      }),
    );
  });
});

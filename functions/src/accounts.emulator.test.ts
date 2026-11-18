/** Account deletion against the Firestore emulator (run by `npm run test:emulator`). */
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { deleteAccountData } from './accounts';

const app = initializeApp({ projectId: 'demo-meditrack' }, 'accounts-test');
const db = getFirestore(app);
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

beforeEach(async () => {
  await fetch(`http://${host}/emulator/v1/projects/demo-meditrack/databases/(default)/documents`, {
    method: 'DELETE',
  });
});
afterAll(() => deleteApp(app));

it('removes the profile, every sub-collection, care links, and invitations', async () => {
  const user = db.collection('users').doc('pat');
  await user.set({ role: 'patient', displayName: 'Pat', email: 'pat@example.com' });
  await user.collection('medicines').doc('m1').set({ name: 'Lisinopril' });
  await user.collection('doses').doc('d1').set({ outcome: 'taken' });
  await user.collection('inventoryTransactions').doc('t1').set({ delta: -1 });
  await db.collection('careLinks').doc('pat_carol').set({ patientId: 'pat', caregiverId: 'carol' });
  await db.collection('careLinks').doc('other_pat').set({ patientId: 'other', caregiverId: 'pat' });
  await db.collection('careLinks').doc('x_y').set({ patientId: 'x', caregiverId: 'y' });
  await db
    .collection('invitations')
    .doc('i1')
    .set({ patientId: 'pat', inviteeEmail: 'carol@example.com' });
  await db
    .collection('invitations')
    .doc('i2')
    .set({ patientId: 'other', inviteeEmail: 'pat@example.com' });
  await db.collection('users').doc('carol').set({ role: 'caregiver' });

  await deleteAccountData(db, 'pat', 'Pat@Example.com');

  expect((await user.get()).exists).toBe(false);
  for (const name of ['medicines', 'doses', 'inventoryTransactions'])
    expect((await user.collection(name).get()).empty).toBe(true);
  expect((await db.collection('careLinks').get()).docs.map((doc) => doc.id)).toEqual(['x_y']);
  expect((await db.collection('invitations').get()).empty).toBe(true);
  expect((await db.collection('users').doc('carol').get()).exists).toBe(true);
});

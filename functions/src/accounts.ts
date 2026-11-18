import type { Firestore } from 'firebase-admin/firestore';

/**
 * Removes everything stored about a user: their profile and all sub-collections (medicines,
 * doses, inventory ledger, alerts, push tokens), every care link they are part of, and every
 * invitation they sent or that is addressed to them. Caregivers lose access to a deleted
 * patient's data immediately because their links are gone.
 */
export async function deleteAccountData(db: Firestore, userId: string, email: string | null) {
  const links = await Promise.all([
    db.collection('careLinks').where('patientId', '==', userId).get(),
    db.collection('careLinks').where('caregiverId', '==', userId).get(),
  ]);
  const invitations = await Promise.all([
    db.collection('invitations').where('patientId', '==', userId).get(),
    email
      ? db.collection('invitations').where('inviteeEmail', '==', email.toLowerCase()).get()
      : null,
  ]);
  const writer = db.bulkWriter();
  for (const snapshot of [...links, ...invitations])
    snapshot?.docs.forEach((doc) => void writer.delete(doc.ref));
  await writer.close();
  await db.recursiveDelete(db.collection('users').doc(userId));
}

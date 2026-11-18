import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger, setGlobalOptions } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { deleteAccountData } from './accounts';
import { processInventoryTransaction, scanMissedDoses } from './alerts';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

/** Caregiver low-stock alerts, triggered by each new inventory ledger entry. */
export const onInventoryTransactionCreated = onDocumentCreated(
  'users/{patientId}/inventoryTransactions/{transactionId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const created = await processInventoryTransaction(
      getFirestore(),
      event.params.patientId,
      event.params.transactionId,
      data,
    );
    if (created) logger.info('Low-stock alerts created', { count: created });
  },
);

/** Caregiver missed-dose alerts, every 15 minutes. */
export const detectMissedDoses = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'UTC' },
  async () => {
    const created = await scanMissedDoses(getFirestore());
    logger.info('Missed-dose scan complete', { alerts: created });
  },
);

/**
 * In-app account deletion (required by the App Store for apps that offer sign-up). Only the
 * signed-in user can delete their own account, and only with a recent sign-in.
 */
export const deleteMyAccount = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in to delete your account.');
  const authTime = Number(auth.token.auth_time ?? 0) * 1000;
  if (Date.now() - authTime > 5 * 60 * 1000)
    throw new HttpsError(
      'failed-precondition',
      'Please sign in again before deleting your account.',
    );
  await deleteAccountData(getFirestore(), auth.uid, auth.token.email ?? null);
  await getAuth().deleteUser(auth.uid);
  logger.info('Account deleted');
  return { deleted: true };
});

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import {
  MISSED_AFTER_MINUTES,
  crossedLowStock,
  doseIdFor,
  formatLocalTime,
  isValidTimeZone,
  slotsBetween,
  type ServerMedicine,
} from './schedule';
import { sendPushToUser } from './push';

/** How far back each missed-dose scan looks. Overlaps the 15-minute schedule; alerts are idempotent. */
export const SCAN_WINDOW_MINUTES = 60;

type CareLinkData = {
  patientId: string;
  patientName: string;
  caregiverId: string;
  status: string;
  permissions?: Record<string, boolean>;
};

/**
 * Active caregivers of a patient who currently hold a permission. Read at send time, so a revoked
 * link or a withdrawn permission stops alerts immediately.
 */
export async function caregiversWith(db: Firestore, patientId: string, permission: string) {
  const links = await db
    .collection('careLinks')
    .where('patientId', '==', patientId)
    .where('status', '==', 'active')
    .get();
  return links.docs
    .map((doc) => doc.data() as CareLinkData)
    .filter((link) => link.permissions?.[permission] === true);
}

/** Creates the alert document; returns false if it already exists (an earlier run sent it). */
async function createAlertOnce(
  db: Firestore,
  caregiverId: string,
  alertId: string,
  data: Record<string, unknown>,
) {
  try {
    await db
      .collection('users')
      .doc(caregiverId)
      .collection('alerts')
      .doc(alertId)
      .create({ ...data, createdAt: FieldValue.serverTimestamp(), readAt: null });
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 6) return false; // ALREADY_EXISTS
    throw error;
  }
}

/**
 * Low-stock alerts. Fires when a taken dose moves a medicine from above its refill point to at
 * or below it (or to zero), matching the patient's own local alert. Returns alerts created.
 */
export async function processInventoryTransaction(
  db: Firestore,
  patientId: string,
  transactionId: string,
  data: Record<string, unknown>,
) {
  if (data.reason !== 'dose') return 0;
  const previous = Number(data.previousStock);
  const next = Number(data.resultingStock);
  const threshold = Number(data.lowStockThreshold);
  if (!crossedLowStock(previous, next, threshold)) return 0;
  const caregivers = await caregiversWith(db, patientId, 'lowStockAlerts');
  const medicineName = String(data.medicineName ?? 'A medicine');
  let created = 0;
  for (const link of caregivers) {
    const isNew = await createAlertOnce(db, link.caregiverId, `lowstock_${transactionId}`, {
      type: 'low-stock',
      patientId,
      patientName: link.patientName,
      medicineName,
      message:
        next === 0
          ? `${link.patientName} has run out of ${medicineName}.`
          : `${link.patientName}'s ${medicineName} is running low (${next} left).`,
    });
    if (!isNew) continue;
    created += 1;
    await sendPushToUser(db, link.caregiverId, {
      title: 'Care alert',
      body: `${link.patientName} has a new medication alert.`,
      data: { kind: 'care-alert', patientId },
    }).catch((error) => logger.warn('Push failed', { error: String(error) }));
  }
  return created;
}

/**
 * Missed-dose alerts. Finds scheduled doses that crossed the missed threshold within the scan
 * window without a recorded outcome, for patients with at least one caregiver who has
 * missed-dose alerts enabled. Returns alerts created.
 */
export async function scanMissedDoses(db: Firestore, now = new Date()) {
  const links = await db
    .collection('careLinks')
    .where('status', '==', 'active')
    .where('permissions.missedDoseAlerts', '==', true)
    .get();
  const patientIds = [...new Set(links.docs.map((doc) => String(doc.get('patientId'))))];
  const to = new Date(now.getTime() - MISSED_AFTER_MINUTES * 60_000);
  const from = new Date(to.getTime() - SCAN_WINDOW_MINUTES * 60_000);
  let alerts = 0;

  for (const patientId of patientIds) {
    try {
      const profile = await db.collection('users').doc(patientId).get();
      const zone = String(profile.get('timeZone') ?? 'UTC');
      const timeZone = isValidTimeZone(zone) ? zone : 'UTC';
      const medicines = await db
        .collection('users')
        .doc(patientId)
        .collection('medicines')
        .where('active', '==', true)
        .get();
      const missed: { doseId: string; medicine: ServerMedicine; slot: Date }[] = [];
      for (const doc of medicines.docs) {
        const medicine = { ...(doc.data() as Omit<ServerMedicine, 'id'>), id: doc.id };
        for (const slot of slotsBetween(medicine, timeZone, from, to)) {
          const doseId = doseIdFor(medicine.id, slot);
          const dose = await db
            .collection('users')
            .doc(patientId)
            .collection('doses')
            .doc(doseId)
            .get();
          if (!dose.exists) missed.push({ doseId, medicine, slot });
        }
      }
      if (!missed.length) continue;
      for (const link of await caregiversWith(db, patientId, 'missedDoseAlerts')) {
        let createdAny = false;
        for (const item of missed) {
          const created = await createAlertOnce(db, link.caregiverId, `missed_${item.doseId}`, {
            type: 'missed-dose',
            patientId,
            patientName: link.patientName,
            medicineName: item.medicine.name,
            message: `${link.patientName} has not confirmed the ${formatLocalTime(item.slot, timeZone)} ${item.medicine.name} dose.`,
          });
          if (created) {
            alerts += 1;
            createdAny = true;
          }
        }
        if (createdAny)
          await sendPushToUser(db, link.caregiverId, {
            title: 'Care alert',
            body: `${link.patientName} may have missed a dose.`,
            data: { kind: 'care-alert', patientId },
          }).catch((error) => logger.warn('Push failed', { error: String(error) }));
      }
    } catch (error) {
      logger.error('Missed-dose scan failed for a patient', { patientId, error: String(error) });
    }
  }
  return alerts;
}

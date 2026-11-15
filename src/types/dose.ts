export type DoseOutcome = 'taken' | 'skipped';
export type DoseSource = 'app' | 'notification';

export interface Dose {
  /** `${medicineId}_${slotKey}` — one document per scheduled dose time. */
  id: string;
  medicineId: string;
  medicineName: string;
  /** ISO instant of the scheduled dose time. */
  scheduledFor: string;
  slotKey: string;
  outcome: DoseOutcome;
  /** ISO instant at which the outcome was confirmed. */
  recordedAt: string;
  source: DoseSource;
  /** True when confirming this dose removed one unit from inventory. */
  stockDeducted: boolean;
}

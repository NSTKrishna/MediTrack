export type InventoryReason = 'dose' | 'refill';

export interface InventoryTransaction {
  id: string;
  medicineId: string;
  medicineName: string;
  reason: InventoryReason;
  delta: number;
  previousStock: number;
  resultingStock: number;
  lowStockThreshold: number;
  doseId?: string;
  /** ISO instant used for ordering and display. */
  recordedAt: string;
}

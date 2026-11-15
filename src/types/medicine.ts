export type MedicineFrequency =
  'once-daily' | 'twice-daily' | 'three-times-daily' | 'custom-time' | 'selected-weekdays';

export interface Medicine {
  id: string;
  userId: string;
  name: string;
  category: string;
  dosage: string;
  dosageUnit: string;
  frequency: MedicineFrequency;
  scheduledTimes: string[];
  /** JavaScript weekday numbers: 0 = Sunday … 6 = Saturday. */
  selectedWeekdays: number[];
  startDate: string;
  endDate: string | null;
  schedule: string;
  stockQuantity: number;
  remainingStock: number;
  lowStockThreshold: number;
  instructions: string;
  active: boolean;
  color: string;
  /** ISO instant the medicine was added. Doses scheduled before this are not expected. */
  createdAt?: string;
  /** Identifier of the inventory transaction that last changed `remainingStock`. */
  lastInventoryTxId?: string;
}

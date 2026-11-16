import { formatClockTime, parseClockTime, parseLocalDate } from '@/src/features/doses/schedule';
import type { MedicineFrequency } from '@/src/types/medicine';

export type MedicineFormValues = {
  name: string;
  category: string;
  dosage: string;
  dosageUnit: string;
  frequency: MedicineFrequency;
  times: string;
  selectedWeekdays: number[];
  startDate: string;
  endDate: string;
  stockQuantity: string;
  lowStockThreshold: string;
  instructions: string;
  active: boolean;
};

export type ValidMedicine = {
  name: string;
  category: string;
  dosage: string;
  dosageUnit: string;
  frequency: MedicineFrequency;
  scheduledTimes: string[];
  selectedWeekdays: number[];
  startDate: string;
  endDate: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  instructions: string;
  active: boolean;
};

export type FieldErrors = Partial<Record<keyof MedicineFormValues, string>>;

const wholeNumber = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);

export const frequencyPresets: { value: MedicineFrequency; label: string; times: string[] }[] = [
  { value: 'once-daily', label: 'Once daily', times: ['8:00 AM'] },
  { value: 'twice-daily', label: 'Twice daily', times: ['8:00 AM', '8:00 PM'] },
  {
    value: 'three-times-daily',
    label: 'Three times daily',
    times: ['8:00 AM', '2:00 PM', '8:00 PM'],
  },
  { value: 'custom-time', label: 'Custom times', times: [] },
  { value: 'selected-weekdays', label: 'Selected weekdays', times: [] },
];

/** Validates the add/edit medicine form. `requireStock` is false when editing (stock is ledger-managed). */
export function validateMedicineForm(
  values: MedicineFormValues,
  options: { requireStock: boolean },
): { ok: true; value: ValidMedicine } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Enter the medicine name.';
  else if (name.length > 100) errors.name = 'Use 100 characters or fewer.';
  if (!values.category.trim()) errors.category = 'Enter a category.';
  if (!values.dosage.trim()) errors.dosage = 'Enter the dosage.';
  if (!values.dosageUnit.trim()) errors.dosageUnit = 'Enter a unit.';

  const rawTimes = values.times
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const parsed = rawTimes.map(parseClockTime);
  if (!rawTimes.length) errors.times = 'Add at least one time, e.g. 8:00 AM.';
  else if (parsed.some((item) => item === null))
    errors.times = 'Use times like 8:00 AM or 20:00, separated by commas.';
  else if (rawTimes.length > 12) errors.times = 'Use 12 times or fewer.';
  const scheduledTimes = [
    ...new Set(parsed.filter((item) => item !== null).map((item) => formatClockTime(item!))),
  ];

  const selectedWeekdays = [...new Set(values.selectedWeekdays)].sort();
  if (values.frequency === 'selected-weekdays' && selectedWeekdays.length === 0)
    errors.selectedWeekdays = 'Choose at least one day.';

  const start = parseLocalDate(values.startDate.trim());
  if (!start) errors.startDate = 'Use the format YYYY-MM-DD.';
  const endText = values.endDate.trim();
  const end = endText ? parseLocalDate(endText) : null;
  if (endText && !end) errors.endDate = 'Use the format YYYY-MM-DD, or leave blank.';
  else if (start && end && end < start)
    errors.endDate = 'End date must be on or after the start date.';

  const stockQuantity = wholeNumber(values.stockQuantity);
  if (options.requireStock && (stockQuantity === null || stockQuantity > 100000))
    errors.stockQuantity = 'Enter a whole number of doses.';
  const lowStockThreshold = wholeNumber(values.lowStockThreshold);
  if (lowStockThreshold === null || lowStockThreshold > 10000)
    errors.lowStockThreshold = 'Enter a whole number.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      category: values.category.trim(),
      dosage: values.dosage.trim(),
      dosageUnit: values.dosageUnit.trim(),
      frequency: values.frequency,
      scheduledTimes,
      selectedWeekdays: values.frequency === 'selected-weekdays' ? selectedWeekdays : [],
      startDate: values.startDate.trim(),
      endDate: endText || null,
      stockQuantity: stockQuantity ?? 0,
      lowStockThreshold: lowStockThreshold ?? 0,
      instructions: values.instructions.trim().slice(0, 500),
      active: values.active,
    },
  };
}

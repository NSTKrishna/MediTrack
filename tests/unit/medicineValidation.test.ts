import {
  validateMedicineForm,
  type MedicineFormValues,
} from '@/src/features/medicines/medicineValidation';

const values = (overrides: Partial<MedicineFormValues> = {}): MedicineFormValues => ({
  name: 'Amoxicillin',
  category: 'Antibiotic',
  dosage: '500',
  dosageUnit: 'mg',
  frequency: 'twice-daily',
  times: '8:00 AM, 20:00, 8:00 am',
  selectedWeekdays: [],
  startDate: '2026-11-18',
  endDate: '',
  stockQuantity: '30',
  lowStockThreshold: '5',
  instructions: '  Take with food  ',
  active: true,
  ...overrides,
});

describe('medicine form validation', () => {
  it('normalizes times and trims text', () => {
    const result = validateMedicineForm(values(), { requireStock: true });
    expect(result).toMatchObject({
      ok: true,
      value: {
        scheduledTimes: ['8:00 AM', '8:00 PM'],
        instructions: 'Take with food',
        endDate: null,
        stockQuantity: 30,
      },
    });
  });

  it('requires whole-number stock and threshold', () => {
    const result = validateMedicineForm(values({ stockQuantity: '2.5', lowStockThreshold: '-1' }), {
      requireStock: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(Object.keys(result.errors).sort()).toEqual(['lowStockThreshold', 'stockQuantity']);
  });

  it('does not require stock when editing', () => {
    expect(validateMedicineForm(values({ stockQuantity: '' }), { requireStock: false }).ok).toBe(
      true,
    );
  });

  it('rejects malformed times and missing weekdays', () => {
    const result = validateMedicineForm(values({ times: '8am', frequency: 'selected-weekdays' }), {
      requireStock: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toMatchObject({
        times: expect.any(String),
        selectedWeekdays: expect.any(String),
      });
  });

  it('rejects an end date before the start date', () => {
    const result = validateMedicineForm(values({ endDate: '2026-11-01' }), { requireStock: true });
    expect(result.ok).toBe(false);
  });

  it('drops weekdays unless the frequency uses them', () => {
    const result = validateMedicineForm(values({ selectedWeekdays: [1, 3] }), {
      requireStock: true,
    });
    expect(result.ok && result.value.selectedWeekdays).toEqual([]);
  });
});

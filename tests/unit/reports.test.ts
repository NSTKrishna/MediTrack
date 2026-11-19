import { doseIdFor } from '@/src/features/doses/schedule';
import { buildReportHtml, escapeHtml } from '@/src/features/reports/reportHtml';
import {
  buildAdherenceReport,
  parseCustomRange,
  rangeFor,
  shiftAnchor,
} from '@/src/features/reports/reportLogic';
import type { Dose } from '@/src/types/dose';
import type { InventoryTransaction } from '@/src/types/inventory';
import type { Medicine } from '@/src/types/medicine';

const medicine = (overrides: Partial<Medicine> = {}): Medicine => ({
  id: 'm1',
  userId: 'u1',
  name: 'Metformin',
  category: '',
  dosage: '850',
  dosageUnit: 'mg',
  frequency: 'twice-daily',
  scheduledTimes: ['8:00 AM', '8:00 PM'],
  selectedWeekdays: [],
  startDate: '2026-11-01',
  endDate: null,
  schedule: '',
  stockQuantity: 30,
  remainingStock: 3,
  lowStockThreshold: 5,
  instructions: '',
  active: true,
  color: '',
  ...overrides,
});

const dose = (med: Medicine, slot: Date, outcome: Dose['outcome']): Dose => ({
  id: doseIdFor(med.id, slot),
  medicineId: med.id,
  medicineName: med.name,
  scheduledFor: slot.toISOString(),
  slotKey: '',
  outcome,
  recordedAt: slot.toISOString(),
  source: 'app',
  stockDeducted: outcome === 'taken',
});

describe('report ranges', () => {
  const wednesday = new Date(2026, 10, 18, 15, 0);
  it('builds calendar day, Monday-start week, and month ranges', () => {
    expect(rangeFor('daily', wednesday)).toEqual({
      start: new Date(2026, 10, 18),
      end: new Date(2026, 10, 19),
    });
    expect(rangeFor('weekly', wednesday)).toEqual({
      start: new Date(2026, 10, 16),
      end: new Date(2026, 10, 23),
    });
    expect(rangeFor('weekly', new Date(2026, 10, 22))).toEqual({
      start: new Date(2026, 10, 16),
      end: new Date(2026, 10, 23),
    });
    expect(rangeFor('monthly', wednesday)).toEqual({
      start: new Date(2026, 10, 1),
      end: new Date(2026, 11, 1),
    });
  });
  it('steps periods backward and forward', () => {
    expect(shiftAnchor('monthly', new Date(2026, 0, 31), -1)).toEqual(new Date(2025, 11, 1));
    expect(shiftAnchor('weekly', wednesday, 1).getDate()).toBe(25);
  });
  it('validates custom ranges', () => {
    expect(parseCustomRange('2026-11-01', '2026-11-30')).toEqual({
      ok: true,
      range: { start: new Date(2026, 10, 1), end: new Date(2026, 11, 1) },
    });
    expect(parseCustomRange('2026-11-30', '2026-11-01').ok).toBe(false);
    expect(parseCustomRange('nope', '2026-11-01').ok).toBe(false);
    expect(parseCustomRange('2024-01-01', '2026-01-01').ok).toBe(false);
  });
});

describe('adherence report', () => {
  const med = medicine();
  const range = rangeFor('daily', new Date(2026, 10, 18));
  const morning = new Date(2026, 10, 18, 8, 0);
  const evening = new Date(2026, 10, 18, 20, 0);

  it('counts taken, skipped, missed, and pending slots and computes adherence', () => {
    const report = buildAdherenceReport({
      medicines: [med, medicine({ id: 'm2', name: 'Vitamin D', scheduledTimes: ['9:00 AM'] })],
      doses: [dose(med, morning, 'taken')],
      transactions: [],
      range,
      now: new Date(2026, 10, 18, 20, 30),
    });
    // 8 AM taken, 9 AM missed (> 2h), 8 PM pending (30 min overdue).
    expect(report.totals).toEqual({
      scheduled: 3,
      taken: 1,
      skipped: 0,
      missed: 1,
      pending: 1,
      adherencePercent: 50,
    });
    expect(report.byMedicine.map((item) => [item.medicineName, item.adherencePercent])).toEqual([
      ['Metformin', 100],
      ['Vitamin D', 0],
    ]);
    expect(report.missedDoses.map((entry) => entry.medicineName)).toEqual(['Vitamin D']);
  });

  it('does not count future doses', () => {
    const report = buildAdherenceReport({
      medicines: [med],
      doses: [],
      transactions: [],
      range,
      now: new Date(2026, 10, 18, 7, 0),
    });
    expect(report.totals.scheduled).toBe(0);
    expect(report.totals.adherencePercent).toBeNull();
  });

  it('includes recorded doses whose medicine was since deleted', () => {
    const report = buildAdherenceReport({
      medicines: [],
      doses: [dose(med, morning, 'skipped'), dose(med, evening, 'taken')],
      transactions: [],
      range,
      now: new Date(2026, 10, 19),
    });
    expect(report.totals).toMatchObject({ taken: 1, skipped: 1, adherencePercent: 50 });
  });

  it('summarizes inventory changes in the range', () => {
    const tx = (
      id: string,
      reason: 'dose' | 'refill',
      delta: number,
      at: Date,
    ): InventoryTransaction => ({
      id,
      medicineId: 'm1',
      medicineName: 'Metformin',
      reason,
      delta,
      previousStock: 10,
      resultingStock: 10 + delta,
      lowStockThreshold: 5,
      recordedAt: at.toISOString(),
    });
    const report = buildAdherenceReport({
      medicines: [med],
      doses: [],
      transactions: [
        tx('a', 'refill', 30, new Date(2026, 10, 18, 9)),
        tx('b', 'dose', -1, new Date(2026, 10, 18, 10)),
        tx('c', 'refill', 10, new Date(2026, 10, 17, 9)),
      ],
      range,
      now: new Date(2026, 10, 19),
    });
    expect(report.inventory).toMatchObject({ refillCount: 1, unitsAdded: 30, unitsUsed: 1 });
    expect(report.inventory.transactions.map((item) => item.id)).toEqual(['b', 'a']);
    expect(report.inventory.lowStock).toEqual([
      expect.objectContaining({ medicineName: 'Metformin', remaining: 3 }),
    ]);
  });
});

describe('PDF export HTML', () => {
  it('escapes user-entered text', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;',
    );
    const evil = medicine({ name: '<script>steal()</script>' });
    const report = buildAdherenceReport({
      medicines: [evil],
      doses: [],
      transactions: [],
      range: rangeFor('daily', new Date(2026, 10, 18)),
      now: new Date(2026, 10, 19),
    });
    const html = buildReportHtml(report, 'Pat <b>');
    expect(html).not.toContain('<script>steal');
    expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
    expect(html).toContain('Pat &lt;b&gt;');
  });

  it('renders empty sections without errors', () => {
    const report = buildAdherenceReport({
      medicines: [],
      doses: [],
      transactions: [],
      range: rangeFor('weekly', new Date(2026, 10, 18)),
      now: new Date(2026, 10, 19),
    });
    expect(buildReportHtml(report, 'Pat')).toContain('No missed doses');
  });
});

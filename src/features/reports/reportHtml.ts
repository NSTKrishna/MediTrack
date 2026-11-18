import {
  describeRange,
  formatPercent,
  type AdherenceReport,
} from '@/src/features/reports/reportLogic';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const cell = (value: string | number) => `<td>${escapeHtml(String(value))}</td>`;
const when = (date: Date) =>
  date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

/** Printable HTML for the PDF export. Every user-supplied value is escaped. */
export function buildReportHtml(report: AdherenceReport, patientName: string) {
  const { totals, inventory } = report;
  const medicineRows = report.byMedicine
    .map(
      (item) =>
        `<tr>${cell(item.medicineName)}${cell(item.scheduled)}${cell(item.taken)}${cell(item.skipped)}${cell(item.missed)}${cell(formatPercent(item.adherencePercent))}</tr>`,
    )
    .join('');
  const dayRows = report.byDay
    .filter((day) => day.scheduled > 0)
    .map(
      (day) =>
        `<tr>${cell(day.date)}${cell(day.scheduled)}${cell(day.taken)}${cell(day.skipped)}${cell(day.missed)}${cell(formatPercent(day.adherencePercent))}</tr>`,
    )
    .join('');
  const missedRows = report.missedDoses
    .slice(0, 100)
    .map((entry) => `<tr>${cell(entry.medicineName)}${cell(when(entry.scheduledFor))}</tr>`)
    .join('');
  const inventoryRows = inventory.transactions
    .slice(0, 200)
    .map(
      (item) =>
        `<tr>${cell(new Date(item.recordedAt).toLocaleString())}${cell(item.medicineName)}${cell(item.reason === 'refill' ? 'Refill' : 'Dose taken')}${cell(`${item.delta > 0 ? '+' : ''}${item.delta}`)}${cell(item.resultingStock)}</tr>`,
    )
    .join('');
  const empty = (columns: number, text: string) =>
    `<tr><td colspan="${columns}" class="empty">${text}</td></tr>`;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>MediTrack adherence report</title>
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #19324A; margin: 32px; }
  h1 { color: #1769AA; margin: 0 0 4px; font-size: 24px; }
  h2 { font-size: 16px; margin: 28px 0 8px; border-bottom: 2px solid #DCE4EB; padding-bottom: 4px; }
  .meta { color: #566A7D; margin: 0; font-size: 12px; }
  .stats { display: flex; gap: 12px; margin-top: 20px; }
  .stat { flex: 1; background: #F5F7FA; border-radius: 10px; padding: 12px; }
  .stat b { display: block; font-size: 22px; }
  .stat span { color: #566A7D; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #DCE4EB; }
  th { background: #F5F7FA; }
  .empty { color: #566A7D; font-style: italic; }
  footer { margin-top: 32px; color: #566A7D; font-size: 10px; }
</style></head>
<body>
  <h1>Medication adherence report</h1>
  <p class="meta">${escapeHtml(patientName)} · ${escapeHtml(describeRange(report.range))}</p>
  <p class="meta">Generated ${escapeHtml(report.generatedAt.toLocaleString())}</p>
  <div class="stats">
    <div class="stat"><span>Adherence</span><b>${formatPercent(totals.adherencePercent)}</b></div>
    <div class="stat"><span>Taken</span><b>${totals.taken}</b></div>
    <div class="stat"><span>Skipped</span><b>${totals.skipped}</b></div>
    <div class="stat"><span>Missed</span><b>${totals.missed}</b></div>
  </div>
  <h2>By medicine</h2>
  <table><thead><tr><th>Medicine</th><th>Scheduled</th><th>Taken</th><th>Skipped</th><th>Missed</th><th>Adherence</th></tr></thead>
  <tbody>${medicineRows || empty(6, 'No scheduled doses in this period.')}</tbody></table>
  <h2>By day</h2>
  <table><thead><tr><th>Date</th><th>Scheduled</th><th>Taken</th><th>Skipped</th><th>Missed</th><th>Adherence</th></tr></thead>
  <tbody>${dayRows || empty(6, 'No scheduled doses in this period.')}</tbody></table>
  <h2>Missed doses</h2>
  <table><thead><tr><th>Medicine</th><th>Scheduled for</th></tr></thead>
  <tbody>${missedRows || empty(2, 'No missed doses. ')}</tbody></table>
  <h2>Inventory history</h2>
  <p class="meta">${inventory.refillCount} refill(s), ${inventory.unitsAdded} dose(s) added, ${inventory.unitsUsed} dose(s) used.</p>
  <table><thead><tr><th>When</th><th>Medicine</th><th>Change</th><th>Amount</th><th>Stock after</th></tr></thead>
  <tbody>${inventoryRows || empty(5, 'No stock changes in this period.')}</tbody></table>
  <footer>Adherence = taken ÷ (taken + skipped + missed). A dose counts as missed when it is not confirmed within 2 hours. This report contains personal health information; share it only with people you trust.</footer>
</body></html>`;
}

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildReportHtml } from '@/src/features/reports/reportHtml';
import type { AdherenceReport } from '@/src/features/reports/reportLogic';

/** Renders the report to a PDF in the app's private cache and opens the share sheet. */
export async function exportReportPdf(report: AdherenceReport, patientName: string) {
  const { uri } = await Print.printToFileAsync({ html: buildReportHtml(report, patientName) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Share adherence report',
    });
  }
  return uri;
}

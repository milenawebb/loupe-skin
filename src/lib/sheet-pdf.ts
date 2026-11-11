import { renderSheetCanvas, PDF_PAGE, exportFilename, exportTitle } from "@/lib/sheet-export";
import type { ExportSheet } from "@/lib/sheet-export";
import { framePageUrl } from "@/lib/export-config";

export async function saveSheetPdf(sheet: ExportSheet, videoTitle: string | undefined, pageUrl: string, playbackId?: string) {
  const title = exportTitle(videoTitle, playbackId);
  const { canvas, links, footerWidth } = await renderSheetCanvas(sheet, title, pageUrl);
  // Load only after the sprite has passed canvas readback.
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true });
  pdf.setProperties({ title, subject: "Loupe contact sheet", creator: "Loupe" });
  pdf.viewerPreferences({ DisplayDocTitle: true });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, PDF_PAGE.width, PDF_PAGE.height);
  for (const { time, ...rectangle } of links) pdf.link(rectangle.x, rectangle.y, rectangle.width, rectangle.height, { url: framePageUrl(pageUrl, time) });
  pdf.link(36, 746, footerWidth, 12, { url: pageUrl });
  pdf.save(exportFilename(videoTitle, playbackId));
}
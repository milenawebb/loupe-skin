import { exportFilename, type ExportSheet } from "@/lib/sheet-export";
export function togglePick(picks: ReadonlySet<number>, index: number) {
  const next = new Set(picks);
  if (next.has(index)) next.delete(index); else next.add(index);
  return next;
}
export function pickedFrames(sheet: ExportSheet, picks: ReadonlySet<number>) {
  return sheet.tiles.map((tile, index) => ({ ...tile, index })).filter(tile => picks.has(tile.index)).sort((a, b) => a.start - b.start);
}
export function picksGrid(ratio: number, count: number) {
  const columns = ratio >= 1 ? count <= 2 ? 1 : count <= 8 ? 2 : 3 : count <= 3 ? Math.max(1, count) : count <= 8 ? 4 : 5;
  const imageWidth = Math.min((540 - (columns - 1) * 10) / columns, (654 - 16) * ratio);
  const imageHeight = imageWidth / ratio;
  const cellHeight = imageHeight + 16;
  const rowsPerPage = Math.max(1, Math.floor((654 + 10) / (cellHeight + 10)));
  return { columns, imageWidth, imageHeight, cellHeight, rowsPerPage, perPage: columns * rowsPerPage, thumbnailWidth: Math.ceil(imageWidth * 3) };
}
export function picksFilename(title?: string, playbackId?: string) {

  return exportFilename(title, playbackId).replace(/\.pdf$/, "-picks.pdf");
}
export const SHEET_FOLLOW_PAUSE_MS = 5000;
export const SHEET_WHEEL_IDLE_MS = 400;
export function sheetWheelCanMove(row: number, rows: number, delta: number) {
  return delta < 0 ? row > 0 : delta > 0 && row < Math.max(0, rows - 3);
}
export function sheetWheelIntent(now: number, lastOutsideWheel: number, owned: boolean) {
  return owned || now - lastOutsideWheel >= SHEET_WHEEL_IDLE_MS;
}
export function clampSheetRow(row: number, rows: number) {
  return Math.max(0, Math.min(Math.max(0, rows - 3), Math.round(row)));
}
export function threeRowHeight(rowHeight: number, gap = 4, padding = 12) {
  return rowHeight * 3 + gap * 2 + padding * 2;
}
export function visibleRowScroll(row: number, currentScroll: number, rowStride: number) {
  const first = Math.round(currentScroll / rowStride);
  return row < first ? row * rowStride : row > first + 2 ? (row - 2) * rowStride : currentScroll;
}
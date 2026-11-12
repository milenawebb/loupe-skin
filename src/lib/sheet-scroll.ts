export const SHEET_FOLLOW_PAUSE_MS = 5000;
export const SHEET_WHEEL_IDLE_MS = 400;
export const SHEET_WHEEL_THRESHOLD_PX = 50;
export const SHEET_WHEEL_COOLDOWN_MS = 200;
export const SHEET_WHEEL_GESTURE_IDLE_MS = 150;
export const SHEET_WHEEL_ANIMATION_MS = 160;

export function accumulateSheetWheel(
  state: { total: number; direction: number; cooldownUntil: number },
  delta: number,
  deltaMode: number,
  now: number,
  lastWheel: number,
) {
  const direction = Math.sign(delta);
  if (!direction) return { ...state, move: 0 };
  if (now < state.cooldownUntil) return { ...state, total: 0, move: 0 };
  const pixels = delta * (deltaMode === 1 ? 16 : 1);
  const total = (now - lastWheel > SHEET_WHEEL_GESTURE_IDLE_MS || direction !== state.direction ? 0 : state.total) + pixels;
  if (Math.abs(total) >= SHEET_WHEEL_THRESHOLD_PX) {
    return { total: 0, direction, cooldownUntil: now + SHEET_WHEEL_COOLDOWN_MS, move: direction };
  }
  return { total, direction, cooldownUntil: state.cooldownUntil, move: 0 };
}

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
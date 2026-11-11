import { TILE_TIME_TOLERANCE } from "@/lib/sheet-seek";

export function frameAtTime(tiles: readonly { start: number }[], time: number) {
  let index = 0;
  for (let i = 0; i < tiles.length; i++) if ((tiles[i]?.start ?? Infinity) <= time + TILE_TIME_TOLERANCE) index = i;
  return index;
}

type Rect = { left: number; top: number; width: number; height: number };

/** Sheet touch input is a tap only within an inclusive 8px movement radius. */
export function sheetTouchIsTap(dx: number, dy: number) {
  return Math.hypot(dx, dy) <= 8;
}

/** Decide once after an 8px dead zone; vertical gestures belong to the browser. */
export function sheetGestureDirection(dx: number, dy: number) {
  if (Math.hypot(dx, dy) < 8) return "pending";
  return Math.abs(dx) > Math.abs(dy) ? "scrub" : "scroll";
}

/** Only seek actual tile faces, not gutters, rebates or timestamps. */
export function frameUnderPointer(frames: readonly { index: number; rect: Rect }[], x: number, y: number) {
  return frames.find(({ rect }) => x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height)?.index;
}
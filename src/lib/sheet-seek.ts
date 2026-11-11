export const SHEET_SEEK_LOADING_DELAY = 1500;
export const SHEET_SEEK_FADE_DURATION = 180;
export const TILE_SEEK_OFFSET = 0.05;
export const TILE_TIME_TOLERANCE = 0.1;
/** Stay inside this tile and the media duration, including very short final tiles. */
export function tileSeekTime(tiles: readonly { start: number }[], index: number, duration: number) {
  const start = tiles[index]?.start ?? 0;
  const end = Math.min(tiles[index + 1]?.start ?? duration, duration);
  return Math.max(0, Math.min(start + TILE_SEEK_OFFSET, Math.max(0, end - 0.001)));
}
export function seekApproximate(video: Pick<HTMLVideoElement, "currentTime"> & { fastSeek?: (time: number) => void }, time: number) {
  // fastSeek may snap to an earlier keyframe; frame jumps require precise seeking.
  video.currentTime = time;
}
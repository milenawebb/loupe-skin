export const SHEET_SEEK_LOADING_DELAY = 1500;
export const SHEET_SEEK_FADE_DURATION = 180;
export function seekApproximate(video: Pick<HTMLVideoElement, "currentTime"> & { fastSeek?: (time: number) => void }, time: number) {
  if (typeof video.fastSeek === "function") video.fastSeek(time);
  else video.currentTime = time;
}
export function isVideoTap(distance: number, elapsed: number) {
  return distance < 10 && elapsed < 300;
}
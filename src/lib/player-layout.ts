/** All sources use one measured-width sheet; strip tiles retain a 44px minimum. */
export const SHEET_GAP = 4;
export function frameThickness(playerWidth: number) {
  return Math.max(8, Math.min(14, playerWidth * 0.008));
}
/** Solve content + both borders against the container without a resize loop. */
export function playerFrameMetrics(ratio: number, heightLimit: number, containerWidth: number) {
  const containerContent = containerWidth <= 1016 ? containerWidth - 16
    : containerWidth <= 1778 ? containerWidth / 1.016 : containerWidth - 28;
  const width = Math.max(0, Math.min(ratio * heightLimit, containerContent));
  return { width, thickness: frameThickness(width) };
}
export function contactSheetTileWidth(contentWidth: number, playerWidth = contentWidth) {
  const columns = sheetColumns(contentWidth, 0, playerWidth);
  return Math.max(0, (contentWidth - (columns - 1) * SHEET_GAP) / columns);
}
export function stripTileWidth(contentWidth: number) {
  return Math.max(44, Math.min(64, (contentWidth - SHEET_GAP) / 2));
}
export function validAspectRatio(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
/** Metadata wins over storyboard JSON, which confirms the host's initial ratio. */
export function resolveAspectRatio(declared?: number, storyboard?: number | null, metadata?: number | null) {
  return validAspectRatio(metadata) ?? validAspectRatio(storyboard) ?? validAspectRatio(declared);
}
/** Picture dimensions come from intrinsic metadata, never the media element's box. */
export function playerVideoMetrics(videoWidth: number, videoHeight: number, viewportHeight: number, availableHeight: number) {
  const validSource = [videoWidth, videoHeight].every((value) => Number.isFinite(value) && value > 0);
  return {
    ratio: validSource ? videoWidth / videoHeight : null,
    heightLimit: Math.min(viewportHeight * 0.7, availableHeight),
  };
}
export function playerWidthLimit(videoWidth: number, videoHeight: number, viewportHeight: number, availableHeight: number, containerWidth: number) {
  if (![viewportHeight, availableHeight, containerWidth].every((value) => Number.isFinite(value) && value > 0)) return "100%";
  const metrics = playerVideoMetrics(videoWidth, videoHeight, viewportHeight, availableHeight);
  if (metrics.ratio === null) return "0px";
  const renderedWidth = metrics.heightLimit * metrics.ratio;
  return `${Math.min(renderedWidth, containerWidth)}px`;
}
export function sheetColumns(contentWidth: number, padding = 0, playerWidth = contentWidth) {
  if (playerWidth < 640) return 4;
  return Math.max(3, Math.min(10, Math.floor((contentWidth - padding) / 110)));
}
/** Common display ratios; storyboard tiles are rounded, so near matches snap to these. */
export const STANDARD_ASPECT_RATIOS = [16 / 9, 4 / 3, 9 / 16, 3 / 4, 1, 2.39, 2.35, 21 / 9] as const;
/** Snap a storyboard-derived ratio within 1% of a standard ratio; otherwise keep it. */
export function snapAspectRatio(ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return ratio;
  let best: number | null = null;
  for (const standard of STANDARD_ASPECT_RATIOS) {
    const off = Math.abs(ratio - standard) / standard;
    if (off <= 0.01 && (best === null || off < Math.abs(ratio - best) / best)) best = standard;
  }
  return best ?? ratio;
}

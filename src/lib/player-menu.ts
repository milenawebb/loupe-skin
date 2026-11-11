export function playerMenuLayout(anchor: { left: number; right: number; top: number; bottom: number }, bounds: { width: number; height: number }, height: number, width: number) {
  const above = Math.max(0, anchor.top);
  const below = Math.max(0, bounds.height - anchor.bottom);
  const downward = above < height && below >= height;
  // When neither side fits, retain all rows in a bounded, internally scrolling menu.
  const maxHeight = Math.min(height, bounds.height);
  const top = downward ? anchor.bottom : Math.max(0, anchor.top - maxHeight);
  return { left: Math.max(0, Math.min(anchor.right - width, bounds.width - width)), top: Math.min(top, Math.max(0, bounds.height - maxHeight)), maxHeight, side: downward ? "below" : "above" };
}

/** Video-only bounds, excluding both the control panel and the expanded sheet. */
export function playerVideoMenuLayout(video: { left: number; top: number; width: number; height: number }, controlTop: number, anchorRight: number, width: number) {
  const maxHeight = Math.max(0, Math.min(video.top + video.height, controlTop) - video.top);
  const resolvedWidth = Math.min(width, video.width);
  return { left: Math.max(video.left, Math.min(anchorRight - resolvedWidth, video.left + video.width - resolvedWidth)), top: video.top, maxHeight, width: resolvedWidth };
}

type VideoBounds = { left: number; top: number; width: number; height: number };
/** Options change shape at the player's own 640px breakpoint. */
export function playerOptionsLayout(video: VideoBounds, controlTop: number, anchorCenter: number, count: number, preferredWidth: number) {
  const chips = video.width < 640;
  const bottom = Math.min(video.top + video.height, controlTop);
  const available = Math.max(0, bottom - video.top);
  const height = Math.min(available, (chips ? 44 : count * 40) + 18);
  const width = chips ? video.width : Math.min(video.width, preferredWidth);
  return { chips, width, height, top: bottom - height, left: chips ? video.left : Math.max(video.left, Math.min(anchorCenter - width / 2, video.left + video.width - width)) };
}

export function playerKeysLayout(video: VideoBounds, controlTop: number) {
  const bottom = Math.min(video.top + video.height, controlTop);
  const height = Math.min(242, Math.max(0, bottom - video.top));
  const narrow = video.width < 640;
  const width = narrow ? video.width : Math.min(video.width, 560);
  return { columns: 2, width, height, left: video.left + video.width - width, top: bottom - height };
}

export function playerVolumeLayout(video: VideoBounds, controlTop: number, anchorCenter: number) {
  const bottom = Math.min(video.top + video.height, controlTop);
  const height = Math.min(118, Math.max(0, bottom - video.top));
  const width = Math.min(44, video.width);
  return { width, height, top: bottom - height, left: Math.max(video.left, Math.min(anchorCenter - width / 2, video.left + video.width - width)) };
}
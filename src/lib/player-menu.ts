export function playerMenuLayout(anchor: { left: number; right: number; top: number; bottom: number }, bounds: { width: number; height: number }, height: number, width: number) {
  const above = Math.max(0, anchor.top);
  const below = Math.max(0, bounds.height - anchor.bottom);
  const downward = above < height && below >= height;
  // When neither side fits, retain all rows in a bounded, internally scrolling menu.
  const maxHeight = Math.min(height, bounds.height);
  const top = downward ? anchor.bottom : Math.max(0, anchor.top - maxHeight);
  return { left: Math.max(0, Math.min(anchor.right - width, bounds.width - width)), top: Math.min(top, Math.max(0, bounds.height - maxHeight)), maxHeight, side: downward ? "below" : "above" };
}
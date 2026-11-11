export const VOLUME_CLOSE_DELAY = 400;
export const TOUCH_PRIMARY_QUERY = "(hover: none) and (pointer: coarse)";
export function volumePanelSide(anchorTop: number, playerTop: number) {
  return anchorTop - playerTop >= 100 ? "above" : "below";
}
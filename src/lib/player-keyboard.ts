export type Shortcut = { action: "play" | "mute" | "fullscreen" | "captions" | "sheet" | "close" | "help" } | { action: "seek" | "volume" | "percent"; value: number };

export function readingDirectionKey(key: string, rtl = false) {
  return rtl && key === "ArrowLeft" ? "ArrowRight" : rtl && key === "ArrowRight" ? "ArrowLeft" : key;
}
export function frameAccessibleName(index: number, time: number) {
  const seconds = Math.max(0, Math.floor(time));
  return `Frame ${index + 1}, ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`;
}
export function playerShortcut(key: string, rtl = false): Shortcut | undefined {
  key = readingDirectionKey(key, rtl);
  const normalized = key.toLowerCase();
  const commands = { " ": "play", k: "play", m: "mute", f: "fullscreen", c: "captions", s: "sheet", escape: "close", "?": "help" } as const;
  if (normalized in commands) return { action: commands[normalized as keyof typeof commands] };
  if (/^[0-9]$/.test(key)) return { action: "percent", value: Number(key) / 10 };
  if (key === "Home" || key === "End") return { action: "percent", value: key === "Home" ? 0 : 1 };
  if (key === "ArrowUp" || key === "ArrowDown") return { action: "volume", value: key === "ArrowUp" ? 0.1 : -0.1 };
  const steps: Record<string, number> = { ArrowLeft: -5, ArrowRight: 5, j: -10, l: 10 };
  const value = steps[key] ?? steps[normalized];
  return value === undefined ? undefined : { action: "seek", value };
}

export function gridDestination(index: number, key: string, columns: number, count: number, rtl = false) {
  key = readingDirectionKey(key, rtl);
  if (key === "ArrowLeft") return Math.max(0, index - 1);
  if (key === "ArrowRight") return Math.min(count - 1, index + 1);
  if (key === "ArrowUp") return Math.max(0, index - columns);
  if (key === "ArrowDown") return Math.min(count - 1, index + columns);
  return index;
}

export const SHORTCUT_GROUPS = [{ label: "PLAYER", shortcuts: [
  ["Space", "Play or pause"], ["← →", "Seek 5s"],
  ["↑ ↓", "Volume"], ["M", "Mute"],
  ["F", "Fullscreen"], ["C", "Captions"],
  ["S", "Contact sheet"],
] }, { label: "IN THE CONTACT SHEET", shortcuts: [
  ["← → ↑ ↓", "Move between frames"], ["Enter", "Jump to frame"],
  ["X", "Mark frame"], ["Esc", "Close"],
] }] as const;
export const SHORTCUT_LIST = SHORTCUT_GROUPS.flatMap<readonly [string, string]>(group => group.shortcuts);

export function sheetKeyboardCommand(key: string) {
  if (key.toLowerCase() === "x") return "mark";
  if (key === "Enter" || key === " ") return "seek";
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) return "move";
  return undefined;
}
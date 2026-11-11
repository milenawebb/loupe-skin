export type PlayerTheme = "light" | "dark";

export function relativeLuminance(red: number, green: number, blue: number) {
  const linear = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
}

function colorChannels(color: string): number[] | null {
  if (!color || color === "transparent") return [0, 0, 0, 0];
  const rgb = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgb?.[1]) {
    const values = rgb[1].split(/[\s,/]+/).map(Number);
    return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1];
  }
  // Computed styles may retain oklch(), color(), etc. Let the browser convert to sRGB.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  return [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0, (pixel[3] ?? 0) / 255];
}

export function detectPlayerTheme(parent: HTMLElement | null, override?: PlayerTheme): PlayerTheme {
  if (override) return override;
  let ancestor = parent;
  while (ancestor) {
    const channels = colorChannels(getComputedStyle(ancestor).backgroundColor);
    if (channels && (channels[3] ?? 0) >= 1) {
      return relativeLuminance(channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0) > 0.5 ? "light" : "dark";
    }
    ancestor = ancestor.parentElement;
  }
  return "dark";
}
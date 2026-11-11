import { tileSeekTime } from "@/lib/sheet-seek";

export type ExportSheet = {
  url: string; tile_width: number; tile_height: number; duration: number;
  tiles: { start: number; x: number; y: number }[];
};

export const PDF_THEME = { background: "#08090A", text: "#E8EBED", dim: "#6B7580" };
export const PDF_PAGE = { width: 612, height: 792, margin: 36 };

export function exportTitle(title?: string, playbackId?: string) {
  return title?.trim() || playbackId?.trim() || "video";
}

export function exportFilename(title?: string, playbackId?: string) {
  const slug = (value: string) => value.toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^-+|-+$/g, "");
  const trim = (value: string) => value.length <= 50 ? value : (value.slice(0, 51).includes("-") ? value.slice(0, 51).replace(/-[^-]*$/, "") : value.slice(0, 50));
  return `${trim(slug(title ?? "")) || trim(slug(playbackId ?? "")) || "video"}-contact-sheet.pdf`;
}

export function exportTimestamp(time: number, duration: number) {
  const seconds = Math.max(0, duration < 60 ? Math.floor(time * 10 + 1e-6) / 10 : Math.floor(time));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(duration < 60 ? 1 : 0).padStart(duration < 60 ? 4 : 2, "0")}`;
}

export function exportGrid(count: number, ratio: number, labelPairWidth = 34) {
  const width = PDF_PAGE.width - PDF_PAGE.margin * 2;
  const height = 650;
  const columnGap = 10;
  const rowGap = 4;
  // Fill the entire header-to-footer region without distorting the source.
  const candidates = Array.from({ length: Math.min(count, 20) }, (_, i) => i + 1);
  const layout = (columns: number) => {
    const rows = Math.ceil(count / columns);
    let labelHeight = 12;
    let imageHeight = (height - (rows - 1) * rowGap) / rows - labelHeight;
    if (imageHeight * ratio < labelPairWidth) {
      labelHeight = 20;
      imageHeight = (height - (rows - 1) * rowGap) / rows - labelHeight;
    }
    const cellWidth = imageHeight * ratio;
    const fits = imageHeight > 0 && columns * cellWidth + (columns - 1) * columnGap <= width;
    return { columns, rows, imageHeight, imageWidth: cellWidth, cellWidth, cellHeight: imageHeight + labelHeight,
      stackedLabels: labelHeight === 20, columnGap, rowGap,
      left: PDF_PAGE.margin + (width - columns * cellWidth - (columns - 1) * columnGap) / 2,
      area: fits ? imageHeight * cellWidth : -1 };
  };
  return candidates.map(layout).reduce((best, candidate) => candidate.area > best.area ? candidate : best, layout(1));
}

/** This must succeed (including readback) before any PDF library is loaded. */
export async function renderSheetCanvas(sheet: ExportSheet, title: string, pageUrl: string, generated = new Date()) {
  const sprite = new Image();
  sprite.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    sprite.onload = () => resolve();
    sprite.onerror = () => reject(new Error(`Cannot load Mux storyboard with CORS: ${sheet.url}`));
    sprite.src = sheet.url;
  });
  const fonts = await document.fonts.load('12px "JetBrains Mono"');
  if (fonts.length === 0) throw new Error("JetBrains Mono is unavailable for PDF export");
  const logo = new Image();
  await new Promise<void>((resolve, reject) => {
    logo.onload = () => resolve();
    logo.onerror = () => reject(new Error("Cannot load Loupe wordmark"));
    logo.src = "/loupe-logo.png";
  });
  // Crop out the tagline; use only the original wordmark's alpha, never its gradient.
  const wordmark = document.createElement("canvas");
  wordmark.width = 1086;
  wordmark.height = 412;
  const logoCtx = wordmark.getContext("2d");
  if (!logoCtx) throw new Error("Wordmark rendering is unavailable");
  logoCtx.drawImage(logo, 29, 69, 1086, 412, 0, 0, 1086, 412);
  logoCtx.globalCompositeOperation = "source-in";
  logoCtx.fillStyle = PDF_THEME.text;
  logoCtx.fillRect(0, 0, 1086, 412);
  const canvas = document.createElement("canvas");
  canvas.width = PDF_PAGE.width * 3;
  canvas.height = PDF_PAGE.height * 3;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is unavailable");
  ctx.scale(3, 3);
  ctx.fillStyle = PDF_THEME.background;
  ctx.fillRect(0, 0, PDF_PAGE.width, PDF_PAGE.height);
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillStyle = PDF_THEME.text;
  ctx.drawImage(wordmark, 36, 34, 90, 90 * 412 / 1086);
  // Keep long host titles on the page without clipping.
  ctx.fillText(title, 140, 49, 436);
  ctx.font = '8px "JetBrains Mono", monospace';
  ctx.fillStyle = PDF_THEME.dim;
  ctx.fillText(`${exportTimestamp(sheet.duration, sheet.duration)}  ·  ${sheet.tiles.length} frames  ·  ${generated.toISOString().slice(0, 10)}`, 140, 66, 436);
  ctx.font = '6px "JetBrains Mono", monospace';
  const labelPairWidth = Math.max(...sheet.tiles.map((tile, index) =>
    ctx.measureText(String(index + 1).padStart(2, "0")).width + 4 + ctx.measureText(exportTimestamp(tile.start, sheet.duration)).width));
  const grid = exportGrid(sheet.tiles.length, sheet.tile_width / sheet.tile_height, labelPairWidth);
  const links = sheet.tiles.map((tile, index) => {
    const x = grid.left + (index % grid.columns) * (grid.cellWidth + grid.columnGap);
    const y = 86 + Math.floor(index / grid.columns) * (grid.cellHeight + grid.rowGap);
    const imageX = x + (grid.cellWidth - grid.imageWidth) / 2;
    ctx.drawImage(sprite, tile.x, tile.y, sheet.tile_width, sheet.tile_height, imageX, y, grid.imageWidth, grid.imageHeight);
    ctx.font = '6px "JetBrains Mono", monospace';
    ctx.fillStyle = PDF_THEME.dim;
    ctx.textAlign = "left";
    ctx.fillText(String(index + 1).padStart(2, "0"), x, y + grid.imageHeight + 8);
    ctx.textAlign = grid.stackedLabels ? "left" : "right";
    ctx.fillText(exportTimestamp(tile.start, sheet.duration), grid.stackedLabels ? x : x + grid.cellWidth, y + grid.imageHeight + (grid.stackedLabels ? 16 : 8));
    return { x, y, width: grid.cellWidth, height: grid.cellHeight, time: tileSeekTime(sheet.tiles, index, sheet.duration) };
  });
  ctx.font = '7px "JetBrains Mono", monospace';
  ctx.fillStyle = PDF_THEME.dim;
  ctx.textAlign = "left";
  const credit = "Generated by Loupe";
  const footerWidth = 540 - ctx.measureText(credit).width - 16;
  ctx.fillText(pageUrl, 36, 755, footerWidth);
  ctx.textAlign = "right";
  ctx.fillText(credit, 576, 755);
  // A tainted sprite throws here. Never conceal that failure inside a PDF.
  ctx.getImageData(0, 0, 1, 1);
  return { canvas, links, footerWidth };
}
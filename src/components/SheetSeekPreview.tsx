export function SheetSeekPreview({ sheet, index, resolving, loading }: {
  sheet: { url: string; tile_width: number; tile_height: number; spriteW: number; spriteH: number; tiles: readonly { x: number; y: number }[] };
  index: number; resolving: boolean; loading: boolean;
}) {
  const tile = sheet.tiles[index];
  if (!tile) return null;
  return <div className="ps-seek-preview" data-resolving={resolving ? "" : undefined} data-frame={index} aria-hidden="true">
    <svg className="ps-seek-preview-image" viewBox={`${tile.x} ${tile.y} ${sheet.tile_width} ${sheet.tile_height}`} preserveAspectRatio="xMidYMid meet">
      <image href={sheet.url} width={sheet.spriteW} height={sheet.spriteH} />
    </svg>
    <span className="ps-seek-loading ps-mono" data-visible={loading ? "" : undefined}>LOADING</span>
  </div>;
}
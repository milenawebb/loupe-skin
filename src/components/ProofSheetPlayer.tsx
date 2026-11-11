import {
  Container,
  createPlayer,
  FullscreenButton,
  PlayButton,
  Time,
  TimeSlider,
} from "@videojs/react";
import { videoFeatures } from "@videojs/react/video";
import { MuxVideo } from "@videojs/react/media/mux-video";
import { useEffect, useLayoutEffect, useRef, useState, useId } from "react";
import { playerMenuLayout } from "@/lib/player-menu";
import { playerFrameMetrics, playerVideoMetrics, snapAspectRatio, resolveAspectRatio, contactSheetTileWidth, stripTileWidth, sheetColumns } from "@/lib/player-layout";
import { detectPlayerTheme } from "@/lib/player-theme";
import type { PlayerTheme } from "@/lib/player-theme";
import { revealOffset, useSheetChrome } from "@/hooks/use-sheet-chrome";
import { Button } from "@/components/ui/button";
import { useSheetTransition } from "@/hooks/use-sheet-transition";
import { frameAtTime, frameUnderPointer, sheetGestureDirection } from "@/lib/sheet-interactions";
import type { RefObject } from "react";
import { InstrumentPlay, TrackAndSpeedControls, VolumeControl } from "@/components/PlayerExtras";
import { fullChromeVisible, hasCaptionTracks, durationKnown, resetEndedRate } from "@/lib/playback-controls";
import { gridDestination, playerShortcut, frameAccessibleName, SHORTCUT_LIST } from "@/lib/player-keyboard";
import { SheetExpansion } from "@/components/SheetExpansion";
import { useCaptionCues } from "@/hooks/use-caption-cues";
import { PlayerTooltip } from "@/components/PlayerTooltip";
import { captionPlaybackSource, captionTrackAllowed, LOCAL_CAPTION_ID } from "@/lib/player-captions";
import { useLocalCaptions } from "@/hooks/use-local-captions";
import { useMenuSurface } from "@/hooks/use-menu-surface";
import { useSheetSeek } from "@/hooks/use-sheet-seek";
import { SheetSeekPreview } from "@/components/SheetSeekPreview";
import { useVideoTap } from "@/hooks/use-video-tap";
import { usePlayerWidth } from "@/hooks/use-player-width";
import { SaveSheetButton } from "@/components/SaveSheetButton";
import { useStartTime } from "@/hooks/use-start-time";
import { exportTitle } from "@/lib/sheet-export";
import { PlayIcon, PauseIcon, FullscreenIcon, GridIcon, CloseIcon } from "@/components/PlayerIcons";

/**
 * THE VIDEO THIS PLAYER SHOWS.
 *
 * Pass any Mux playback ID through the `playbackId` prop. There is no
 * built-in fallback video: without a playback ID the player renders
 * nothing and logs an error, so a missing prop can never silently ship
 * someone else's footage.
 */

/** Storyboard (thumbnail sheet) Mux generates for a given playback ID. */
function storyboardUrl(playbackId: string) {
  return `https://image.mux.com/${playbackId}/storyboard.json`;
}

/**
 * Which video to show: the trimmed prop when it has text, otherwise
 * undefined. Empty, whitespace-only and missing all mean "no video".
 */
export function resolvePlaybackId(override?: string) {
  return override?.trim() || undefined;
}

// The player context shared by the skin below.
const { Player, usePlayer } = createPlayer({ features: videoFeatures });

type Tile = { start: number; x: number; y: number };
type Storyboard = {
  url: string;
  tile_width: number;
  tile_height: number;
  duration: number;
  tiles: Tile[];
};
type Sheet = Storyboard & { spriteW: number; spriteH: number };

function fmtTile(t: number, duration: number) {
  if (duration >= 60) return fmt(t);
  const tenths = Math.max(0, Math.floor(t * 10 + 1e-6));
  const m = Math.floor(tenths / 600);
  const sec = (tenths % 600) / 10;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
}

function fmt(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function useStoryboard(playbackId: string) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    // Drop the previous video's frames so a stale strip is never shown.
    setSheet(null);
    setRatio(null);
    fetch(storyboardUrl(playbackId))
      .then((r) => {
        if (!r.ok) throw new Error("storyboard");
        return r.json() as Promise<Storyboard>;
      })
      .then(
        (data) => {
          // Resolve geometry from the small JSON, without waiting for the sprite.
          if (alive) { const tileRatio = playerVideoMetrics(data.tile_width, data.tile_height, 1, 1).ratio; setRatio(tileRatio === null ? null : snapAspectRatio(tileRatio)); }
          return new Promise<Sheet>((resolve, reject) => {
            if (!data?.url || !data.tiles?.length) return reject(new Error("empty"));
            const img = new Image();
            img.onload = () =>
              resolve({ ...data, spriteW: img.naturalWidth, spriteH: img.naturalHeight });
            img.onerror = reject;
            img.src = data.url;
          });
        },
      )
      .then((s) => alive && setSheet(s))
      // No storyboard for this ID: stay null and render the plain player.
      .catch(() => alive && setSheet(null));
    return () => {
      alive = false;
    };
  }, [playbackId]);
  return { sheet, ratio };
}

function FocusFrame() {
  return <span className="ps-focus-frame" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function TileFace({ sheet, tile, width }: { sheet: Sheet; tile: Tile; width: number }) {
  const scale = width / sheet.tile_width;
  return (
    <span
      aria-hidden
      className="block"
      style={{
        width,
        aspectRatio: `${sheet.tile_width} / ${sheet.tile_height}`,
        backgroundImage: `url(${sheet.url})`,
        backgroundSize: `${sheet.spriteW * scale}px ${sheet.spriteH * scale}px`,
        backgroundPosition: `${-(tile.x * scale)}px ${-(tile.y * scale)}px`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

function Strip({ sheet, open, onOpen, idx, onSeek }: { sheet: Sheet; open: boolean; onOpen: () => void; idx: number; onSeek: (index: number) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tileW, setTileW] = useState(64);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setTileW(stripTileWidth(el.clientWidth - 16));
    const observer = new ResizeObserver(measure);
    observer.observe(el); measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = refs.current[idx];
    const sc = scroller.current;
    if (!el || !sc) return;
    const tile = el.getBoundingClientRect();
    const view = sc.getBoundingClientRect();
    sc.scrollLeft = revealOffset(tile.left - view.left + sc.scrollLeft, tile.width, sc.scrollLeft, sc.clientWidth);
  }, [idx, tileW]);

  return (
    <div className="ps-strip ps-rule-t flex items-stretch">
      <div ref={scroller} className="ps-strip-scroll ps-noscroll flex flex-1 cursor-zoom-in gap-1 overflow-x-auto p-2"
        onClick={(e) => e.target === e.currentTarget && onOpen()}
      >
        {sheet.tiles.map((tile, i) => (
          <Button variant="player"
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            aria-label={frameAccessibleName(i, tile.start)}
            aria-current={i === idx ? "true" : undefined}
            onClick={() => onSeek(i)}
            className="ps-tile shrink-0"
          >
            <TileFace sheet={sheet} tile={tile} width={tileW} />
            <FocusFrame />
          </Button>
        ))}
      </div>
      <Button variant="player" className="ps-strip-open" aria-label="Contact sheet" aria-expanded={open} onClick={onOpen}>
        <GridIcon /><span>Contact sheet</span>
      </Button>
    </div>
  );
}

function ContactSheet({ sheet, title, playbackId, open, onClose, idx, onSeek, onHold, onCancelHold, sheetRef, dragging }: {
  title: string;
  playbackId: string;
  open: boolean;
  sheet: Sheet; onClose: () => void; idx: number; onSeek: (index: number) => void;
  onHold: (index: number) => void; onCancelHold: () => void;
  sheetRef: RefObject<HTMLDivElement | null>; dragging: RefObject<boolean>;
}) {
  const gridId = useId();
  const [connector, setConnector] = useState<{ x: number; y: number; endX: number; endY: number } | null>(null);
  const lastPassed = useRef<number | null>(null);
  const pointerId = useRef<number | null>(null);
  const pressPosition = useRef({ x: 0, y: 0 });
  const gesture = useRef<"pending" | "scrub" | "scroll">("pending");
  // Tile rects are measured once per drag (and after scrolling), never per move.
  const frameCache = useRef<{ frames: { index: number; rect: DOMRect }[]; host: DOMRect } | null>(null);
  const measureFrames = () => {
    const host = sheetRef.current;
    if (!host) return null;
    frameCache.current = {
      host: host.getBoundingClientRect(),
      frames: Array.from(host.querySelectorAll<HTMLElement>("[data-frame]")).map((tile) => ({
        index: Number(tile.dataset["frame"]), rect: (tile.querySelector(".ps-tile") ?? tile).getBoundingClientRect(),
      })),
    };
    return frameCache.current;
  };
  /** Follow the pointer: active tile, preview overlay and connector. Never seeks. */
  const scrub = (x: number, y: number) => {
    const cache = frameCache.current ?? measureFrames();
    if (!cache) return;
    const { frames, host: rect } = cache;
    const hit = frameUnderPointer(frames, x, y);
    if (hit !== undefined && hit !== lastPassed.current) {
      lastPassed.current = hit;
      setFocused(hit);
      gridRef.current?.focus({ preventScroll: true });
      onHold(hit);
    }
    const target = frames.find((frame) => frame.index === (lastPassed.current ?? idx));
    if (target) setConnector({ x: x - rect.left, y: y - rect.top,
      endX: target.rect.left + target.rect.width / 2 - rect.left,
      endY: target.rect.top + target.rect.height / 2 - rect.top });
  };
  const finishDrag = () => { dragging.current = false; pointerId.current = null; gesture.current = "pending"; frameCache.current = null; setConnector(null); };
  /** Pointer left the sheet or the gesture was interrupted: no seek, restore playback's tile. */
  const cancelDrag = () => {
    if (pointerId.current === null) return;
    const held = lastPassed.current;
    lastPassed.current = null;
    finishDrag();
    if (held !== null) { onCancelHold(); setFocused(idx); }
  };
  const outsideSheet = (x: number, y: number) => {
    const r = frameCache.current?.host ?? sheetRef.current?.getBoundingClientRect();
    return !r || x < r.left || x > r.right || y < r.top || y > r.bottom;
  };
  const gridRef = useRef<HTMLDivElement>(null);
  const [tileW, setTileW] = useState(90);
  const [columns, setColumns] = useState(3);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [focused, setFocused] = useState(idx);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      // Grid width is the player's width minus sheet padding and scrollbar.
      const w = el.getBoundingClientRect().width;
      const playerWidth = el.closest(".ps-player")?.getBoundingClientRect().width ?? w;
      setColumns(sheetColumns(w, 0, playerWidth));
      setTileW(contactSheetTileWidth(w, playerWidth));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const player = el.closest(".ps-player");
    if (player) ro.observe(player);
    window.addEventListener("resize", measure);
    measure();
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const tile = refs.current[idx];
    const scroller = gridRef.current?.parentElement;
    if (tile && scroller) scroller.scrollTop = tile.offsetTop - scroller.offsetTop - scroller.clientHeight / 2 + tile.clientHeight / 2;
    setFocused(idx);
    gridRef.current?.focus({ preventScroll: true });
    // only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);


  return (
    <div ref={sheetRef} className="ps-contact ps-rule-t"
      onPointerDown={(e) => {
        if (e.button !== 0 || !(e.target instanceof Element) || !e.target.closest("[data-frame]")) return;
        pointerId.current = e.pointerId;
        dragging.current = false;
        gesture.current = e.pointerType === "touch" ? "pending" : "scrub";
        pressPosition.current = { x: e.clientX, y: e.clientY };
        lastPassed.current = null;
        if (e.pointerType !== "touch") {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          scrub(e.clientX, e.clientY);
        }
      }}
      onPointerMove={(e) => {
        if (pointerId.current !== e.pointerId) return;
        if (gesture.current === "pending") {
          gesture.current = sheetGestureDirection(e.clientX - pressPosition.current.x, e.clientY - pressPosition.current.y);
          if (gesture.current === "pending") return;
          if (gesture.current === "scroll") { cancelDrag(); return; }
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        e.preventDefault();
        if (outsideSheet(e.clientX, e.clientY)) { cancelDrag(); return; }
        if (Math.hypot(e.clientX - pressPosition.current.x, e.clientY - pressPosition.current.y) > 3) dragging.current = true;
        scrub(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (pointerId.current !== e.pointerId) return;
        if (gesture.current === "pending") scrub(e.clientX, e.clientY);
        const hit = frameCache.current ? frameUnderPointer(frameCache.current.frames, e.clientX, e.clientY) : undefined;
        const target = hit ?? lastPassed.current;
        finishDrag();
        // One seek, on release, to the tile under the pointer.
        if (target !== null && target !== undefined) onSeek(target);
      }} onPointerCancel={cancelDrag} onScrollCapture={() => { if (frameCache.current) measureFrames(); }}
      onLostPointerCapture={(e) => { if (e.target === e.currentTarget && pointerId.current !== null && gesture.current !== "pending") cancelDrag(); }}>
      {connector && <svg className="ps-drag-line" aria-hidden="true"><line x1={connector.x} y1={connector.y} x2={connector.endX} y2={connector.endY} /></svg>}
      <div className="ps-rule-b flex flex-wrap items-center justify-between gap-x-3 px-3 py-2">
        <span className="ps-dim">
          Contact sheet · {sheet.tiles.length} frames
        </span>
        <div className="flex items-center gap-3">
        <SaveSheetButton sheet={sheet} title={title} playbackId={playbackId} />
        <Button ref={closeRef} variant="player" type="button" aria-label="Close contact sheet" onClick={onClose}>
          <CloseIcon />
          <span>Close</span>
        </Button>
        </div>
      </div>
      <div className="ps-contact-scroll overflow-y-auto p-3">
        <div ref={gridRef} className="ps-frame-rows" role="grid" tabIndex={0} aria-activedescendant={`${gridId}-frame-${focused}`} aria-label="Contact sheet frames" aria-rowcount={Math.ceil(sheet.tiles.length / columns)} aria-colcount={columns}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            if (event.key === "Enter" || event.key === " ") { onSeek(focused); onClose(); return; }
            const next = gridDestination(focused, event.key, columns, sheet.tiles.length, getComputedStyle(event.currentTarget).direction === "rtl");
            setFocused(next); onSeek(next); refs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
          }}>
          {Array.from({ length: Math.ceil(sheet.tiles.length / columns) }, (_, row) => (
            <div key={row} className="ps-frame-row">
               <div role="row" aria-rowindex={row + 1} className="ps-frame-grid grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {sheet.tiles.slice(row * columns, (row + 1) * columns).map((tile, col) => {
            const i = row * columns + col;
            return (
            <div role="gridcell" id={`${gridId}-frame-${i}`} aria-label={frameAccessibleName(i, tile.start)} aria-current={i === idx ? "true" : undefined} aria-colindex={col + 1} key={i}>
            <Button variant="player"
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              aria-label={frameAccessibleName(i, tile.start)}
              aria-current={i === idx ? "true" : undefined}
              data-past={i < idx ? "" : undefined}
              data-frame={i}
              tabIndex={-1}
              data-focused={focused === i ? "" : undefined}
              onClick={(e) => { if (e.detail === 0) onSeek(i); }}
              className="ps-sheet-tile text-left"
            >
              <span className="ps-tile block">
                <TileFace sheet={sheet} tile={tile} width={tileW} />
                <FocusFrame />
              </span>
              <span className="ps-tile-footer ps-mono ps-dim">
                <span className="ps-frame-number">{String(i + 1).padStart(2, "0")}</span>
                <span className="ps-frame-time">{fmtTile(tile.start, sheet.duration)}</span>
              </span>
            </Button></div>
          ); })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Two lines by default; a cue that needs more drops one size step before a third line is allowed. Never truncated. */
function CaptionBox({ text, controlsVisible }: { text: string; controlsVisible: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    const span = el?.firstElementChild as HTMLElement | null;
    if (!el || !span) return;
    const fit = () => {
      el.removeAttribute("data-reduced");
      const lines = Math.round(span.getBoundingClientRect().height / parseFloat(getComputedStyle(span).lineHeight));
      const next = lines > 2;
      if (next) el.setAttribute("data-reduced", "");
      setReduced(next);
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (el.parentElement) observer.observe(el.parentElement);
    return () => observer.disconnect();
  }, [text]);
  return <div ref={box} className="ps-captions" data-reduced={reduced ? "" : undefined} data-controls-visible={controlsVisible ? "" : undefined} aria-live="off"><span>{text}</span></div>;
}

function Skin({ playbackId, title, startTime, aspectRatio, captionsUrl, theme, onFrameCount, muted, loop, autoPlay, initialSheetOpen, posterTime = 6 }: { posterTime?: number | undefined; playbackId: string; title: string; startTime?: number | undefined; aspectRatio?: number | undefined; captionsUrl?: string | undefined; theme?: PlayerTheme | undefined; onFrameCount?: ((count: number) => void) | undefined; muted: boolean; loop: boolean; autoPlay: boolean; initialSheetOpen: boolean }) {
  const { sheet, ratio: storyboardRatio } = useStoryboard(playbackId);
  useEffect(() => { onFrameCount?.(sheet?.tiles.length ?? 0); }, [sheet, onFrameCount]);
  const store = usePlayer();
  const time = usePlayer((s) => s.currentTime);
  const playbackFrame = sheet ? frameAtTime(sheet.tiles, time) : 0;
  const transition = useSheetTransition(initialSheetOpen);
  const { open, openSheet, closeSheet, playerRef: containerRef, videoRef: videoWrap, sheetRef, dragging } = transition;
  const playerWidth = usePlayerWidth(containerRef);
  const narrow = playerWidth > 0 && playerWidth < 640;
  const compact = playerWidth > 0 && playerWidth < 380;
  useStartTime(videoWrap, startTime);
  const { preview, seek, hold, cancelHold } = useSheetSeek(videoWrap);
  const active = preview?.index ?? playbackFrame;
  const { text: captionText, selectedId: selectedCaptionId, select: selectCaption } = useCaptionCues(videoWrap, captionsUrl);
  useLocalCaptions(videoWrap, captionsUrl);
  const seekFrame = (index: number) => {
    const tile = sheet?.tiles[index];
    if (!tile) return;
    seek(index, tile.start);
  };
  const holdFrame = (index: number) => { const tile = sheet?.tiles[index]; if (tile) hold(index, tile.start); };
  const paused = usePlayer((s) => s.paused);
  const ended = usePlayer((s) => s.ended);
  const duration = usePlayer((s) => s.duration);
  const textTracks = usePlayer((s) => s.textTrackList);
  const [hasPlayed, setHasPlayed] = useState(false);
  useEffect(() => {
    if (!ended) return;
    resetEndedRate(store);
    containerRef.current?.dispatchEvent(new Event("sheet-close-menus"));
  }, [ended, store]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [volumeEngaged, setVolumeEngaged] = useState(false);
  const hasDuration = durationKnown(duration);
  const captionsAvailable = hasCaptionTracks(textTracks.filter((track) => captionTrackAllowed(track, captionsUrl)));
  const [overControls, setOverControls] = useState(false);
  const [keyFocus, setKeyFocus] = useState(false);
  const { hidden, controlsIdle, interacting, reveal } = useSheetChrome(paused, menuOpen || volumeEngaged || helpOpen || overControls || keyFocus, !hasPlayed || ended);
  const lastCaptionId = useRef<string | null>(null);
  if (selectedCaptionId) lastCaptionId.current = selectedCaptionId;
  useVideoTap(videoWrap, dragging, () => {
    if (store.state.paused) void store.play().catch(() => {});
    else store.pause();
  }, reveal, () => { void (store.state.isFullscreen ? store.exitFullscreen() : store.requestFullscreen()).catch(() => {}); });
  const [metadataRatio, setMetadataRatio] = useState<number | null>(null);
  const ratio = resolveAspectRatio(aspectRatio, storyboardRatio, metadataRatio);
  const [heightLimit, setHeightLimit] = useState("70vh");
  const [widthLimit, setWidthLimit] = useState<string | null>(null);
  const [thickness, setThickness] = useState<number | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rtlSeekPointer = useRef<number | null>(null);
  const seekFromRtlPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const total = store.state.duration;
    if (bounds.width > 0 && Number.isFinite(total)) void store.seek(Math.max(0, Math.min(1, (bounds.right - event.clientX) / bounds.width)) * total);
  };
  useEffect(() => {
    const overlay = overlayRef.current;
    const video = videoWrap.current;
    if (!overlay || !video) return;
    const measure = () => video.style.setProperty('--chrome-height', `${overlay.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(overlay); measure();
    return () => observer.disconnect();
  }, []);
  const [detectedTheme, setDetectedTheme] = useState<PlayerTheme>("dark");
  const frameRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const helpMenu = useMenuSurface({ open: helpOpen, setOpen: setHelpOpen, menu: helpRef, trigger: helpTrigger, host: containerRef });
  useLayoutEffect(() => {
    const player = containerRef.current;
    const popup = helpRef.current;
    if (!helpOpen || !player || !popup) return;
    const position = () => {
      const bounds = player.getBoundingClientRect();
      const trigger = helpTrigger.current;
      // The hardware-keyboard shortcut remains available when KEYS is hidden.
      const anchor = trigger?.getClientRects().length ? trigger.getBoundingClientRect() : videoWrap.current?.getBoundingClientRect();
      if (!anchor) return;
      popup.style.width = `${Math.min(480, player.clientWidth)}px`;
      popup.toggleAttribute("data-narrow", player.clientWidth < 480);
      const height = popup.scrollHeight;
      const layout = playerMenuLayout({ left: anchor.left - bounds.left - player.clientLeft, right: anchor.right - bounds.left - player.clientLeft, top: anchor.top - bounds.top - player.clientTop, bottom: anchor.bottom - bounds.top - player.clientTop }, { width: player.clientWidth, height: player.clientHeight }, height, popup.offsetWidth);
      popup.style.left = `${layout.left}px`;
      popup.style.top = `${layout.top}px`;
      popup.style.maxHeight = `${layout.maxHeight}px`;
      popup.dataset["side"] = layout.side;
    };
    position();
    popup.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(player);
    if (helpTrigger.current) observer.observe(helpTrigger.current);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [helpOpen]);
  const showSheet = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : containerRef.current;
    openSheet();
  };
  const hideSheet = () => { void closeSheet(); };
  const wasSheetOpen = useRef(false);
  useEffect(() => {
    if (wasSheetOpen.current && !open) opener.current?.focus({ preventScroll: true });
    wasSheetOpen.current = open;
  }, [open]);

  useEffect(() => {
    setDetectedTheme(detectPlayerTheme(frameRef.current?.parentElement ?? null, theme));
  }, [theme]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      frame.toggleAttribute("data-in-view", Boolean(entry?.isIntersecting));
    });
    observer.observe(frame);
    return () => { observer.disconnect(); frame.removeAttribute("data-in-view"); };
  }, []);

  useEffect(() => {
    const row = controlsRef.current;
    if (!row) return;
    const fit = () => {
      // Try spacing first, then type size; never remove a label.
      for (const density of ["normal", "tight", "small", "nano"]) {
        row.dataset["density"] = density;
        const styles = getComputedStyle(row);
        const items = Array.from(row.children).filter((item) => !item.classList.contains("flex-1"));
        const needed = items.reduce((width, item) => width + item.getBoundingClientRect().width, 0)
          + Math.max(0, items.length - 1) * parseFloat(styles.columnGap)
          + parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        if (needed <= row.clientWidth) break;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    // Controls can appear or relabel (captions arriving, the rate changing)
    // without the row's own box resizing, so watch its content as well.
    const observeChildren = () => { for (const child of row.children) observer.observe(child); };
    const mutations = new MutationObserver(() => { observeChildren(); fit(); });
    observeChildren();
    mutations.observe(row, { childList: true, subtree: true, characterData: true });
    fit();
    document.fonts.ready.then(fit);
    return () => { observer.disconnect(); mutations.disconnect(); };
  }, [sheet, paused, captionsAvailable, volumeEngaged]);

  useEffect(() => {
    const video = videoWrap.current?.querySelector("video");
    if (!video) return;
    const played = () => setHasPlayed(true);
    video.addEventListener("playing", played);
    return () => video.removeEventListener("playing", played);
  }, [playbackId]);

  useLayoutEffect(() => {
    const el = videoWrap.current;
    const frame = frameRef.current;
    const host = frame?.parentElement;
    if (!el || !frame || !host) return;
    const read = () => {
      const v = el.querySelector("video");
      if (!v) return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const fullscreen = document.fullscreenElement === containerRef.current;
      const hostStyles = getComputedStyle(host);
      const containerWidth = fullscreen ? window.innerWidth : host.clientWidth - (parseFloat(hostStyles.paddingLeft) || 0) - (parseFloat(hostStyles.paddingRight) || 0);
      // Auto-height hosts grow with the sheet; only an explicit height bound
      // constrains the picture. Do not use the video's bounding rectangle.
      const hostMaxHeight = parseFloat(hostStyles.maxHeight);
      const availableHeight = fullscreen ? containerRef.current?.clientHeight ?? viewportHeight : Number.isFinite(hostMaxHeight) ? Math.min(viewportHeight, hostMaxHeight) : viewportHeight;
      const metrics = playerVideoMetrics(v.videoWidth, v.videoHeight, viewportHeight, availableHeight);
      if (metrics.ratio !== null) setMetadataRatio(metrics.ratio);
      const resolved = metrics.ratio ?? ratio;
      setHeightLimit(`${metrics.heightLimit}px`);
      // Scale the perimeter from content width, including it in the container bound.
      const geometry = resolved === null ? null : playerFrameMetrics(resolved, metrics.heightLimit, containerWidth);
      setWidthLimit(geometry ? `${geometry.width}px` : null);
      setThickness(geometry?.thickness ?? null);
    };
    el.addEventListener("loadedmetadata", read, true);
    el.addEventListener("resize", read, true);
    const observer = new ResizeObserver(read);
    observer.observe(host);
    window.addEventListener("resize", read);
    window.visualViewport?.addEventListener("resize", read);
    document.addEventListener("fullscreenchange", read);
    read();
    return () => {
      el.removeEventListener("loadedmetadata", read, true);
      el.removeEventListener("resize", read, true);
      observer.disconnect();
      window.removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("resize", read);
      document.removeEventListener("fullscreenchange", read);
    };
  }, [playbackId, ratio]);

  return (
    <div ref={frameRef} className="ps-glass-frame" data-ratio-pending={ratio === null ? "" : undefined} data-theme={theme ?? detectedTheme} style={{ "--player-width-limit": widthLimit ?? (ratio === null ? "0px" : `calc(70vh * ${ratio})`), "--frame-thickness": thickness === null ? undefined : `${thickness}px` } as React.CSSProperties}>
    <span className="ps-glass-inner-layer" aria-hidden="true" />
    <span className="ps-glass-lens" aria-hidden="true" />
    <Container ref={containerRef} data-narrow={narrow ? "" : undefined} data-compact={compact ? "" : undefined} data-theme={theme ?? detectedTheme} data-chrome-hidden={hidden ? "" : undefined} data-controls-idle={controlsIdle ? "" : undefined} data-sheet-open={open ? "" : undefined}
      tabIndex={0} role="region" aria-label="Contact sheet video player" aria-description="Press question mark for keyboard shortcuts."
      onPointerMove={(event) => {
        reveal();
        const over = event.target instanceof Element && !!event.target.closest(".ps-controls, .ps-slider");
        if (over !== overControls) setOverControls(over);
      }}
      onPointerLeave={() => setOverControls(false)}
      onTouchStart={reveal} onTouchMove={reveal}
      onFocusCapture={(event) => {
        reveal();
        const target = event.target;
        setKeyFocus(target !== event.currentTarget && target instanceof Element && target.matches(":focus-visible"));
      }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setKeyFocus(false); }}
      onKeyDownCapture={(event) => {
        const wasHidden = !interacting && hasPlayed && !ended;
        reveal();
        if (event.key === "Tab" && wasHidden && event.target === event.currentTarget && !event.shiftKey) {
          // Bring the bar back first, then hand it focus.
          event.preventDefault();
          const player = event.currentTarget;
          requestAnimationFrame(() => player.querySelector<HTMLElement>(".ps-slider [tabindex], .ps-slider [role=slider], .ps-controls button")?.focus());
          return;
        }
        const target = event.target;
        if (!(target instanceof Element) || event.altKey || event.ctrlKey || event.metaKey || target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (target.closest('[role="menu"], [role="dialog"], [role="grid"]') && event.key !== "Escape") return;
        const shortcut = playerShortcut(event.key, getComputedStyle(event.currentTarget).direction === "rtl");
        if (!shortcut) return;
        if (event.key === "Escape" && target.closest('[role="menu"]')) return;
        if (event.key === " " && target.closest('button, [role="button"]')) return;
        event.preventDefault(); event.stopPropagation();
        if (event.repeat && ["play", "mute", "fullscreen", "captions", "sheet", "close", "help"].includes(shortcut.action)) return;
        const state = store.state;
        switch (shortcut.action) {
          case "play": if (state.paused) void store.play().catch(() => {}); else store.pause(); break;
          case "mute": store.setMuted(!state.muted); break;
          case "fullscreen": void (state.isFullscreen ? store.exitFullscreen() : store.requestFullscreen()).catch(() => {}); break;
          case "captions": if (captionsAvailable) {
            selectCaption(selectedCaptionId ? null : lastCaptionId.current ?? textTracks.find((track) => ["captions", "subtitles"].includes(track.kind) && captionTrackAllowed(track, captionsUrl))?.id ?? null);
          } break;
          case "seek": if (Number.isFinite(state.duration)) void store.seek(Math.max(0, Math.min(state.duration, state.currentTime + shortcut.value))); break;
          case "percent": if (Number.isFinite(state.duration)) void store.seek(state.duration * shortcut.value); break;
          case "volume": store.setVolume(Math.max(0, Math.min(1, state.volume + shortcut.value))); break;
          case "sheet": if (sheet) { if (open) hideSheet(); else showSheet(); } break;
          case "close": if (helpOpen) helpMenu.close(); else if (menuOpen) containerRef.current?.dispatchEvent(new Event("sheet-close-menus")); else if (open) hideSheet(); break;
          case "help": helpMenu.toggle(); break;
        }
      }}
      className="ps-player" style={{ "--video-ratio": ratio ?? undefined, "--video-height-limit": heightLimit, "--sheet-seek-fill": preview && duration > 0 ? `${Math.max(0, Math.min(100, preview.time / duration * 100))}%` : undefined } as React.CSSProperties}>
      <div className="ps-main">
      <div
        ref={videoWrap}
        className="ps-video w-full"
        style={{ aspectRatio: ratio ?? undefined }}
      >
        <MuxVideo crossOrigin="anonymous" source={captionPlaybackSource(playbackId, captionsUrl)} poster={`https://image.mux.com/${playbackId}/thumbnail.jpg?time=${posterTime}`} muted={muted} loop={loop} autoPlay={autoPlay} playsInline className="h-full w-full">
          {captionsUrl && <track key={captionsUrl} id={LOCAL_CAPTION_ID} kind="captions" srcLang="en" label="English" src={captionsUrl} default />}
        </MuxVideo>
        {sheet && preview && <SheetSeekPreview sheet={sheet} index={preview.index} resolving={preview.resolving} loading={preview.loading} />}
        {captionText && <CaptionBox text={captionText} controlsVisible={(!controlsIdle || interacting) && fullChromeVisible(hasPlayed, ended, interacting)} />}
        <PlayButton render={(props) => <Button {...props} variant="player" className="ps-big-play"
          data-visible={paused || ended ? "" : undefined} aria-label={ended ? "Replay video" : "Play video"}
          aria-hidden={!paused && !ended}
          tabIndex={paused || ended ? 0 : -1}>
          <InstrumentPlay replay={ended} />
        </Button>} />
      </div>
      <div ref={overlayRef} className="ps-overlay">
      <TimeSlider.Root hidden={!fullChromeVisible(hasPlayed, ended, interacting)} className="ps-slider ps-chrome" aria-label="Seek"
        onPointerDownCapture={(event) => {
          if (getComputedStyle(event.currentTarget).direction !== "rtl" || event.button !== 0) return;
          event.preventDefault(); event.stopPropagation();
          rtlSeekPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus(); seekFromRtlPointer(event);
        }}
        onPointerMoveCapture={(event) => { if (rtlSeekPointer.current === event.pointerId) { event.stopPropagation(); seekFromRtlPointer(event); } }}
        onPointerUpCapture={(event) => { if (rtlSeekPointer.current === event.pointerId) { event.stopPropagation(); rtlSeekPointer.current = null; } }}
        onPointerCancelCapture={() => { rtlSeekPointer.current = null; }}>
        <TimeSlider.Track className="ps-track">
          <TimeSlider.Buffer className="ps-buffer" />
          <TimeSlider.Fill className="ps-fill" />
          <TimeSlider.Thumb className="ps-thumb" />
        </TimeSlider.Track>
      </TimeSlider.Root>

      <div className="ps-control-panel ps-chrome">
      <div ref={controlsRef} hidden={!fullChromeVisible(hasPlayed, ended, interacting)} className="ps-controls ps-rule-t flex items-center px-1 py-1">
        <PlayButton
          render={(props, state) => (
            <PlayerTooltip label={state.paused ? "Play" : "Pause"} host={containerRef}>
              <Button {...props} variant="player" className="ps-icon-control" aria-label={state.paused ? "Play" : "Pause"}>
                {state.paused ? <PlayIcon /> : <PauseIcon />}
              </Button>
            </PlayerTooltip>
          )}
        />
        {hasDuration ? <Time.Group className="ps-time ps-mono px-3 text-xs">
          {preview ? <span>{fmt(preview.time)}</span> : <Time.Value type="current" />}
          {!narrow && <><span className="ps-dim"> / </span><Time.Value type="duration" /></>}
        </Time.Group> : <span className="ps-time ps-mono" role="status">LOADING</span>}
        <span className="flex-1" />
        <VolumeControl host={containerRef} onEngaged={setVolumeEngaged} />
        <TrackAndSpeedControls host={containerRef} onOpenChange={setMenuOpen} captionsUrl={captionsUrl} selectedCaptionId={selectedCaptionId} selectCaption={selectCaption} showSpeed={!compact} />
        <Button ref={helpTrigger} variant="player" className="ps-keys-trigger" aria-label="Keyboard shortcuts" aria-expanded={helpOpen} onClick={helpMenu.toggle}><span>Keys</span></Button>
        {/* Narrow player boxes open the sheet from the bar, regardless of viewport. */}
        {sheet && narrow && (
          <PlayerTooltip label={open ? "Close contact sheet" : "Open contact sheet"} host={containerRef}>
            <Button variant="player" className="ps-icon-control" aria-label={open ? "Close contact sheet" : "Open contact sheet"} aria-expanded={open}
              onClick={() => (open ? hideSheet() : showSheet())}>
              <GridIcon />
            </Button>
          </PlayerTooltip>
        )}
        <FullscreenButton
          render={(props, state) => (
            <PlayerTooltip label={state.fullscreen ? "Exit fullscreen" : "Enter fullscreen"} host={containerRef}>
              <Button {...props} variant="player" className="ps-icon-control" aria-label={state.fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                <FullscreenIcon exit={state.fullscreen} />
              </Button>
            </PlayerTooltip>
          )}
        />
      </div>

      {sheet && !narrow && <div className="ps-frames">
          <div className="ps-strip-chrome" data-collapsed={open ? "" : undefined} inert={open} aria-hidden={open}>
            <div className="ps-strip-inner"><Strip sheet={sheet} open={open} idx={active} onSeek={seekFrame} onOpen={() => open ? hideSheet() : showSheet()} /></div>
          </div>
      </div>}
      </div>
      </div>
      </div>

      {sheet && <SheetExpansion open={open}><ContactSheet sheet={sheet} title={title} playbackId={playbackId} open={open} idx={active} onSeek={seekFrame} onHold={holdFrame} onCancelHold={cancelHold} onClose={hideSheet} sheetRef={sheetRef} dragging={dragging} /></SheetExpansion>}
      {helpOpen && <div ref={helpRef} tabIndex={-1} role="dialog" aria-modal={true} aria-label="Keyboard shortcuts" className="ps-menu-surface ps-keyboard-help">
        <div className="ps-keys-header"><strong>KEYBOARD</strong><Button variant="player" className="ps-keys-close" aria-label="Close keyboard shortcuts" onClick={helpMenu.close}><CloseIcon /></Button></div>
        <dl className="ps-keys-grid">{SHORTCUT_LIST.map(([key, action]) => <div className="ps-menu-row" key={key}><dt><kbd>{key}</kbd></dt><dd>{action}</dd></div>)}</dl>
      </div>}
    </Container>
    </div>
  );
}

export default function ProofSheetPlayer({
  playbackId,
  title,
  startTime,
  aspectRatio,
  captionsUrl,
  theme,
  onFrameCount,
  muted = false,
  loop = false,
  autoPlay = false,
  initialSheetOpen = false,
  posterTime,
}: {
  /** Poster frame time in seconds; defaults to 6. */
  posterTime?: number | undefined;
  playbackId?: string | undefined;
  title?: string | undefined;
  startTime?: number | undefined;
  /** Reserve the source shape immediately; storyboard and metadata confirm it. */
  aspectRatio?: number | undefined;
  /** Optional English WebVTT track, replacing the source's caption tracks. */
  captionsUrl?: string | undefined;
  /** Optional explicit theme; otherwise the nearest opaque host background decides. */
  theme?: PlayerTheme | undefined;
  onFrameCount?: ((count: number) => void) | undefined;
  /** Hosts opt into each playback behavior; all default to false. */
  muted?: boolean | undefined;
  loop?: boolean | undefined;
  autoPlay?: boolean | undefined;
  /** Open with the contact sheet already expanded (demo hero). */
  initialSheetOpen?: boolean | undefined;
}) {
  const id = resolvePlaybackId(playbackId);
  if (!id) {
    console.error("ProofSheetPlayer: the \"playbackId\" prop is missing. Pass a Mux playback ID; without one the player renders nothing.");
    return null;
  }
  // Remount on a different video so the old one's playback state is dropped.
  return (
    <Player key={`${id}:${captionsUrl ?? ""}`}>
      <Skin playbackId={id} title={exportTitle(title, id)} startTime={startTime} aspectRatio={aspectRatio} captionsUrl={captionsUrl} theme={theme} onFrameCount={onFrameCount} muted={muted} loop={loop} autoPlay={autoPlay} initialSheetOpen={initialSheetOpen} posterTime={posterTime} />
    </Player>
  );
}


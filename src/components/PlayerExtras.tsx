import { MuteButton, VolumeSlider, useCaptionsOptions, usePlaybackRateOptions } from "@videojs/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { MuteIcon, PlayIcon, ReplayIcon, VolumeIcon } from "@/components/PlayerIcons";
import { Button } from "@/components/ui/button";
import { PLAYBACK_RATES } from "@/lib/playback-controls";
import { TOUCH_PRIMARY_QUERY, VOLUME_CLOSE_DELAY, volumePanelSide } from "@/lib/volume-panel";
import { playerMenuLayout } from "@/lib/player-menu";
import { captionControlMode, toggledCaptionValue, LOCAL_CAPTION_ID } from "@/lib/player-captions";
import { PlayerTooltip } from "@/components/PlayerTooltip";
import { useMenuSurface } from "@/hooks/use-menu-surface";

function SheetMenu({ label, triggerLabel, icon, options, value, onSelect, host, onOpenChange }: {
  label: string; triggerLabel: string; icon: React.ReactNode;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  value: string; onSelect: (value: string) => void; host: RefObject<HTMLDivElement | null>;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const { close, toggle } = useMenuSurface({ open, setOpen, menu, trigger, host, onOpenChange });
  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current || !host.current) return;
    const popup = menu.current;
    const position = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const container = host.current?.getBoundingClientRect();
      if (!anchor || !container) return;
      const owner = host.current;
      if (!owner) return;
      const left = container.left + owner.clientLeft;
      const top = container.top + owner.clientTop;
      const layout = playerMenuLayout({ left: anchor.left - left, right: anchor.right - left, top: anchor.top - top, bottom: anchor.bottom - top }, { width: owner.clientWidth, height: owner.clientHeight }, popup.scrollHeight, popup.offsetWidth);
      popup.style.maxHeight = `${layout.maxHeight}px`;
      popup.style.left = `${layout.left}px`;
      popup.style.top = `${layout.top}px`;
      popup.dataset['side'] = layout.side;
    };
    position();
    popup.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    const owner = host.current;
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    const observer = new ResizeObserver(position);
    observer.observe(owner);
    if (trigger.current) observer.observe(trigger.current);
    return () => { observer.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [open]);
  useEffect(() => () => onOpenChange(false), []);
  return <>
    <Button ref={trigger} variant="player" aria-label={label} aria-haspopup="menu" aria-expanded={open}
      onClick={toggle}>
      {icon}{triggerLabel && <span data-active={label === "Captions" && value !== "off" ? "" : undefined}>{triggerLabel}</span>}
    </Button>
    {open && host.current && createPortal(<div ref={menu} className={`ps-menu-surface ps-option-menu${label === "Playback speed" ? " ps-speed-menu" : ""}`} role="menu" aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)') ?? []);
          const current = items.findIndex((item) => item === document.activeElement);
          const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[index]?.focus();
        }
      }}>
      {options.map((option) => <Button key={option.value} variant="player" role="menuitemradio" aria-checked={value === option.value} tabIndex={-1}
        disabled={option.disabled} className="ps-menu-row ps-option" onClick={() => { onSelect(option.value); close(); }}>
        {option.label}
      </Button>)}
    </div>, host.current)}
  </>;
}

export function VolumeControl({ host, onEngaged }: { host: RefObject<HTMLDivElement | null>; onEngaged: (engaged: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const anchorLayer = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragging = useRef(false);
  const restoring = useRef(false);
  // A dismissal under the pointer stays closed until the pointer leaves and returns.
  const dismissedUnderPointer = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  // Geometry, not :hover, because toggling mute re-renders the button under a still pointer.
  const pointerOverTrigger = () => {
    const box = trigger.current?.getBoundingClientRect(); const at = lastPointer.current;
    return !!box && !!at && at.x >= box.left && at.x <= box.right && at.y >= box.top && at.y <= box.bottom;
  };
  // Every close path returns focus to mute; that restored focus must not reopen the panel.
  const surface = useMenuSurface({ open, setOpen, menu: panel, trigger, host, onOpenChange: (engaged) => {
    if (!engaged) { clearTimeout(timer.current); dragging.current = false; restoring.current = true; requestAnimationFrame(() => { restoring.current = false; }); dismissedUnderPointer.current = pointerOverTrigger(); }
    onEngaged(engaged);
  } });
  const touchPrimary = () => window.matchMedia(TOUCH_PRIMARY_QUERY).matches;
  const close = () => surface.close();
  const show = () => { clearTimeout(timer.current); if (touchPrimary() || open || dismissedUnderPointer.current) return; surface.show(); };
  // Pointer leaving waits so a small wobble between mute and panel never dismisses it.
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (dragging.current || trigger.current?.matches(':hover') || panel.current?.matches(':hover')) return;
      close();
    }, VOLUME_CLOSE_DELAY);
  };
  useEffect(() => {
    const media = window.matchMedia(TOUCH_PRIMARY_QUERY);
    const update = () => { if (media.matches) setOpen(false); };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Chrome fades can fire synthetic leave/enter; only a real pointer move off mute re-arms hover.
  useEffect(() => {
    const moved = (event: PointerEvent) => {
      if (!event.isTrusted) return;
      lastPointer.current = { x: event.clientX, y: event.clientY };
      if (dismissedUnderPointer.current && !pointerOverTrigger()) dismissedUnderPointer.current = false;
    };
    document.addEventListener('pointermove', moved, true);
    return () => document.removeEventListener('pointermove', moved, true);
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const owner = host.current?.getBoundingClientRect();
      const popup = anchorLayer.current;
      if (!anchor || !owner || !popup) return;
      popup.style.left = `${anchor.left - owner.left - (host.current?.clientLeft ?? 0)}px`;
      popup.style.top = `${anchor.top - owner.top - (host.current?.clientTop ?? 0)}px`;
      popup.style.width = `${anchor.width}px`;
      popup.style.height = `${anchor.height}px`;
      popup.dataset['side'] = volumePanelSide(anchor.top, owner.top);
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    const observer = new ResizeObserver(position);
    if (host.current) observer.observe(host.current);
    if (trigger.current) observer.observe(trigger.current);
    return () => { observer.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open, host]);
  return <div ref={trigger} className="ps-volume-group"
    onMouseEnter={show} onMouseLeave={leave}
    onFocusCapture={(event) => { if (!restoring.current && trigger.current?.contains(event.target as Node) && event.target instanceof Element && event.target.matches(':focus-visible')) show(); }}
    // Mute still toggles; a second click on the control also closes its open panel.
    onClickCapture={(event) => { if (!trigger.current?.contains(event.target as Node)) return; if (open) close(); else if (!touchPrimary()) { dismissedUnderPointer.current = false; show(); } }}>
    <MuteButton render={(props, state) => <PlayerTooltip label={state.muted ? "Unmute" : "Mute"} host={host} side="right">
      <Button {...props} variant="player" className="ps-icon-control" aria-label={state.muted ? "Unmute" : "Mute"} aria-expanded={open}>
        {state.muted ? <MuteIcon /> : <VolumeIcon />}
      </Button>
    </PlayerTooltip>} />
    {open && host.current && createPortal(<div ref={anchorLayer} className="ps-volume-anchor"><div ref={panel} className="ps-menu-surface ps-volume-panel" onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={leave}
      onPointerUpCapture={() => { dragging.current = false; }} onPointerCancelCapture={() => { dragging.current = false; leave(); }}>
    <VolumeSlider.Root orientation="vertical" className="ps-volume-slider" aria-label="Volume" onPointerDown={() => { dragging.current = true; clearTimeout(timer.current); }}>
      <VolumeSlider.Track className="ps-volume-track"><VolumeSlider.Fill className="ps-volume-fill" /><VolumeSlider.Thumb className="ps-volume-thumb" /></VolumeSlider.Track>
    </VolumeSlider.Root>
    </div></div>, host.current)}
  </div>;
}

export function TrackAndSpeedControls({ host, onOpenChange, captionsUrl, selectedCaptionId, selectCaption, showSpeed = true }: { host: RefObject<HTMLDivElement | null>; onOpenChange: (open: boolean) => void; captionsUrl?: string | undefined; selectedCaptionId: string | null; selectCaption: (id: string | null) => void; showSpeed?: boolean }) {
  const captions = useCaptionsOptions();
  const captionOptions = captions?.options.filter((option) => !captionsUrl || option.value === "off" || option.value === LOCAL_CAPTION_ID) ?? [];
  const captionValue = selectedCaptionId ?? "off";
  const speed = usePlaybackRateOptions({ rates: PLAYBACK_RATES, formatRate: (rate) => `${rate}x` });
  return <>
    {captions && !captions.hidden && captionOptions.length > 1 && (captionControlMode(captionOptions.length - 1) === "toggle"
      ? <Button variant="player" aria-label="Captions" aria-pressed={captionValue !== "off"}
          onClick={() => { const track = captionOptions.find((option) => option.value !== "off"); if (track) selectCaption(toggledCaptionValue(captionValue, track.value) === "off" ? null : track.value); }}>
          <span>CC</span>
        </Button>
      : <SheetMenu label="Captions" triggerLabel="CC" icon={null} options={captionOptions}
          value={captionValue} onSelect={(id) => selectCaption(id === "off" ? null : id)} host={host} onOpenChange={onOpenChange} />)}
    {showSpeed && speed && <SheetMenu label="Playback speed" triggerLabel={`${speed.rate}x`} icon={null} options={speed.options}
      value={speed.value} onSelect={speed.setValue} host={host} onOpenChange={onOpenChange} />}
  </>;
}

export function InstrumentPlay({ replay }: { replay: boolean }) {
  return replay ? <ReplayIcon className="ps-play-circle" filled /> : <PlayIcon className="ps-play-circle" filled />;
}
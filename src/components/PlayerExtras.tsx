import { MuteButton, VolumeSlider, useCaptionsOptions, usePlaybackRateOptions } from "@videojs/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { MuteIcon, PlayIcon, ReplayIcon, VolumeIcon } from "@/components/PlayerIcons";
import { Button } from "@/components/ui/button";
import { PLAYBACK_RATES } from "@/lib/playback-controls";
import { TOUCH_PRIMARY_QUERY, VOLUME_CLOSE_DELAY, KEYBOARD_VOLUME_FEEDBACK_MS } from "@/lib/volume-panel";
import { playerOptionsLayout, playerVolumeLayout } from "@/lib/player-menu";
import { captionControlMode, LOCAL_CAPTION_ID } from "@/lib/player-captions";
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
      const video = owner.querySelector('.ps-video')?.getBoundingClientRect();
      const controls = owner.querySelector('.ps-control-panel')?.getBoundingClientRect();
      if (!video || !controls) return;
      const layout = playerOptionsLayout({ left: video.left - left, top: video.top - top, width: video.width, height: video.height }, controls.top - top, (anchor.left + anchor.right) / 2 - left, options.length, label === 'Playback speed' ? 110 : 180);
      popup.toggleAttribute('data-chips', layout.chips);
      popup.style.height = `${layout.height}px`;
      popup.style.left = `${layout.left}px`;
      popup.style.top = `${layout.top}px`;
      popup.style.width = `${layout.width}px`;
    };
    position();
    popup.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    const owner = host.current;
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    const observer = new ResizeObserver(position);
    observer.observe(owner);
    const videoNode = owner.querySelector('.ps-video');
    const panelNode = owner.querySelector('.ps-control-panel');
    if (videoNode) observer.observe(videoNode);
    if (panelNode) observer.observe(panelNode);
    if (trigger.current) observer.observe(trigger.current);
    return () => { observer.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [open, options.length, label]);
  useEffect(() => () => onOpenChange(false), []);
  return <>
    <Button ref={trigger} variant="player" aria-label={label} aria-haspopup="menu" aria-expanded={open}
      onClick={toggle}>
      {icon}{triggerLabel && <span data-active={label === "Captions" && value !== "off" ? "" : undefined}>{triggerLabel}</span>}
    </Button>
    {open && host.current && createPortal(<div ref={menu} className={`ps-menu-surface ps-option-menu${label === "Playback speed" ? " ps-speed-menu" : ""}`} role="menu" aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)') ?? []);
          const current = items.findIndex((item) => item === document.activeElement);
          const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + items.length) % items.length;
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
  const [announcement, setAnnouncement] = useState("");
  const trigger = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const anchorLayer = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
  const surface = useMenuSurface({ open, setOpen, menu: panel, trigger, host, trapTab: false, onOpenChange: (engaged) => {
    if (!engaged) { clearTimeout(timer.current); dragging.current = false; restoring.current = true; requestAnimationFrame(() => { restoring.current = false; }); dismissedUnderPointer.current = pointerOverTrigger(); }
    onEngaged(engaged);
  } });
  const touchPrimary = () => window.matchMedia(TOUCH_PRIMARY_QUERY).matches;
  const close = () => surface.close();
  useEffect(() => {
    const owner = host.current;
    if (!owner) return;
    const feedback = () => {
      surface.show();
      clearTimeout(feedbackTimer.current);
      requestAnimationFrame(() => {
        const media = owner.querySelector('video');
        if (media) setAnnouncement(media.muted ? 'Muted' : `Volume ${Math.round(media.volume * 100)} percent`);
      });
      feedbackTimer.current = setTimeout(() => { setOpen(false); onEngaged(false); }, KEYBOARD_VOLUME_FEEDBACK_MS);
    };
    owner.addEventListener('player-keyboard-volume', feedback);
    return () => { owner.removeEventListener('player-keyboard-volume', feedback); clearTimeout(feedbackTimer.current); };
  }, [host, surface.show, onEngaged]);
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
      const popup = panel.current;
      if (!anchor || !owner || !popup) return;
      const player = host.current;
      const video = player?.querySelector('.ps-video')?.getBoundingClientRect();
      const controls = player?.querySelector('.ps-control-panel')?.getBoundingClientRect();
      if (!player || !video || !controls) return;
      const left = owner.left + player.clientLeft;
      const top = owner.top + player.clientTop;
      const layout = playerVolumeLayout({ left: video.left - left, top: video.top - top, width: video.width, height: video.height }, controls.top - top, (anchor.left + anchor.right) / 2 - left);
      popup.style.left = `${layout.left}px`;
      popup.style.top = `${layout.top}px`;
      popup.style.width = `${layout.width}px`;
      popup.style.height = `${layout.height}px`;
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    const observer = new ResizeObserver(position);
    if (host.current) observer.observe(host.current);
    const controls = host.current?.querySelector('.ps-control-panel');
    const video = host.current?.querySelector('.ps-video');
    if (controls) observer.observe(controls);
    if (video) observer.observe(video);
    if (trigger.current) observer.observe(trigger.current);
    return () => { observer.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open, host]);
  return <div ref={trigger} className="ps-volume-group"
    onMouseEnter={show} onMouseLeave={leave}
    onFocusCapture={(event) => { if (!restoring.current && trigger.current?.contains(event.target as Node) && event.target instanceof Element && event.target.matches(':focus-visible')) show(); }}
    // Mute still toggles; a second click on the control also closes its open panel.
    onClickCapture={(event) => { if (!trigger.current?.contains(event.target as Node)) return; if (open) close(); else if (!touchPrimary()) { dismissedUnderPointer.current = false; show(); } }}>
    <MuteButton render={(props, state) =>
      <Button {...props} title={undefined} variant="player" className="ps-icon-control" aria-label={state.muted ? "Unmute" : "Mute"} aria-expanded={open}>
        {state.muted ? <MuteIcon /> : <VolumeIcon />}
      </Button>
    } />
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    {open && host.current && createPortal(<div ref={anchorLayer} className="ps-volume-anchor"><div ref={panel} className="ps-menu-surface ps-volume-panel" onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={leave}
      onPointerUpCapture={() => { dragging.current = false; }} onPointerCancelCapture={() => { dragging.current = false; leave(); }}>
    <VolumeSlider.Root orientation="vertical" className="ps-volume-slider" aria-label="Volume" onPointerDown={() => { dragging.current = true; clearTimeout(timer.current); }}>
      <VolumeSlider.Track className="ps-volume-track"><VolumeSlider.Fill className="ps-volume-fill" /><VolumeSlider.Thumb className="ps-volume-thumb" /></VolumeSlider.Track>
    </VolumeSlider.Root>
    </div></div>, host.current)}
  </div>;
}

export function TrackAndSpeedControls({ host, onOpenChange, captionsUrl, selectedCaptionId, selectCaption }: { host: RefObject<HTMLDivElement | null>; onOpenChange: (open: boolean) => void; captionsUrl?: string | undefined; selectedCaptionId: string | null; selectCaption: (id: string | null) => void }) {
  const captions = useCaptionsOptions();
  const captionOptions = captions?.options.filter((option) => !captionsUrl || option.value === "off" || option.value === LOCAL_CAPTION_ID) ?? [];
  const captionValue = selectedCaptionId ?? "off";
  const tracks = captionOptions.filter((option) => option.value !== "off");
  const mode = captionControlMode(tracks.length);
  const speed = usePlaybackRateOptions({ rates: PLAYBACK_RATES, formatRate: (rate) => `${rate}x` });
  return <>
    {mode === "unavailable" && <Button variant="player" aria-label="Captions unavailable" disabled><span>CC</span></Button>}
    {mode === "toggle" && <Button variant="player" aria-label="Captions" aria-pressed={selectedCaptionId !== null}
      onClick={() => selectCaption(selectedCaptionId ? null : tracks[0]?.value ?? null)}>
      <span data-active={selectedCaptionId ? "" : undefined}>CC</span>
    </Button>}
    {mode === "menu" && <SheetMenu label="Captions" triggerLabel="CC" icon={null} options={captionOptions}
          value={captionValue} onSelect={(id) => selectCaption(id === "off" ? null : id)} host={host} onOpenChange={onOpenChange} />}
    {speed && <SheetMenu label="Playback speed" triggerLabel={`${speed.rate}x`} icon={null} options={speed.options}
      value={speed.value} onSelect={speed.setValue} host={host} onOpenChange={onOpenChange} />}
  </>;
}

export function InstrumentPlay({ replay }: { replay: boolean }) {
  return replay ? <ReplayIcon className="ps-play-circle" filled /> : <PlayIcon className="ps-play-circle" filled />;
}
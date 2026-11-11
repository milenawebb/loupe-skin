import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/PlayerIcons";
import { SHORTCUT_GROUPS } from "@/lib/player-keyboard";

export function KeyboardHelp({ host, video, trigger, surface, onClose }: {
  host: RefObject<HTMLDivElement | null>; video: RefObject<HTMLDivElement | null>;
  trigger: RefObject<HTMLButtonElement | null>; onClose: () => void;
  surface: RefObject<HTMLDivElement | null>;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const modalPanel = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ modal: boolean; short: boolean; theme: string; tokens: Record<string, string> } | null>(null);
  useLayoutEffect(() => {
    const player = host.current, media = video.current;
    if (!player || !media) return;
    const position = () => {
      const popup = panel.current;
      if (!popup) return;
      const bounds = media.getBoundingClientRect();
      const controls = player.querySelector('.ps-control-panel')?.getBoundingClientRect();
      if (!controls) return;
      popup.style.width = `${Math.min(bounds.width, 600)}px`;
      popup.toggleAttribute('data-two-columns', bounds.width >= 540);
      const needed = popup.scrollHeight + 2;
      const available = Math.min(bounds.bottom, controls.top) - bounds.top;
      const computed = getComputedStyle(player);
      const tokens: Record<string, string> = {};
      for (const name of ['--text','--line','--font-mono','--popup-fallback','--popup-tint','--popup-sheen','--menu-shadow','--menu-edge','--key-cap-background']) tokens[name] = computed.getPropertyValue(name);
      const parent = player.getBoundingClientRect();
      popup.style.left = `${bounds.right - parent.left - player.clientLeft - popup.offsetWidth}px`;
      popup.style.top = `${controls.top - parent.top - player.clientTop - needed}px`;
      popup.style.height = `${needed}px`;
      setLayout({ modal: needed > available, short: window.innerHeight - 32 < 448, theme: player.dataset['theme'] ?? 'dark', tokens });
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(player); observer.observe(media);
    const controls = player.querySelector('.ps-control-panel');
    if (controls) observer.observe(controls);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    document.addEventListener('fullscreenchange', position);
    return () => { observer.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); document.removeEventListener('fullscreenchange', position); };
  }, [host, video]);
  useLayoutEffect(() => {
    if (!layout) return;
    const popup = layout.modal ? modalPanel.current : panel.current;
    if (!popup) return;
    if (layout.modal && !layout.short && popup.scrollHeight + 2 > window.innerHeight - 32) {
      setLayout(current => current ? { ...current, short: true } : current);
    }
    const frame = requestAnimationFrame(() => popup.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [layout?.modal, layout?.short]);
  const list = <><div className="ps-keys-header"><strong>KEYBOARD</strong><Button variant="player" className="ps-keys-close" aria-label="Close keyboard shortcuts" onClick={onClose}><CloseIcon /></Button></div><div className="ps-keys-groups">{SHORTCUT_GROUPS.map(group => <section className="ps-keys-group" key={group.label}><h3>{group.label}</h3><dl className="ps-keys-grid">{group.shortcuts.map(([key, action]) => <div key={key}><dt><kbd>{key}</kbd></dt><dd>{action}</dd></div>)}</dl></section>)}</div></>;
  if (layout?.modal) return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal container={typeof document !== "undefined" && document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined}><Dialog.Overlay className="ps-keys-backdrop" /><Dialog.Content ref={node => { modalPanel.current = node; surface.current = node; }} aria-describedby={undefined} aria-label="Keyboard shortcuts" data-theme={layout.theme} data-two-columns={layout.short ? '' : undefined} className="ps-menu-surface ps-keyboard-help ps-keys-page-dialog" style={layout.tokens} onOpenAutoFocus={event => { event.preventDefault(); modalPanel.current?.querySelector<HTMLButtonElement>('button')?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }}><Dialog.Title className="sr-only">Keyboard shortcuts</Dialog.Title>{list}</Dialog.Content></Dialog.Portal></Dialog.Root>;
  return <div ref={node => { panel.current = node; surface.current = node; }} role="dialog" aria-label="Keyboard shortcuts" className="ps-menu-surface ps-keyboard-help" style={layout ? undefined : { visibility: 'hidden' }}>{list}</div>;
}
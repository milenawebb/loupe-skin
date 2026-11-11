import { useCallback, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/** Shared interaction policy for every player-local menu surface. */
export function useMenuSurface({ open, setOpen, menu, trigger, host, onOpenChange }: {
  open: boolean; setOpen: (open: boolean) => void;
  menu: RefObject<HTMLDivElement | null>; trigger: RefObject<HTMLElement | null>;
  host: RefObject<HTMLDivElement | null>; onOpenChange?: (open: boolean) => void;
}) {
  const callbacks = useRef({ setOpen, onOpenChange });
  callbacks.current = { setOpen, onOpenChange };
  const close = useCallback(() => {
    callbacks.current.setOpen(false);
    callbacks.current.onOpenChange?.(false);
    const owner = trigger.current;
    const target = owner?.matches('button') ? owner : owner?.querySelector<HTMLElement>('button') ?? owner;
    (target?.getClientRects().length ? target : host.current)?.focus({ preventScroll: true });
    // Closing removes the menu's idle hold; reveal after that state settles.
    requestAnimationFrame(() => host.current?.dispatchEvent(new Event("pointermove", { bubbles: true })));
  }, [trigger, host]);
  const show = useCallback(() => {
    host.current?.dispatchEvent(new CustomEvent("sheet-menu-opening", { detail: menu }));
    callbacks.current.setOpen(true);
    callbacks.current.onOpenChange?.(true);
  }, [host, menu]);
  useLayoutEffect(() => {
    if (!open) return;
    const popup = menu.current;
    const owner = host.current;
    if (!popup || !owner) return;
    const outside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || popup.contains(target) || trigger.current?.contains(target)) return;
      const videoSurface = target instanceof Element && owner.contains(target) && target.closest(".ps-video");
      close();
      // Controls still receive their click; only a video-surface click is consumed.
      if (videoSurface) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
      if (event.key !== "Tab") return;
      event.preventDefault(); event.stopImmediatePropagation();
      const items = Array.from(popup.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]'))
        .filter((item) => item.getClientRects().length > 0 && !item.closest('[inert]'));
      if (!items.length) { popup.focus(); return; }
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = current < 0 ? (event.shiftKey ? items.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
    };
    const opening = (event: Event) => { if ((event as CustomEvent).detail !== menu) close(); };
    document.addEventListener("click", outside, true);
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("fullscreenchange", close);
    owner.addEventListener("sheet-menu-opening", opening);
    owner.addEventListener("sheet-close-menus", close);
    return () => {
      document.removeEventListener("click", outside, true);
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("fullscreenchange", close);
      owner.removeEventListener("sheet-menu-opening", opening);
      owner.removeEventListener("sheet-close-menus", close);
    };
  }, [open, menu, trigger, host, close]);
  return { close, show, toggle: () => open ? close() : show() };
}
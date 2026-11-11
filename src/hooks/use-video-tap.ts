import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { isVideoTap } from "@/lib/video-tap";

/** One rule set for touch taps and mouse clicks; the click phase lets shared menu dismissal win. Double click toggles fullscreen. */
export function useVideoTap(host: RefObject<HTMLDivElement | null>, dragging: RefObject<boolean>, toggle: () => void, reveal: () => void, fullscreen?: () => void) {
  const callbacks = useRef({ toggle, reveal, fullscreen });
  callbacks.current = { toggle, reveal, fullscreen };
  useEffect(() => {
    const video = host.current;
    if (!video) return;
    let press: { id: number; x: number; y: number; time: number; distance: number } | null = null;
    let touchClick: boolean | null = null;
    const excluded = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('button, [role="button"], [role="slider"], .ps-slider, .ps-contact, .ps-menu-surface'));
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) { touchClick = null; return; }
      touchClick = false;
      if (excluded(e.target) || dragging.current) return;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp, distance: 0 };
    };
    const move = (e: PointerEvent) => {
      if (press?.id === e.pointerId) press.distance = Math.max(press.distance, Math.hypot(e.clientX - press.x, e.clientY - press.y));
    };
    const up = (e: PointerEvent) => {
      if (press?.id !== e.pointerId) return;
      move(e);
      const mouse = e.pointerType !== "touch";
      // Mouse clicks have no duration limit; any click that ends a drag or scrub is ignored.
      touchClick = (mouse ? press.distance < 10 : isVideoTap(press.distance, e.timeStamp - press.time)) && !dragging.current;
      press = null;
    };
    const cancel = () => { press = null; touchClick = false; };
    const click = (e: MouseEvent) => {
      if (touchClick === null || excluded(e.target)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (touchClick && !dragging.current) { callbacks.current.reveal(); callbacks.current.toggle(); }
      touchClick = null;
    };
    const dbl = (e: MouseEvent) => {
      if (excluded(e.target) || dragging.current || !callbacks.current.fullscreen) return;
      e.preventDefault(); e.stopImmediatePropagation();
      callbacks.current.fullscreen();
    };
    video.addEventListener("dblclick", dbl, true);
    video.addEventListener("pointerdown", down);
    video.addEventListener("pointermove", move);
    video.addEventListener("pointerup", up);
    video.addEventListener("pointercancel", cancel);
    video.addEventListener("click", click, true);
    return () => {
      video.removeEventListener("pointerdown", down); video.removeEventListener("pointermove", move);
      video.removeEventListener("pointerup", up); video.removeEventListener("pointercancel", cancel);
      video.removeEventListener("click", click, true);
      video.removeEventListener("dblclick", dbl, true);
    };
  }, [host, dragging]);
}
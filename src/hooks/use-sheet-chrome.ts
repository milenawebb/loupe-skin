import { useCallback, useEffect, useRef, useState } from "react";
import { TOUCH_PRIMARY_QUERY } from "@/lib/volume-panel";

/** Keep the viewport still until a frame crosses either visible edge. */
export function revealOffset(start: number, size: number, scroll: number, viewport: number) {
  if (size > viewport && start <= scroll && start + size >= scroll + viewport) return scroll;
  if (start < scroll) return start;
  if (start + size > scroll + viewport) return start + size - viewport;
  return scroll;
}

/** Inactivity before playback chrome hides. */
export const CHROME_IDLE_MS = 1800;
/** Fade-out length; the fade-in is 120ms in CSS. */
export const CHROME_FADE_OUT_MS = 200;

export function useSheetChrome(paused: boolean, engaged: boolean, cleanRest = false) {
  const [touchPrimary, setTouchPrimary] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(TOUCH_PRIMARY_QUERY);
    const update = () => setTouchPrimary(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const cleanAtRest = cleanRest && !touchPrimary;
  const [idle, setIdle] = useState(cleanRest);
  const [interacting, setInteracting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearTimer = useCallback(() => { clearTimeout(timer.current); clearTimeout(fadeTimer.current); }, []);
  const reveal = useCallback(() => {
    clearTimer();
    setIdle(false);
    setInteracting(true);
    const hold = engaged || (paused && !cleanAtRest);
    if (!hold) timer.current = setTimeout(() => {
      setIdle(true);
      const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : CHROME_FADE_OUT_MS;
      fadeTimer.current = setTimeout(() => setInteracting(false), delay);
    }, CHROME_IDLE_MS);
  }, [engaged, paused, cleanAtRest, clearTimer]);

  useEffect(() => {
    clearTimer();
    if (cleanAtRest && !engaged) { setIdle(true); setInteracting(false); }
    else reveal();
    return clearTimer;
  }, [paused, cleanAtRest, engaged, reveal, clearTimer]);

  return { hidden: idle && !cleanAtRest, controlsIdle: idle, interacting, reveal };
}
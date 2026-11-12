import { useCallback, useEffect, useRef, useState } from "react";

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
  const [idle, setIdle] = useState(cleanRest);
  const [interacting, setInteracting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearTimer = useCallback(() => { clearTimeout(timer.current); clearTimeout(fadeTimer.current); }, []);
  const reveal = useCallback(() => {
    clearTimer();
    setIdle(false);
    setInteracting(true);
    const hold = engaged || (paused && !cleanRest);
    if (!hold) timer.current = setTimeout(() => {
      setIdle(true);
      const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : CHROME_FADE_OUT_MS;
      fadeTimer.current = setTimeout(() => setInteracting(false), delay);
    }, CHROME_IDLE_MS);
  }, [engaged, paused, cleanRest, clearTimer]);

  useEffect(() => {
    clearTimer();
    if (cleanRest && !engaged) { setIdle(true); setInteracting(false); }
    else reveal();
    return clearTimer;
  }, [paused, cleanRest, engaged, reveal, clearTimer]);

  return { hidden: idle && !cleanRest, controlsIdle: idle, interacting, reveal };
}
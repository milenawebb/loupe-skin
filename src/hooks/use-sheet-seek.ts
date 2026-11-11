import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { flushSync } from "react-dom";
import { seekApproximate, SHEET_SEEK_FADE_DURATION, SHEET_SEEK_LOADING_DELAY } from "@/lib/sheet-seek";

export function useSheetSeek(videoWrap: RefObject<HTMLDivElement | null>, playbackFrame?: number) {
  const [preview, setPreview] = useState<{ index: number; time: number; resolving: boolean; loading: boolean } | null>(null);
  const [chosenFrame, setChosenFrame] = useState<number | null>(null);
  const pending = useRef(false);
  const resume = useRef(false);
  const holding = useRef(false);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clear = () => { clearTimeout(loadingTimer.current); clearTimeout(fadeTimer.current); };
  useEffect(() => {
    if (!pending.current && chosenFrame !== null && playbackFrame === chosenFrame) setChosenFrame(null);
  }, [playbackFrame, chosenFrame, preview]);
  useEffect(() => {
    const video = videoWrap.current?.querySelector("video");
    if (!video) return;
    const resolved = () => {
      if (!pending.current || video.seeking) return;
      pending.current = false;
      clear();
      // Playback state survives the seek: playing resumes, paused stays paused.
      if (resume.current && video.paused) void video.play()?.catch?.(() => {});
      resume.current = false;
      if (holding.current) return;
      setPreview((current) => current ? { ...current, loading: false, resolving: true } : null);
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduced) setPreview(null);
      else fadeTimer.current = setTimeout(() => setPreview(null), SHEET_SEEK_FADE_DURATION);
    };
    video.addEventListener("seeked", resolved);
    return () => { video.removeEventListener("seeked", resolved); clear(); };
  }, [videoWrap]);
  const seek = (index: number, time: number) => {
    const video = videoWrap.current?.querySelector("video");
    if (!video) return;
    clear();
    holding.current = false;
    pending.current = true;
    resume.current = !video.paused && !video.ended;
    // Commit image, active tile and progress before the media starts seeking.
    flushSync(() => { setChosenFrame(index); setPreview({ index, time, resolving: false, loading: false }); });
    loadingTimer.current = setTimeout(() => {
      if (pending.current) setPreview((current) => current ? { ...current, loading: true } : null);
    }, SHEET_SEEK_LOADING_DELAY);
    seekApproximate(video, time);
  };
  /** Show a tile as the overlay without seeking (drag in progress). */
  const hold = (index: number, time: number) => {
    holding.current = true;
    clearTimeout(fadeTimer.current);
    setPreview({ index, time, resolving: false, loading: false });
  };
  /** Drop a held overlay; playback is untouched. */
  const cancelHold = () => { holding.current = false; if (!pending.current) { clear(); setPreview(null); } };
  return { preview, chosenFrame, seek, hold, cancelHold };
}
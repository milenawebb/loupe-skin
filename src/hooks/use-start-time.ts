import { useEffect } from "react";
import type { RefObject } from "react";

export function useStartTime(host: RefObject<HTMLDivElement | null>, startTime?: number) {
  useEffect(() => {
    if (startTime === undefined) return;
    const video = host.current?.querySelector("video");
    if (!video) return;
    let applied = false;
    const seek = () => {
      if (applied || !Number.isFinite(video.duration) || video.duration <= 0) return;
      video.currentTime = Math.min(startTime, video.duration);
      applied = true;
    };
    video.addEventListener("loadedmetadata", seek);
    video.addEventListener("durationchange", seek);
    seek();
    return () => { video.removeEventListener("loadedmetadata", seek); video.removeEventListener("durationchange", seek); };
  }, [host, startTime]);
}
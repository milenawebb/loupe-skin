import { useEffect } from "react";
import type { RefObject } from "react";
import { captionTrackAllowed } from "@/lib/player-captions";

/** Native HLS can still add source tracks; keep those disabled, without changing local CC selection. */
export function useLocalCaptions(host: RefObject<HTMLDivElement | null>, captionsUrl?: string) {
  useEffect(() => {
    const video = host.current?.querySelector("video");
    if (!video || !captionsUrl) return;
    const tracks = video.textTracks;
    const enforce = () => {
      for (const track of Array.from(tracks)) {
        if (!captionTrackAllowed(track, captionsUrl) && track.mode !== "disabled") track.mode = "disabled";
      }
    };
    tracks.addEventListener("addtrack", enforce);
    tracks.addEventListener("change", enforce);
    video.addEventListener("loadedmetadata", enforce);
    enforce();
    return () => {
      tracks.removeEventListener("addtrack", enforce);
      tracks.removeEventListener("change", enforce);
      video.removeEventListener("loadedmetadata", enforce);
    };
  }, [host, captionsUrl]);
}
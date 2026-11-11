import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { captionCueText } from "@/lib/player-captions";

/** Video.js requests selection; the native hidden-track engine owns cue timing. */
export function useCaptionCues(host: RefObject<HTMLDivElement | null>, captionsUrl?: string) {
  const [captions, setCaptions] = useState<{ text: string; selectedId: string | null }>({ text: "", selectedId: null });
  const selection = useRef<(id: string | null) => void>(() => {});
  const select = useCallback((id: string | null) => selection.current(id), []);
  useEffect(() => {
    const video = host.current?.querySelector("video");
    if (!video) return;
    const tracks = video.textTracks;
    let selected: TextTrack | null = null;
    let explicitlyOff = false;
    let reported = false;
    const trackId = (track: TextTrack) => track.id || `track:${Array.from(tracks).indexOf(track)}:${track.kind}:${track.language}:${track.label}`;
    const update = () => {
      const cues = Array.from(selected?.activeCues ?? []).filter((cue): cue is VTTCue => "text" in cue);
      setCaptions({ text: captionCueText(cues), selectedId: selected ? trackId(selected) : null });
      if (!reported && selected?.cues?.length) {
        reported = true;
        console.info("Loupe caption tracks ready", Array.from(tracks, (track) => ({ id: trackId(track), kind: track.kind, mode: track.mode, cueCount: track.cues?.length ?? 0 })));
      }
    };
    const bind = () => {
      const available = Array.from(tracks).filter((track) => (track.kind === "captions" || track.kind === "subtitles") && (!captionsUrl || track.id === "loupe-local-english"));
      const next = available.find((track) => track.mode === "showing")
        ?? (selected && available.includes(selected) && selected.mode === "hidden" ? selected : null)
        ?? available.find((track) => track.mode === "hidden") ?? null;
      if (next !== selected) {
        selected?.removeEventListener("cuechange", update);
        selected?.removeEventListener("load", update);
        selected = next;
        selected?.addEventListener("cuechange", update);
        selected?.addEventListener("load", update);
      }
      // Hidden populates activeCues without browser painting. Disabled is only Off.
      if (selected && selected.mode !== "hidden") selected.mode = "hidden";
      update();
    };
    const added = () => {
      if (!selected && !explicitlyOff) {
        const first = Array.from(tracks).find((track) => ["captions", "subtitles"].includes(track.kind) && (!captionsUrl || track.id === "loupe-local-english"));
        if (first) first.mode = "hidden";
      }
      bind();
    };
    selection.current = (id) => {
      explicitlyOff = id === null;
      for (const track of Array.from(tracks)) {
        if (!["captions", "subtitles"].includes(track.kind)) continue;
        track.mode = id === trackId(track) ? "hidden" : "disabled";
      }
      bind();
    };
    tracks.addEventListener("addtrack", added);
    tracks.addEventListener("removetrack", bind);
    tracks.addEventListener("change", bind);
    added();
    return () => {
      tracks.removeEventListener("addtrack", added);
      tracks.removeEventListener("removetrack", bind);
      tracks.removeEventListener("change", bind);
      selected?.removeEventListener("cuechange", update);
      selected?.removeEventListener("load", update);
      selection.current = () => {};
    };
  }, [host, captionsUrl]);
  return { ...captions, select };
}
export function captionControlMode(trackCount: number) {
  return trackCount === 0 ? "unavailable" : trackCount === 1 ? "toggle" : "menu";
}

export function toggledCaptionValue(value: string, trackValue: string) {
  return value === "off" ? trackValue : "off";
}

export const LOCAL_CAPTION_ID = "loupe-local-english";

/** Do not create HLS caption tracks when a host supplies its own VTT. */
export function captionPlaybackSource(playbackId: string, captionsUrl?: string) {
  return captionsUrl ? {
    playbackId,
    engine: { hlsJs: { enableWebVTT: false, enableIMSC1: false, enableCEA708Captions: false } },
  } : { playbackId, engine: { hlsJs: { renderTextTracksNatively: true } } };
}

export function captionTrackAllowed(track: { id: string; kind: string }, captionsUrl?: string) {
  return !captionsUrl || !["captions", "subtitles"].includes(track.kind) || track.id === LOCAL_CAPTION_ID;
}

/** Cue markup is read as text only; it must never become player HTML. */
export function captionCueText(cues: readonly { text: string; getCueAsHTML?: () => DocumentFragment }[]) {
  return cues.map((cue) => cue.getCueAsHTML?.().textContent ?? cue.text.replace(/<[^>]*>/g, "")).join("\n");
}
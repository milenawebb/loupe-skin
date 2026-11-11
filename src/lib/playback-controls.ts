export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const durationKnown = (duration: number) => Number.isFinite(duration) && duration > 0;
export const fullChromeVisible = (hasPlayed: boolean, ended = false, interacting = false) => (hasPlayed && !ended) || interacting;
export const resetEndedRate = (player: { setPlaybackRate: (rate: number) => void }) => player.setPlaybackRate(1);
export const hasCaptionTracks = (tracks: readonly { kind: string }[]) => tracks.some((track) => track.kind === "captions" || track.kind === "subtitles");
export const loadingVisible = (ready: boolean, waiting: boolean, ended: boolean, failed: boolean) => !failed && !ended && (!ready || waiting);
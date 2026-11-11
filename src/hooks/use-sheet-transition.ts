import { useCallback, useRef, useState } from "react";

/** Open state and stable refs; the full-size media never moves or resizes. */
export function useSheetTransition(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => setOpen(false), []);
  return { open, openSheet, closeSheet, playerRef, videoRef, sheetRef, dragging };
}

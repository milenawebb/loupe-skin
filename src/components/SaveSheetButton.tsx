import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ExportSheet } from "@/lib/sheet-export";
import { sourcePageUrl } from "@/lib/export-config";
import { SaveIcon } from "@/components/PlayerIcons";

export function SaveSheetButton({ sheet, title, playbackId, picks = new Set<number>() }: { sheet: ExportSheet; title: string; playbackId: string; picks?: ReadonlySet<number> }) {
  const [status, setStatus] = useState<"ready" | "saving" | "failed">("ready");
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const save = async () => {
    if (busy.current) return;
    busy.current = true;
    clearTimeout(timer.current);
    setStatus("saving");
    try {
      if (picks.size) {
        const { savePicksPdf } = await import("@/lib/sheet-picks-pdf");
        await savePicksPdf(sheet, picks, title, sourcePageUrl(window.location.pathname), playbackId);
      } else {
        const { saveSheetPdf } = await import("@/lib/sheet-pdf");
        await saveSheetPdf(sheet, title, sourcePageUrl(window.location.pathname), playbackId);
      }
      setStatus("ready");
    } catch (error) {
      console.error("Loupe contact sheet export failed", error);
      setStatus("failed");
      timer.current = setTimeout(() => setStatus("ready"), 2000);
    } finally {
      busy.current = false;
    }
  };
  return <Button variant="player" type="button" aria-label={picks.size ? "Save picks" : "Save sheet"} disabled={status === "saving"} onClick={() => void save()}>
    <SaveIcon />
    <span role="status">{status === "saving" ? "SAVING" : status === "failed" ? "FAILED" : picks.size ? "SAVE PICKS" : "SAVE SHEET"}</span>
  </Button>;
}
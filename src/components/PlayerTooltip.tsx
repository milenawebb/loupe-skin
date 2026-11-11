import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactElement, RefObject } from "react";

export const PLAYER_TOOLTIP_DELAY = 400;

/** Portal inside the owning player to retain its theme and stacking boundary. */
export function PlayerTooltip({ label, host, children, side = "top" }: {
  label: string;
  host: RefObject<HTMLDivElement | null>;
  children: ReactElement;
  side?: "top" | "right";
}) {
  return <TooltipPrimitive.Provider delayDuration={PLAYER_TOOLTIP_DELAY} skipDelayDuration={0}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal container={host.current}>
        <TooltipPrimitive.Content className="ps-control-tooltip" side={side} sideOffset={6}
          collisionBoundary={host.current} collisionPadding={6}>
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>;
}
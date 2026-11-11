import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Measure the player element itself, never its host container.
 * Uses the ResizeObserver border-box size: getBoundingClientRect would report
 * a scaled-down width while an ancestor scroll animation scales the player,
 * which could flip it into its compact layout mid-scroll.
 */
export function usePlayerWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.borderBoxSize;
      const size = Array.isArray(box) ? box[0] : box;
      setWidth(size ? size.inlineSize : entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

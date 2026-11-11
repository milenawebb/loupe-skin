import { useEffect, useRef, useState, type ReactNode } from "react";

/** Measure sheet content only; the media never participates in the transition. */
export function SheetExpansion({ open, children }: { open: boolean; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.getBoundingClientRect().height));
    observer.observe(element);
    setHeight(element.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, []);
  return <div className="ps-sheet-expansion" style={{ height: open ? height : 0 }} inert={!open} aria-hidden={!open}>
    <div ref={content}>{children}</div>
  </div>;
}
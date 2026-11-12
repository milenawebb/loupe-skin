import { useLayoutEffect, useEffect, useRef, useState, type RefObject } from "react";
import { SHEET_FOLLOW_PAUSE_MS, SHEET_WHEEL_IDLE_MS, SHEET_WHEEL_GESTURE_IDLE_MS, SHEET_WHEEL_ANIMATION_MS, accumulateSheetWheel, threeRowHeight, clampSheetRow, sheetWheelCanMove, sheetWheelIntent } from "@/lib/sheet-scroll";

export function useSheetScroll(grid: RefObject<HTMLDivElement | null>, index: number, columns: number, open: boolean, playing: boolean) {
  const scroller = useRef<HTMLDivElement>(null);
  const stride = useRef(1);
  const firstRow = useRef(0);
  const pausedUntil = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animation = useRef<number | null>(null);
  const [resume, setResume] = useState(0);
  const [edges, setEdges] = useState({ above: false, below: false });
  const [touch, setTouch] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const readEdges = () => {
    const rows = grid.current;
    if (rows) {
      firstRow.current = clampSheetRow((scroller.current?.scrollTop ?? 0) / stride.current, rows.children.length);
      setEdges({ above: firstRow.current > 0, below: firstRow.current + 3 < rows.children.length });
      setPage(Math.floor(firstRow.current / 3) + 1);
      setPages(Math.max(1, Math.ceil(rows.children.length / 3)));
    }
  };
  const move = (row: number, smooth = false) => {
    const rows = grid.current;
    const el = scroller.current;
    if (!rows || !el) return;
    firstRow.current = clampSheetRow(row, rows.children.length);
    const top = firstRow.current * stride.current;
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    if (smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const from = el.scrollTop;
      const started = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / SHEET_WHEEL_ANIMATION_MS);
        el.scrollTop = from + (top - from) * (1 - Math.pow(1 - progress, 3));
        if (progress < 1) animation.current = requestAnimationFrame(tick);
        else { animation.current = null; firstRow.current = clampSheetRow(top / stride.current, rows.children.length); readEdges(); }
      };
      animation.current = requestAnimationFrame(tick);
    } else {
      el.scrollTop = top;
      readEdges();
    }
  };
  const reveal = (frame: number) => {
    const el = scroller.current;
    if (!el) return;
    const row = Math.floor(frame / columns);
    readEdges();
    move(row < firstRow.current ? row : row > firstRow.current + 2 ? row - 2 : firstRow.current);
  };
  const manual = () => {
    pausedUntil.current = Date.now() + SHEET_FOLLOW_PAUSE_MS;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setResume(n => n + 1), SHEET_FOLLOW_PAUSE_MS);
  };
  useEffect(() => () => {
    clearTimeout(timer.current);
    if (animation.current !== null) cancelAnimationFrame(animation.current);
  }, []);
  useLayoutEffect(() => {
    const el = scroller.current;
    const rows = grid.current;
    if (!el || !rows) return;
    const measure = () => {
      const row = rows.firstElementChild;
      if (!row) return;
      const tile = row.querySelector<HTMLElement>(".ps-sheet-tile");
      const height = tile ? parseFloat(getComputedStyle(tile).height) : (row as HTMLElement).offsetHeight;
      stride.current = height + 4;
      el.style.height = `${threeRowHeight(height, 4, 4)}px`;
      move(firstRow.current);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(rows);
    const media = window.matchMedia("(pointer: coarse)");
    const mode = () => { setTouch(media.matches); };
    mode();
    media.addEventListener("change", mode);
    let lastOutsideWheel = -Infinity;
    let lastSheetWheel = -Infinity;
    let owned = false;
    const wheelState = { total: 0, direction: 0, cooldownUntil: 0 };
    const leave = () => { owned = false; };
    const globalWheel = (event: WheelEvent) => {
      if (!(event.target instanceof Node) || !el.contains(event.target)) { lastOutsideWheel = performance.now(); owned = false; }
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) return;
      const now = performance.now();
      const previousWheel = lastSheetWheel;
      if (now - previousWheel >= SHEET_WHEEL_IDLE_MS) owned = false;
      const intent = sheetWheelIntent(now, lastOutsideWheel, owned);
      lastSheetWheel = now;
      readEdges();
      if (!intent) { wheelState.total = 0; return; }
      if (!sheetWheelCanMove(firstRow.current, rows.children.length, event.deltaY)) {
        wheelState.total = 0;
        // Swallow only this gesture's trailing inertia; a later gesture chains to the page.
        if (owned && now - previousWheel < SHEET_WHEEL_GESTURE_IDLE_MS) event.preventDefault();
        return;
      }
      owned = true;
      event.preventDefault();
      manual();
      const step = accumulateSheetWheel(wheelState, event.deltaY, event.deltaMode, now, previousWheel);
      wheelState.total = step.total;
      wheelState.direction = step.direction;
      wheelState.cooldownUntil = step.cooldownUntil;
      if (step.move) move(firstRow.current + step.move, true);
    };
    // Native vertical touch scrolling, including inertia and boundary chaining.
    // No pointer cancellation, pointer capture or horizontal paging here.
    const down = (event: PointerEvent) => { if (event.pointerType === "touch") manual(); };
    const scroll = () => readEdges();
    el.addEventListener("pointerleave", leave);
    window.addEventListener("wheel", globalWheel, { passive: true, capture: true });
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", down, { passive: true });
    el.addEventListener("scroll", scroll, { passive: true });
    measure();
    return () => {
      if (animation.current !== null) cancelAnimationFrame(animation.current);
      observer.disconnect(); media.removeEventListener("change", mode);
      window.removeEventListener("wheel", globalWheel, true); el.removeEventListener("pointerleave", leave); el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerdown", down); el.removeEventListener("scroll", scroll);
    };
  }, [grid, columns]);
  useEffect(() => {
    if (open && playing && Date.now() >= pausedUntil.current) reveal(index);
  }, [index, columns, open, playing, resume]);
  useEffect(() => { if (open) reveal(index); }, [open]);
  return { scroller, edges, manual, reveal, onScroll: readEdges, touch, page, pages };
}
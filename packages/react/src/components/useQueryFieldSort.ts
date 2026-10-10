import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** 计算插入顺序和每项让位距离；拖动项限制在原内容边界内，其余项按实际高度连续排布。 */
export function getQuerySortPreview(keys: readonly string[], rects: readonly { top: number; height: number }[], from: number, dy: number, gap: number) {
  const center = rects[from].top + rects[from].height / 2 + dy;
  const rest = keys.map((_, index) => index).filter(index => index !== from);
  const to = rest.filter(index => center > rects[index].top + rects[index].height / 2).length;
  const ordered = [...keys];
  ordered.splice(to, 0, ordered.splice(from, 1)[0]);
  const offsets: Record<string, number> = {};
  // transform 也会扩大滚动溢出范围，拖动行不能越过首尾边界，否则会不断撑大 scrollHeight。
  const last = rects[rects.length - 1];
  const boundedDy = Math.max(rects[0].top - rects[from].top, Math.min(dy, last.top + last.height - rects[from].height - rects[from].top));
  let top = rects[0].top;
  for (const key of ordered) {
    const index = keys.indexOf(key);
    offsets[key] = index === from ? boundedDy : top - rects[index].top;
    top += rects[index].height + gap;
  }
  return { ordered, offsets };
}

/** 查询设置的指针排序；实时让位、边缘滚动，松手提交草稿，Escape/取消/失焦恢复原顺序。 */
export function useQueryFieldSort(keys: readonly string[], enabled: boolean, onCommit: (keys: readonly string[]) => void) {
  const listRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<() => void>();
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const [preview, setPreview] = useState<{ key: string; offsets: Record<string, number> }>();
  const signature = JSON.stringify(keys);
  useEffect(() => { cancelRef.current?.(); return () => cancelRef.current?.(); }, [enabled, signature]);

  /** 用指针捕获替代原生 HTML 拖放，避免浏览器生成半透明副本且松手前没有预览。 */
  function start(event: ReactPointerEvent<HTMLDivElement>, key: string) {
    if (!enabled || event.button !== 0 || (event.target as Element).closest("button, input, label")) return;
    const list = listRef.current;
    const from = keys.indexOf(key);
    if (!list || from < 0) return;
    cancelRef.current?.();
    const elements = [...list.querySelectorAll<HTMLElement>(".sia-query-settings__item")];
    if (elements.length !== keys.length) return;
    const rects = elements.map(element => element.getBoundingClientRect());
    const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
    const original = [...keys];
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    const startY = event.clientY;
    const initialScroll = list.scrollTop;
    // 固定使用拖动开始时的滚动上限，避免位移引起的临时溢出反过来推动自动滚动。
    const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
    const originalUserSelect = document.body.style.userSelect;
    let lastY = startY;
    let moved = false;
    let ended = false;
    let ordered = original;
    let frame = 0;
    target.setPointerCapture(pointerId);

    const update = () => {
      const dy = lastY - startY + list.scrollTop - initialScroll;
      if (!moved && Math.abs(dy) < 4) return;
      moved = true;
      document.body.style.userSelect = "none";
      const next = getQuerySortPreview(original, rects, from, dy, gap);
      ordered = next.ordered;
      setPreview({ key, offsets: next.offsets });
    };
    const tick = () => {
      if (moved) {
        const bounds = list.getBoundingClientRect();
        const delta = lastY < bounds.top + 32 ? -10 : lastY > bounds.bottom - 32 ? 10 : 0;
        const nextScroll = Math.max(0, Math.min(maxScroll, list.scrollTop + delta));
        if (delta && nextScroll !== list.scrollTop) { list.scrollTop = nextScroll; update(); }
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (next: PointerEvent) => { if (next.pointerId === pointerId) { lastY = next.clientY; update(); } };
    const finish = (commit: boolean) => {
      if (ended) return;
      ended = true;
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancelPointer);
      target.removeEventListener("lostpointercapture", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", escape, true);
      cancelAnimationFrame(frame);
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
      document.body.style.userSelect = originalUserSelect;
      cancelRef.current = undefined;
      setPreview(undefined);
      if (commit && moved) commitRef.current(ordered);
    };
    const up = (next: PointerEvent) => { if (next.pointerId === pointerId) { lastY = next.clientY; update(); finish(true); } };
    const cancel = () => finish(false);
    const cancelPointer = (next: PointerEvent) => { if (next.pointerId === pointerId) cancel(); };
    const escape = (next: KeyboardEvent) => {
      if (next.key === "Escape") { next.preventDefault(); next.stopImmediatePropagation(); cancel(); }
    };
    cancelRef.current = cancel;
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancelPointer);
    target.addEventListener("lostpointercapture", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", escape, true);
    frame = requestAnimationFrame(tick);
  }
  return { listRef, preview, start };
}

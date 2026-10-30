import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

type SelectionBox = { x: number; y: number; width: number; height: number; key: string };

/** 分段选择共用一个背景层；只在选项或布局变化时测量，动画仅改变 transform。 */
export function SegmentedSelectionMotion({ rootRef, enabled }: { rootRef: RefObject<HTMLDivElement>; enabled: boolean }) {
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<SelectionBox>();
  const animation = useRef<Animation>();
  useLayoutEffect(() => {
    const root = rootRef.current;
    const indicator = indicatorRef.current;
    if (!root || !indicator) return;
    let frame = 0;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const candidates = [...root.querySelectorAll<HTMLButtonElement>(':scope > button.is-selected')]
        .filter(button => button.parentElement === root && !button.closest('[aria-hidden="true"]') && button.getClientRects().length > 0);
      const target = enabled && candidates.length === 1 ? candidates[0] : undefined;
      root.querySelectorAll('[data-sia-segmented-highlight]').forEach(button => {
        if (button !== target && button.parentElement === root) button.removeAttribute('data-sia-segmented-highlight');
      });
      if (!target || root.offsetWidth === 0) {
        animation.current?.cancel();
        indicator.style.display = 'none';
        previous.current = undefined;
        return;
      }
      const bounds = root.getBoundingClientRect();
      // 组合组件可能位于缩放中的弹层，将视口坐标换回面板自身的布局坐标。
      const scaleX = bounds.width / root.offsetWidth || 1;
      const scaleY = bounds.height / root.offsetHeight || 1;
      const box = (node: HTMLElement) => {
        const rect = node.getBoundingClientRect();
        return { x: (rect.left - bounds.left) / scaleX + root.scrollLeft - root.clientLeft, y: (rect.top - bounds.top) / scaleY + root.scrollTop - root.clientTop, width: rect.width / scaleX, height: rect.height / scaleY };
      };
      const next = { ...box(target), key: target.dataset.segmentedKey ?? '' };
      if (!target.hasAttribute('data-sia-segmented-highlight')) target.dataset.siaSegmentedHighlight = '';
      indicator.style.borderRadius = getComputedStyle(target).borderRadius;
      indicator.style.opacity = target.disabled ? '.5' : '1';
      const last = previous.current;
      if (last && last.key === next.key && ['x', 'y', 'width', 'height'].every(key => Math.abs(last[key as keyof Omit<SelectionBox, 'key'>] - next[key as keyof Omit<SelectionBox, 'key'>]) < .5)) return;
      const from = animation.current && ['running', 'paused'].includes(animation.current.playState) ? box(indicator) : last;
      animation.current?.cancel();
      indicator.style.display = 'block';
      indicator.style.width = `${next.width}px`;
      indicator.style.height = `${next.height}px`;
      indicator.style.transform = `translate(${next.x}px, ${next.y}px)`;
      previous.current = next;
      // 首次定位、布局变化及减少动态效果直接对齐；选项改变才滑动。
      if (from && last?.key !== next.key && !media.matches && indicator.animate) {
        const running = indicator.animate([
          { transform: `translate(${from.x}px, ${from.y}px) scale(${from.width / next.width}, ${from.height / next.height})` },
          { transform: `translate(${next.x}px, ${next.y}px) scale(1)` },
        ], { duration: 260, easing: 'cubic-bezier(.22,.8,.25,1)' });
        animation.current = running;
        running.finished.then(() => { if (animation.current === running) { running.cancel(); animation.current = undefined; } }, () => {});
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); };
    const reduceMotion = () => { animation.current?.cancel(); update(); };
    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    root.querySelectorAll(':scope > button').forEach(button => observer.observe(button));
    root.addEventListener('transitionend', schedule);
    media.addEventListener('change', reduceMotion);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); root.removeEventListener('transitionend', schedule); media.removeEventListener('change', reduceMotion); };
  });
  useLayoutEffect(() => () => { animation.current?.cancel(); }, []);
  return <span ref={indicatorRef} className="sia-segmented__selection" role="presentation" aria-hidden="true" />;
}

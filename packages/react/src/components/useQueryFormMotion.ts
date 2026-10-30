import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

type FieldBox = { x: number; y: number; width: number; height: number; opacity?: number };
type Layout = { height: number; boxes: Map<HTMLElement, FieldBox> };

/** 读取一次当前字段几何，缩放中的弹层需换回本地布局坐标。 */
function readLayout(row: HTMLDivElement): Layout {
  const root = row.getBoundingClientRect();
  const scaleX = root.width / row.offsetWidth || 1, scaleY = root.height / row.offsetHeight || 1;
  const boxes = new Map<HTMLElement, FieldBox>();
  for (const node of [...row.children] as HTMLElement[]) {
    if (node.hidden) continue;
    const rect = node.getBoundingClientRect();
    boxes.set(node, { x: (rect.left - root.left) / scaleX + row.scrollLeft, y: (rect.top - root.top) / scaleY + row.scrollTop, width: rect.width / scaleX, height: rect.height / scaleY });
  }
  return { height: row.offsetHeight, boxes };
}

/** 查询条件切换时一次性测量首尾布局；字段只动画透明度/位移，容器高度过渡让后续内容自然跟随。 */
export function useQueryFormMotion(ref: RefObject<HTMLDivElement>, layoutKey: string) {
  const previous = useRef<Layout>();
  const stop = useRef<(() => void)>();
  const snapshot = useRef<(() => Layout)>();
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    if (!previous.current) { previous.current = readLayout(row); return; }
    let cancelled = false;
    // 同一次操作可能同步更新收起状态和可容纳字段数，等这一批提交结束再测量，避免使用中间布局。
    queueMicrotask(() => {
      if (cancelled) return;
      // 外层只负责高度裁切，内部 flex 始终保持目标布局，避免单行字段随容器高度垂直漂移。
      const shell = row.parentElement!;
      const before = snapshot.current?.() ?? previous.current;
      const startHeight = stop.current ? shell.offsetHeight : before?.height;
      stop.current?.();
      const after = readLayout(row);
      previous.current = after;
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (!before || startHeight === undefined || media.matches || !row.animate) return;
      const animations: Animation[] = [];
      const restores: (() => void)[] = [];
      const options: KeyframeAnimationOptions = { duration: 240, easing: "cubic-bezier(.4,0,.6,1)", fill: "both" };
      const overflow = shell.style.overflow;
      const rowOverflow = row.style.overflow;
      row.dataset.queryMotion = "true";
      shell.style.overflow = "hidden";
      // 收起态的横向滚动容器不能提前裁掉退出字段和移动中的操作区，由外壳统一裁切。
      row.style.overflow = "visible";
      animations.push(shell.animate([{ height: `${startHeight}px` }, { height: `${after.height}px` }], options));
      // 控制独立合成层数量；大型查询区域只对前 24 个字段和操作区做位移/淡入淡出。
      const candidates = [...new Set([...before.boxes.keys(), ...after.boxes.keys()])];
      const moving = candidates.filter((node, index) => index < 24 || node.classList.contains("sia-query-form__actions"));
      const nodeAnimations = new Map<HTMLElement, Animation>();
      for (const node of moving) {
        const from = before.boxes.get(node), to = after.boxes.get(node);
        if (from && !to && node.isConnected) {
          const keys = ["position", "left", "top", "width", "height", "pointerEvents"] as const;
          const saved = keys.map(key => node.style[key]);
          const inert = node.hasAttribute("inert");
          // 退场字段退出正常布局但保留当前画面，立即阻止焦点和点击，结束后再隐藏。
          node.hidden = false;
          Object.assign(node.style, { position: "absolute", left: `${from.x}px`, top: `${from.y}px`, width: `${from.width}px`, height: `${from.height}px`, pointerEvents: "none" });
          node.setAttribute("inert", "");
          restores.push(() => {
            keys.forEach((key, index) => { node.style[key] = saved[index]; });
            if (!inert) node.removeAttribute("inert");
            node.hidden = node.dataset.queryHidden === "true";
          });
          animations.push(node.animate([{ opacity: from.opacity ?? 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-6px)" }], options));
        } else if (to && !from) {
          animations.push(node.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "translateY(0)" }], options));
        } else if (from && to && (Math.abs(from.x - to.x) > .5 || Math.abs(from.y - to.y) > .5 || (from.opacity ?? 1) < .999)) {
          animations.push(node.animate([{ opacity: from.opacity ?? 1, transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)` }, { opacity: 1, transform: "translate(0,0)" }], options));
        }
        const animation = animations[animations.length - 1];
        if ((animation.effect as KeyframeEffect).target === node) nodeAnimations.set(node, animation);
      }
      // 快速反向时只采样一次当前合成样式；基准坐标独立于新一轮 React 提交，避免隐藏字段跳回终点。
      snapshot.current = () => ({ height: shell.offsetHeight, boxes: new Map(candidates.filter(node => node.isConnected).map(node => {
        const base = after.boxes.get(node) ?? before.boxes.get(node)!;
        const style = getComputedStyle(node);
        // 新提交可能先设置 hidden，浏览器此时返回 transform:none；直接从动画时间轴还原位移。
        const effect = nodeAnimations.get(node)?.effect as KeyframeEffect | undefined;
        const frames = effect?.getKeyframes();
        const progress = Number(effect?.getComputedTiming().progress ?? 0);
        const from = frames ? new DOMMatrixReadOnly(String(frames[0].transform)) : new DOMMatrixReadOnly();
        const to = frames ? new DOMMatrixReadOnly(String(frames[frames.length - 1].transform)) : from;
        return [node, { ...base, x: base.x + from.m41 + (to.m41 - from.m41) * progress, y: base.y + from.m42 + (to.m42 - from.m42) * progress, opacity: Number(style.opacity) }];
      })) });
      let ended = false;
      const cleanup = () => {
        if (ended) return;
        ended = true;
        animations.forEach(animation => animation.cancel());
        restores.forEach(restore => restore());
        shell.style.overflow = overflow;
        row.style.overflow = rowOverflow;
        delete row.dataset.queryMotion;
        media.removeEventListener("change", finish);
        stop.current = undefined;
        snapshot.current = undefined;
      };
      const finish = () => {
        if (ended) return;
        cleanup();
        previous.current = readLayout(row);
        // 原有自适应测量只在过渡结束后补做一次，避免高度动画期间反复重排和 setState。
        row.dispatchEvent(new Event("sia-query-motion-end"));
      };
      stop.current = cleanup;
      media.addEventListener("change", finish, { once: true });
      animations[0].finished.then(finish, () => {});
    });
    return () => { cancelled = true; };
  }, [ref, layoutKey]);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    // 闲置时跟随容器重排刷新缓存；过渡期间立即返回，不进行每帧布局读取。
    const observer = new ResizeObserver(() => { if (!stop.current) previous.current = readLayout(row); });
    observer.observe(row);
    return () => { observer.disconnect(); stop.current?.(); };
  }, [ref]);
}

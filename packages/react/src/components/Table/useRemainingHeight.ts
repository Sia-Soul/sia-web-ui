import { useLayoutEffect, useState, type RefObject } from "react";
import type { TableProps } from "./types";

/** 测量表格到固定容器或视口底边的空间；只监听布局相关节点，不观察表格行内容。 */
export function useRemainingHeight(rootRef: RefObject<HTMLDivElement | null>, options: TableProps["fillRemaining"]) {
  const [height, setHeight] = useState<number>();
  const enabled = !!options;
  const container = typeof options === "object" ? options.container : undefined;
  const bottomOffset = typeof options === "object" ? options.bottomOffset ?? 0 : 0;
  const minHeight = typeof options === "object" ? options.minHeight ?? 0 : 0;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;
    const win = root.ownerDocument.defaultView;
    if (!win) return;
    let frame = 0;
    let disposed = false;
    const observed = new Set<Element>();
    const observe = (element: Element) => {
      if (observed.has(element)) return;
      observed.add(element);
      resize?.observe(element);
    };
    const measure = () => {
      frame = 0;
      if (disposed || !root.isConnected || !root.getClientRects().length) return;
      const target = container?.();
      if (container && (!target || !target.getClientRects().length)) return;
      // 祖先的兄弟节点覆盖查询表单折叠、异步提示条等引起的顶部位置变化。
      let branch: Element = root;
      while (branch.parentElement) {
        const parent = branch.parentElement;
        observe(parent);
        for (const sibling of parent.children) if (sibling !== branch) observe(sibling);
        branch = parent;
      }
      if (target) observe(target);
      const viewport = win.visualViewport;
      const bottom = target
        ? target.getBoundingClientRect().top + target.clientTop + target.clientHeight - (parseFloat(win.getComputedStyle(target).paddingBottom) || 0)
        : (viewport ? viewport.offsetTop + viewport.height : win.innerHeight);
      const next = Math.max(0, minHeight, Math.floor(bottom - root.getBoundingClientRect().top - bottomOffset));
      setHeight(previous => previous === next ? previous : next);
    };
    const schedule = () => {
      if (!disposed && !frame) frame = win.requestAnimationFrame(measure);
    };
    // 表格内部滚动不会改变外部位置，不触发高度重测，避免虚拟滚动额外布局读取。
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && root.contains(event.target)) return;
      schedule();
    };
    // transform 不触发 ResizeObserver；弹层入场结束后按最终位置补测。
    const onMotionEnd = (event: Event) => {
      if (event.target instanceof Element && event.target.contains(root)) schedule();
    };
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    const mutation = new MutationObserver(schedule);
    // 仅监听祖先自身的显隐/布局属性和直接子节点，避免上传进度、行渲染引起无关重测。
    for (let node = root.parentElement; node; node = node.parentElement) {
      mutation.observe(node, { attributes: true, attributeFilter: ["style", "class", "hidden"], childList: true });
    }
    measure();
    // 子组件布局 effect 可能早于父容器 ref 赋值；首帧再测一次以接入刚挂载的容器。
    schedule();
    win.addEventListener("resize", schedule);
    win.addEventListener("scroll", onScroll, true);
    win.addEventListener("transitionend", onMotionEnd, true);
    win.addEventListener("animationend", onMotionEnd, true);
    win.visualViewport?.addEventListener("resize", schedule);
    win.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      disposed = true;
      win.cancelAnimationFrame(frame);
      resize?.disconnect();
      mutation.disconnect();
      win.removeEventListener("resize", schedule);
      win.removeEventListener("scroll", onScroll, true);
      win.removeEventListener("transitionend", onMotionEnd, true);
      win.removeEventListener("animationend", onMotionEnd, true);
      win.visualViewport?.removeEventListener("resize", schedule);
      win.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [rootRef, enabled, container, bottomOffset, minHeight]);
  return enabled ? height : undefined;
}

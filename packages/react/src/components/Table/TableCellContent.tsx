import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Tooltip } from "../FloatingDisplay";

// 单元格批量读取布局、批量写入标记，避免数千单元格交替读写引起布局抖动。
const pendingLayouts = new Map<HTMLElement, { layouts: () => HTMLElement[]; measure: () => void }>();
let layoutFrame: number | undefined;
function scheduleLayout(element: HTMLElement, task: { layouts: () => HTMLElement[]; measure: () => void }) {
  pendingLayouts.set(element, task);
  if (layoutFrame !== undefined) return;
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = undefined;
    const tasks = [...pendingLayouts.values()];
    pendingLayouts.clear();
    const layouts = tasks.flatMap(task => task.layouts());
    layouts.forEach(layout => {
      if (!layout.hasAttribute("data-table-inline-layout")) layout.setAttribute("data-table-inline-layout", "");
    });
    tasks.forEach(task => task.measure());
  });
}

export function TableCellContent({ children, ellipsis, title }: { children: ReactNode; ellipsis: boolean; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const customContent = typeof children !== "string" && typeof children !== "number" && children != null;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !ellipsis || !customContent) return;
    const normalizeLayouts = (parent: Element, layouts: HTMLElement[]) => {
      for (const child of parent.children) {
        if (!(child instanceof HTMLElement)) continue;
        const component = [...child.classList].some(name => name.startsWith("sia-") && !name.startsWith("sia-space") && name !== "sia-flex");
        if (component || child.matches("button, input, textarea, select, [contenteditable]")) continue;
        const display = getComputedStyle(child).display;
        if (["flex", "inline-flex", "grid", "inline-grid"].includes(display)) {
          layouts.push(child);
        }
        normalizeLayouts(child, layouts);
      }
    };
    const update = () => setOverflowing(element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
    scheduleLayout(element, {
      layouts: () => { const layouts: HTMLElement[] = []; normalizeLayouts(element, layouts); return layouts; },
      measure: update,
    });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => {
      observer.disconnect();
      // 标记跟随 DOM 生命周期；重渲染时移除再添加会强制整张表重新布局。
      pendingLayouts.delete(element);
    };
  }, [children, ellipsis, customContent]);

  return <div ref={ref} className="sia-table__cell-content" data-custom-content={customContent || undefined} data-content-overflow={ellipsis && customContent && overflowing || undefined}>
    {title ? <Tooltip title={title} className="sia-table__cell-tooltip"><span>{children}</span></Tooltip> : children}
  </div>;
}

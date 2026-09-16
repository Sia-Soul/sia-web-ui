import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Tooltip } from "../FloatingDisplay";

export function TableCellContent({ children, ellipsis, title }: { children: ReactNode; ellipsis: boolean; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const customContent = typeof children !== "string" && typeof children !== "number" && children != null;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !ellipsis || !customContent) return;
    const layouts: HTMLElement[] = [];
    const normalizeLayouts = (parent: Element) => {
      for (const child of parent.children) {
        if (!(child instanceof HTMLElement)) continue;
        const component = [...child.classList].some(name => name.startsWith("sia-") && !name.startsWith("sia-space") && name !== "sia-flex");
        if (component || child.matches("button, input, textarea, select, [contenteditable]")) continue;
        const display = getComputedStyle(child).display;
        if (["flex", "inline-flex", "grid", "inline-grid"].includes(display)) {
          child.setAttribute("data-table-inline-layout", "");
          layouts.push(child);
        }
        normalizeLayouts(child);
      }
    };
    normalizeLayouts(element);
    const update = () => setOverflowing(element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => {
      observer.disconnect();
      layouts.forEach(layout => layout.removeAttribute("data-table-inline-layout"));
    };
  }, [children, ellipsis, customContent]);

  return <div ref={ref} className="sia-table__cell-content" data-custom-content={customContent || undefined} data-content-overflow={ellipsis && customContent && overflowing || undefined}>
    {title ? <Tooltip title={title} className="sia-table__cell-tooltip"><span>{children}</span></Tooltip> : children}
  </div>;
}

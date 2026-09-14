import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function TableCellContent({ children, ellipsis, title }: { children: ReactNode; ellipsis: boolean; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const customContent = typeof children !== "string" && typeof children !== "number" && children != null;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !ellipsis || !customContent) return;
    const update = () => setOverflowing(element.scrollWidth > element.clientWidth + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  }, [children, ellipsis, customContent]);

  return <div ref={ref} className="sia-table__cell-content" title={title} data-content-overflow={ellipsis && customContent && overflowing || undefined}>
    {children}
  </div>;
}

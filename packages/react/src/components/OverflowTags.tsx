import { useLayoutEffect, useRef, useState } from "react";
import type { Key, ReactNode } from "react";

interface OverflowTagsProps {
  items: readonly { key: Key; label: ReactNode }[];
  maxCount: number;
  className?: string;
  tagClassName: string;
  restClassName?: string;
}

export function OverflowTags({ items, maxCount, className = "", tagClassName, restClassName = "" }: OverflowTagsProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const limit = Math.min(items.length, Math.max(0, Math.floor(maxCount) || 0));
  const [visibleCount, setVisibleCount] = useState(0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) return;
    const update = () => {
      const gap = Number.parseFloat(getComputedStyle(root).columnGap) || 0;
      const widths = Array.from(measure.children, child => child.getBoundingClientRect().width);
      let used = 0;
      let fitting = 0;
      for (let count = 1; count <= limit; count += 1) {
        used += widths[count - 1] + (count > 1 ? gap : 0);
        const rest = count < items.length ? gap + widths[limit + count] : 0;
        if (used + rest <= root.clientWidth) fitting = count;
      }
      setVisibleCount(previous => previous === fitting ? previous : fitting);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    for (const child of measure.children) observer.observe(child);
    return () => observer.disconnect();
  }, [items, limit]);

  const count = Math.min(visibleCount, limit);
  return <span ref={rootRef} className={`sia-overflow-tags ${className}`.trim()}>
    {items.slice(0, count).map(item => <span className={tagClassName} key={item.key}>{item.label}</span>)}
    {items.length > count ? <span className={`${tagClassName} sia-overflow-tags__rest ${restClassName}`.trim()}>+{items.length - count}</span> : null}
    <span ref={measureRef} className="sia-overflow-tags__measure" aria-hidden="true">
      {items.slice(0, limit).map(item => <span className={tagClassName} key={item.key}>{item.label}</span>)}
      {Array.from({ length: limit + 1 }, (_, index) => <span className={`${tagClassName} ${restClassName}`.trim()} key={`rest-${index}`}>+{items.length - index}</span>)}
    </span>
  </span>;
}

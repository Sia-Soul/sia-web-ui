import { useLayoutEffect, useRef, useState } from "react";
import type { Key, ReactNode } from "react";

/** 框架内部的单行标签布局配置，测量层不参与用户交互。 */
interface OverflowTagsProps {
  /** 按显示顺序排列的标签。 */
  items: readonly {
    /** 标签的稳定标识，用于保留节点。 */
    key: Key;
    /** 标签显示内容。 */
    label: ReactNode;
  }[];
  /** 允许显示的标签数量上限，超出部分计入 +N。 */
  maxCount: number;
  /** 是否让被截断的标签利用剩余宽度；默认 false，短标签与 +N 保持内容宽度。 */
  expandToFit?: boolean;
  /** 标签行容器的附加样式类。 */
  className?: string;
  /** 可见标签及测量标签共用的样式类。 */
  tagClassName: string;
  /** +N 汇总标签的附加样式类。 */
  restClassName?: string;
}

/** 按可用宽度折叠标签，并可将剩余宽度分配给被截断的长标签。 */
export function OverflowTags({ items, maxCount, expandToFit = false, className = "", tagClassName, restClassName = "" }: OverflowTagsProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const limit = Math.min(items.length, Math.max(0, Math.floor(maxCount) || 0));
  const [layout, setLayout] = useState<{ count: number; minimumWidths: number[] }>({ count: 0, minimumWidths: [] });

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
      // 测量层保留基础宽度来确定数量；只让长标签伸缩，避免短标签被挤小或 +N 被挤出。
      // 可见层的扩展不反馈到测量层，ResizeObserver 因此不会反复改变折叠数量。
      const minimumWidths = Array.from({ length: fitting }, (_, index) => {
        const tag = measure.children[index];
        return expandToFit && tag.scrollWidth > tag.clientWidth ? widths[index] : 0;
      });
      setLayout(previous => previous.count === fitting && minimumWidths.every((width, index) => previous.minimumWidths[index] === width)
        ? previous : { count: fitting, minimumWidths });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    for (const child of measure.children) observer.observe(child);
    return () => observer.disconnect();
  }, [items, limit, expandToFit]);

  const count = Math.min(layout.count, limit);
  return <span ref={rootRef} className={`sia-overflow-tags ${className}`.trim()}>
    {items.slice(0, count).map((item, index) => <span className={tagClassName} key={item.key}
      style={expandToFit && layout.minimumWidths[index] ? { flex: "0 1 auto", minWidth: layout.minimumWidths[index], maxWidth: "none" } : undefined}>{item.label}</span>)}
    {items.length > count ? <span className={`${tagClassName} sia-overflow-tags__rest ${restClassName}`.trim()}>+{items.length - count}</span> : null}
    <span ref={measureRef} className="sia-overflow-tags__measure" aria-hidden="true">
      {items.slice(0, limit).map(item => <span className={tagClassName} key={item.key}>{item.label}</span>)}
      {Array.from({ length: limit + 1 }, (_, index) => <span className={`${tagClassName} ${restClassName}`.trim()} key={`rest-${index}`}>+{items.length - index}</span>)}
    </span>
  </span>;
}

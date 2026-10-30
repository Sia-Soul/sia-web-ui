import type { HTMLAttributes } from "react";
import { withTitleTooltip } from "./titleTooltip";

/** 静态布局骨架的配置；不挂载真实内容，也不会自动推断尚未渲染的业务组件。 */
export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** 每列占位行数，默认 6；取整并限制在 1～30，非有限值回退默认值。 */
  rows?: number;
  /** 占位列数，默认 2；取整并限制在 1～4，非有限值回退默认值。 */
  columns?: number;
  /** 每个占位块高度，单位 CSS px，默认 30；限制在 8～200，非有限值回退默认值。 */
  rowHeight?: number;
  /** 行与列之间的间距，单位 CSS px，默认 16；限制在 0～64，非有限值回退默认值。 */
  gap?: number;
}

/** 轻量静态骨架，适合弹层入场期间预留正文布局；通过行列配置近似目标内容，不执行真实子组件。 */
export function Skeleton({ rows = 6, columns = 2, rowHeight = 30, gap = 16, className = "", style, ...props }: SkeletonProps) {
  const count = (value: number, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
  const rowCount = count(rows, 6, 1, 30);
  const columnCount = count(columns, 2, 1, 4);
  return <div role="status" aria-label="正在准备内容" className={`sia-skeleton ${className}`.trim()} style={{ display: "grid", gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, gap: count(gap, 16, 0, 64), ...style }} {...withTitleTooltip(props)}>
    {Array.from({ length: rowCount * columnCount }, (_, index) => <span className="sia-skeleton__block" aria-hidden="true" key={index} style={{ height: count(rowHeight, 30, 8, 200) }} />)}
  </div>;
}

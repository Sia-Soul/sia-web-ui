import { Children, cloneElement, isValidElement } from "react";
import type { ReactNode } from "react";

/** 原始图形的 x、y、宽、高；不包含描边向外扩展的部分。 */
type IconBounds = readonly [number, number, number, number];

// 路径缩放时反向补偿显式描边；不用 non-scaling-stroke，以保留 size 的正常整体缩放。
function compensateStroke(node: ReactNode, scale: number): ReactNode {
  return Children.map(node, child => {
    if (!isValidElement<{ children?: ReactNode; strokeWidth?: number | string }>(child)) return child;
    const props = child.props;
    return cloneElement(child, {
      ...(props.strokeWidth === undefined ? {} : { strokeWidth: Number(props.strokeWidth) / scale }),
      ...(props.children === undefined ? {} : { children: compensateStroke(props.children, scale) }),
    });
  });
}

/** 将整个图形等比居中至 24 单位画布，最长边统一为 18 单位；模块加载时只计算一次。 */
export function normalizeIconPaths<T extends Record<string, ReactNode>>(paths: T, bounds: Record<keyof T, IconBounds>) {
  return Object.fromEntries(Object.entries(paths).map(([name, node]) => {
    const [x, y, width, height] = bounds[name];
    const scale = 18 / Math.max(width, height);
    const transform = `translate(${12 - (x + width / 2) * scale} ${12 - (y + height / 2) * scale}) scale(${scale})`;
    return [name, { scale, node: <g transform={transform}>{compensateStroke(node, scale)}</g> }];
  })) as Record<keyof T, { scale: number; node: ReactNode }>;
}

import { Children } from "react";
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from "react";

/** 布局间距，可使用预设等级或数值。 */
export type LayoutGap = "small" | "medium" | "large" | number | string;
/** 弹性布局交叉轴上的对齐方式。 */
export type FlexAlign = "normal" | "start" | "center" | "end" | "stretch" | "baseline";
/** 弹性布局主轴上的内容分布方式。 */
export type FlexJustify = "normal" | "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";

const gaps = { small: 8, medium: 12, large: 16 } as const;

function resolveGap(gap: LayoutGap) {
  return typeof gap === "string" && gap in gaps ? gaps[gap as keyof typeof gaps] : gap;
}

function resolveCssLength(gap: LayoutGap) {
  const value = resolveGap(gap);
  return typeof value === "number" ? `${value}px` : value;
}

function resolveAlign(value: FlexAlign | undefined) {
  if (value === "start" || value === "end") return `flex-${value}`;
  return value;
}

function resolveJustify(value: FlexJustify | undefined) {
  if (value === "start" || value === "end") return `flex-${value}`;
  return value;
}

/** 弹性布局的属性配置。 */
export interface FlexProps extends HTMLAttributes<HTMLElement> {
  /**
   * 是否使用垂直布局。
   * @defaultValue false
   */
  vertical?: boolean;
  /** 组件的水平或垂直排列方向。 */
  orientation?: "horizontal" | "vertical";
  /**
   * 是否允许换行
   * @defaultValue false
   */
  wrap?: boolean | CSSProperties["flexWrap"];
  /** 主轴对齐 */
  justify?: FlexJustify;
  /** 交叉轴对齐 */
  align?: FlexAlign;
  /** 预设或自定义间距 */
  gap?: LayoutGap;
  /** 弹性布局的伸缩权重或 CSS flex 配置。 */
  flex?: CSSProperties["flex"];
  /**
   * 用作容器的元素或组件类型。
   * @defaultValue "div"
   */
  component?: ElementType;
}

/** 弹性布局组件。 */
export function Flex({
  vertical = false,
  orientation,
  wrap = false,
  justify,
  align,
  gap,
  flex,
  component: Component = "div",
  className = "",
  style,
  ...props
}: FlexProps) {
  const isVertical = vertical || orientation === "vertical";
  const mergedStyle: CSSProperties = {
    display: "flex",
    flexDirection: isVertical ? "column" : "row",
    flexWrap: wrap === true ? "wrap" : wrap === false ? "nowrap" : wrap,
    justifyContent: resolveJustify(justify),
    alignItems: resolveAlign(align),
    gap: gap === undefined ? undefined : resolveGap(gap),
    flex,
    ...style,
  };
  return <Component className={`sia-flex${isVertical ? " sia-flex--vertical" : ""} ${className}`.trim()} style={mergedStyle} {...props} />;
}

/** 间距布局的属性配置。 */
export interface SpaceProps extends HTMLAttributes<HTMLDivElement> {
  /**
   排列或展示方向。
   * @defaultValue "horizontal"
   */
  direction?: "horizontal" | "vertical";
  /**
   * 组件尺寸；用于调整控件高度、字号和间距。
   * @defaultValue "medium"
   */
  size?: LayoutGap | readonly [LayoutGap, LayoutGap];
  /**
   * 交叉轴对齐
   * @defaultValue "center"
   */
  align?: "start" | "center" | "end" | "baseline";
  /**
   * 是否允许换行
   * @defaultValue false
   */
  wrap?: boolean;
  /** 相邻元素之间的分隔内容 */
  split?: ReactNode;
}

/** SpaceCompact的属性配置。 */
export interface SpaceCompactProps extends HTMLAttributes<HTMLDivElement> {
  /**
   排列或展示方向。
   * @defaultValue "horizontal"
   */
  direction?: "horizontal" | "vertical";
  /**
   * 宽度撑满父容器
   * @defaultValue false
   */
  block?: boolean;
}

function SpaceCompact({ direction = "horizontal", block = false, className = "", ...props }: SpaceCompactProps) {
  return <div className={`sia-space-compact sia-space-compact--${direction}${block ? " sia-space-compact--block" : ""} ${className}`.trim()} {...props} />;
}

function SpaceRoot({
  direction = "horizontal",
  size = "medium",
  align = "center",
  wrap = false,
  split,
  className = "",
  style,
  children,
  ...props
}: SpaceProps) {
  const [horizontalGap, verticalGap] = Array.isArray(size) ? size : [size, size];
  const items = Children.toArray(children);
  const mergedStyle: CSSProperties = {
    columnGap: resolveGap(horizontalGap as LayoutGap),
    rowGap: resolveGap(verticalGap as LayoutGap),
    flexWrap: wrap ? "wrap" : "nowrap",
    alignItems: resolveAlign(align),
    ...style,
  };
  return <div className={`sia-space sia-space--${direction} ${className}`.trim()} style={mergedStyle} {...props}>
    {items.map((item, index) => <span className="sia-space__item" key={index}>
      {item}
      {split !== undefined && index < items.length - 1 ? <span className="sia-space__split">{split}</span> : null}
    </span>)}
  </div>;
}

/** 间距布局组件。 */
export const Space = Object.assign(SpaceRoot, {
  /** 紧凑布局容器，将相邻控件组合为连续的按钮或输入组。 */
  Compact: SpaceCompact });

/** 分隔线的属性配置。 */
export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   组件的水平或垂直排列方向。
   * @defaultValue "horizontal"
   */
  orientation?: "horizontal" | "vertical";
  /**
   组件的视觉样式。
   * @defaultValue "solid"
   */
  variant?: "solid" | "dashed" | "dotted";
  /**
   * 文字在横向分割线中的位置
   * @defaultValue "center"
   */
  textAlign?: "start" | "center" | "end";
  /**
   * 使用普通字重
   * @defaultValue false
   */
  plain?: boolean;
  /** 分割线文字 */
  children?: ReactNode;
}

/** 分隔线组件。 */
export function Divider({
  orientation = "horizontal",
  variant = "solid",
  textAlign = "center",
  plain = false,
  children,
  className = "",
  ...props
}: DividerProps) {
  return (
    <div
      className={`sia-divider sia-divider--${orientation} sia-divider--${variant} sia-divider--text-${textAlign}${children ? " sia-divider--with-text" : ""}${plain ? " sia-divider--plain" : ""} ${className}`.trim()}
      role="separator"
      aria-orientation={orientation}
      {...props}
    >
      {children ? <span className="sia-divider__text">{children}</span> : null}
    </div>
  );
}

/** 响应式栅格的断点名称。 */
export type GridBreakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
/** 按照屏幕断点分别提供的配置值。 */
export type GridResponsive<T> = T | Partial<Record<GridBreakpoint, T>>;

/** 栅格行的属性配置。 */
export interface RowProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 栅格行列间距。
   * @defaultValue 0
   */
  gutter?: LayoutGap | readonly [LayoutGap, LayoutGap];
  /** 交叉轴对齐 */
  align?: GridResponsive<"top" | "middle" | "bottom" | "stretch">;
  /** 主轴对齐 */
  justify?: GridResponsive<"start" | "end" | "center" | "space-around" | "space-between" | "space-evenly">;
  /**
   * 是否允许换行
   * @defaultValue true
   */
  wrap?: boolean;
}

function firstResponsive<T extends string>(value: GridResponsive<T> | undefined, fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value !== "object") return value;
  const responsive = value as Partial<Record<GridBreakpoint, T>>;
  return responsive.xs ?? responsive.sm ?? responsive.md ?? responsive.lg ?? responsive.xl ?? responsive.xxl ?? fallback;
}

/** 栅格行组件。 */
export function Row({ gutter = 0, align, justify, wrap = true, className = "", style, ...props }: RowProps) {
  const [horizontal, vertical] = Array.isArray(gutter) ? gutter : [gutter, 0];
  const mergedStyle = {
    "--sia-grid-gutter-x": resolveCssLength(horizontal as LayoutGap),
    "--sia-grid-gutter-y": resolveCssLength(vertical as LayoutGap),
    alignItems: ({ top: "flex-start", middle: "center", bottom: "flex-end", stretch: "stretch" } as const)[firstResponsive(align, "top")],
    justifyContent: resolveJustify(firstResponsive(justify, "start")),
    flexWrap: wrap ? "wrap" : "nowrap",
    ...style,
  } as CSSProperties;
  return <div className={`sia-row ${className}`.trim()} style={mergedStyle} {...props} />;
}

/** 一个断点下的栅格列宽、偏移和排序配置。 */
export interface ColSize {
  /** 占据的网格列数。 */
  span?: number;
  /** 相对于默认位置的偏移。 */
  offset?: number;
  /** 排序位置或排序方向。 */
  order?: number;
  /** 推移距离或栅格偏移配置。 */
  push?: number;
  /** 栅格列向左移动的列数。 */
  pull?: number;
}

/** 栅格列的属性配置。 */
export interface ColProps extends HTMLAttributes<HTMLDivElement>, ColSize {
  /** 弹性布局的伸缩权重或 CSS flex 配置。 */
  flex?: number | string;
  /** 超小屏断点下的布局配置。 */
  xs?: number | ColSize;
  /** 小屏断点下的布局配置。 */
  sm?: number | ColSize;
  /** 中屏断点下的布局配置。 */
  md?: number | ColSize;
  /** 大屏断点下的布局配置。 */
  lg?: number | ColSize;
  /** 超大屏断点下的布局配置。 */
  xl?: number | ColSize;
  /** 特大屏断点下的布局配置。 */
  xxl?: number | ColSize;
}

type GridStyle = CSSProperties & Record<`--sia-col-${string}`, string | number | undefined>;

function setColVariables(style: GridStyle, prefix: string, value: number | ColSize | undefined) {
  if (value === undefined) return;
  const config = typeof value === "number" ? { span: value } : value;
  if (config.span !== undefined) style[`--sia-col-${prefix}span`] = config.span;
  if (config.offset !== undefined) style[`--sia-col-${prefix}offset`] = config.offset;
  if (config.order !== undefined) style[`--sia-col-${prefix}order`] = config.order;
}

/** 栅格列组件。 */
export function Col({
  span = 24,
  offset = 0,
  order = 0,
  push = 0,
  pull = 0,
  flex,
  xs,
  sm,
  md,
  lg,
  xl,
  xxl,
  className = "",
  style,
  ...props
}: ColProps) {
  const mergedStyle: GridStyle = {
    "--sia-col-span": span,
    "--sia-col-offset": offset,
    "--sia-col-order": order,
    left: push ? `${push / 24 * 100}%` : pull ? `${-pull / 24 * 100}%` : undefined,
    flex: typeof flex === "number" ? `${flex} ${flex} auto` : flex,
    ...style,
  };
  setColVariables(mergedStyle, "xs-", xs);
  setColVariables(mergedStyle, "sm-", sm);
  setColVariables(mergedStyle, "md-", md);
  setColVariables(mergedStyle, "lg-", lg);
  setColVariables(mergedStyle, "xl-", xl);
  setColVariables(mergedStyle, "xxl-", xxl);
  return <div className={`sia-col ${className}`.trim()} style={mergedStyle} {...props} />;
}

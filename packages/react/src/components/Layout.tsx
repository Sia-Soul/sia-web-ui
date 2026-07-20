import { Children } from "react";
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from "react";

export type LayoutGap = "small" | "medium" | "large" | number | string;
export type FlexAlign = "normal" | "start" | "center" | "end" | "stretch" | "baseline";
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

export interface FlexProps extends HTMLAttributes<HTMLElement> {
  vertical?: boolean;
  orientation?: "horizontal" | "vertical";
  wrap?: boolean | CSSProperties["flexWrap"];
  justify?: FlexJustify;
  align?: FlexAlign;
  gap?: LayoutGap;
  flex?: CSSProperties["flex"];
  component?: ElementType;
}

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

export interface SpaceProps extends HTMLAttributes<HTMLDivElement> {
  direction?: "horizontal" | "vertical";
  size?: LayoutGap | readonly [LayoutGap, LayoutGap];
  align?: "start" | "center" | "end" | "baseline";
  wrap?: boolean;
  split?: ReactNode;
}

export interface SpaceCompactProps extends HTMLAttributes<HTMLDivElement> {
  direction?: "horizontal" | "vertical";
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

export const Space = Object.assign(SpaceRoot, { Compact: SpaceCompact });

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  variant?: "solid" | "dashed" | "dotted";
  textAlign?: "start" | "center" | "end";
  plain?: boolean;
  children?: ReactNode;
}

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

export type GridBreakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
export type GridResponsive<T> = T | Partial<Record<GridBreakpoint, T>>;

export interface RowProps extends HTMLAttributes<HTMLDivElement> {
  gutter?: LayoutGap | readonly [LayoutGap, LayoutGap];
  align?: GridResponsive<"top" | "middle" | "bottom" | "stretch">;
  justify?: GridResponsive<"start" | "end" | "center" | "space-around" | "space-between" | "space-evenly">;
  wrap?: boolean;
}

function firstResponsive<T extends string>(value: GridResponsive<T> | undefined, fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value !== "object") return value;
  const responsive = value as Partial<Record<GridBreakpoint, T>>;
  return responsive.xs ?? responsive.sm ?? responsive.md ?? responsive.lg ?? responsive.xl ?? responsive.xxl ?? fallback;
}

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

export interface ColSize {
  span?: number;
  offset?: number;
  order?: number;
  push?: number;
  pull?: number;
}

export interface ColProps extends HTMLAttributes<HTMLDivElement>, ColSize {
  flex?: number | string;
  xs?: number | ColSize;
  sm?: number | ColSize;
  md?: number | ColSize;
  lg?: number | ColSize;
  xl?: number | ColSize;
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

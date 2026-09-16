import { withTitleTooltip } from "./titleTooltip";
import { useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

/** 卡片强调装饰的显示方式。 */
export type CardAccent = "primary" | "success" | "warning" | "error";

/** 卡片的属性配置。 */
export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode;
  /** 主体之外的补充内容或操作区。 */
  extra?: ReactNode;
  /** 强调装饰样式。 */
  accent?: CardAccent;
  /** 强调装饰的颜色。 */
  accentColor?: string;
  /**
   * 允许收起内容区域
   * @defaultValue false
   */
  collapsible?: boolean;
  /** 是否收起；传入后由外部控制。 */
  collapsed?: boolean;
  /**
   * 非受控模式的初始收起状态。
   * @defaultValue false
   */
  defaultCollapsed?: boolean;
  /** 收起状态变化回调 */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** 固定内容区高度并开启内部滚动 */
  bodyHeight?: number | string;
  /**
   * 内容区域的 CSS 类名。
   * @defaultValue ""
   */
  bodyClassName?: string;
  /** 内容区域的内联样式。 */
  bodyStyle?: CSSProperties;
}

/** 卡片组件。 */
export function Card({
  title,
  description,
  extra,
  accent,
  accentColor,
  collapsible = false,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  bodyHeight,
  bodyClassName = "",
  bodyStyle,
  className = "",
  style,
  children,
  ...props
}: CardProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsed ?? internalCollapsed;
  const hasHeader = title || extra || collapsible;
  const mergedStyle = accentColor ? ({ "--sia-card-accent": accentColor, ...style } as CSSProperties) : style;
  const mergedBodyStyle: CSSProperties = bodyHeight === undefined
    ? { ...bodyStyle }
    : { height: bodyHeight, overflowY: "auto", ...bodyStyle };

  function toggleCollapsed() {
    const nextCollapsed = !isCollapsed;
    if (collapsed === undefined) setInternalCollapsed(nextCollapsed);
    onCollapsedChange?.(nextCollapsed);
  }

  const heading = (
    <span className="sia-card__heading">
      {accent || accentColor ? <span className={`sia-card__accent${accent ? ` sia-card__accent--${accent}` : ""}`} aria-hidden="true" /> : null}
      {title ? <h3 className="sia-card__title">{title}</h3> : null}
    </span>
  );

  return (
    <section className={`sia-card${isCollapsed ? " sia-card--collapsed" : ""} ${className}`.trim()} style={mergedStyle} {...withTitleTooltip(props)}>
      {hasHeader ? (
        <header className="sia-card__header">
          {collapsible ? (
            <button type="button" className="sia-card__collapse-trigger" aria-expanded={!isCollapsed} onClick={toggleCollapsed}>
              {heading}
              <Icon name={isCollapsed ? "chevron-down" : "chevron-up"} size={16} />
            </button>
          ) : heading}
          {extra ? <div className="sia-card__extra">{extra}</div> : null}
        </header>
      ) : null}
      {!isCollapsed ? (
        <>
          {description ? <p className="sia-card__description">{description}</p> : null}
          <div className={`sia-card__body ${bodyClassName}`.trim()} style={mergedBodyStyle}>{children}</div>
        </>
      ) : null}
    </section>
  );
}

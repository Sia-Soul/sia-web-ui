import { withTitleTooltip } from "./titleTooltip";
import { useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

/** 卡片强调装饰的显示方式。 */
export type CardAccent = "primary" | "success" | "warning" | "error";

/** 卡片的属性配置。 */
export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /**
   * 是否显示外边框并保留默认内部留白。false 移除外边框、选中描边、标题区左右留白及说明、正文、悬浮操作区的内边距；保留背景、圆角、内部分割线和键盘焦点提示。
   * 无边框时仍可通过 bodyStyle.padding 自定义正文内边距。
   * @defaultValue true
   */
  bordered?: boolean;
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode;
  /** 主体之外的补充内容或操作区。 */
  extra?: ReactNode;
  /**
   * 点击卡片非交互区域切换选中，支持 Enter 和空格键；选中时显示右上角三角勾选标记。
   * @defaultValue false
   */
  selectable?: boolean;
  /** 受控选中状态，需在 onSelectedChange 中更新。 */
  selected?: boolean;
  /**
   * 是否显示选中卡片右上角的三角勾选标记。仅在 selectable 且已选中时生效；false 保留键盘交互，选中边框仅在 bordered 为 true 时显示。
   * @defaultValue true
   */
  showSelectedIndicator?: boolean;
  /**
   * 非受控初始选中状态。
   * @defaultValue false
   */
  defaultSelected?: boolean;
  /**
   * 禁止切换选中，不禁用卡片内独立操作。
   * @defaultValue false
   */
  disabled?: boolean;
  /** 用户切换选中时通知新的布尔状态；禁用时不触发。 */
  onSelectedChange?: (selected: boolean) => void;
  /** 鼠标移入或键盘聚焦卡片时从底部滑入的操作区；触屏设备始终显示。 */
  hoverActions?: ReactNode;
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
  bordered = true,
  title,
  description,
  extra,
  selectable = false,
  selected,
  showSelectedIndicator = true,
  defaultSelected = false,
  disabled = false,
  onSelectedChange,
  hoverActions,
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
  onClick,
  onKeyDown,
  ...props
}: CardProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const [internalSelected, setInternalSelected] = useState(defaultSelected);
  const isSelected = selected ?? internalSelected;
  // 内部按钮、链接和表单控件有自己的行为，不应连带切换卡片选中。
  function toggleSelected() {
    if (!selectable || disabled) return;
    const next = !isSelected;
    if (selected === undefined) setInternalSelected(next);
    onSelectedChange?.(next);
  }
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
    <section
      className={`sia-card${!bordered ? " sia-card--borderless" : ""}${isCollapsed ? " sia-card--collapsed" : ""}${selectable ? " sia-card--selectable" : ""}${selectable && isSelected ? " sia-card--selected" : ""}${hoverActions ? " sia-card--hover-actions" : ""} ${className}`.trim()}
      style={mergedStyle}
      role={selectable ? "checkbox" : undefined}
      aria-checked={selectable ? isSelected : undefined}
      aria-disabled={selectable ? disabled : undefined}
      tabIndex={selectable && !disabled ? 0 : undefined}
      {...withTitleTooltip(props)}
      onClick={(event) => {
        onClick?.(event);
        const target = event.target as Element;
        const interactive = target.closest('button, a, input, select, textarea, label, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [contenteditable="true"], [tabindex]');
        if (!event.defaultPrevented && (!interactive || interactive === event.currentTarget)) toggleSelected();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && event.target === event.currentTarget && selectable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          toggleSelected();
        }
      }}
    >
      {/* 选中角标不参与点击命中，点击角标仍可取消整卡选择。 */}
      {selectable && isSelected && showSelectedIndicator ? <span className="sia-card__selected-corner" aria-hidden="true"><Icon name="check" size={16} /></span> : null}
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
          {hoverActions ? <div className="sia-card__hover-actions" onClick={(event) => event.stopPropagation()}>{hoverActions}</div> : null}
        </>
      ) : null}
    </section>
  );
}

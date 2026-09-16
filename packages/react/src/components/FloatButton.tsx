import { withTitleTooltip } from "./titleTooltip";
import { createContext, forwardRef, useContext, useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import { Badge } from "./DataDisplay";
import type { BadgeProps } from "./DataDisplay";
import { Tooltip } from "./FloatingDisplay";
import { useControllableState } from "./shared";
import "../float-button.css";

/** 浮动按钮的外形。 */
export type FloatButtonShape = "circle" | "square";
/** 浮动按钮的属性配置。 */
export interface FloatButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "content"> {
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode;
  /** 浮动按钮的提示内容。 */
  tooltip?: ReactNode;
  /**
   * 类型标识，用于选择对应的表现形式。
   * @defaultValue "default"
   */
  type?: "default" | "primary";
  /**
   * 外观形状。
   * @defaultValue "circle"
   */
  shape?: FloatButtonShape;
  /** 数字、红点和溢出计数配置 */
  badge?: Pick<BadgeProps, "count" | "dot" | "overflowCount" | "showZero" | "color">;
  /**
   * 原生按钮类型，例如 button、submit 或 reset。
   * @defaultValue "button"
   */
  htmlType?: "button" | "submit" | "reset";
}
const GroupShape = createContext<FloatButtonShape | undefined>(undefined);

const FloatButtonRoot = forwardRef<HTMLButtonElement, FloatButtonProps>(function FloatButton({
  icon, description, tooltip, type = "default", shape = "circle", badge, htmlType = "button", className = "", style, children, ...props
}, ref) {
  const groupShape = useContext(GroupShape);
  const label = props["aria-label"] ?? (typeof tooltip === "string" ? tooltip : typeof description === "string" ? description : "悬浮操作");
  const button = <button {...withTitleTooltip(props)} ref={ref} type={htmlType} aria-label={label}
    className={`sia-float-button sia-float-button--${groupShape ?? shape} sia-float-button--${type} ${className}`.trim()}>
    <Badge {...badge} className="sia-float-button__badge">
      <span className="sia-float-button__body">
        {icon !== null ? <span className="sia-float-button__icon">{icon ?? <Icon name="question" size={20} />}</span> : null}
        {description != null || children != null ? <span className="sia-float-button__description">{description ?? children}</span> : null}
      </span>
    </Badge>
  </button>;
  return <span className="sia-float-button-root" style={style}>{tooltip ? <Tooltip title={tooltip} placement="left">{button}</Tooltip> : button}</span>;
});

/** FloatButtonGroup的属性配置。 */
export interface FloatButtonGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /**
   * 外观形状。
   * @defaultValue "circle"
   */
  shape?: FloatButtonShape;
  /**
   * 类型标识，用于选择对应的表现形式。
   * @defaultValue "default"
   */
  type?: "default" | "primary";
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 自定义关闭图标。 */
  closeIcon?: ReactNode;
  /** 提示内容或提示框配置。 */
  tooltip?: ReactNode;
  /** 触发显示的交互方式。 */
  trigger?: "click" | "hover";
  /**
   * 相对于触发元素的弹出方向和对齐位置。
   * @defaultValue "top"
   */
  placement?: "top" | "bottom" | "left" | "right";
  /** 是否打开；传入后由外部控制显示状态。 */
  open?: boolean;
  /**
   * 非受控模式下的初始打开状态。
   * @defaultValue false
   */
  defaultOpen?: boolean;
  /** 打开状态改变时触发，参数为新的打开状态。 */
  onOpenChange?: (open: boolean) => void;
}
function FloatButtonGroup({ shape = "circle", type = "default", icon, closeIcon, tooltip, trigger, placement = "top",
  open, defaultOpen = false, onOpenChange, children, className = "", onMouseEnter, onMouseLeave, onKeyDown, onBlur, ...props
}: FloatButtonGroupProps) {
  const [visible, setVisible] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!trigger || !visible) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setVisible(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [trigger, visible, setVisible]);
  return <GroupShape.Provider value={shape}>
    <div {...withTitleTooltip(props)} ref={rootRef} role="group" className={`sia-float-button-group sia-float-button-group--${shape} sia-float-button-group--${placement}${trigger ? " sia-float-button-group--menu" : ""} ${className}`.trim()}
      onMouseEnter={(event) => { onMouseEnter?.(event); if (trigger === "hover") setVisible(true); }}
      onMouseLeave={(event) => { onMouseLeave?.(event); if (trigger === "hover" && !event.currentTarget.contains(document.activeElement)) setVisible(false); }}
      onBlur={(event) => { onBlur?.(event); if (trigger === "hover" && !event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(":hover")) setVisible(false); }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && trigger && event.key === "Escape") { setVisible(false); triggerRef.current?.focus(); }
      }}>
      {!trigger || visible ? <div id={id} className="sia-float-button-group__list">{children}</div> : null}
      {trigger ? <FloatButtonRoot ref={triggerRef} type={type} icon={visible ? closeIcon ?? <Icon name="close" size={20} /> : icon ?? <Icon name="plus" size={20} />}
        tooltip={tooltip} aria-label={visible ? "收起悬浮菜单" : "展开悬浮菜单"} aria-expanded={visible} aria-controls={visible ? id : undefined}
        onClick={() => setVisible(!visible)} /> : null}
    </div>
  </GroupShape.Provider>;
}

/** FloatButtonBackTop的属性配置。 */
export interface FloatButtonBackTopProps extends FloatButtonProps {
  /** 关联的目标元素或获取目标元素的函数。 */
  target?: () => HTMLElement | Window | null;
  /**
   * 滚动距离超过此值时显示返回顶部按钮。
   * @defaultValue 400
   */
  visibilityHeight?: number;
  /**
   * 滚动行为，smooth 表示平滑滚动。
   * @defaultValue "smooth"
   */
  behavior?: ScrollBehavior;
}
function FloatButtonBackTop({ target, visibilityHeight = 400, behavior = "smooth", onClick, icon, tooltip = "返回顶部", ...props }: FloatButtonBackTopProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = target ? target() : window;
    if (!element) return;
    const update = () => setVisible((element === window ? window.scrollY : (element as HTMLElement).scrollTop) >= visibilityHeight);
    update();
    element.addEventListener("scroll", update, { passive: true });
    return () => element.removeEventListener("scroll", update);
  }, [target, visibilityHeight]);
  if (!visible) return null;
  return <FloatButtonRoot {...props} tooltip={tooltip} icon={icon ?? <Icon name="arrow-up" size={20} />} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const element = target ? target() : window;
    element?.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : behavior });
  }} />;
}
/** 浮动按钮组件。 */
export const FloatButton = Object.assign(FloatButtonRoot, {
  /** 组合多个子项并统一管理布局或选择状态。 */
  Group: FloatButtonGroup,
  /** 滚动超过指定距离后显示的返回顶部按钮。 */
  BackTop: FloatButtonBackTop });

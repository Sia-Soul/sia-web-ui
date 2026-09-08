import { createContext, forwardRef, useContext, useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import { Badge } from "./DataDisplay";
import type { BadgeProps } from "./DataDisplay";
import { Tooltip } from "./FloatingDisplay";
import { useControllableState } from "./shared";
import "../float-button.css";

export type FloatButtonShape = "circle" | "square";
export interface FloatButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "content"> {
  icon?: ReactNode;
  description?: ReactNode;
  tooltip?: ReactNode;
  type?: "default" | "primary";
  shape?: FloatButtonShape;
  badge?: Pick<BadgeProps, "count" | "dot" | "overflowCount" | "showZero" | "color">;
  htmlType?: "button" | "submit" | "reset";
}
const GroupShape = createContext<FloatButtonShape | undefined>(undefined);

const FloatButtonRoot = forwardRef<HTMLButtonElement, FloatButtonProps>(function FloatButton({
  icon, description, tooltip, type = "default", shape = "circle", badge, htmlType = "button", className = "", style, children, ...props
}, ref) {
  const groupShape = useContext(GroupShape);
  const label = props["aria-label"] ?? (typeof tooltip === "string" ? tooltip : typeof description === "string" ? description : "悬浮操作");
  const button = <button {...props} ref={ref} type={htmlType} aria-label={label}
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

export interface FloatButtonGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  shape?: FloatButtonShape;
  type?: "default" | "primary";
  icon?: ReactNode;
  closeIcon?: ReactNode;
  tooltip?: ReactNode;
  trigger?: "click" | "hover";
  placement?: "top" | "bottom" | "left" | "right";
  open?: boolean;
  defaultOpen?: boolean;
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
    <div {...props} ref={rootRef} role="group" className={`sia-float-button-group sia-float-button-group--${shape} sia-float-button-group--${placement}${trigger ? " sia-float-button-group--menu" : ""} ${className}`.trim()}
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

export interface FloatButtonBackTopProps extends FloatButtonProps {
  target?: () => HTMLElement | Window | null;
  visibilityHeight?: number;
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
export const FloatButton = Object.assign(FloatButtonRoot, { Group: FloatButtonGroup, BackTop: FloatButtonBackTop });

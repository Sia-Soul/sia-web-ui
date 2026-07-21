import { useEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Button } from "./Button";
import type { ButtonProps } from "./Button";
import { Icon } from "./Icon";
import { Menu } from "./Navigation";
import type { MenuClickInfo, MenuItem, MenuProps, MenuTheme } from "./Navigation";
import { PopupPortal } from "./PopupPortal";
import type { PopupPortalPlacement } from "./PopupPortal";

export type DropdownTrigger = "click" | "hover" | "contextMenu";
export type DropdownPlacement = "bottomLeft" | "bottomRight" | "topLeft" | "topRight";
export type DropdownOpenSource = "trigger" | "menu";

export interface DropdownMenuProps extends Pick<
  MenuProps,
  "multiple" | "selectable" | "selectedKeys" | "defaultSelectedKeys" | "onSelect" | "onDeselect"
> {
  items: readonly MenuItem[];
  theme?: MenuTheme;
  onClick?: (info: MenuClickInfo) => void;
}

export interface DropdownProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children" | "onOpenChange"> {
  menu: DropdownMenuProps;
  children: ReactNode;
  trigger?: readonly DropdownTrigger[];
  placement?: DropdownPlacement;
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  arrow?: boolean | { pointAtCenter?: boolean };
  autoFocus?: boolean;
  openDelay?: number;
  closeDelay?: number;
  popupClassName?: string;
  popupStyle?: CSSProperties;
  popupRender?: (menu: ReactNode) => ReactNode;
  onOpenChange?: (open: boolean, info: { source: DropdownOpenSource }) => void;
}

const placementMap: Record<DropdownPlacement, PopupPortalPlacement> = {
  bottomLeft: "bottom-start",
  bottomRight: "bottom-end",
  topLeft: "top-start",
  topRight: "top-end",
};

function DropdownRoot({
  menu,
  children,
  trigger = ["hover"],
  placement = "bottomLeft",
  open,
  defaultOpen = false,
  disabled = false,
  arrow = false,
  autoFocus = false,
  openDelay = 80,
  closeDelay = 120,
  popupClassName = "",
  popupStyle,
  popupRender,
  onOpenChange,
  className = "",
  onClick,
  onMouseEnter,
  onMouseLeave,
  onContextMenu,
  onKeyDown,
  ...props
}: DropdownProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const contextAnchorRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<number | undefined>(undefined);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(open ?? defaultOpen);
  const [contextPoint, setContextPoint] = useState<{ x: number; y: number }>();
  const visible = open ?? internalOpen;
  const triggerSet = new Set(trigger);
  const pointAtCenter = typeof arrow === "object" && arrow.pointAtCenter;

  function clearTimer(ref: typeof openTimerRef) {
    if (ref.current === undefined) return;
    window.clearTimeout(ref.current);
    ref.current = undefined;
  }

  function clearTimers() {
    clearTimer(openTimerRef);
    clearTimer(closeTimerRef);
  }

  function updateOpen(next: boolean, source: DropdownOpenSource) {
    clearTimers();
    if (next === visible) return;
    if (open === undefined) setInternalOpen(next);
    if (!next) setContextPoint(undefined);
    onOpenChange?.(next, { source });
  }

  function scheduleOpen() {
    clearTimer(closeTimerRef);
    clearTimer(openTimerRef);
    openTimerRef.current = window.setTimeout(() => updateOpen(true, "trigger"), Math.max(0, openDelay));
  }

  function scheduleClose() {
    clearTimer(openTimerRef);
    clearTimer(closeTimerRef);
    closeTimerRef.current = window.setTimeout(() => updateOpen(false, "trigger"), Math.max(0, closeDelay));
  }

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setMounted(false), 160);
    return () => window.clearTimeout(timer);
  }, [visible]);

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!visible) return undefined;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      const targetOwner = target instanceof Element ? target.closest("[data-sia-menu-owner]")?.getAttribute("data-sia-menu-owner") : null;
      const menuOwner = popupRef.current?.querySelector("[data-sia-menu-owner]")?.getAttribute("data-sia-menu-owner");
      if (menuOwner && targetOwner === menuOwner) return;
      updateOpen(false, "trigger");
    };
    const closeWithEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      updateOpen(false, "trigger");
      rootRef.current?.querySelector<HTMLElement>("button, a, [tabindex]:not([tabindex='-1'])")?.focus();
    };
    const keepOpenOverNestedMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".sia-menu__popup")) clearTimer(closeTimerRef);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    document.addEventListener("pointerover", keepOpenOverNestedMenu);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
      document.removeEventListener("pointerover", keepOpenOverNestedMenu);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !autoFocus) return undefined;
    const frame = window.requestAnimationFrame(() => popupRef.current?.querySelector<HTMLElement>(".sia-menu__item:not(:disabled)")?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, visible]);

  function handleMenuClick(info: MenuClickInfo) {
    info.domEvent.stopPropagation();
    menu.onClick?.(info);
    updateOpen(false, "menu");
  }

  function handleClick(event: MouseEvent<HTMLSpanElement>) {
    onClick?.(event);
    if (disabled || !triggerSet.has("click") || event.defaultPrevented) return;
    setContextPoint(undefined);
    updateOpen(!visible, "trigger");
  }

  function handleMouseEnter(event: MouseEvent<HTMLSpanElement>) {
    onMouseEnter?.(event);
    if (!disabled && triggerSet.has("hover")) scheduleOpen();
  }

  function handleMouseLeave(event: MouseEvent<HTMLSpanElement>) {
    onMouseLeave?.(event);
    if (!disabled && triggerSet.has("hover")) scheduleClose();
  }

  function handleContextMenu(event: MouseEvent<HTMLSpanElement>) {
    onContextMenu?.(event);
    if (disabled || !triggerSet.has("contextMenu") || event.defaultPrevented) return;
    event.preventDefault();
    setContextPoint({ x: event.clientX, y: event.clientY });
    updateOpen(true, "trigger");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    onKeyDown?.(event);
    if (disabled || event.defaultPrevented) return;
    if (event.key === "ArrowDown" && (triggerSet.has("click") || triggerSet.has("hover"))) {
      event.preventDefault();
      setContextPoint(undefined);
      updateOpen(true, "trigger");
    } else if (triggerSet.has("contextMenu") && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
      event.preventDefault();
      setContextPoint(undefined);
      updateOpen(true, "trigger");
    }
  }

  const menuNode = <Menu
    mode="vertical"
    theme={menu.theme}
    items={menu.items}
    multiple={menu.multiple}
    selectable={menu.selectable}
    selectedKeys={menu.selectedKeys}
    defaultSelectedKeys={menu.defaultSelectedKeys}
    triggerSubMenuAction="hover"
    onClick={handleMenuClick}
    onSelect={menu.onSelect}
    onDeselect={menu.onDeselect}
    className="sia-dropdown__menu"
  />;

  return <span
    ref={rootRef}
    className={`sia-dropdown${visible ? " is-open" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()}
    aria-expanded={visible}
    aria-haspopup="menu"
    tabIndex={triggerSet.has("contextMenu") ? 0 : undefined}
    onClick={handleClick}
    onMouseEnter={handleMouseEnter}
    onMouseLeave={handleMouseLeave}
    onContextMenu={handleContextMenu}
    onKeyDown={handleKeyDown}
    {...props}
  >
    {children}
    <span
      ref={contextAnchorRef}
      className="sia-dropdown__context-anchor"
      style={contextPoint ? { left: contextPoint.x, top: contextPoint.y } : undefined}
      aria-hidden="true"
    />
    <PopupPortal
      ref={popupRef}
      anchorRef={contextPoint ? contextAnchorRef : rootRef}
      open={mounted}
      placement={contextPoint ? "bottom-start" : placementMap[placement]}
      offset={contextPoint ? 2 : 6}
      className={`sia-dropdown__popup${visible ? " is-open" : " is-closing"}${arrow ? " sia-dropdown__popup--arrow" : ""}${pointAtCenter ? " sia-dropdown__popup--arrow-center" : ""} ${popupClassName}`.trim()}
      style={popupStyle}
      onMouseEnter={() => {
        clearTimer(closeTimerRef);
        if (!disabled && triggerSet.has("hover")) clearTimer(openTimerRef);
      }}
      onMouseLeave={() => {
        if (!disabled && triggerSet.has("hover")) scheduleClose();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {popupRender ? popupRender(menuNode) : menuNode}
    </PopupPortal>
  </span>;
}

export interface DropdownButtonProps extends Omit<DropdownProps, "children" | "className"> {
  children?: ReactNode;
  className?: string;
  buttonProps?: Omit<ButtonProps, "children" | "onClick" | "disabled">;
  onClick?: ButtonProps["onClick"];
}

function DropdownButton({
  children,
  className = "",
  buttonProps,
  onClick,
  disabled,
  trigger = ["click"],
  ...dropdownProps
}: DropdownButtonProps) {
  return <span className={`sia-dropdown-button ${className}`.trim()}>
    <Button {...buttonProps} disabled={disabled} onClick={onClick}>{children}</Button>
    <DropdownRoot {...dropdownProps} disabled={disabled} trigger={trigger}>
      <Button
        {...buttonProps}
        className={`sia-dropdown-button__arrow ${buttonProps?.className ?? ""}`.trim()}
        disabled={disabled}
        icon={<Icon name="chevron-down" size={14} />}
        aria-label="展开下拉菜单"
      />
    </DropdownRoot>
  </span>;
}

export const Dropdown = Object.assign(DropdownRoot, { Button: DropdownButton });

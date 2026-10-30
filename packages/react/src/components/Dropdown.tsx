import { withTitleTooltip } from "./titleTooltip";
import { cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode, RefObject } from "react";
import { Button } from "./Button";
import type { ButtonProps } from "./Button";
import { Icon } from "./Icon";
import { Menu } from "./Navigation";
import type { MenuClickInfo, MenuItem, MenuProps, MenuTheme } from "./Navigation";
import { PopupPortal } from "./PopupPortal";
import type { PopupPortalPlacement } from "./PopupPortal";

/** 打开下拉菜单的触发方式。 */
export type DropdownTrigger = "click" | "hover" | "contextMenu";
/** 下拉菜单的位置类型。 */
export type DropdownPlacement = "bottomLeft" | "bottomRight" | "topLeft" | "topRight";
/** 引起下拉菜单打开状态变化的来源。 */
export type DropdownOpenSource = "trigger" | "menu";

/** DropdownMenu的属性配置。 */
export interface DropdownMenuProps extends Pick<
  MenuProps,
  "multiple" | "selectable" | "selectedKeys" | "defaultSelectedKeys" | "onSelect" | "onDeselect"
> {
  /** 按展示顺序排列的项目配置。 */
  items: readonly MenuItem[];
  /** 组件的配色主题。 */
  theme?: MenuTheme;
  /** 点击时触发，参数为当前点击事件或项目上下文。 */
  onClick?: (info: MenuClickInfo) => void;
}

/** 下拉菜单的属性配置。 */
export interface DropdownProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children" | "onOpenChange"> {
  /** 菜单项、选中状态与点击回调 */
  menu: DropdownMenuProps;
  /** 触发内容；菜单默认跟随触发按钮的实际字号，无按钮时使用首个触发元素或外层容器的字号。 */
  children: ReactNode;
  /**
   * 触发显示的交互方式。
   * @defaultValue ["hover"]
   */
  trigger?: readonly DropdownTrigger[];
  /**
   * 相对于触发元素的弹出方向和对齐位置。
   * @defaultValue "bottomLeft"
   */
  placement?: DropdownPlacement;
  /** 是否打开；传入后由外部控制显示状态。 */
  open?: boolean;
  /**
   * 非受控模式下的初始打开状态。
   * @defaultValue false
   */
  defaultOpen?: boolean;
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /** Automatically append a disclosure icon to a Button with text. */
  showTriggerIcon?: boolean;
  /**
   * 显示箭头及是否指向触发器中心
   * @defaultValue false
   */
  arrow?: boolean | {
  /** 是否让弹层箭头指向触发元素中心。 */
  pointAtCenter?: boolean };
  /**
   * 显示后是否自动聚焦。
   * @defaultValue false
   */
  autoFocus?: boolean;
  /**
   * 触发后延迟打开的时间。
   * @defaultValue 80
   */
  openDelay?: number;
  /**
   * 移出后延迟关闭的时间。
   * @defaultValue 120
   */
  closeDelay?: number;
  /**
   * 弹出面板的附加 CSS 类名。
   * @defaultValue ""
   */
  popupClassName?: string;
  /** 弹出面板的内联样式；fontSize 可覆盖默认跟随触发按钮的菜单字号。 */
  popupStyle?: CSSProperties;
  /** 自定义菜单浮层内容 */
  popupRender?: (menu: ReactNode) => ReactNode;
  /** 打开状态改变时触发，参数为新的打开状态。 */
  onOpenChange?: (open: boolean, info: {
  /** 触发来源，用于区分不同入口的操作。 */
  source: DropdownOpenSource }) => void;
}

const placementMap: Record<DropdownPlacement, PopupPortalPlacement> = {
  bottomLeft: "bottom-start",
  bottomRight: "bottom-end",
  topLeft: "top-start",
  topRight: "top-end",
};

/** 内部定位配置；组合按钮使用整组作为锚点，触发事件仍绑定箭头按钮。 */
interface DropdownInternalProps extends DropdownProps {
  /** 菜单定位锚点；未指定时使用当前下拉触发器，右键菜单仍使用点击坐标。 */
  popupAnchorRef?: RefObject<HTMLSpanElement | null>;
}

function DropdownInternal({
  popupAnchorRef,
  menu,
  children,
  trigger = ["hover"],
  placement = "bottomLeft",
  open,
  defaultOpen = false,
  disabled = false,
  showTriggerIcon = true,
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
}: DropdownInternalProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const contextAnchorRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<number | undefined>(undefined);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [contextPoint, setContextPoint] = useState<{ x: number; y: number }>();
  const visible = open ?? internalOpen;
  const triggerSet = new Set(trigger);
  const pointAtCenter = typeof arrow === "object" && arrow.pointAtCenter;
  const [triggerFontSize, setTriggerFontSize] = useState<string>();

  // Portal 脱离触发器的样式继承链，需读取按钮最终字号，并在按钮尺寸变化时同步。
  useLayoutEffect(() => {
    if (!visible || !rootRef.current) return;
    const root = rootRef.current;
    const target = root.querySelector<HTMLElement>("button, [role='button'], a")
      ?? (root.firstElementChild !== contextAnchorRef.current ? root.firstElementChild : null) ?? root;
    /** 读取计算后的 CSS 像素字号，兼容按钮尺寸、继承样式与自定义字号。 */
    const syncFontSize = () => setTriggerFontSize(getComputedStyle(target).fontSize);
    syncFontSize();
    const observer = new ResizeObserver(syncFontSize);
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible, children]);

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

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!visible) return undefined;
    const contextMenuTrigger = triggerSet.has("contextMenu");
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (!contextMenuTrigger && rootRef.current?.contains(target)) return;
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
    const frame = window.requestAnimationFrame(() => {
      popupRef.current?.querySelector<HTMLElement>(
        "[data-sia-dropdown-autofocus], input:not(:disabled), textarea:not(:disabled), .sia-menu__item:not(:disabled)",
      )?.focus();
    });
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
    event.stopPropagation();
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

  const triggerNode = showTriggerIcon && isValidElement<ButtonProps>(children) && children.type === Button
    && children.props.children !== undefined && children.props.children !== null
    ? cloneElement(children, {}, <span className="sia-dropdown__trigger-content">
      {children.props.children}
      <Icon name="chevron-down" size={14} className="sia-dropdown__trigger-icon" />
    </span>)
    : children;

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
    {...withTitleTooltip(props)}
  >
    {triggerNode}
    <span
      ref={contextAnchorRef}
      className="sia-dropdown__context-anchor"
      style={contextPoint ? { left: contextPoint.x, top: contextPoint.y } : undefined}
      aria-hidden="true"
    />
    <PopupPortal
      key={contextPoint ? `context-${contextPoint.x}-${contextPoint.y}` : "trigger"}
      ref={popupRef}
      anchorRef={contextPoint ? contextAnchorRef : popupAnchorRef ?? rootRef}
      open={visible}
      // 定位锚点保留到真实退场完成，不能按旧固定计时提前切换 Portal key。
      afterOpenChange={(nextOpen) => { if (!nextOpen) setContextPoint(undefined); }}
      placement={contextPoint ? "bottom-start" : placementMap[placement]}
      offset={contextPoint ? 2 : 6}
      className={`sia-dropdown__popup${visible ? " is-open" : " is-closing"}${arrow ? " sia-dropdown__popup--arrow" : ""}${pointAtCenter ? " sia-dropdown__popup--arrow-center" : ""} ${popupClassName}`.trim()}
      style={{ fontSize: triggerFontSize, ...popupStyle }}
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

/** 普通下拉菜单使用自身触发器定位，不对外暴露组合按钮的内部锚点。 */
function DropdownRoot(props: DropdownProps) {
  return <DropdownInternal {...props} />;
}

/** 组合下拉按钮的属性配置；菜单相对于整组按钮定位，主操作和箭头触发保持独立。 */
export interface DropdownButtonProps extends Omit<DropdownProps, "children" | "className"> {
  /**
   * 相对于整组按钮的弹出方向和对齐位置；默认优先与主按钮左侧对齐，视口空间不足时自动调整位置。
   * @defaultValue "bottomLeft"
   */
  placement?: DropdownPlacement;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode;
  /**
   * 附加到组件根节点的 CSS 类名。
   * @defaultValue ""
   */
  className?: string;
  /** 透传给触发按钮的 Button 属性，可配置样式、尺寸和事件。 */
  buttonProps?: Omit<ButtonProps, "children" | "onClick" | "disabled">;
  /** 仅禁用主操作按钮；整组 disabled 为 true 时仍优先禁用两侧。 */
  buttonDisabled?: boolean;
  /** 仅禁用下拉入口；用于主操作与菜单具有不同业务权限的场景。 */
  dropdownDisabled?: boolean;
  /** 点击时触发，参数为当前点击事件或项目上下文。 */
  onClick?: ButtonProps["onClick"];
}

function DropdownButton({
  children,
  className = "",
  buttonProps,
  onClick,
  disabled,
  buttonDisabled,
  dropdownDisabled,
  trigger = ["click"],
  ...dropdownProps
}: DropdownButtonProps) {
  // 定位使用整组宽度，避免菜单左边缘只对齐右侧箭头；事件仍由各自按钮处理。
  const groupRef = useRef<HTMLSpanElement>(null);
  return <span ref={groupRef} className={`sia-dropdown-button ${className}`.trim()}>
    <Button {...buttonProps} disabled={disabled || buttonDisabled} onClick={onClick}>{children}</Button>
    <DropdownInternal {...dropdownProps} popupAnchorRef={groupRef} disabled={disabled || dropdownDisabled} trigger={trigger} showTriggerIcon={false}>
      <Button
        {...buttonProps}
        className={`sia-dropdown-button__arrow ${buttonProps?.className ?? ""}`.trim()}
        disabled={disabled || dropdownDisabled}
        icon={<Icon name="chevron-down" size={14} />}
        aria-label="展开下拉菜单"
      />
    </DropdownInternal>
  </span>;
}

/** 下拉菜单组件；面板以 260ms 缩放淡入并果冻回弹，关闭为 140ms 无回弹缩小淡出；退出完成后释放定位锚点，系统减少动态效果时直接完成。 */
export const Dropdown = Object.assign(DropdownRoot, {
  /** 组合主操作按钮与下拉菜单的按钮组件。 */
  Button: DropdownButton });

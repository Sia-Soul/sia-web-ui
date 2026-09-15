import { useControlSize } from "./shared";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, KeyboardEvent, ReactNode, RefObject } from "react";
import { Icon } from "./Icon";
import { PopupPortal } from "./PopupPortal";
import type { PopupPortalPlacement } from "./PopupPortal";
import { useControllableState } from "./shared";

export type MenuMode = "vertical" | "horizontal" | "inline";
export type MenuTheme = "light" | "dark";
export type MenuItem = {
  key: string;
  label?: ReactNode;
  icon?: ReactNode;
  extra?: ReactNode;
  title?: string;
  disabled?: boolean;
  danger?: boolean;
  type?: "item" | "group" | "divider";
  children?: readonly MenuItem[];
};
export type MenuClickInfo = { key: string; keyPath: string[]; domEvent: React.MouseEvent; item: MenuItem };

export interface MenuProps extends Omit<HTMLAttributes<HTMLUListElement>, "onClick" | "onSelect"> {
  items: readonly MenuItem[];
  mode?: MenuMode;
  theme?: MenuTheme;
  selectedKeys?: readonly string[];
  defaultSelectedKeys?: readonly string[];
  openKeys?: readonly string[];
  defaultOpenKeys?: readonly string[];
  multiple?: boolean;
  selectable?: boolean;
  inlineCollapsed?: boolean;
  inlineIndent?: number;
  triggerSubMenuAction?: "hover" | "click";
  onClick?: (info: MenuClickInfo) => void;
  onSelect?: (info: MenuClickInfo & { selectedKeys: string[] }) => void;
  onDeselect?: (info: MenuClickInfo & { selectedKeys: string[] }) => void;
  onOpenChange?: (keys: string[]) => void;
}

type MenuLevelContext = Required<Pick<MenuProps, "mode" | "theme" | "multiple" | "selectable" | "inlineCollapsed" | "inlineIndent" | "triggerSubMenuAction">> & {
  menuId: string;
  selected: readonly string[];
  open: readonly string[];
  select: (item: MenuItem, path: string[], event: React.MouseEvent) => void;
  toggle: (key: string, force?: boolean) => void;
};

function MenuPopup({
  anchorRef,
  open,
  placement,
  menuId,
  theme,
  children,
  onMouseEnter,
  onMouseLeave,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  placement: PopupPortalPlacement;
  menuId: string;
  theme: MenuTheme;
  children: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setMounted(false), 160);
    return () => window.clearTimeout(timer);
  }, [open]);

  return <PopupPortal
    anchorRef={anchorRef}
    open={mounted}
    placement={placement}
    offset={4}
    className={`sia-menu__popup sia-menu--${theme}${open ? " is-open" : " is-closing"}`}
    data-sia-menu-owner={menuId}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <ul className="sia-menu__popup-list" role="menu">{children}</ul>
  </PopupPortal>;
}

function MenuEntry({
  item,
  level,
  parents,
  props,
}: {
  item: MenuItem;
  level: number;
  parents: string[];
  props: MenuLevelContext;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const hasChildren = Boolean(item.children?.length);
  const isOpen = props.open.includes(item.key);
  const isSelected = props.selected.includes(item.key);
  const path = [item.key, ...parents];
  const collapsed = props.inlineCollapsed && level === 0;
  const inlineSubmenu = props.mode === "inline" && !collapsed;

  useEffect(() => () => {
    if (closeTimerRef.current !== undefined) window.clearTimeout(closeTimerRef.current);
  }, []);

  function cancelClose() {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => props.toggle(item.key, false), 100);
  }

  const hover = props.triggerSubMenuAction === "hover" && hasChildren && !inlineSubmenu;
  const submenu = hasChildren ? <MenuLevel items={item.children ?? []} level={level + 1} parents={[item.key, ...parents]} props={props} /> : null;
  const popupPlacement: PopupPortalPlacement = props.mode === "horizontal" && level === 0 ? "bottom-start" : "right-start";

  return <li
    className={`sia-menu__entry${isOpen ? " is-open" : ""}${isSelected ? " is-selected" : ""}${item.disabled ? " is-disabled" : ""}${item.danger ? " is-danger" : ""}`}
    onMouseEnter={hover ? () => { cancelClose(); props.toggle(item.key, true); } : undefined}
    onMouseLeave={hover ? scheduleClose : undefined}
  >
    <button
      ref={anchorRef}
      type="button"
      className="sia-menu__item"
      style={{ paddingInlineStart: props.mode === "inline" && !props.inlineCollapsed ? 12 + level * props.inlineIndent : undefined }}
      title={collapsed ? item.title ?? (typeof item.label === "string" ? item.label : undefined) : item.title}
      disabled={item.disabled}
      aria-current={isSelected ? "page" : undefined}
      aria-expanded={hasChildren ? isOpen : undefined}
      onClick={(event) => hasChildren ? props.toggle(item.key) : props.select(item, path, event)}
    >
      {item.icon ? <span className="sia-menu__icon">{item.icon}</span> : null}
      {!collapsed ? <span className="sia-menu__label">{item.label}</span> : null}
      {!collapsed && item.extra ? <span className="sia-menu__extra">{item.extra}</span> : null}
      {!collapsed && hasChildren ? <Icon className="sia-menu__expand-icon" name="chevron-down" size={13} /> : null}
    </button>
    {hasChildren ? inlineSubmenu
      ? <ul className="sia-menu__submenu" role="menu" aria-hidden={!isOpen}>{submenu}</ul>
      : <MenuPopup
        anchorRef={anchorRef}
        open={isOpen}
        placement={popupPlacement}
        menuId={props.menuId}
        theme={props.theme}
        onMouseEnter={hover ? cancelClose : undefined}
        onMouseLeave={hover ? scheduleClose : undefined}
      >{submenu}</MenuPopup>
      : null}
  </li>;
}

function MenuLevel({
  items,
  level,
  parents,
  props,
}: {
  items: readonly MenuItem[];
  level: number;
  parents: string[];
  props: MenuLevelContext;
}) {
  return <>
    {items.map((item, index) => {
      if (item.type === "divider") return <li className="sia-menu__divider" key={item.key || `divider-${index}`} role="separator" />;
      if (item.type === "group") return <li className="sia-menu__group" key={item.key}>
        <div className="sia-menu__group-title">{item.label}</div>
        <ul role="group"><MenuLevel items={item.children ?? []} level={level + 1} parents={[...parents, item.key]} props={props} /></ul>
      </li>;
      return <MenuEntry key={item.key} item={item} level={level} parents={parents} props={props} />;
    })}
  </>;
}

export function Menu({
  items,
  mode = "vertical",
  theme = "light",
  selectedKeys,
  defaultSelectedKeys = [],
  openKeys,
  defaultOpenKeys = [],
  multiple = false,
  selectable = true,
  inlineCollapsed = false,
  inlineIndent = 20,
  triggerSubMenuAction = "click",
  onClick,
  onSelect,
  onDeselect,
  onOpenChange,
  className = "",
  ...rest
}: MenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLUListElement>(null);
  const [selected, setSelected] = useControllableState<readonly string[]>({ value: selectedKeys, defaultValue: defaultSelectedKeys });
  const [open, setOpen] = useControllableState<readonly string[]>({ value: openKeys, defaultValue: defaultOpenKeys, onChange: (next) => onOpenChange?.([...next]) });

  useEffect(() => {
    if (mode === "inline" || !open.length) return undefined;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const owner = target instanceof Element ? target.closest("[data-sia-menu-owner]")?.getAttribute("data-sia-menu-owner") : null;
      if (owner !== menuId) setOpen([]);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [menuId, mode, open.length, setOpen]);

  function toggle(key: string, force?: boolean) {
    const shouldOpen = force ?? !open.includes(key);
    setOpen(shouldOpen ? (open.includes(key) ? open : [...open, key]) : open.filter((item) => item !== key));
  }
  function select(item: MenuItem, keyPath: string[], domEvent: React.MouseEvent) {
    const info = { key: item.key, keyPath, domEvent, item };
    onClick?.(info);
    if (!selectable) return;
    const exists = selected.includes(item.key);
    const next = multiple ? (exists ? selected.filter((key) => key !== item.key) : [...selected, item.key]) : [item.key];
    setSelected(next);
    if (exists && multiple) onDeselect?.({ ...info, selectedKeys: [...next] });
    else onSelect?.({ ...info, selectedKeys: [...next] });
    if (mode !== "inline") setOpen([]);
  }
  return <ul ref={rootRef} className={`sia-menu sia-menu--${mode} sia-menu--${theme}${inlineCollapsed ? " sia-menu--collapsed" : ""} ${className}`.trim()} role="menu" {...rest} data-sia-menu-owner={menuId}>
    <MenuLevel items={items} level={0} parents={[]} props={{ menuId, mode, theme, multiple, selectable, inlineCollapsed, inlineIndent, triggerSubMenuAction, selected, open, select, toggle }} />
  </ul>;
}

export type StepStatus = "wait" | "process" | "finish" | "error";
export type StepItem = { title: ReactNode; description?: ReactNode; subTitle?: ReactNode; icon?: ReactNode; status?: StepStatus; disabled?: boolean };
export interface StepsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: readonly StepItem[];
  current?: number;
  initial?: number;
  direction?: "horizontal" | "vertical";
  type?: "default" | "navigation" | "dot";
  size?: "default" | "small";
  status?: "process" | "error";
  progressDot?: boolean | ((dot: ReactNode, info: { index: number; status: StepStatus; title: ReactNode; description?: ReactNode }) => ReactNode);
  onChange?: (current: number) => void;
}

export function Steps({ items, current = 0, initial = 0, direction = "horizontal", type = "default", size = "default", status = "process", progressDot = false, onChange, className = "", ...props }: StepsProps) {
  return <div className={`sia-steps sia-steps--${direction} sia-steps--${type} sia-steps--${size} ${className}`.trim()} {...props}>
    {items.map((item, rawIndex) => {
      const index = rawIndex + initial;
      const itemStatus: StepStatus = item.status ?? (index < current ? "finish" : index === current ? status : "wait");
      const dot = <span className="sia-steps__dot" />;
      const icon = progressDot ? (typeof progressDot === "function" ? progressDot(dot, { index, status: itemStatus, title: item.title, description: item.description }) : dot)
        : item.icon ?? (itemStatus === "finish" ? <Icon name="check" size={15} /> : itemStatus === "error" ? <Icon name="close" size={14} /> : index + 1);
      return <button type="button" className={`sia-steps__item sia-steps__item--${itemStatus}`} key={index} disabled={item.disabled || !onChange} onClick={() => onChange?.(index)}>
        <span className="sia-steps__head"><span className="sia-steps__icon">{icon}</span><span className="sia-steps__tail" /></span>
        <span className="sia-steps__content"><span className="sia-steps__title">{item.title}{item.subTitle ? <small>{item.subTitle}</small> : null}</span>{item.description ? <span className="sia-steps__description">{item.description}</span> : null}</span>
      </button>;
    })}
  </div>;
}

export type SegmentedValue = string | number;
export type SegmentedOption = SegmentedValue | { label?: ReactNode; value: SegmentedValue; icon?: ReactNode; disabled?: boolean; title?: string };
export interface SegmentedProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  options: readonly SegmentedOption[];
  value?: SegmentedValue;
  defaultValue?: SegmentedValue;
  size?: "small" | "medium" | "large";
  block?: boolean;
  vertical?: boolean;
  disabled?: boolean;
  onChange?: (value: SegmentedValue) => void;
}

export function Segmented({ options, value, defaultValue, size: sizeProp, block = false, vertical = false, disabled = false, onChange, className = "", onKeyDown, ...props }: SegmentedProps) {
  const size = useControlSize(sizeProp);
  const normalized = useMemo(() => options.map((option) => typeof option === "object" ? option : { label: option, value: option }), [options]);
  const [current, setCurrent] = useControllableState<SegmentedValue | undefined>({ value, defaultValue: defaultValue ?? normalized[0]?.value, onChange: (next) => next !== undefined && onChange?.(next) });
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const enabled = normalized.filter((option) => !option.disabled);
    const index = enabled.findIndex((option) => option.value === current);
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? enabled[(index + 1) % enabled.length] : enabled[(index - 1 + enabled.length) % enabled.length];
    if (next) setCurrent(next.value);
  }
  return <div className={`sia-segmented sia-segmented--${size}${block ? " sia-segmented--block" : ""}${vertical ? " sia-segmented--vertical" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()} role="radiogroup" onKeyDown={keyboard} {...props}>
    {normalized.map((option) => <button type="button" role="radio" aria-checked={option.value === current} title={option.title} className={option.value === current ? "is-selected" : ""} disabled={disabled || option.disabled} key={option.value} onClick={() => setCurrent(option.value)}>
      {option.icon}<span>{option.label ?? option.value}</span>
    </button>)}
  </div>;
}

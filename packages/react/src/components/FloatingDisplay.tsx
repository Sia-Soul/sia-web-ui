import { cloneElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Checkbox } from "./Checkbox";
import { Icon } from "./Icon";
import { useControllableState } from "./shared";

export type FloatingPlacement = "top" | "top-start" | "top-end" | "bottom" | "bottom-start" | "bottom-end" | "left" | "right";
export type FloatingTrigger = "hover" | "focus" | "click";
export interface TooltipProps {
  title?: ReactNode;
  children: ReactElement;
  placement?: FloatingPlacement;
  trigger?: FloatingTrigger | readonly FloatingTrigger[];
  role?: string;
  open?: boolean;
  defaultOpen?: boolean;
  mouseEnterDelay?: number;
  mouseLeaveDelay?: number;
  arrow?: boolean;
  color?: string;
  className?: string;
  overlayClassName?: string;
  onOpenChange?: (open: boolean) => void;
}

type FloatingPosition = {
  top: number;
  left: number;
  placement: FloatingPlacement;
  arrowX?: number;
  arrowY?: number;
};

const FLOATING_GAP = 9;
const FLOATING_VIEWPORT_PADDING = 8;
const FLOATING_ARROW_EDGE_OFFSET = 16;
let activeTooltipClose: (() => void) | undefined;

function clampFloating(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function resolveFloatingPosition(trigger: DOMRect, overlay: DOMRect, placement: FloatingPlacement): FloatingPosition {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  let resolvedPlacement = placement;
  if (placement.startsWith("top") && trigger.top - overlay.height - FLOATING_GAP < FLOATING_VIEWPORT_PADDING && trigger.bottom + overlay.height + FLOATING_GAP <= viewportHeight - FLOATING_VIEWPORT_PADDING) {
    resolvedPlacement = placement.replace("top", "bottom") as FloatingPlacement;
  } else if (placement.startsWith("bottom") && trigger.bottom + overlay.height + FLOATING_GAP > viewportHeight - FLOATING_VIEWPORT_PADDING && trigger.top - overlay.height - FLOATING_GAP >= FLOATING_VIEWPORT_PADDING) {
    resolvedPlacement = placement.replace("bottom", "top") as FloatingPlacement;
  } else if (placement === "left" && trigger.left - overlay.width - FLOATING_GAP < FLOATING_VIEWPORT_PADDING && trigger.right + overlay.width + FLOATING_GAP <= viewportWidth - FLOATING_VIEWPORT_PADDING) {
    resolvedPlacement = "right";
  } else if (placement === "right" && trigger.right + overlay.width + FLOATING_GAP > viewportWidth - FLOATING_VIEWPORT_PADDING && trigger.left - overlay.width - FLOATING_GAP >= FLOATING_VIEWPORT_PADDING) {
    resolvedPlacement = "left";
  }

  let top = trigger.top;
  let left = trigger.left;
  if (resolvedPlacement.startsWith("top") || resolvedPlacement.startsWith("bottom")) {
    top = resolvedPlacement.startsWith("top") ? trigger.top - overlay.height - FLOATING_GAP : trigger.bottom + FLOATING_GAP;
    left = resolvedPlacement.endsWith("-start")
      ? trigger.left
      : resolvedPlacement.endsWith("-end")
        ? trigger.right - overlay.width
        : trigger.left + (trigger.width - overlay.width) / 2;
  } else {
    top = trigger.top + (trigger.height - overlay.height) / 2;
    left = resolvedPlacement === "left" ? trigger.left - overlay.width - FLOATING_GAP : trigger.right + FLOATING_GAP;
  }

  top = clampFloating(top, FLOATING_VIEWPORT_PADDING, viewportHeight - overlay.height - FLOATING_VIEWPORT_PADDING);
  left = clampFloating(left, FLOATING_VIEWPORT_PADDING, viewportWidth - overlay.width - FLOATING_VIEWPORT_PADDING);
  const result: FloatingPosition = { top, left, placement: resolvedPlacement };
  if (resolvedPlacement.startsWith("top") || resolvedPlacement.startsWith("bottom")) {
    result.arrowX = resolvedPlacement.endsWith("-start")
      ? clampFloating(FLOATING_ARROW_EDGE_OFFSET, 8, overlay.width - 16)
      : resolvedPlacement.endsWith("-end")
        ? clampFloating(overlay.width - FLOATING_ARROW_EDGE_OFFSET - 8, 8, overlay.width - 16)
        : clampFloating(trigger.left + trigger.width / 2 - left - 4, 8, overlay.width - 16);
  } else {
    result.arrowY = clampFloating(trigger.top + trigger.height / 2 - top - 4, 8, overlay.height - 16);
  }
  return result;
}

function Floating({
  children, content, placement = "top", trigger = "hover", open, defaultOpen = false, mouseEnterDelay = .1, mouseLeaveDelay = .1,
  arrow = true, color, className = "", overlayClassName = "", role = "tooltip", onOpenChange,
}: TooltipProps & { content: ReactNode }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLSpanElement>(null);
  const enterTimer = useRef<number>();
  const leaveTimer = useRef<number>();
  const contentId = useId();
  const triggers = Array.isArray(trigger) ? trigger : [trigger];
  const [visible, setVisible] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const [position, setPosition] = useState<FloatingPosition>();
  const setVisibleRef = useRef(setVisible);
  setVisibleRef.current = setVisible;
  const closeSelfRef = useRef<() => void>();
  if (!closeSelfRef.current) closeSelfRef.current = () => setVisibleRef.current(false);
  const exclusiveTooltip = role === "tooltip" && triggers.includes("hover");
  function openNow() {
    if (exclusiveTooltip && activeTooltipClose !== closeSelfRef.current) {
      activeTooltipClose?.();
      activeTooltipClose = closeSelfRef.current;
    }
    setVisible(true);
  }
  function closeNow() {
    if (activeTooltipClose === closeSelfRef.current) activeTooltipClose = undefined;
    setVisible(false);
  }
  function clearTimers() {
    window.clearTimeout(enterTimer.current);
    window.clearTimeout(leaveTimer.current);
  }
  function show(delay = 0) {
    clearTimers();
    if (delay <= 0) openNow();
    else enterTimer.current = window.setTimeout(openNow, delay * 1000);
  }
  function hide(delay = 0) {
    clearTimers();
    if (delay <= 0) closeNow();
    else leaveTimer.current = window.setTimeout(closeNow, delay * 1000);
  }
  useEffect(() => {
    if (!visible || !triggers.includes("click")) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !overlayRef.current?.contains(target)) closeNow();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [triggers.join("|"), visible]);
  useLayoutEffect(() => {
    if (!visible) {
      setPosition(undefined);
      return;
    }
    const update = () => {
      if (!rootRef.current || !overlayRef.current) return;
      setPosition(resolveFloatingPosition(rootRef.current.getBoundingClientRect(), overlayRef.current.getBoundingClientRect(), placement));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new ResizeObserver(update);
    if (rootRef.current) observer.observe(rootRef.current);
    if (overlayRef.current) observer.observe(overlayRef.current);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
    };
  }, [children, content, placement, visible]);
  useEffect(() => () => {
    clearTimers();
    if (activeTooltipClose === closeSelfRef.current) activeTooltipClose = undefined;
  }, []);
  const child = cloneElement(children, {
    ...(triggers.includes("hover") ? { onMouseEnter: (event: React.MouseEvent) => { children.props.onMouseEnter?.(event); show(mouseEnterDelay); }, onMouseLeave: (event: React.MouseEvent) => { children.props.onMouseLeave?.(event); hide(mouseLeaveDelay); } } : {}),
    ...(triggers.includes("focus") ? { onFocus: (event: React.FocusEvent) => { children.props.onFocus?.(event); show(); }, onBlur: (event: React.FocusEvent) => { children.props.onBlur?.(event); hide(); } } : {}),
    ...(triggers.includes("click") ? { onClick: (event: React.MouseEvent) => { children.props.onClick?.(event); if (visible) closeNow(); else openNow(); } } : {}),
    "aria-describedby": visible ? contentId : undefined,
  });
  const overlay = visible && content !== null && content !== undefined && typeof document !== "undefined"
    ? createPortal(
      <span
        ref={overlayRef}
        id={contentId}
        role={role}
        data-custom-color={color ? "" : undefined}
        className={`sia-floating__overlay sia-floating__overlay--${position?.placement ?? placement} ${overlayClassName}`.trim()}
        style={{
          "--sia-floating-color": color,
          "--sia-floating-arrow-x": position?.arrowX == null ? undefined : `${position.arrowX}px`,
          "--sia-floating-arrow-y": position?.arrowY == null ? undefined : `${position.arrowY}px`,
          top: position?.top ?? 0,
          left: position?.left ?? 0,
          visibility: position ? "visible" : "hidden",
        } as CSSProperties}
        onMouseEnter={triggers.includes("hover") ? () => show() : undefined}
        onMouseLeave={triggers.includes("hover") ? () => hide(mouseLeaveDelay) : undefined}
      >
        {content}{arrow ? <span className="sia-floating__arrow" /> : null}
      </span>,
      document.body,
    )
    : null;
  return <>
    <span ref={rootRef} className={`sia-floating ${className}`.trim()}>
      {child}
    </span>
    {overlay}
  </>;
}

export function Tooltip(props: TooltipProps) { return <Floating {...props} content={props.title} />; }

export interface PopoverProps extends Omit<TooltipProps, "title"> {
  title?: ReactNode;
  content?: ReactNode;
}
export function Popover({ title, content, trigger = "click", overlayClassName = "", ...props }: PopoverProps) {
  return <Floating {...props} trigger={trigger} role="dialog" overlayClassName={`sia-popover ${overlayClassName}`.trim()} content={<>{title ? <strong className="sia-popover__title">{title}</strong> : null}<span className="sia-popover__content">{content}</span></>} />;
}

export type TimelineItem = { children?: ReactNode; label?: ReactNode; color?: "blue" | "red" | "green" | "gray" | string; dot?: ReactNode; position?: "left" | "right" };
export interface TimelineProps extends HTMLAttributes<HTMLUListElement> {
  items?: readonly TimelineItem[];
  mode?: "left" | "alternate" | "right";
  pending?: ReactNode | boolean;
  pendingDot?: ReactNode;
  reverse?: boolean;
}
export function Timeline({ items = [], mode = "left", pending = false, pendingDot, reverse = false, className = "", ...props }: TimelineProps) {
  const values: TimelineItem[] = [...items, ...(pending ? [{ children: pending === true ? "加载中..." : pending, dot: pendingDot ?? <Icon name="loader" className="sia-spin-icon" /> }] : [])];
  if (reverse) values.reverse();
  return <ul className={`sia-timeline sia-timeline--${mode} ${className}`.trim()} {...props}>
    {values.map((item, index) => {
      const position = item.position ?? (mode === "alternate" ? (index % 2 ? "right" : "left") : mode);
      return <li className={`sia-timeline__item sia-timeline__item--${position}`} key={index}>
        {item.label ? <span className="sia-timeline__label">{item.label}</span> : null}
        <span className="sia-timeline__rail"><span className="sia-timeline__dot" style={{ color: item.color && !["blue", "red", "green", "gray"].includes(item.color) ? item.color : undefined }} data-color={item.color ?? "blue"}>{item.dot}</span></span>
        <span className="sia-timeline__content">{item.children}</span>
      </li>;
    })}
  </ul>;
}

export type TreeKey = string | number;
export interface TreeNode {
  key: TreeKey;
  title: ReactNode;
  prefix?: ReactNode;
  extra?: ReactNode;
  disabled?: boolean;
  disableCheckbox?: boolean;
  selectable?: boolean;
  checkable?: boolean;
  isLeaf?: boolean;
  icon?: ReactNode;
  rowProps?: Omit<HTMLAttributes<HTMLDivElement>, "children"> & Partial<Record<`data-${string}`, string | number>>;
  children?: readonly TreeNode[];
  [key: string]: unknown;
}
export interface TreeProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect" | "onDrop"> {
  treeData: readonly TreeNode[];
  selectedKeys?: readonly TreeKey[];
  defaultSelectedKeys?: readonly TreeKey[];
  expandedKeys?: readonly TreeKey[];
  defaultExpandedKeys?: readonly TreeKey[];
  defaultExpandAll?: boolean;
  checkedKeys?: readonly TreeKey[];
  defaultCheckedKeys?: readonly TreeKey[];
  checkable?: boolean;
  checkStrictly?: boolean;
  multiple?: boolean;
  selectable?: boolean;
  showLine?: boolean;
  showIcon?: boolean;
  blockNode?: boolean;
  draggable?: boolean;
  loadData?: (node: TreeNode) => void | Promise<void>;
  onSelect?: (keys: TreeKey[], info: { selected: boolean; node: TreeNode; nativeEvent: React.MouseEvent }) => void;
  onCheck?: (keys: TreeKey[], info: { checked: boolean; node: TreeNode }) => void;
  onExpand?: (keys: TreeKey[], info: { expanded: boolean; node: TreeNode }) => void;
  onDrop?: (info: { dragNode: TreeNode; node: TreeNode }) => void;
}

function collectKeys(nodes: readonly TreeNode[], branchOnly = false, result: TreeKey[] = []) {
  nodes.forEach((node) => { if (!branchOnly || node.children?.length) result.push(node.key); if (node.children) collectKeys(node.children, branchOnly, result); });
  return result;
}
function descendants(node: TreeNode) { return node.children ? collectKeys(node.children) : []; }

export function Tree({
  treeData, selectedKeys, defaultSelectedKeys = [], expandedKeys, defaultExpandedKeys = [], defaultExpandAll = false, checkedKeys, defaultCheckedKeys = [],
  checkable = false, checkStrictly = false, multiple = false, selectable = true, showLine = false, showIcon = false, blockNode = false,
  draggable = false, loadData, onSelect, onCheck, onExpand, onDrop, className = "", ...props
}: TreeProps) {
  const [selected, setSelected] = useControllableState<readonly TreeKey[]>({ value: selectedKeys, defaultValue: defaultSelectedKeys });
  const [expanded, setExpanded] = useControllableState<readonly TreeKey[]>({ value: expandedKeys, defaultValue: defaultExpandAll ? collectKeys(treeData, true) : defaultExpandedKeys });
  const [checked, setChecked] = useControllableState<readonly TreeKey[]>({ value: checkedKeys, defaultValue: defaultCheckedKeys });
  const [loading, setLoading] = useState<Set<TreeKey>>(new Set());
  const [dragNode, setDragNode] = useState<TreeNode>();
  async function toggleExpand(node: TreeNode) {
    const nextExpanded = !expanded.includes(node.key);
    if (nextExpanded && !node.children?.length && node.isLeaf === false && loadData) {
      setLoading((keys) => new Set(keys).add(node.key));
      await loadData(node);
      setLoading((keys) => { const next = new Set(keys); next.delete(node.key); return next; });
    }
    const next = nextExpanded ? [...expanded, node.key] : expanded.filter((key) => key !== node.key);
    setExpanded(next); onExpand?.([...next], { expanded: nextExpanded, node });
  }
  function check(node: TreeNode) {
    const nodeChecked = checked.includes(node.key);
    const affected = checkStrictly ? [node.key] : [node.key, ...descendants(node)];
    const next = nodeChecked ? checked.filter((key) => !affected.includes(key)) : [...new Set([...checked, ...affected])];
    setChecked(next); onCheck?.([...next], { checked: !nodeChecked, node });
  }
  function select(node: TreeNode, event: React.MouseEvent) {
    if (!selectable || node.selectable === false || node.disabled) return;
    const exists = selected.includes(node.key);
    const next = multiple ? (exists ? selected.filter((key) => key !== node.key) : [...selected, node.key]) : (exists ? [] : [node.key]);
    setSelected(next); onSelect?.([...next], { selected: !exists, node, nativeEvent: event });
  }
  function render(nodes: readonly TreeNode[], depth = 0): ReactNode {
    return nodes.map((node) => {
      const open = expanded.includes(node.key);
      const isSelected = selected.includes(node.key);
      const isChecked = checked.includes(node.key);
      const hasChildren = Boolean(node.children?.length || node.isLeaf === false);
      const { className: rowClassName = "", style: rowStyle, onClick: onRowClick, ...rowProps } = node.rowProps ?? {};
      return <div className={`sia-tree__node${isSelected ? " is-selected" : ""}${node.disabled ? " is-disabled" : ""}`} role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={isSelected} key={node.key}>
        <div {...rowProps} className={`sia-tree__row${blockNode ? " sia-tree__row--block" : ""} ${rowClassName}`.trim()} style={{ ...rowStyle, paddingInlineStart: depth * 20 }}
          draggable={draggable && !node.disabled}
          onClick={(event) => {
            onRowClick?.(event);
            if (event.defaultPrevented || node.disabled) return;
            select(node, event);
            if (hasChildren) void toggleExpand(node);
          }}
          onDragStart={() => setDragNode(node)}
          onDragOver={draggable ? (event) => event.preventDefault() : undefined}
          onDrop={draggable ? () => { if (dragNode && dragNode.key !== node.key) onDrop?.({ dragNode, node }); setDragNode(undefined); } : undefined}>
          {hasChildren ? <button type="button" className="sia-tree__switcher" disabled={node.disabled} onClick={(event) => { event.stopPropagation(); void toggleExpand(node); }}>{loading.has(node.key) ? <Icon name="loader" className="sia-spin-icon" size={13} /> : <Icon name={open ? "chevron-down" : "chevron-right"} size={13} />}</button> : <span className="sia-tree__switcher" aria-hidden="true" />}
          {checkable || node.checkable ? <span onClick={(event) => event.stopPropagation()}><Checkbox checked={isChecked} disabled={node.disabled || node.disableCheckbox} onChange={() => check(node)} /></span> : null}
          {node.prefix ? <span className="sia-tree__prefix" onClick={(event) => event.stopPropagation()}>{node.prefix}</span> : null}
          {showIcon ? <span className="sia-tree__icon">{node.icon ?? <Icon name={hasChildren ? "folder" : "file"} size={15} />}</span> : null}
          <button type="button" className="sia-tree__title" disabled={node.disabled}>{node.title}</button>
          {node.extra ? <span className="sia-tree__extra" onClick={(event) => event.stopPropagation()}>{node.extra}</span> : null}
        </div>
        {open && node.children?.length ? <div className="sia-tree__children" role="group">{render(node.children, depth + 1)}</div> : null}
      </div>;
    });
  }
  return <div className={`sia-tree${showLine ? " sia-tree--line" : ""} ${className}`.trim()} role="tree" aria-multiselectable={multiple || undefined} {...props}>{render(treeData)}</div>;
}

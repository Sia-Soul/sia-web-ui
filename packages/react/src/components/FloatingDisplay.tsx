import { withTitleTooltip } from "./titleTooltip";
import { cloneElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Checkbox } from "./Checkbox";
import { Dropdown } from "./Dropdown";
import type { DropdownMenuProps } from "./Dropdown";
import { Icon } from "./Icon";
import { useControllableState } from "./shared";

/** Floating的位置类型。 */
export type FloatingPlacement = "top" | "top-start" | "top-end" | "bottom" | "bottom-start" | "bottom-end" | "left" | "right";
/** 触发浮层显示的交互方式。 */
export type FloatingTrigger = "hover" | "focus" | "click";
/** 文字提示的属性配置。 */
export interface TooltipProps {
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children: ReactElement;
  /** 相对于触发元素的弹出方向和对齐位置。 */
  placement?: FloatingPlacement;
  /** 触发显示的交互方式。 */
  trigger?: FloatingTrigger | readonly FloatingTrigger[];
  /** 元素的无障碍语义角色。 */
  role?: string;
  /** 是否打开；传入后由外部控制显示状态。 */
  open?: boolean;
  /** 非受控模式下的初始打开状态。 */
  defaultOpen?: boolean;
  /** 鼠标移入后延迟显示的时间。 */
  mouseEnterDelay?: number;
  /** 鼠标移出后延迟隐藏的时间。 */
  mouseLeaveDelay?: number;
  /** 显示箭头及是否指向触发器中心 */
  arrow?: boolean;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 附加到组件根节点的 CSS 类名。 */
  className?: string;
  /** 浮层容器的附加 CSS 类名。 */
  overlayClassName?: string;
  /** 打开状态改变时触发，参数为新的打开状态。 */
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

/** 文字提示组件。 */
export function Tooltip(props: TooltipProps) { return <Floating {...props} content={props.title} />; }

/** 气泡卡片的属性配置。 */
export interface PopoverProps extends Omit<TooltipProps, "title"> {
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 需要显示的内容，支持文本或 React 节点。 */
  content?: ReactNode;
}
/** 气泡卡片组件。 */
export function Popover({ title, content, trigger = "click", overlayClassName = "", ...props }: PopoverProps) {
  return <Floating {...props} trigger={trigger} role="dialog" overlayClassName={`sia-popover ${overlayClassName}`.trim()} content={<>{title ? <strong className="sia-popover__title">{title}</strong> : null}<span className="sia-popover__content">{content}</span></>} />;
}

/** 时间轴的项目定义。 */
export type TimelineItem = {
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: ReactNode;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: "blue" | "red" | "green" | "gray" | string;
  /** 是否以圆点形式显示状态或徽标。 */
  dot?: ReactNode;
  /** 显示位置或定位配置。 */
  position?: "left" | "right" };
/** 时间轴的属性配置。 */
export interface TimelineProps extends HTMLAttributes<HTMLUListElement> {
  /**
   * 按展示顺序排列的项目配置。
   * @defaultValue []
   */
  items?: readonly TimelineItem[];
  /**
   * 展示或交互模式；可选值见类型定义。
   * @defaultValue "left"
   */
  mode?: "left" | "alternate" | "right";
  /**
   * 时间轴未完成节点的内容。
   * @defaultValue false
   */
  pending?: ReactNode | boolean;
  /** 时间轴未完成节点的图标。 */
  pendingDot?: ReactNode;
  /**
   * 反转节点顺序
   * @defaultValue false
   */
  reverse?: boolean;
}
/** 时间轴组件。 */
export function Timeline({ items = [], mode = "left", pending = false, pendingDot, reverse = false, className = "", ...props }: TimelineProps) {
  const values: TimelineItem[] = [...items, ...(pending ? [{ children: pending === true ? "加载中..." : pending, dot: pendingDot ?? <Icon name="loader" className="sia-spin-icon" /> }] : [])];
  if (reverse) values.reverse();
  return <ul className={`sia-timeline sia-timeline--${mode} ${className}`.trim()} {...withTitleTooltip(props)}>
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

/** 树节点的唯一标识类型。 */
export type TreeKey = string | number;
/** 拖放目标相对于节点的位置。 */
export type TreeDropPosition = "before" | "inside" | "after";
/** 树组件的数据节点，支持子节点、勾选、禁用和异步加载。 */
export interface TreeNode {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: TreeKey;
  /** 标题内容，可传入文本或 React 节点。 */
  title: ReactNode;
  /** 输入框前缀 */
  prefix?: ReactNode;
  /** 主体之外的补充内容或操作区。 */
  extra?: ReactNode;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 是否仅禁用该节点的勾选框。 */
  disableCheckbox?: boolean;
  /** 是否允许选中项目。 */
  selectable?: boolean;
  /** 是否显示勾选框或允许勾选。 */
  checkable?: boolean;
  /** 是否为叶子节点；异步加载场景可用于标识无子项节点。 */
  isLeaf?: boolean;
  /** 子节点是否已经加载完成。 */
  loaded?: boolean;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 加载过程中的提示内容。 */
  loadingText?: ReactNode;
  /** 是否允许拖拽。 */
  draggable?: boolean;
  /** 是否允许作为拖放目标。 */
  droppable?: boolean;
  /** 右键菜单配置或按当前项目生成菜单的函数。 */
  contextMenu?: DropdownMenuProps;
  /** 右键菜单弹层的 CSS 类名。 */
  contextMenuPopupClassName?: string;
  /** 行节点的附加属性，也可按行生成属性。 */
  rowProps?: Omit<HTMLAttributes<HTMLDivElement>, "children"> & Partial<Record<`data-${string}`, string | number>>;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: readonly TreeNode[];
  [key: string]: unknown;
}
/** 树的属性配置。 */
export interface TreeProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect" | "onDrop"> {
  /** 树形节点数据 */
  treeData: readonly TreeNode[];
  /** 当前选中项目的标识集合；传入后由外部控制。 */
  selectedKeys?: readonly TreeKey[];
  /**
   * 非受控模式下初始选中的项目标识集合。
   * @defaultValue []
   */
  defaultSelectedKeys?: readonly TreeKey[];
  /** 受控的展开节点标识集合。 */
  expandedKeys?: readonly TreeKey[];
  /**
   * 初始化时展开的节点标识集合。
   * @defaultValue []
   */
  defaultExpandedKeys?: readonly TreeKey[];
  /**
   * 是否在初始化时展开所有节点。
   * @defaultValue false
   */
  defaultExpandAll?: boolean;
  /** 受控的勾选节点标识集合。 */
  checkedKeys?: readonly TreeKey[];
  /**
   * 非受控模式下初始勾选的节点标识。
   * @defaultValue []
   */
  defaultCheckedKeys?: readonly TreeKey[];
  /**
   * 由外部控制正在异步加载的节点
   * @defaultValue []
   */
  loadingKeys?: readonly TreeKey[];
  /**
   * 是否显示勾选框或允许勾选。
   * @defaultValue false
   */
  checkable?: boolean;
  /**
   * 父子节点勾选状态是否相互独立。
   * @defaultValue false
   */
  checkStrictly?: boolean;
  /**
   是否允许同时选择多个项目。
   * @defaultValue false
   */
  multiple?: boolean;
  /**
   * 是否允许选中项目。
   * @defaultValue true
   */
  selectable?: boolean;
  /**
   * 是否显示连接线。
   * @defaultValue false
   */
  showLine?: boolean;
  /**
   * 是否显示状态图标。
   * @defaultValue false
   */
  showIcon?: boolean;
  /**
   * 节点是否占满整行宽度。
   * @defaultValue false
   */
  blockNode?: boolean;
  /**
   * 每级节点的缩进距离，单位为像素。
   * @defaultValue 20
   */
  indentSize?: number;
  /**
   * 展开开关预留宽度，单位为像素。
   * @defaultValue 24
   */
  switcherWidth?: number;
  /**
   * 滚动时是否固定显示当前节点的祖先行。
   * @defaultValue false
   */
  stickyAncestors?: boolean;
  /**
   * 固定祖先行的高度，单位为像素。
   * @defaultValue 34
   */
  stickyRowHeight?: number;
  /**
   * 是否允许拖拽。
   * @defaultValue false
   */
  draggable?: boolean;
  /** 按当前节点异步加载子节点的函数。 */
  loadData?: (node: TreeNode) => void | Promise<void>;
  /** 选中项目时调用，参数包含选中项目及关联状态。 */
  onSelect?: (keys: TreeKey[], info: {
  /** 是否处于选中状态。 */
  selected: boolean;
  /** 当前操作关联的节点数据。 */
  node: TreeNode;
  /** 触发本次操作的原生事件。 */
  nativeEvent: React.MouseEvent }) => void;
  /** 勾选状态变化时调用。 */
  onCheck?: (keys: TreeKey[], info: {
  /** 当前是否勾选；作为受控属性时通过回调更新。 */
  checked: boolean;
  /** 当前操作关联的节点数据。 */
  node: TreeNode }) => void;
  /** 节点展开或收起时调用。 */
  onExpand?: (keys: TreeKey[], info: {
  /** 是否处于展开状态。 */
  expanded: boolean;
  /** 当前操作关联的节点数据。 */
  node: TreeNode }) => void;
  /** 拖放完成时调用，提供拖拽源和目标位置。 */
  onDrop?: (info: {
  /** 正在拖拽的源节点。 */
  dragNode: TreeNode;
  /** 当前操作关联的节点数据。 */
  node: TreeNode;
  /** 相对于目标节点的落点位置。 */
  dropPosition: TreeDropPosition }) => void;
}

function collectKeys(nodes: readonly TreeNode[], branchOnly = false, result: TreeKey[] = []) {
  nodes.forEach((node) => { if (!branchOnly || node.children?.length) result.push(node.key); if (node.children) collectKeys(node.children, branchOnly, result); });
  return result;
}
function descendants(node: TreeNode) { return node.children ? collectKeys(node.children) : []; }

/** 树组件。 */
export function Tree({
  treeData, selectedKeys, defaultSelectedKeys = [], expandedKeys, defaultExpandedKeys = [], defaultExpandAll = false, checkedKeys, defaultCheckedKeys = [], loadingKeys = [],
  checkable = false, checkStrictly = false, multiple = false, selectable = true, showLine = false, showIcon = false, blockNode = false,
  indentSize = 20, switcherWidth = 24, stickyAncestors = false, stickyRowHeight = 34,
  draggable = false, loadData, onSelect, onCheck, onExpand, onDrop, className = "", ...props
}: TreeProps) {
  const [selected, setSelected] = useControllableState<readonly TreeKey[]>({ value: selectedKeys, defaultValue: defaultSelectedKeys });
  const [expanded, setExpanded] = useControllableState<readonly TreeKey[]>({ value: expandedKeys, defaultValue: defaultExpandAll ? collectKeys(treeData, true) : defaultExpandedKeys });
  const [checked, setChecked] = useControllableState<readonly TreeKey[]>({ value: checkedKeys, defaultValue: defaultCheckedKeys });
  const [loading, setLoading] = useState<Set<TreeKey>>(new Set());
  const controlledLoading = useMemo(() => new Set(loadingKeys), [loadingKeys]);
  const selectedKeySet = useMemo(() => new Set(selected), [selected]);
  const selectedAncestorKeys = useMemo(() => {
    const ancestors = new Set<TreeKey>();
    const visit = (nodes: readonly TreeNode[], parentKeys: readonly TreeKey[]) => {
      nodes.forEach((node) => {
        if (selectedKeySet.has(node.key)) parentKeys.forEach((key) => ancestors.add(key));
        if (node.children?.length) visit(node.children, [...parentKeys, node.key]);
      });
    };
    visit(treeData, []);
    return ancestors;
  }, [selectedKeySet, treeData]);
  const dragNodeRef = useRef<TreeNode>();
  const pointerDragRef = useRef<{
    node: TreeNode;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  }>();
  const suppressClickRef = useRef(false);
  const [dragOver, setDragOver] = useState<{ key: TreeKey; position: TreeDropPosition }>();
  const normalizedSwitcherWidth = Math.max(0, switcherWidth);
  async function toggleExpand(node: TreeNode) {
    const nextExpanded = !expanded.includes(node.key);
    if (nextExpanded && node.loaded !== true && !node.children?.length && node.isLeaf === false && loadData) {
      setLoading((keys) => new Set(keys).add(node.key));
      try {
        await loadData(node);
      } finally {
        setLoading((keys) => { const next = new Set(keys); next.delete(node.key); return next; });
      }
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
  function selectForContextMenu(node: TreeNode, event: React.MouseEvent) {
    if (!selectable || node.selectable === false || node.disabled || selected.includes(node.key)) return;
    const next = [node.key];
    setSelected(next);
    onSelect?.(next, { selected: true, node, nativeEvent: event });
  }
  function findNode(key: string, nodes: readonly TreeNode[] = treeData): TreeNode | undefined {
    for (const node of nodes) {
      if (String(node.key) === key) return node;
      const child = node.children?.length ? findNode(key, node.children) : undefined;
      if (child) return child;
    }
    return undefined;
  }
  function getPointerDropTarget(clientX: number, clientY: number, dragNode: TreeNode) {
    const targetElement = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-sia-tree-drop-key]");
    if (!targetElement) return undefined;
    const targetNode = targetElement?.dataset.siaTreeDropKey ? findNode(targetElement.dataset.siaTreeDropKey) : undefined;
    if (!targetNode || targetNode.key === dragNode.key || targetNode.disabled || targetNode.droppable === false) return undefined;
    const bounds = targetElement.getBoundingClientRect();
    const relativeY = bounds.height > 0 ? (clientY - bounds.top) / bounds.height : 0.5;
    const dropPosition: TreeDropPosition = relativeY < 0.25
      ? "before"
      : relativeY > 0.75
        ? "after"
        : "inside";
    return { node: targetNode, dropPosition };
  }
  function beginPointerDrag(node: TreeNode, event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    pointerDragRef.current = {
      node,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePointerDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    if (!pointerDrag.active && Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) < 5) return;
    pointerDrag.active = true;
    dragNodeRef.current = pointerDrag.node;
    event.preventDefault();
    const target = getPointerDropTarget(event.clientX, event.clientY, pointerDrag.node);
    setDragOver(target ? { key: target.node.key, position: target.dropPosition } : undefined);
  }
  function finishPointerDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointerDrag.active) {
      event.preventDefault();
      suppressClickRef.current = true;
      const target = getPointerDropTarget(event.clientX, event.clientY, pointerDrag.node);
      if (target) onDrop?.({ dragNode: pointerDrag.node, node: target.node, dropPosition: target.dropPosition });
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    pointerDragRef.current = undefined;
    dragNodeRef.current = undefined;
    setDragOver(undefined);
  }
  function cancelPointerDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    pointerDragRef.current = undefined;
    dragNodeRef.current = undefined;
    setDragOver(undefined);
  }
  function render(nodes: readonly TreeNode[], depth = 0): ReactNode {
    return nodes.map((node) => {
      const open = expanded.includes(node.key);
      const isSelected = selected.includes(node.key);
      const isSelectedAncestor = selectedAncestorKeys.has(node.key);
      const isChecked = checked.includes(node.key);
      const hasChildren = Boolean(node.children?.length || node.isLeaf === false);
      const nodeLoading = loading.has(node.key) || controlledLoading.has(node.key);
      const sticky = stickyAncestors && hasChildren && open;
      const canDrag = draggable && node.draggable !== false && !node.disabled;
      const { className: rowClassName = "", style: rowStyle, onClick: onRowClick, ...rowProps } = node.rowProps ?? {};
      const unloaded = hasChildren && node.loaded === false;
      const dropPosition = dragOver?.key === node.key ? dragOver.position : undefined;
      return <div className={`sia-tree__node${isSelected ? " is-selected" : ""}${isSelectedAncestor ? " is-selected-ancestor" : ""}${dropPosition ? ` is-drag-over-${dropPosition}` : ""}${node.disabled ? " is-disabled" : ""}${unloaded ? " is-unloaded" : ""}`} role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={isSelected} key={node.key}>
        <div {...withTitleTooltip(rowProps)} className={`sia-tree__row${blockNode ? " sia-tree__row--block" : ""}${sticky ? " sia-tree__row--sticky" : ""} ${rowClassName}`.trim()} style={{
          ...rowStyle,
          paddingInlineStart: depth * Math.max(0, indentSize),
          top: sticky ? depth * Math.max(1, stickyRowHeight) : rowStyle?.top,
          zIndex: sticky ? Math.max(1, 100 - depth) : rowStyle?.zIndex,
        }}
          aria-busy={nodeLoading || undefined}
          data-sia-tree-drop-key={String(node.key)}
          data-sia-tree-draggable={canDrag || undefined}
          onClick={(event) => {
            onRowClick?.(event);
            if (event.defaultPrevented || suppressClickRef.current || node.disabled) return;
            select(node, event);
            if (hasChildren) void toggleExpand(node);
          }}
        >
          {(() => {
            const content = <span className="sia-tree__context-content">
              {hasChildren ? <button type="button" className="sia-tree__switcher" aria-label={open ? "收起节点" : "展开节点"} aria-expanded={open} style={{ width: normalizedSwitcherWidth, flexBasis: normalizedSwitcherWidth }} disabled={node.disabled} onClick={(event) => { event.stopPropagation(); void toggleExpand(node); }}>{nodeLoading ? <Icon name="loader" className="sia-spin-icon" size={13} /> : <Icon name={open ? "chevron-down" : "chevron-right"} size={13} />}</button> : <span className="sia-tree__switcher" aria-label={open ? "收起节点" : "展开节点"} aria-expanded={open} style={{ width: normalizedSwitcherWidth, flexBasis: normalizedSwitcherWidth }} aria-hidden="true" />}
              {checkable || node.checkable ? <span onClick={(event) => event.stopPropagation()}><Checkbox checked={isChecked} disabled={node.disabled || node.disableCheckbox} onChange={() => check(node)} /></span> : null}
              {node.prefix ? <span className="sia-tree__prefix" onClick={(event) => event.stopPropagation()}>{node.prefix}</span> : null}
              {showIcon ? <span className="sia-tree__icon">{node.icon ?? <Icon name={hasChildren ? "folder" : "file"} size={15} />}</span> : null}
              <button
                type="button"
                className="sia-tree__title"
                disabled={node.disabled}
                onPointerDown={canDrag ? (event) => beginPointerDrag(node, event) : undefined}
                onPointerMove={canDrag ? movePointerDrag : undefined}
                onPointerUp={canDrag ? finishPointerDrag : undefined}
                onPointerCancel={canDrag ? cancelPointerDrag : undefined}
              >
                {node.title}
              </button>
              {nodeLoading ? <span className="sia-tree__loading-text" role="status">{node.loadingText ?? "正在加载…"}</span> : null}
              {node.extra ? <span className="sia-tree__extra" onClick={(event) => event.stopPropagation()}>{node.extra}</span> : null}
            </span>;
            return node.contextMenu ? <Dropdown
              className="sia-tree__context-trigger"
              popupClassName={node.contextMenuPopupClassName}
              trigger={["contextMenu"]}
              menu={node.contextMenu}
              onContextMenu={(event) => selectForContextMenu(node, event)}
            >
              {content}
            </Dropdown> : content;
          })()}
        </div>
        {open && node.children?.length ? <div className="sia-tree__children" role="group">{render(node.children, depth + 1)}</div> : null}
      </div>;
    });
  }
  return <div className={`sia-tree${showLine ? " sia-tree--line" : ""}${stickyAncestors ? " sia-tree--sticky-ancestors" : ""} ${className}`.trim()} role="tree" aria-multiselectable={multiple || undefined} {...withTitleTooltip(props)}>{render(treeData)}</div>;
}

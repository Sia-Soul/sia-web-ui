import { getTreeCheckState, toggleTreeCheck } from "./treeCheckState";
import { withTitleTooltip } from "./titleTooltip";
import { cloneElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Checkbox } from "./Checkbox";
import { FloatingScrollbarProvider } from "./FloatingScrollbarProvider";
import { Dropdown } from "./Dropdown";
import type { DropdownMenuProps } from "./Dropdown";
import { Icon } from "./Icon";
import { useControllableState } from "./shared";

/** 气泡十二个方向；start/end 为对应边的起点/终点对齐，同时支持 topLeft、leftTop 等驼峰别名。 */
export type FloatingPlacement = "top" | "top-start" | "top-end" | "bottom" | "bottom-start" | "bottom-end" | "left" | "left-start" | "left-end" | "right" | "right-start" | "right-end"
  | "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "leftTop" | "leftBottom" | "rightTop" | "rightBottom";
/** 触发浮层显示的交互方式。 */
export type FloatingTrigger = "hover" | "focus" | "click";
/** 文字提示的属性配置；弹框或抽屉内的提示遵循所属容器的层级，不覆盖后续打开的子弹层。 */
export interface TooltipProps {
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 触发气泡的元素；定位以实际接收触发事件的 DOM 元素为准，初始打开时使用首个子元素。 */
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
  /** 是否显示箭头，默认 true；对象配置可让箭头指向触发元素中心。 */
  arrow?: boolean | {
    /** 是否指向触发元素中心，默认 false；空间受限时箭头限制在气泡边缘内。 */
    pointAtCenter?: boolean;
  };
  /** 是否自动翻转和贴边偏移，默认 true；滚动时始终跟随触发元素，目标完全离开可视区域时隐藏气泡。 */
  autoAdjustOverflow?: boolean;
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
  hidden?: boolean;
};

const FLOATING_GAP = 9;
const FLOATING_VIEWPORT_PADDING = 8;
const FLOATING_ARROW_EDGE_OFFSET = 16;
let activeTooltipClose: (() => void) | undefined;

function clampFloating(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// 驼峰名称仅作为 API 别名，定位和样式统一使用方向加 start/end。
function normalizeFloatingPlacement(placement: FloatingPlacement): FloatingPlacement {
  const aliases: Partial<Record<FloatingPlacement, FloatingPlacement>> = {
    topLeft: "top-start", topRight: "top-end", bottomLeft: "bottom-start", bottomRight: "bottom-end",
    leftTop: "left-start", leftBottom: "left-end", rightTop: "right-start", rightBottom: "right-end",
  };
  return aliases[placement] ?? placement;
}

function resolveFloatingPosition(trigger: DOMRect, overlay: DOMRect, placement: FloatingPlacement, pointAtCenter: boolean, adjust: boolean): FloatingPosition {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  let resolvedPlacement = normalizeFloatingPlacement(placement);
  const side = resolvedPlacement.split("-")[0];
  const available = { top: trigger.top, bottom: viewportHeight - trigger.bottom, left: trigger.left, right: viewportWidth - trigger.right };
  const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" } as const;
  const preferred = side as keyof typeof opposite;
  const other = opposite[preferred];
  const needed = (side === "top" || side === "bottom" ? overlay.height : overlay.width) + FLOATING_GAP + FLOATING_VIEWPORT_PADDING;
  if (adjust && available[preferred] < needed && available[other] > available[preferred]) {
    resolvedPlacement = resolvedPlacement.replace(preferred, other) as FloatingPlacement;
  }
  const vertical = resolvedPlacement.startsWith("top") || resolvedPlacement.startsWith("bottom");
  const start = resolvedPlacement.endsWith("-start");
  const end = resolvedPlacement.endsWith("-end");
  let top = vertical
    ? resolvedPlacement.startsWith("top") ? trigger.top - overlay.height - FLOATING_GAP : trigger.bottom + FLOATING_GAP
    : start ? trigger.top : end ? trigger.bottom - overlay.height : trigger.top + (trigger.height - overlay.height) / 2;
  let left = vertical
    ? start ? trigger.left : end ? trigger.right - overlay.width : trigger.left + (trigger.width - overlay.width) / 2
    : resolvedPlacement.startsWith("left") ? trigger.left - overlay.width - FLOATING_GAP : trigger.right + FLOATING_GAP;
  // 只沿对齐轴贴边移动，保持弹层与触发器间距，避免滚动时浮层压住目标。
  if (adjust) {
    if (vertical) left = clampFloating(left, FLOATING_VIEWPORT_PADDING, viewportWidth - overlay.width - FLOATING_VIEWPORT_PADDING);
    else top = clampFloating(top, FLOATING_VIEWPORT_PADDING, viewportHeight - overlay.height - FLOATING_VIEWPORT_PADDING);
  }
  const result: FloatingPosition = { top, left, placement: resolvedPlacement };
  const size = vertical ? trigger.width : trigger.height;
  const anchorStart = vertical ? trigger.left : trigger.top;
  const edge = Math.min(size / 2, FLOATING_ARROW_EDGE_OFFSET + 4);
  const target = anchorStart + (pointAtCenter || (!start && !end) ? size / 2 : start ? edge : size - edge);
  if (vertical) result.arrowX = clampFloating(target - left - 4, 8, overlay.width - 16);
  else result.arrowY = clampFloating(target - top - 4, 8, overlay.height - 16);
  return result;
}

// Portal 不受滚动容器裁剪；目标离开祖先可视区后隐藏弹层，避免悬空停留。
function isFloatingAnchorHidden(anchor: Element, rect: DOMRect) {
  let left = 0, top = 0, right = document.documentElement.clientWidth, bottom = document.documentElement.clientHeight;
  for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
    if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
  }
  return rect.right <= left || rect.left >= right || rect.bottom <= top || rect.top >= bottom;
}

function Floating({
  children, content, placement = "top", trigger = "hover", open, defaultOpen = false, mouseEnterDelay = .1, mouseLeaveDelay = .1,
  arrow = true, autoAdjustOverflow = true, color, className = "", overlayClassName = "", role = "tooltip", onOpenChange,
}: TooltipProps & { content: ReactNode }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerElementRef = useRef<Element | null>(null);
  const overlayRef = useRef<HTMLSpanElement>(null);
  const enterTimer = useRef<number>();
  const leaveTimer = useRef<number>();
  const contentId = useId();
  const triggers = Array.isArray(trigger) ? trigger : [trigger];
  const [visible, setVisible] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const [position, setPosition] = useState<FloatingPosition>();
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  // 挂到弹层根节点而非动画面板，既保留 fixed 的视口定位，又让气泡受父弹层堆叠上下文约束。
  useLayoutEffect(() => {
    if (!visible) return;
    setPortalContainer(rootRef.current?.closest<HTMLElement>(".sia-modal-root, .sia-drawer-root") ?? document.body);
  });
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
    // 外层包装可能被 flex/grid 拉伸，定位应使用实际触发元素的边界。
    const getAnchor = () => {
      const root = rootRef.current;
      const target = triggerElementRef.current;
      return target && root?.contains(target) ? target : root?.firstElementChild ?? root;
    };
    const update = () => {
      if (!rootRef.current || !overlayRef.current) return;
      const anchor = getAnchor();
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        const next = resolveFloatingPosition(rect, overlayRef.current.getBoundingClientRect(), placement, typeof arrow === "object" && !!arrow.pointAtCenter, autoAdjustOverflow);
        next.hidden = isFloatingAnchorHidden(anchor, rect);
        setPosition(next);
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    // 弹框/抽屉的 transform 动画不会触发 ResizeObserver，结束后重新校准锚点可见性和视口坐标。
    window.addEventListener("animationend", update, true);
    window.addEventListener("transitionend", update, true);
    const observer = new ResizeObserver(update);
    if (rootRef.current) observer.observe(rootRef.current);
    const anchor = getAnchor();
    if (anchor) observer.observe(anchor);
    if (overlayRef.current) observer.observe(overlayRef.current);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("animationend", update, true);
      window.removeEventListener("transitionend", update, true);
      observer.disconnect();
    };
  }, [children, content, placement, visible, portalContainer, autoAdjustOverflow, typeof arrow === "object" && arrow.pointAtCenter]);
  useEffect(() => () => {
    clearTimers();
    if (activeTooltipClose === closeSelfRef.current) activeTooltipClose = undefined;
  }, []);
  const child = cloneElement(children, {
    ...(triggers.includes("hover") ? { onMouseEnter: (event: React.MouseEvent) => { triggerElementRef.current = event.currentTarget; children.props.onMouseEnter?.(event); show(mouseEnterDelay); }, onMouseLeave: (event: React.MouseEvent) => { children.props.onMouseLeave?.(event); hide(mouseLeaveDelay); } } : {}),
    ...(triggers.includes("focus") ? { onFocus: (event: React.FocusEvent) => { triggerElementRef.current = event.currentTarget; children.props.onFocus?.(event); show(); }, onBlur: (event: React.FocusEvent) => { children.props.onBlur?.(event); hide(); } } : {}),
    ...(triggers.includes("click") ? { onClick: (event: React.MouseEvent) => { triggerElementRef.current = event.currentTarget; children.props.onClick?.(event); if (visible) closeNow(); else openNow(); } } : {}),
    "aria-describedby": visible ? contentId : undefined,
  });
  const overlay = visible && content !== null && content !== undefined && typeof document !== "undefined"
    ? createPortal(
      <span
        ref={overlayRef}
        id={contentId}
        role={role}
        data-custom-color={color ? "" : undefined}
        className={`sia-floating__overlay sia-floating__overlay--${position?.placement ?? normalizeFloatingPlacement(placement)} ${overlayClassName}`.trim()}
        style={{
          "--sia-floating-color": color,
          "--sia-floating-arrow-x": position?.arrowX == null ? undefined : `${position.arrowX}px`,
          "--sia-floating-arrow-y": position?.arrowY == null ? undefined : `${position.arrowY}px`,
          top: position?.top ?? 0,
          left: position?.left ?? 0,
          visibility: position && !position.hidden ? "visible" : "hidden",
        } as CSSProperties}
        onMouseEnter={triggers.includes("hover") ? () => show() : undefined}
        onMouseLeave={triggers.includes("hover") ? () => hide(mouseLeaveDelay) : undefined}
      >
        {content}{arrow ? <span className="sia-floating__arrow" /> : null}
      </span>,
      portalContainer ?? document.body,
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
/** 树的属性配置；通过 style 或 className 设置高度限制及 overflow: auto 后，溢出内容使用不占布局空间的浮动滚动条。 */
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
  /** 受控勾选键；非独立模式自动向下关联子节点、向上汇总父节点及半选，禁用节点阻断传播。通过 onCheck 同步更新。 */
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
   * 为 true 时父子独立；为 false 时父子联动，并显示部分子项选中的半选状态。
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
   * 节点标题是否填满缩进、展开按钮和复选框之外的剩余宽度。
   * @defaultValue true
   */
  blockNode?: boolean;
  /**
   * 是否强调选中节点的祖先行；关闭时仅选中节点显示选中背景。
   * @defaultValue false
   */
  highlightSelectedAncestors?: boolean;
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
   * 是否允许组件在可见节点达到阈值且自身形成滚动视口时自动启用虚拟滚动；关闭后始终渲染全部已展开节点。
   * @defaultValue true
   */
  virtual?: boolean;
  /**
   * 自动启用虚拟滚动所需的最少可见节点数；小于该数量时保留完整 DOM，避免为小树增加额外计算。
   * @defaultValue 100
   */
  virtualThreshold?: number;
  /**
   * 虚拟滚动模式下每一行的固定高度，单位为像素；未传入时使用 stickyRowHeight 的值。
   * @defaultValue stickyRowHeight
   */
  virtualItemHeight?: number;
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
  /** 用户切换勾选时调用；keys 为联动后的完整选中键，info.halfCheckedKeys 为半选父节点。 */
  onCheck?: (keys: TreeKey[], info: {
  /** 当前是否勾选；作为受控属性时通过回调更新。 */
  checked: boolean;
  /** 联动计算后处于半选状态的节点键；独立模式为空数组。 */
  halfCheckedKeys: TreeKey[];
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

/** 虚拟滚动使用的扁平节点，仅包含当前已经展开且真实可见的层级。 */
interface FlatTreeNode {
  node: TreeNode;
  depth: number;
  ancestorKeys: readonly TreeKey[];
  index: number;
  positionInSet: number;
  setSize: number;
}

/** 将展开分支拍平成稳定顺序，避免虚拟窗口仍递归创建全部 React 节点。 */
function flattenVisibleTree(nodes: readonly TreeNode[], expandedKeys: ReadonlySet<TreeKey>, depth = 0, ancestorKeys: readonly TreeKey[] = [], result: FlatTreeNode[] = []) {
  nodes.forEach((node, siblingIndex) => {
    result.push({ node, depth, ancestorKeys, index: result.length, positionInSet: siblingIndex + 1, setSize: nodes.length });
    if (expandedKeys.has(node.key) && node.children?.length) {
      flattenVisibleTree(node.children, expandedKeys, depth + 1, [...ancestorKeys, node.key], result);
    }
  });
  return result;
}

/** 树形控件，支持选择、勾选与异步加载；自身容器可滚动时默认接入浮动滚动条，无需全局 Provider。 */
export function Tree({
  treeData, selectedKeys, defaultSelectedKeys = [], expandedKeys, defaultExpandedKeys = [], defaultExpandAll = false, checkedKeys, defaultCheckedKeys = [], loadingKeys = [],
  checkable = false, checkStrictly = false, multiple = false, selectable = true, showLine = false, showIcon = false, blockNode = true, highlightSelectedAncestors = false,
  indentSize = 20, switcherWidth = 24, stickyAncestors = false, stickyRowHeight = 34,
  virtual = true, virtualThreshold = 100, virtualItemHeight,
  draggable = false, loadData, onSelect, onCheck, onExpand, onDrop, className = "", ...props
}: TreeProps) {
  // 仅接管当前树的滚动容器，复用框架轨道的显隐、拖拽和尺寸更新逻辑。
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useControllableState<readonly TreeKey[]>({ value: selectedKeys, defaultValue: defaultSelectedKeys });
  const [expanded, setExpanded] = useControllableState<readonly TreeKey[]>({ value: expandedKeys, defaultValue: defaultExpandAll ? collectKeys(treeData, true) : defaultExpandedKeys });
  const [checked, setChecked] = useControllableState<readonly TreeKey[]>({ value: checkedKeys, defaultValue: defaultCheckedKeys });
  const [loading, setLoading] = useState<Set<TreeKey>>(new Set());
  const controlledLoading = useMemo(() => new Set(loadingKeys), [loadingKeys]);
  const selectedKeySet = useMemo(() => new Set(selected), [selected]);
  const expandedKeySet = useMemo(() => new Set(expanded), [expanded]);
  const flatNodes = useMemo(() => flattenVisibleTree(treeData, expandedKeySet), [expandedKeySet, treeData]);
  const normalizedVirtualThreshold = Math.max(1, Math.floor(virtualThreshold));
  const normalizedVirtualItemHeight = Math.max(1, virtualItemHeight ?? stickyRowHeight);
  const wantsVirtualScroll = virtual && flatNodes.length >= normalizedVirtualThreshold;
  const [virtualViewport, setVirtualViewport] = useState({ height: 0, scrollTop: 0, ownsScroll: true });

  useLayoutEffect(() => {
    if (!wantsVirtualScroll) return undefined;
    const element = scrollRef.current;
    if (!element) return undefined;
    let animationFrame = 0;
    // Tree 只有在自身承担纵向滚动时才能稳定计算窗口；外部滚动容器继续使用完整渲染。
    const updateViewport = () => {
      animationFrame = 0;
      const overflowY = window.getComputedStyle(element).overflowY;
      const ownsScroll = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
      const next = { height: element.clientHeight, scrollTop: element.scrollTop, ownsScroll };
      setVirtualViewport((current) => current.height === next.height && current.scrollTop === next.scrollTop && current.ownsScroll === next.ownsScroll ? current : next);
    };
    const scheduleViewportUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateViewport);
    };
    updateViewport();
    element.addEventListener("scroll", scheduleViewportUpdate, { passive: true });
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(scheduleViewportUpdate);
    resizeObserver?.observe(element);
    return () => {
      element.removeEventListener("scroll", scheduleViewportUpdate);
      resizeObserver?.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [className, props.style, wantsVirtualScroll]);

  const virtualEnabled = wantsVirtualScroll && virtualViewport.ownsScroll;
  const virtualWindow = useMemo(() => {
    if (!virtualEnabled) return { start: 0, end: flatNodes.length };
    const overscan = 8;
    const viewportHeight = virtualViewport.height || normalizedVirtualItemHeight * 12;
    const maxStart = Math.max(0, flatNodes.length - 1);
    const start = Math.min(maxStart, Math.max(0, Math.floor(virtualViewport.scrollTop / normalizedVirtualItemHeight) - overscan));
    const end = Math.min(flatNodes.length, Math.ceil((virtualViewport.scrollTop + viewportHeight) / normalizedVirtualItemHeight) + overscan);
    return { start, end };
  }, [flatNodes.length, normalizedVirtualItemHeight, virtualEnabled, virtualViewport.height, virtualViewport.scrollTop]);
  const flatNodeByKey = useMemo(() => new Map(flatNodes.map((item) => [item.node.key, item])), [flatNodes]);
  const virtualStickyNodes = useMemo(() => {
    if (!virtualEnabled || !stickyAncestors || !flatNodes.length) return [];
    const anchorIndex = Math.min(flatNodes.length - 1, Math.max(0, Math.floor(virtualViewport.scrollTop / normalizedVirtualItemHeight)));
    return flatNodes[anchorIndex].ancestorKeys
      .map((key) => flatNodeByKey.get(key))
      .filter((item): item is FlatTreeNode => Boolean(item));
  }, [flatNodeByKey, flatNodes, normalizedVirtualItemHeight, stickyAncestors, virtualEnabled, virtualViewport.scrollTop]);
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
  const checkState = useMemo(() => getTreeCheckState(treeData, checked, checkStrictly), [treeData, checked, checkStrictly]);
  function check(node: TreeNode) {
    const next = toggleTreeCheck(treeData, checked, node, checkStrictly);
    setChecked([...next.checked]);
    onCheck?.([...next.checked], { checked: next.checkedValue, halfCheckedKeys: [...next.halfChecked], node });
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
  function renderNode(node: TreeNode, depth: number, options: {
    reactKey?: TreeKey | string;
    children?: ReactNode;
    virtualTop?: number;
    stickySlot?: number;
    positionInSet?: number;
    setSize?: number;
  } = {}) {
    const open = expandedKeySet.has(node.key);
    const isSelected = selected.includes(node.key);
    // 祖先强调独立于节点选择，避免把父节点误呈现为同时选中。
    const isSelectedAncestor = highlightSelectedAncestors && selectedAncestorKeys.has(node.key);
    const isChecked = checkState.checked.has(node.key);
    const isHalfChecked = checkState.halfChecked.has(node.key);
    const hasChildren = Boolean(node.children?.length || node.isLeaf === false);
    const nodeLoading = loading.has(node.key) || controlledLoading.has(node.key);
    const virtualizedNode = options.virtualTop !== undefined || options.stickySlot !== undefined;
    const sticky = !virtualizedNode && stickyAncestors && hasChildren && open;
    const canDrag = draggable && node.draggable !== false && !node.disabled;
    const { className: rowClassName = "", style: rowStyle, onClick: onRowClick, ...rowProps } = node.rowProps ?? {};
    const unloaded = hasChildren && node.loaded === false;
    const dropPosition = dragOver?.key === node.key ? dragOver.position : undefined;
    const virtualNodeClassName = options.stickySlot !== undefined ? " sia-tree__virtual-sticky-node" : options.virtualTop !== undefined ? " sia-tree__virtual-node" : "";
    const virtualNodeStyle: CSSProperties | undefined = options.stickySlot !== undefined
      ? { top: options.stickySlot * normalizedVirtualItemHeight, height: normalizedVirtualItemHeight }
      : options.virtualTop !== undefined
        ? { transform: `translateY(${options.virtualTop}px)`, height: normalizedVirtualItemHeight }
        : undefined;
    return <div
      className={`sia-tree__node${virtualNodeClassName}${isSelected ? " is-selected" : ""}${isSelectedAncestor ? " is-selected-ancestor" : ""}${dropPosition ? ` is-drag-over-${dropPosition}` : ""}${node.disabled ? " is-disabled" : ""}${unloaded ? " is-unloaded" : ""}`}
      style={virtualNodeStyle}
      role="treeitem"
      aria-expanded={hasChildren ? open : undefined}
      aria-selected={isSelected}
      aria-level={depth + 1}
      aria-posinset={options.positionInSet}
      aria-setsize={options.setSize}
      key={options.reactKey ?? node.key}
    >
      {/* 扁平虚拟节点不再拥有 children 包装层，按深度补绘连接线。 */}
      {virtualizedNode && showLine && depth > 0 ? <span className="sia-tree__virtual-guides" aria-hidden="true">
        {Array.from({ length: depth }, (_, guideDepth) => <span className="sia-tree__virtual-guide" style={{ insetInlineStart: (guideDepth + 1) * Math.max(0, indentSize) }} key={guideDepth} />)}
      </span> : null}
      <div {...withTitleTooltip(rowProps)} className={`sia-tree__row${blockNode ? " sia-tree__row--block" : ""}${sticky ? " sia-tree__row--sticky" : ""} ${rowClassName}`.trim()} style={{
        ...rowStyle,
        height: virtualizedNode ? "100%" : rowStyle?.height,
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
            {checkable || node.checkable ? <span onClick={(event) => event.stopPropagation()}><Checkbox checked={isChecked} indeterminate={isHalfChecked} disabled={node.disabled || node.disableCheckbox} onChange={() => check(node)} /></span> : null}
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
      {options.children}
    </div>;
  }
  function render(nodes: readonly TreeNode[], depth = 0): ReactNode {
    return nodes.map((node, siblingIndex) => renderNode(node, depth, {
      positionInSet: siblingIndex + 1,
      setSize: nodes.length,
      children: expandedKeySet.has(node.key) && node.children?.length
        ? <div className="sia-tree__children" role="group">{render(node.children, depth + 1)}</div>
        : null,
    }));
  }
  const stickyVirtualKeySet = new Set(virtualStickyNodes.map((item) => item.node.key));
  const virtualContent = virtualEnabled ? <div className="sia-tree__virtual-space" style={{ height: flatNodes.length * normalizedVirtualItemHeight }}>
    {virtualStickyNodes.length ? <div className="sia-tree__virtual-sticky-layer">
      {virtualStickyNodes.map((item, stickySlot) => renderNode(item.node, item.depth, {
        reactKey: `sticky-${String(item.node.key)}`,
        stickySlot,
        positionInSet: item.positionInSet,
        setSize: item.setSize,
      }))}
    </div> : null}
    {flatNodes.slice(virtualWindow.start, virtualWindow.end).filter((item) => !stickyVirtualKeySet.has(item.node.key)).map((item) => renderNode(item.node, item.depth, {
      reactKey: `virtual-${String(item.node.key)}`,
      virtualTop: item.index * normalizedVirtualItemHeight,
      positionInSet: item.positionInSet,
      setSize: item.setSize,
    }))}
  </div> : render(treeData);
  return <div ref={scrollRef} className={`sia-tree${showLine ? " sia-tree--line" : ""}${stickyAncestors ? " sia-tree--sticky-ancestors" : ""}${virtualEnabled ? " sia-tree--virtual" : ""} ${className}`.trim()} role="tree" aria-multiselectable={multiple || undefined} data-sia-tree-virtualized={virtualEnabled || undefined} {...withTitleTooltip(props)}>
    {virtualContent}
    {/* Provider 不生成树内 DOM，保留节点层级和祖先吸顶布局。 */}
    <FloatingScrollbarProvider targetRef={scrollRef} />
  </div>;
}

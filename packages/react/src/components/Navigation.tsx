import { withTitleTooltip } from "./titleTooltip";
import { useControlSize } from "./shared";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode, RefObject } from "react";
import { Icon } from "./Icon";
import { PopupPortal } from "./PopupPortal";
import type { PopupPortalPlacement } from "./PopupPortal";
import { useControllableState } from "./shared";

/** 菜单排列模式；vertical 为纵向列表，horizontal 为横向菜单，inline 为内嵌子菜单，grid 为双列圆角卡片（图标在上、名称在下，子菜单以弹层展开）。 */
export type MenuMode = "vertical" | "horizontal" | "inline" | "grid";
/** 菜单的亮色或暗色主题。 */
export type MenuTheme = "light" | "dark";
/** 菜单的项目定义。 */
export type MenuItem = {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: string;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: ReactNode;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 图标槽的宽高，单位 px；未指定时沿用菜单图标尺寸变量。图片图标应传入与图片相同的尺寸，避免挤压。 */
  iconSize?: number;
  /** 是否显示当前生效的实心圆形勾选标记，默认为 false；标记以92%不透明度显示，独立于 selectedKeys 的浏览选中状态，由业务在应用成功后更新。 */
  applied?: boolean;
  /** 生效水印的无障碍说明；默认为“当前使用”，仅 applied 为 true 时显示。 */
  appliedLabel?: string;
  /** 主体之外的补充内容或操作区。 */
  extra?: ReactNode;
  /** 菜单项的悬停提示文字，停留 600ms 后显示，禁用项同样支持；收起的图标菜单未设置时使用纯文本 label。 */
  title?: string;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 危险操作样式 */
  danger?: boolean;
  /** 类型标识，用于选择对应的表现形式。 */
  type?: "item" | "group" | "divider";
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: readonly MenuItem[];
};
/** 菜单的点击事件上下文。 */
export type MenuClickInfo = {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: string;
  /** 从当前项目到祖先项目的标识路径。 */
  keyPath: string[];
  /** 触发本次操作的 React 鼠标事件。 */
  domEvent: React.MouseEvent;
  /** 本次操作关联的项目配置。 */
  item: MenuItem };

/** 菜单的属性配置。 */
export interface MenuProps extends Omit<HTMLAttributes<HTMLUListElement>, "onClick" | "onSelect"> {
  /** 按展示顺序排列的项目配置。 */
  items: readonly MenuItem[];
  /**
   * 展示或交互模式；grid 显示双列圆角卡片，图标居上、名称居下，保留选中和当前生效标记。
   * @defaultValue "vertical"
   */
  mode?: MenuMode;
  /** grid 模式的列数，默认 2；正数取整且至少为 1，auto 按每列至少 88px 自动换列。通过 --sia-menu-grid-columns 传递到分组；style 中的同名变量可覆盖。其他模式不生效。 */
  gridColumns?: number | "auto";
  /** 菜单项的鼠标形状：pointer 使用系统链接指针，default 保持普通选择指针，适合桌面列表；不改变点击、键盘和禁用语义，包含分组及子菜单。@defaultValue "pointer" */
  interactionCursor?: "pointer" | "default";
  /**
   组件的配色主题。
   * @defaultValue "light"
   */
  theme?: MenuTheme;
  /** 当前选中项目的标识集合；传入后由外部控制。 */
  selectedKeys?: readonly string[];
  /**
   * 自动将首个选中项目滚动到菜单自身的可见区域，适用于可纵向滚动的列表、内嵌或网格菜单。
   * 首次渲染、异步项目到达及首个选中标识改变时尝试定位；已完整可见时不滚动，超出时尽量居中。
   * 仅调整菜单自身的滚动位置，不展开子菜单、不移动焦点；相同选中项的普通重渲染保留用户手动滚动位置。
   * @defaultValue false
   */
  autoScrollSelected?: boolean;
  /**
   * 非受控模式下初始选中的项目标识集合。
   * @defaultValue []
   */
  defaultSelectedKeys?: readonly string[];
  /** 当前展开的子菜单标识集合。 */
  openKeys?: readonly string[];
  /**
   * 初始展开的子菜单标识集合。
   * @defaultValue []
   */
  defaultOpenKeys?: readonly string[];
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
   * 收起内嵌菜单
   * @defaultValue false
   */
  inlineCollapsed?: boolean;
  /**
   * 内嵌子菜单每增加一级时增加的缩进，单位为像素。
   * @defaultValue 20
   */
  inlineIndent?: number;
  /**
   * 打开子菜单的方式：hover 为悬停，click 为点击。
   * @defaultValue "click"
   */
  triggerSubMenuAction?: "hover" | "click";
  /** 点击时触发，参数为当前点击事件或项目上下文。 */
  onClick?: (info: MenuClickInfo) => void;
  /** 选中项目时调用，参数包含选中项目及关联状态。 */
  onSelect?: (info: MenuClickInfo & {
  /** 当前选中项目的标识集合；传入后由外部控制。 */
  selectedKeys: string[] }) => void;
  /** 取消选中项目时调用。 */
  onDeselect?: (info: MenuClickInfo & {
  /** 当前选中项目的标识集合；传入后由外部控制。 */
  selectedKeys: string[] }) => void;
  /** 打开状态改变时触发，参数为新的打开状态。 */
  onOpenChange?: (keys: string[]) => void;
}

// 子菜单沿用同一个指针配置，Portal 渲染不依赖外部样式继承。
type MenuLevelContext = Required<Pick<MenuProps, "interactionCursor" | "mode" | "theme" | "multiple" | "selectable" | "inlineCollapsed" | "inlineIndent" | "triggerSubMenuAction">> & {
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
  const [fontSize, setFontSize] = useState<string>();
  // 子菜单也通过 Portal 渲染，沿用父菜单项字号以保持多级菜单文字一致。
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!mounted || !anchor) return;
    /** 同步父级菜单项的实际字号，避免子菜单回退到页面默认字号。 */
    const syncFontSize = () => setFontSize(getComputedStyle(anchor).fontSize);
    syncFontSize();
    const observer = new ResizeObserver(syncFontSize);
    observer.observe(anchor);
    return () => observer.disconnect();
  });
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
    style={{ fontSize }}
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
  reserveIcon,
}: {
  item: MenuItem;
  level: number;
  parents: string[];
  props: MenuLevelContext;
  reserveIcon: boolean;
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
      data-sia-interaction-cursor={props.interactionCursor}
      style={{ paddingInlineStart: props.mode === "inline" && !props.inlineCollapsed ? 12 + level * props.inlineIndent : undefined }}
      {...withTitleTooltip({ title: collapsed ? item.title ?? (typeof item.label === "string" ? item.label : undefined) : item.title })}
      disabled={item.disabled}
      aria-current={isSelected ? "page" : undefined}
      data-menu-key={item.key}
      data-applied={item.applied || undefined}
      aria-expanded={hasChildren ? isOpen : undefined}
      onClick={(event) => hasChildren ? props.toggle(item.key) : props.select(item, path, event)}
    >
      {reserveIcon ? <span className="sia-menu__icon" style={item.iconSize ? { width: item.iconSize, height: item.iconSize, flexBasis: item.iconSize } : undefined} aria-hidden={!item.icon || undefined}>{item.icon}</span> : null}
      {item.applied ? <span className="sia-menu__applied" role="img" aria-label={item.appliedLabel ?? "当前使用"}><Icon name="circle-check" variant="filled" size={32}/></span> : null}
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

function hasMenuIcon(items: readonly MenuItem[]): boolean {
  return items.some(item => item.type === "group" ? hasMenuIcon(item.children ?? []) : item.type !== "divider" && Boolean(item.icon));
}

function MenuLevel({
  items,
  level,
  parents,
  props,
  reserveIcon = hasMenuIcon(items),
}: {
  items: readonly MenuItem[];
  level: number;
  parents: string[];
  props: MenuLevelContext;
  reserveIcon?: boolean;
}) {
  return <>
    {items.map((item, index) => {
      if (item.type === "divider") return <li className="sia-menu__divider" key={item.key || `divider-${index}`} role="separator" />;
      if (item.type === "group") return <li className="sia-menu__group" key={item.key}>
        <div className="sia-menu__group-title">{item.label}</div>
        <ul role="group"><MenuLevel items={item.children ?? []} level={level + 1} parents={[...parents, item.key]} props={props} reserveIcon={reserveIcon} /></ul>
      </li>;
      return <MenuEntry key={item.key} item={item} level={level} parents={parents} props={props} reserveIcon={reserveIcon} />;
    })}
  </>;
}

/** 菜单组件。 */
export function Menu({
  items,
  mode = "vertical",
  gridColumns = 2,
  interactionCursor = "pointer",
  theme = "light",
  selectedKeys,
  autoScrollSelected = false,
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
  style,
  ...rest
}: MenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLUListElement>(null);
  const [selected, setSelected] = useControllableState<readonly string[]>({ value: selectedKeys, defaultValue: defaultSelectedKeys });
  const [open, setOpen] = useControllableState<readonly string[]>({ value: openKeys, defaultValue: defaultOpenKeys, onChange: (next) => onOpenChange?.([...next]) });
  const revealedKey = useRef<string>();
  const firstSelected = selected[0];

  // 选中状态与滚动位置分别维护；已定位的同一项目不会因宿主状态刷新而抢回滚动位置。
  useLayoutEffect(() => {
    if (!autoScrollSelected || firstSelected === undefined) { revealedKey.current = undefined; return; }
    const root = rootRef.current;
    if (!root || revealedKey.current === firstSelected || mode === "horizontal") return;
    const reveal = () => {
      if (revealedKey.current === firstSelected || root.clientHeight === 0) return;
      const target = Array.from(root.querySelectorAll<HTMLElement>(".sia-menu__item"))
        .find(element => element.dataset.menuKey === firstSelected && element.getBoundingClientRect().height > 0);
      if (!target) return;
      const bounds = root.getBoundingClientRect(), item = target.getBoundingClientRect();
      const top = bounds.top + root.clientTop, bottom = top + root.clientHeight;
      // 只滚动本菜单，避免 scrollIntoView 连带移动整个页面或右侧面板。
      if (item.top < top || item.bottom > bottom)
        root.scrollTop += item.top - top - Math.max(0, (root.clientHeight - item.height) / 2);
      revealedKey.current = firstSelected;
    };
    reveal();
    // 初始化布局或隐藏容器恢复时补做定位，成功后回调立即短路，不干扰手动浏览。
    const observer = new ResizeObserver(reveal);
    observer.observe(root);
    return () => observer.disconnect();
  }, [autoScrollSelected, firstSelected, items, mode]);

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
  // 列定义由框架统一传入根菜单及分组，业务无需覆写内部卡片样式。
  const gridStyle = mode === "grid" ? { "--sia-menu-grid-columns": gridColumns === "auto" ? "repeat(auto-fill, minmax(88px, 1fr))" : `repeat(${Number.isFinite(gridColumns) ? Math.max(1, Math.floor(Number(gridColumns))) : 2}, minmax(0, 1fr))` } : {};
  return <ul ref={rootRef} className={`sia-menu sia-menu--${mode} sia-menu--${theme}${inlineCollapsed ? " sia-menu--collapsed" : ""} ${className}`.trim()} role="menu" {...withTitleTooltip(rest)} style={{ ...gridStyle, ...style } as CSSProperties} data-sia-menu-owner={menuId}>
    <MenuLevel items={items} level={0} parents={[]} props={{ interactionCursor, menuId, mode, theme, multiple, selectable, inlineCollapsed, inlineIndent, triggerSubMenuAction, selected, open, select, toggle }} />
  </ul>;
}

/** Step的状态类型。 */
export type StepStatus = "wait" | "process" | "finish" | "error";
/** Step的项目定义。 */
export type StepItem = {
  /** 标题内容，可传入文本或 React 节点。 */
  title: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode;
  /** 主标题旁的次级标题。 */
  subTitle?: ReactNode;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 当前状态，用于选择对应的状态样式。 */
  status?: StepStatus;
  /** 是否禁用交互。 */
  disabled?: boolean };
/** 步骤条的属性配置。 */
export interface StepsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** 横向步骤条的标题位置：vertical 在图标下方，horizontal 在图标右侧；纵向和窄屏堆叠时保持原布局。默认 vertical。 */
  labelPlacement?: "horizontal" | "vertical";
  /** 按展示顺序排列的项目配置。 */
  items: readonly StepItem[];
  /**
   当前步骤索引，从 0 开始。
   * @defaultValue 0
   */
  current?: number;
  /**
   * 起始步骤的编号偏移。
   * @defaultValue 0
   */
  initial?: number;
  /**
   排列或展示方向。
   * @defaultValue "horizontal"
   */
  direction?: "horizontal" | "vertical";
  /**
   * 类型标识，用于选择对应的表现形式。
   * @defaultValue "default"
   */
  type?: "default" | "navigation" | "dot";
  /**
   * 组件尺寸；用于调整控件高度、字号和间距。
   * @defaultValue "default"
   */
  size?: "default" | "small";
  /**
   * 当前状态，用于选择对应的状态样式。
   * @defaultValue "process"
   */
  status?: "process" | "error";
  /**
   * 是否以点状指示步骤，可传入自定义渲染函数。
   * @defaultValue false
   */
  progressDot?: boolean | ((dot: ReactNode, info: {
  /** 项目在当前集合中的索引，从 0 开始。 */
  index: number;
  /**
   * 当前状态，用于选择对应的状态样式。
   * @defaultValue "process"
   */
  status: StepStatus;
  /** 标题内容，可传入文本或 React 节点。 */
  title: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode }) => ReactNode);
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (current: number) => void;
}

/** 步骤条组件。 */
export function Steps({ items, current = 0, initial = 0, direction = "horizontal", labelPlacement = "vertical", type = "default", size = "default", status = "process", progressDot = false, onChange, className = "", ...props }: StepsProps) {
  return <div className={`sia-steps sia-steps--${direction} sia-steps--${type} sia-steps--${size} sia-steps--label-${labelPlacement} ${className}`.trim()} {...withTitleTooltip(props)}>
    {items.map((item, rawIndex) => {
      const index = rawIndex + initial;
      const itemStatus: StepStatus = item.status ?? (index < current ? "finish" : index === current ? status : "wait");
      const dot = <span className="sia-steps__dot" />;
      const icon = progressDot ? (typeof progressDot === "function" ? progressDot(dot, { index, status: itemStatus, title: item.title, description: item.description }) : dot)
        : item.icon ?? (itemStatus === "finish" ? <Icon name="check" size={15} /> : itemStatus === "error" ? <Icon name="close" size={14} /> : index + 1);
      return <button type="button" className={`sia-steps__item sia-steps__item--${itemStatus}`} key={index} disabled={item.disabled || !onChange} onClick={() => onChange?.(index)}>
        <span className="sia-steps__head"><span className="sia-steps__icon">{icon}</span><span className="sia-steps__tail" /></span>
        <span className="sia-steps__content"><span className="sia-steps__title">{item.title}{item.subTitle ? <small>{item.subTitle}</small> : null}</span>{item.description ? <span className="sia-steps__description">{item.description}</span> : null}</span>
        {direction === "horizontal" && labelPlacement === "horizontal" ? <span className="sia-steps__tail sia-steps__inline-tail" /> : null}
      </button>;
    })}
  </div>;
}

/** 分段选择的值类型。 */
export type SegmentedValue = string | number;
/** 分段选择的候选项定义。 */
export type SegmentedOption = SegmentedValue | {
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: ReactNode;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: SegmentedValue;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 标题内容，可传入文本或 React 节点。 */
  title?: string };
/** 分段选择的属性配置。 */
export interface SegmentedProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /**
   * default 为圆角分段样式；zigzag 为横向闪电折线分隔样式，选中项主题色高亮并平滑放大至 1.04 倍（200ms）。
   * 仅支持两个横向选项；vertical=true 或选项数量不为 2 时回退为 default 样式。
   * @defaultValue "default"
   */
  variant?: "default" | "zigzag";
  /**
   * zigzag 变体的外形：capsule 胶囊、rectangle 直角矩形、rounded 主题圆角矩形。
   * default 变体不受此属性影响。
   * @defaultValue "capsule"
   */
  shape?: "capsule" | "rectangle" | "rounded";
  /** 可供用户选择的候选项列表。 */
  options: readonly SegmentedOption[];
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: SegmentedValue;
  /** 非受控模式的初始值，仅在初始化时使用。 */
  defaultValue?: SegmentedValue;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: "small" | "medium" | "large";
  /**
   * 宽度撑满父容器
   * @defaultValue false
   */
  block?: boolean;
  /**
   * 是否使用垂直布局。
   * @defaultValue false
   */
  vertical?: boolean;
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (value: SegmentedValue) => void;
}

/** 分段选择组件。 */
export function Segmented({ options, value, defaultValue, variant = "default", shape = "capsule", size: sizeProp, block = false, vertical = false, disabled = false, onChange, className = "", onKeyDown, ...props }: SegmentedProps) {
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
  return <div className={`sia-segmented sia-segmented--${size}${variant === "zigzag" && !vertical && normalized.length === 2 ? ` sia-segmented--zigzag sia-segmented--shape-${shape}` : ""}${block ? " sia-segmented--block" : ""}${vertical ? " sia-segmented--vertical" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()} role="radiogroup" onKeyDown={keyboard} {...withTitleTooltip(props)}>
    {normalized.map((option) => <button type="button" role="radio" aria-checked={option.value === current} {...withTitleTooltip({ title: option.title })} className={option.value === current ? "is-selected" : ""} disabled={disabled || option.disabled} key={option.value} onClick={() => setCurrent(option.value)}>
      {option.icon}<span>{option.label ?? option.value}</span>
    </button>)}
  </div>;
}

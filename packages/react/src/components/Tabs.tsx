import { withTitleTooltip } from "./titleTooltip";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import { Icon } from "./Icon";
import type { MenuClickInfo, MenuItem } from "./Navigation";
import type { ControlSize } from "./shared";

/** Tab的项目定义。 */
export interface TabItem {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: string;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 是否显示关闭入口。 */
  closable?: boolean;
}

/** 选项卡的类型标识。 */
export type TabsType = "line" | "card" | "pill" | "capsule" | "underline" | "tech" | "tech-line";
/** 选项卡沿水平方向或垂直方向排列。 */
export type TabsOrientation = "horizontal" | "vertical";
/** 选项卡导航相对于内容区的位置。 */
export type TabsPosition = "top" | "right" | "bottom" | "left";
/** TabsContextMenu的点击事件上下文。 */
export type TabsContextMenuClickInfo = MenuClickInfo & {
  /** 关联选项卡的唯一标识。 */
  tabKey: string;
  /** 当前选项卡配置。 */
  tab: TabItem;
};

/** 选项卡的属性配置。 */
export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** 标签项，包含 key、label、children、icon、disabled 和 closable */
  items: readonly TabItem[];
  /** 当前激活项目的标识；传入后由外部控制。 */
  activeKey?: string;
  /** 非受控模式下初始激活的项目标识。 */
  defaultActiveKey?: string;
  /** 用户切换标签时立即调用，参数为目标 key；受控模式需同步更新 activeKey。重内容或路由切换可放在 onAfterChange 中，避免阻塞选中框动画。 */
  onChange?: (key: string) => void;
  /** 选中框动画结束且目标面板获准显示时调用，参数为最终目标 key；首次渲染不调用，连续切换仅通知最终目标。无动画或系统减少动态效果时在下一帧完成，不等待面板数据请求；也适用于业务在 Tabs 外渲染内容或切换路由。 */
  onAfterChange?: (key: string) => void;
  /** 是否等选中框动画结束后再切换 items[].children，等待期间保留旧面板。默认 false，立即切换；true 时配合 destroyInactiveTabPane=false 仅在首次激活后挂载并保留面板。不能延迟父组件已执行的同步计算或 onChange 中的渲染，请将外部重内容更新放到 onAfterChange。 */
  deferContent?: boolean;
  /**
   * 线型、卡片型、胶囊型、圆角胶囊、紧凑下划线或科技样式；tech-line 使用固定倾角的圆角斜切选中框，长标题仅扩展中段宽度；位移与尺寸在 300ms 内同步过渡，系统减少动态效果时直接切换。
   * @defaultValue "line"
   */
  type?: TabsType;
  /**
   * 组件尺寸；用于调整控件高度、字号和间距。
   * @defaultValue "medium"
   */
  size?: ControlSize;
  /** 标签栏位于内容的上、右、下或左侧 */
  tabPosition?: TabsPosition;
  /**
   组件的水平或垂直排列方向。
   * @defaultValue "horizontal"
   */
  orientation?: TabsOrientation;
  /**
   * 弹框是否垂直居中。
   * @defaultValue false
   */
  centered?: boolean;
  /** 标签栏左侧标题，科技大屏型会附带装饰线；折线科技型横向布局按标题内容及装饰留白确定宽度，窄屏时标题独占一行。 */
  tabBarTitle?: ReactNode;
  /** 标签栏与内容面板之间的间距，单位 px，支持 0；未指定时上下布局为 16px，左右布局为 20px。仅影响当前 Tabs，不传递给嵌套实例。 */
  contentGap?: number;
  /** 标签栏右侧额外操作 */
  tabBarExtraContent?: ReactNode;
  /**
   * 是否卸载非激活面板
   * @defaultValue true
   */
  destroyInactiveTabPane?: boolean;
  /**
   * 是否显示关闭入口。
   * @defaultValue false
   */
  closable?: boolean;
  /** 新增、删除或修改项目时调用。 */
  onEdit?: (key: string, action: "remove") => void;
  /** 选项卡右键菜单配置。 */
  tabContextMenu?: readonly MenuItem[] | ((tab: TabItem) => readonly MenuItem[]);
  /** 点击选项卡右键菜单时调用。 */
  onTabContextMenuClick?: (info: TabsContextMenuClickInfo) => void;
}

/** 选项卡组件。 */
export function Tabs({
  items,
  activeKey,
  defaultActiveKey,
  onChange,
  onAfterChange,
  deferContent = false,
  type = "line",
  size = "medium",
  tabPosition,
  orientation = "horizontal",
  centered = false,
  tabBarTitle,
  tabBarExtraContent,
  contentGap,
  destroyInactiveTabPane = true,
  closable = false,
  onEdit,
  tabContextMenu,
  onTabContextMenuClick,
  className = "",
  ...props
}: TabsProps) {
  const firstEnabledKey = items.find((item) => !item.disabled)?.key ?? "";
  const [internalActiveKey, setInternalActiveKey] = useState(defaultActiveKey ?? firstEnabledKey);
  const currentKey = activeKey ?? internalActiveKey;
  const selectedKey = items.some((item) => item.key === currentKey && !item.disabled) ? currentKey : firstEnabledKey;
  const baseId = useId().replace(/:/g, "");
  const enabledItems = useMemo(() => items.filter((item) => !item.disabled), [items]);
  const resolvedPosition = tabPosition ?? (orientation === "vertical" ? "left" : "top");
  const resolvedOrientation: TabsOrientation = resolvedPosition === "left" || resolvedPosition === "right" ? "vertical" : "horizontal";

  const sliding = ["capsule", "line", "underline", "tech", "tech-line"].includes(type);
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const [contentState, setContentState] = useState(() => ({ key: selectedKey, visited: new Set([selectedKey]) }));
  const settledKeyRef = useRef(selectedKey);
  const afterChangeRef = useRef(onAfterChange);
  useLayoutEffect(() => { afterChangeRef.current = onAfterChange; }, [onAfterChange]);

  useLayoutEffect(() => {
    if (!sliding) return;
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;
    function updateIndicator() {
      if (!list || !indicator) return;
      const active = list.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
      if (!active) { indicator.style.visibility = "hidden"; return; }
      const listRect = list.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      indicator.style.transform = `translate(${rect.left - listRect.left - list.clientLeft + list.scrollLeft}px, ${rect.top - listRect.top - list.clientTop + list.scrollTop}px)`;
      indicator.style.width = `${rect.width}px`;
      indicator.style.height = `${rect.height}px`;
      indicator.style.visibility = "visible";
      if (!indicator.dataset.ready) {
        // 首次直接定位，后续选中项变化才播放滑动动画。
        indicator.getBoundingClientRect();
        indicator.dataset.ready = "true";
      }
    }
    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(list);
    list.querySelectorAll('[role="tab"]').forEach(tab => observer.observe(tab));
    return () => observer.disconnect();
  }, [sliding, type, selectedKey, items, size, resolvedPosition, centered, closable]);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    // 读取浏览器的真实过渡，兼容自定义时长、减少动态效果和动画被取消；不硬编码延迟。
    // 等一帧让新选中框样式生效，再等待全部位移/尺寸过渡，连续点击时废弃旧任务。
    frame = requestAnimationFrame(() => {
      const indicator = indicatorRef.current;
      if (indicator) getComputedStyle(indicator).transform;
      const animations = indicator?.getAnimations() ?? [];
      const complete = () => {
        if (cancelled) return;
        setContentState(previous => ({ key: selectedKey, visited: new Set([...previous.visited].filter(key => items.some(item => item.key === key))).add(selectedKey) }));
        if (settledKeyRef.current !== selectedKey) {
          settledKeyRef.current = selectedKey;
          afterChangeRef.current?.(selectedKey);
        }
      };
      if (!animations.length) complete();
      else Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        if (!cancelled) frame = requestAnimationFrame(complete);
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [selectedKey, type, deferContent]);

  const contentKey = deferContent ? contentState.key : selectedKey;

  function selectTab(key: string) {
    if (key === selectedKey) return;
    if (activeKey === undefined) setInternalActiveKey(key);
    onChange?.(key);
  }

  function focusAndSelect(key: string) {
    selectTab(key);
    document.getElementById(`${baseId}-tab-${key}`)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: string) {
    const previousKey = resolvedOrientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const nextKey = resolvedOrientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    if (![previousKey, nextKey, "Home", "End"].includes(event.key) || enabledItems.length === 0) return;
    event.preventDefault();
    const currentIndex = Math.max(0, enabledItems.findIndex((item) => item.key === key));
    if (event.key === "Home") return focusAndSelect(enabledItems[0].key);
    if (event.key === "End") return focusAndSelect(enabledItems[enabledItems.length - 1].key);
    const offset = event.key === nextKey ? 1 : -1;
    const nextIndex = (currentIndex + offset + enabledItems.length) % enabledItems.length;
    focusAndSelect(enabledItems[nextIndex].key);
  }

  const hasPanels = items.some((item) => item.children !== undefined);

  return (
    <div
      className={`sia-tabs sia-tabs--${type}${type === "underline" ? " sia-tabs--line" : ""} sia-tabs--${size} sia-tabs--${resolvedOrientation} sia-tabs--${resolvedPosition}${centered ? " sia-tabs--centered" : ""} ${className}`.trim()}
      {...withTitleTooltip(props)}
    >
      <div className="sia-tabs__header">
        {tabBarTitle ? <div className="sia-tabs__title">{tabBarTitle}{type === "tech-line" ? (
          <svg className="sia-tabs__title-connector" viewBox="0 0 32 40" aria-hidden="true">
            {/* 端点对齐两条 1.5px 横线的中心，而非上边缘，避免接点出现半像素尖刺。 */}
            <path d="M0 39.25 H5 Q8 39.25 10 35.25 L28 3.75 Q29 1.75 32 1.75" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ) : null}</div> : null}
        <div ref={listRef} className={`sia-tabs__list${sliding ? " sia-tabs__list--sliding" : ""}`} role="tablist" aria-orientation={resolvedOrientation}>
          {sliding ? <span key={type} ref={indicatorRef} className={`sia-tabs__indicator${type === "capsule" ? " sia-tabs__capsule-indicator" : ""}`} aria-hidden="true">
            {type === "tech-line" ? (                    <span className="sia-tabs__indicator-shape" aria-hidden="true" />) : null}
          </span> : null}
          {items.map((item) => {
            const selected = item.key === selectedKey;
            const canClose = item.closable ?? closable;
            const tabNode = (
              <span className={`sia-tabs__tab-wrap${canClose ? " is-closable" : ""}`} key={item.key}>
                <button
                  id={`${baseId}-tab-${item.key}`}
                  type="button"
                  className="sia-tabs__tab"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={hasPanels ? `${baseId}-panel-${item.key}` : undefined}
                  tabIndex={selected ? 0 : -1}
                  disabled={item.disabled}
                  onClick={() => selectTab(item.key)}
                  onKeyDown={(event) => handleKeyDown(event, item.key)}
                >
                  {type === "tech-line" ? (
                    <span className="sia-tabs__tab-shape" aria-hidden="true" />
                  ) : null}
                  {item.icon ? <span className="sia-tabs__icon">{item.icon}</span> : null}
                  <span>{item.label}</span>
                </button>
                {canClose ? (
                  <button
                    type="button"
                    className="sia-tabs__close"
                    aria-label={`关闭${typeof item.label === "string" ? item.label : "标签页"}`}
                    disabled={item.disabled}
                    onClick={() => onEdit?.(item.key, "remove")}
                  >
                    <Icon name="close" size={12} />
                  </button>
                ) : null}
              </span>
            );
            const contextMenuItems = typeof tabContextMenu === "function"
              ? tabContextMenu(item)
              : tabContextMenu;
            if (!contextMenuItems?.length) return tabNode;
            return (
              <Dropdown
                key={item.key}
                className="sia-tabs__tab-context-trigger"
                popupClassName="sia-tabs__tab-context-menu"
                trigger={["contextMenu"]}
                tabIndex={-1}
                menu={{
                  items: contextMenuItems,
                  selectable: false,
                  onClick: (info) => onTabContextMenuClick?.({ ...info, tabKey: item.key, tab: item }),
                }}
              >
                {tabNode}
              </Dropdown>
            );
          })}
        </div>
        {tabBarExtraContent ? <div className="sia-tabs__extra">{tabBarExtraContent}</div> : null}
      </div>
      {hasPanels ? (
        <div className="sia-tabs__panels" style={contentGap === undefined ? undefined : {
          // 仅设置面板靠近导航的一侧，保留各方向布局原有的其余边界。
          [resolvedPosition === "top" ? "paddingTop" : resolvedPosition === "bottom" ? "paddingBottom" : resolvedPosition === "left" ? "paddingLeft" : "paddingRight"]: contentGap,
        }} aria-busy={deferContent && contentKey !== selectedKey || undefined}>
          {items.map((item) => {
            const selected = item.key === contentKey;
            if (destroyInactiveTabPane && !selected) return null;
            // 延迟模式下未访问的面板不预挂载，避免隐藏表格抢占切换动画的主线程。
            if (deferContent && !selected && !contentState.visited.has(item.key)) return null;
            return (
              <div
                key={item.key}
                id={`${baseId}-panel-${item.key}`}
                className="sia-tabs__panel"
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-${item.key}`}
                hidden={!selected}
                tabIndex={0}
              >
                {item.children}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

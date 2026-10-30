import { withTitleTooltip } from "./titleTooltip";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";

/** 工具面板的位置类型。 */
export type ToolPanelPlacement = "left" | "right";

/** 工具面板的项目定义。 */
export interface ToolPanelItem {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: string;
  /** 标题内容，可传入文本或 React 节点。 */
  title: ReactNode;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children: ReactNode;
  /** 是否禁用交互。 */
  disabled?: boolean;
}

/** 工具面板的属性配置。 */
export interface ToolPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "onResize"> {
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 多面板配置；提供后优先于 title、icon 和 children。切换保留内容状态，共享面板宽度 */
  items?: readonly ToolPanelItem[];
  /** 当前激活项目的标识；传入后由外部控制。 */
  activeKey?: string;
  /** 非受控模式下初始激活的项目标识。 */
  defaultActiveKey?: string;
  /** 切换面板时触发；再次点击当前入口仅切换展开状态 */
  onActiveKeyChange?: (key: string) => void;
  /**
   * 工具面板位于工作区左侧或右侧
   * @defaultValue "left"
   */
  placement?: ToolPanelPlacement;
  /** 是否打开；传入后由外部控制显示状态。 */
  open?: boolean;
  /**
   * 非受控模式下的初始打开状态。
   * @defaultValue true
   */
  defaultOpen?: boolean;
  /**
   非受控模式下的初始尺寸。
   * @defaultValue 320
   */
  defaultSize?: number;
  /**
   * 允许的最小尺寸。
   * @defaultValue 220
   */
  minSize?: number;
  /**
   * 允许的最大尺寸。
   * @defaultValue 640
   */
  maxSize?: number;
  /** 活动栏切换展开状态时触发 */
  onOpenChange?: (open: boolean) => void;
  /** 拖拽调整过程中持续触发 */
  onResize?: (size: number) => void;
  /** 鼠标或键盘调整结束时触发 */
  onResizeEnd?: (size: number) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 可折叠、可调整宽度的工具面板；活动栏仅纵向滚动，收起后保留入口和已挂载内容状态。 */
export function ToolPanel({
  title,
  icon,
  items,
  activeKey,
  defaultActiveKey,
  onActiveKeyChange,
  placement = "left",
  open,
  defaultOpen = true,
  defaultSize = 320,
  minSize = 220,
  maxSize = 640,
  onOpenChange,
  onResize,
  onResizeEnd,
  className = "",
  style,
  children,
  ...props
}: ToolPanelProps) {
  const panelId = useId();
  const [internalActiveKey, setInternalActiveKey] = useState(defaultActiveKey);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [size, setSize] = useState(() => clamp(defaultSize, minSize, maxSize));
  const panels: readonly ToolPanelItem[] = items ?? [{ key: "single", title, icon, children }];
  const requestedKey = activeKey ?? internalActiveKey;
  const activePanel = panels.find(item => item.key === requestedKey && !item.disabled) ?? panels.find(item => !item.disabled);
  const isOpen = (open ?? internalOpen) && Boolean(activePanel);

  const railRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const rail = railRef.current;
    const indicator = indicatorRef.current;
    if (!rail || !indicator) return;
    function updateIndicator() {
      if (!rail || !indicator) return;
      const active = rail.querySelector<HTMLButtonElement>('.sia-tool-panel__activity.is-active');
      if (!active) {
        // 清除上一次激活位置，避免不可见指示器撑开已收起的活动栏。
        indicator.style.visibility = "hidden";
        indicator.style.transform = "none";
        delete indicator.dataset.ready;
        return;
      }
      const railRect = rail.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      const x = rect.left - railRect.left - rail.clientLeft + rail.scrollLeft + (placement === "left" ? rect.width - 3 : 0);
      const y = rect.top - railRect.top - rail.clientTop + rail.scrollTop;
      indicator.style.transform = `translate(${x}px, ${y}px)`;
      indicator.style.height = `${rect.height}px`;
      indicator.style.visibility = "visible";
      if (!indicator.dataset.ready) {
        indicator.getBoundingClientRect();
        indicator.dataset.ready = "true";
      }
    }
    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(rail);
    rail.querySelectorAll('.sia-tool-panel__activity').forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [isOpen, activePanel?.key, items, title, icon, placement]);

  function activatePanel(item: ToolPanelItem) {
    if (item.disabled) return;
    if (item.key === activePanel?.key) {
      setOpen(!isOpen);
    } else {
      if (activeKey === undefined) setInternalActiveKey(item.key);
      onActiveKeyChange?.(item.key);
      if (!isOpen) setOpen(true);
    }
  }

  function setOpen(nextOpen: boolean) {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function resize(nextSize: number, complete = false) {
    const clampedSize = clamp(nextSize, minSize, maxSize);
    setSize(clampedSize);
    onResize?.(clampedSize);
    if (complete) onResizeEnd?.(clampedSize);
  }

  function startResize(event: MouseEvent<HTMLDivElement>) {
    if (!isOpen) return;
    event.preventDefault();
    const startX = event.clientX;
    const startSize = size;
    const move = (moveEvent: globalThis.MouseEvent) => {
      const delta = placement === "left" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      resize(startSize + delta);
    };
    const up = (upEvent: globalThis.MouseEvent) => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const delta = placement === "left" ? upEvent.clientX - startX : startX - upEvent.clientX;
      resize(startSize + delta, true);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!isOpen || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    resize(size + (placement === "left" ? direction : -direction) * 12, true);
  }

  const titleText = typeof activePanel?.title === "string" ? activePanel.title : "工具";
  const rail = (
    <div ref={railRef} className="sia-tool-panel__rail">
      <span ref={indicatorRef} className="sia-tool-panel__indicator" aria-hidden="true" />
      {panels.map((item, index) => {
        const expanded = isOpen && item.key === activePanel?.key;
        const label = typeof item.title === "string" ? item.title : "工具";
        return (
          <button
            key={item.key}
            id={`${panelId}-activity-${index}`}
            type="button"
            className={`sia-tool-panel__activity${expanded ? " is-active" : ""}`}
            aria-expanded={expanded}
            aria-controls={`${panelId}-content-${index}`}
            aria-label={`${expanded ? "收起" : "展开"}${label}面板`}
            {...withTitleTooltip({ title: typeof item.title === "string" ? item.title : undefined })}
            disabled={item.disabled}
            onClick={() => activatePanel(item)}
          >
            {item.icon ? <span className="sia-tool-panel__activity-icon">{item.icon}</span> : null}
            <span className="sia-tool-panel__activity-label">{item.title}</span>
          </button>
        );
      })}
    </div>
  );
  const content = (
    <div className="sia-tool-panel__content" hidden={!isOpen} aria-hidden={!isOpen}>
      {panels.map((item, index) => <div
        key={item.key}
        id={`${panelId}-content-${index}`}
        className="sia-tool-panel__pane"
        role="region"
        aria-labelledby={`${panelId}-activity-${index}`}
        hidden={!isOpen || item.key !== activePanel?.key}
      >{item.children}</div>)}
    </div>
  );
  const resizeHandle = (
    <div
      className="sia-tool-panel__resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
      aria-valuenow={Math.round(size)}
      aria-label={`调整${titleText}面板宽度`}
      tabIndex={isOpen ? 0 : -1}
      hidden={!isOpen}
      onMouseDown={startResize}
      onKeyDown={resizeWithKeyboard}
    />
  );
  const panelStyle = {
    ...style,
    "--sia-tool-panel-size": `${size}px`,
  } as CSSProperties;

  return (
    <div
      className={`sia-tool-panel sia-tool-panel--${placement}${isOpen ? " is-open" : ""} ${className}`.trim()}
      style={panelStyle}
      data-placement={placement}
      {...withTitleTooltip(props)}
    >
      {placement === "left" ? <>{rail}{content}{resizeHandle}</> : <>{resizeHandle}{content}{rail}</>}
    </div>
  );
}

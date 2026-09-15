import { useId, useLayoutEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";

export type ToolPanelPlacement = "left" | "right";

export interface ToolPanelItem {
  key: string;
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

export interface ToolPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "onResize"> {
  title?: ReactNode;
  icon?: ReactNode;
  items?: readonly ToolPanelItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onActiveKeyChange?: (key: string) => void;
  placement?: ToolPanelPlacement;
  open?: boolean;
  defaultOpen?: boolean;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  onOpenChange?: (open: boolean) => void;
  onResize?: (size: number) => void;
  onResizeEnd?: (size: number) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
        indicator.style.visibility = "hidden";
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
            title={typeof item.title === "string" ? item.title : undefined}
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
      {...props}
    >
      {placement === "left" ? <>{rail}{content}{resizeHandle}</> : <>{resizeHandle}{content}{rail}</>}
    </div>
  );
}

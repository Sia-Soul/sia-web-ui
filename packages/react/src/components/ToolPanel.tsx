import { useState } from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";

export type ToolPanelPlacement = "left" | "right";

export interface ToolPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "onResize"> {
  title: ReactNode;
  icon?: ReactNode;
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
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [size, setSize] = useState(() => clamp(defaultSize, minSize, maxSize));
  const isOpen = open ?? internalOpen;

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

  const titleText = typeof title === "string" ? title : "工具";
  const rail = (
    <div className="sia-tool-panel__rail">
      <button
        type="button"
        className={`sia-tool-panel__activity${isOpen ? " is-active" : ""}`}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? "收起" : "展开"}${titleText}面板`}
        title={typeof title === "string" ? title : undefined}
        onClick={() => setOpen(!isOpen)}
      >
        {icon ? <span className="sia-tool-panel__activity-icon">{icon}</span> : null}
        <span className="sia-tool-panel__activity-label">{title}</span>
      </button>
    </div>
  );
  const content = (
    <div className="sia-tool-panel__content" hidden={!isOpen} aria-hidden={!isOpen}>
      {children}
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

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Icon } from "./Icon";
import { OverlayPortal, useOverlayLifecycle } from "./Overlay";
import type { OverlayApiHandle } from "./Modal";
import type { OverlayContainer } from "./Overlay";

export type DrawerPlacement = "left" | "right" | "top" | "bottom";

export interface DrawerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  title?: ReactNode;
  children?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  placement?: DrawerPlacement;
  size?: number | string;
  closable?: boolean;
  maskClosable?: boolean;
  keyboard?: boolean;
  zIndex?: number;
  getContainer?: OverlayContainer;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export interface DrawerOpenConfig extends Omit<DrawerProps, "open"> {}

const drawerHandles = new Set<OverlayApiHandle<DrawerOpenConfig>>();
const DRAWER_MOTION_DURATION = 220;

const DrawerRoot = forwardRef<HTMLDivElement, DrawerProps>(function Drawer(
  {
    open,
    title,
    children,
    extra,
    footer,
    placement = "right",
    size = placement === "top" || placement === "bottom" ? 320 : 420,
    closable = true,
    maskClosable = true,
    keyboard = true,
    zIndex = 1000,
    getContainer,
    onClose,
    onOpenChange,
    className = "",
    style,
    ...props
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return undefined;
    }
    if (!rendered) return undefined;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, DRAWER_MOTION_DURATION);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  function setRef(node: HTMLDivElement | null) {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function requestClose() {
    onClose?.();
    onOpenChange?.(false);
  }

  useOverlayLifecycle(rendered, localRef, requestClose, keyboard);
  if (!rendered) return null;

  const mergedStyle = {
    ...style,
    "--sia-drawer-size": typeof size === "number" ? `${size}px` : size,
  } as CSSProperties;

  return <OverlayPortal container={getContainer}>
    <div className="sia-drawer-root" data-state={closing ? "closing" : "open"} style={{ zIndex }}>
      <button className="sia-drawer__mask" type="button" aria-label="关闭抽屉" onClick={() => maskClosable && requestClose()} />
      <div
        ref={setRef}
        className={`sia-drawer sia-drawer--${placement} ${className}`.trim()}
        style={mergedStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        {...props}
      >
        <div className="sia-drawer__header">
          <div className="sia-drawer__heading">
            {closable ? <button type="button" className="sia-drawer__close" aria-label="关闭抽屉" onClick={requestClose}><Icon name="close" size={17} /></button> : null}
            {title ? <strong id={titleId}>{title}</strong> : null}
          </div>
          {extra ? <div className="sia-drawer__extra">{extra}</div> : null}
        </div>
        <div className="sia-drawer__body">{children}</div>
        {footer ? <div className="sia-drawer__footer">{footer}</div> : null}
      </div>
    </div>
  </OverlayPortal>;
});

function openDrawer(config: DrawerOpenConfig): OverlayApiHandle<DrawerOpenConfig> {
  if (typeof document === "undefined") return { destroy() {}, update() {} };
  const container = document.createElement("div");
  container.className = "sia-drawer-api-host";
  document.body.appendChild(container);
  const root = createRoot(container);
  let currentConfig = config;
  let currentOpen = true;
  let destroyed = false;
  let cleanupTimer: number | undefined;

  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
    root.unmount();
    container.remove();
    drawerHandles.delete(handle);
  }

  function closeWithMotion() {
    if (destroyed || !currentOpen) return;
    currentOpen = false;
    render();
    cleanupTimer = window.setTimeout(cleanup, DRAWER_MOTION_DURATION);
  }

  function render() {
    root.render(<DrawerRoot {...currentConfig} open={currentOpen} onOpenChange={(nextOpen) => {
      currentConfig.onOpenChange?.(nextOpen);
      if (!nextOpen) closeWithMotion();
    }} />);
  }

  const handle: OverlayApiHandle<DrawerOpenConfig> = {
    destroy: closeWithMotion,
    update(next) {
      if (destroyed) return;
      currentConfig = { ...currentConfig, ...next };
      render();
    },
  };
  drawerHandles.add(handle);
  render();
  return handle;
}

export const Drawer = Object.assign(DrawerRoot, {
  open: openDrawer,
  destroyAll() {
    [...drawerHandles].forEach((handle) => handle.destroy());
  },
});

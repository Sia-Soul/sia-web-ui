import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "./Button";
import type { ButtonProps } from "./Button";
import { Icon } from "./Icon";
import { OverlayPortal, useOverlayLifecycle } from "./Overlay";
import type { OverlayContainer } from "./Overlay";

export type ModalType = "default" | "info" | "success" | "warning" | "error" | "confirm";
export type ModalActionResult = void | boolean | Promise<void | boolean>;

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "onSubmit"> {
  open: boolean;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode | null;
  type?: ModalType;
  okText?: ReactNode;
  cancelText?: ReactNode;
  showCancel?: boolean;
  confirmLoading?: boolean;
  okButtonProps?: ButtonProps;
  cancelButtonProps?: ButtonProps;
  closable?: boolean;
  maskClosable?: boolean;
  keyboard?: boolean;
  centered?: boolean;
  width?: number | string;
  zIndex?: number;
  getContainer?: OverlayContainer;
  onOk?: () => ModalActionResult;
  onCancel?: () => void;
  onOpenChange?: (open: boolean) => void;
  /** 动画完成后触发，适用于聚焦内容和释放外部挂载点。 */
  afterOpenChange?: (open: boolean) => void;
}

export interface ModalOpenConfig extends Omit<ModalProps, "open"> {}

export interface OverlayApiHandle<T> {
  destroy: () => void;
  update: (next: Partial<T>) => void;
}

const modalHandles = new Set<OverlayApiHandle<ModalOpenConfig>>();
const MODAL_MOTION_DURATION = 220;

const typeIcons: Partial<Record<ModalType, ReactNode>> = {
  info: <Icon name="info" size={23} />,
  success: <Icon name="circle-check" size={23} />,
  warning: <Icon name="warning" size={23} />,
  error: <Icon name="circle-close" size={23} />,
  confirm: <Icon name="question" size={23} />,
};

const ModalRoot = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  {
    open,
    title,
    children,
    footer,
    type = "default",
    okText = "确定",
    cancelText = "取消",
    showCancel = type === "default" || type === "confirm",
    confirmLoading = false,
    okButtonProps,
    cancelButtonProps,
    closable = true,
    maskClosable = true,
    keyboard = true,
    centered = false,
    width = 520,
    zIndex = 1000,
    getContainer,
    onOk,
    onCancel,
    onOpenChange,
    afterOpenChange,
    className = "",
    style,
    ...props
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const afterOpenChangeRef = useRef(afterOpenChange);
  afterOpenChangeRef.current = afterOpenChange;
  const submitLock = useRef(false);

  useEffect(() => {
    if (!open || !rendered) return undefined;
    const timer = window.setTimeout(() => afterOpenChangeRef.current?.(true), MODAL_MOTION_DURATION);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

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
      afterOpenChangeRef.current?.(false);
    }, MODAL_MOTION_DURATION);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  function setRef(node: HTMLDivElement | null) {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function requestClose() {
    if (submitting || confirmLoading) return;
    onCancel?.();
    onOpenChange?.(false);
  }

  async function handleOk() {
    if (submitLock.current || confirmLoading) return;
    submitLock.current = true;
    if (!onOk) {
      onOpenChange?.(false);
      submitLock.current = false;
      return;
    }
    try {
      const result = onOk();
      if (result instanceof Promise) {
        setSubmitting(true);
        const resolved = await result;
        if (resolved !== false) onOpenChange?.(false);
      } else if (result !== false) {
        onOpenChange?.(false);
      }
    } catch {
      return;
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  useOverlayLifecycle(rendered, localRef, requestClose, keyboard);
  if (!rendered) return null;

  const mergedStyle = {
    ...style,
    "--sia-modal-width": typeof width === "number" ? `${width}px` : width,
  } as CSSProperties;
  const loading = submitting || confirmLoading;
  const defaultFooter = <>
    {showCancel ? <Button {...cancelButtonProps} onClick={requestClose} disabled={loading || cancelButtonProps?.disabled}>{cancelText}</Button> : null}
    <Button variant="primary" {...okButtonProps} onClick={handleOk} loading={loading}>{okText}</Button>
  </>;

  return <OverlayPortal container={getContainer}>
    <div
      className={`sia-modal-root${centered ? " sia-modal-root--centered" : ""}`}
      data-state={closing ? "closing" : "open"}
      style={{ zIndex }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && maskClosable) requestClose();
      }}
    >
      <div
        ref={setRef}
        className={`sia-modal sia-modal--${type} ${className}`.trim()}
        style={mergedStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        {...props}
      >
        <div className="sia-modal__header">
          <div className="sia-modal__heading">
            {typeIcons[type] ? <span className="sia-modal__type-icon" aria-hidden="true">{typeIcons[type]}</span> : null}
            {title ? <strong id={titleId}>{title}</strong> : null}
          </div>
          {closable ? <button type="button" className="sia-modal__close" aria-label="关闭对话框" onClick={requestClose}><Icon name="close" size={17} /></button> : null}
        </div>
        {children !== undefined ? <div className="sia-modal__body">{children}</div> : null}
        {footer !== null ? <div className="sia-modal__footer">{footer ?? defaultFooter}</div> : null}
      </div>
    </div>
  </OverlayPortal>;
});

function openModal(config: ModalOpenConfig): OverlayApiHandle<ModalOpenConfig> {
  if (typeof document === "undefined") return { destroy() {}, update() {} };
  const container = document.createElement("div");
  container.className = "sia-modal-api-host";
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
    modalHandles.delete(handle);
  }

  function closeWithMotion() {
    if (destroyed || !currentOpen) return;
    currentOpen = false;
    render();
    cleanupTimer = window.setTimeout(cleanup, MODAL_MOTION_DURATION);
  }

  function render() {
    root.render(<ModalRoot {...currentConfig} open={currentOpen} onOpenChange={(nextOpen) => {
      currentConfig.onOpenChange?.(nextOpen);
      if (!nextOpen) closeWithMotion();
    }} />);
  }

  const handle: OverlayApiHandle<ModalOpenConfig> = {
    destroy: closeWithMotion,
    update(next) {
      if (destroyed) return;
      currentConfig = { ...currentConfig, ...next };
      render();
    },
  };
  modalHandles.add(handle);
  render();
  return handle;
}

function preset(type: Exclude<ModalType, "default">, defaults: Partial<ModalOpenConfig> = {}) {
  return (config: ModalOpenConfig) => openModal({
    okText: type === "confirm" ? "确定" : "知道了",
    showCancel: type === "confirm",
    closable: type !== "confirm",
    maskClosable: type !== "confirm",
    ...defaults,
    ...config,
    type,
  });
}

export const Modal = Object.assign(ModalRoot, {
  open: openModal,
  info: preset("info", { title: "提示" }),
  success: preset("success", { title: "操作成功" }),
  warning: preset("warning", { title: "请注意" }),
  error: preset("error", { title: "操作失败" }),
  confirm: preset("confirm", { title: "确认操作" }),
  destroyAll() {
    [...modalHandles].forEach((handle) => handle.destroy());
  },
});

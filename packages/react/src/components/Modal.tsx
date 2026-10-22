import { withTitleTooltip } from "./titleTooltip";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "./Button";
import type { ButtonProps } from "./Button";
import { Icon } from "./Icon";
import { OverlayPortal, useOverlayLifecycle } from "./Overlay";
import type { OverlayContainer } from "./Overlay";

/** 模态框的类型标识。 */
export type ModalType = "default" | "info" | "success" | "warning" | "error" | "confirm";
/** 确认操作的返回值；false 阻止关闭，Promise 可用于等待异步操作。 */
export type ModalActionResult = void | boolean | Promise<void | boolean>;

/** 模态框的属性配置。 */
export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "onSubmit"> {
  /** 是否显示对话框 */
  open: boolean;
  /**
   * 打开时自动聚焦正文中首个可用输入组件，跳过隐藏、禁用和只读字段；尊重内容自身已设置的焦点。
   * 无可用输入组件或设置为 false 时，使用默认首个可聚焦元素。仅在打开时执行，不等待异步加载的字段；异步内容可在加载完成后自行聚焦。
   * @defaultValue true
   */
  autoFocus?: boolean;
  /** 标题 */
  title?: ReactNode;
  /** 弹框正文内容，默认字号为 13px；子元素可通过自身字号样式覆盖。 */
  children?: ReactNode;
  /** 自定义底部操作区，传 null 隐藏 */
  footer?: ReactNode | null;
  /** 默认底部操作区左侧的扩展内容。 */
  footerExtra?: ReactNode;
  /**
   * 类型标识，用于选择对应的表现形式。
   * @defaultValue "default"
   */
  type?: ModalType;
  /**
   * 确定按钮文案。
   * @defaultValue "确定"
   */
  okText?: ReactNode;
  /**
   * 取消按钮文案。
   * @defaultValue "取消"
   */
  cancelText?: ReactNode;
  /**
   * 是否显示取消按钮。
   * @defaultValue type === "default" || type === "confirm"
   */
  showCancel?: boolean;
  /**
   * 确定操作是否正在执行；为 true 时阻止重复提交和关闭。
   * @defaultValue false
   */
  confirmLoading?: boolean;
  /** 确定按钮的 Button 属性。 */
  okButtonProps?: ButtonProps;
  /** 取消按钮的 Button 属性。 */
  cancelButtonProps?: ButtonProps;
  /**
   * 是否显示关闭入口。
   * @defaultValue true
   */
  closable?: boolean;
  /**
   * 点击遮罩时是否允许关闭。
   * @defaultValue true
   */
  maskClosable?: boolean;
  /**
   * 是否允许通过 Esc 等键盘操作关闭。
   * @defaultValue true
   */
  keyboard?: boolean;
  /**
   * 弹框是否垂直居中。
   * @defaultValue false
   */
  centered?: boolean;
  /**
   * 宽度；数值按像素处理，字符串可使用 CSS 尺寸。
   * @defaultValue 520
   */
  width?: number | string;
  /** 固定弹框高度，内容区独立滚动，标题和底部保持可见。 */
  height?: number | string;
  /**
   组件或浮层的堆叠层级。
   * @defaultValue 1000
   */
  zIndex?: number;
  /** 弹层挂载目标；可提供元素或返回元素的函数，默认挂载到页面容器。 */
  getContainer?: OverlayContainer;
  /** 确认回调，支持 Promise 与返回 false 阻止关闭 */
  onOk?: () => ModalActionResult;
  /** 用户取消或通过关闭入口退出时调用。 */
  onCancel?: () => void;
  /** 打开状态变化回调 */
  onOpenChange?: (open: boolean) => void;
  /** 动画完成后触发，适用于聚焦内容和释放外部挂载点。 */
  afterOpenChange?: (open: boolean) => void;
}

/** ModalOpen的配置。 */
export interface ModalOpenConfig extends Omit<ModalProps, "open"> {}

/** OverlayApi的操作句柄。 */
export interface OverlayApiHandle<T> {
  /** 关闭弹层并在退出动画后释放挂载点。程序化关闭不会模拟用户取消按钮点击。 */
  destroy: () => void;
  /** 合并更新已打开弹层的配置，未提供的属性保留原值。 */
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
    autoFocus = true,
    title,
    children,
    footer,
    footerExtra,
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
    height,
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

  useOverlayLifecycle(rendered, localRef, requestClose, keyboard, autoFocus);
  if (!rendered) return null;

  const mergedStyle = {
    ...(height !== undefined ? { display: "flex", flexDirection: "column", height, maxHeight: "calc(100dvh - 48px)" } : {}),
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
        {...withTitleTooltip(props)}
      >
        <div className="sia-modal__header" style={height !== undefined ? { flexShrink: 0 } : undefined}>
          <div className="sia-modal__heading">
            {typeIcons[type] ? <span className="sia-modal__type-icon" aria-hidden="true">{typeIcons[type]}</span> : null}
            {title ? <strong id={titleId}>{title}</strong> : null}
          </div>
          {closable ? <button type="button" className="sia-modal__close" aria-label="关闭对话框" onClick={requestClose}><Icon name="close" size={17} /></button> : null}
        </div>
        {children !== undefined ? <div className="sia-modal__body" style={height !== undefined ? { flex: 1, minHeight: 0, overflow: "auto" } : undefined}>{children}</div> : null}
        {footer !== null ? <div className="sia-modal__footer" style={height !== undefined ? { flexShrink: 0 } : undefined}>{footer === undefined && footerExtra != null ? <div style={{ marginRight: "auto" }}>{footerExtra}</div> : null}{footer ?? defaultFooter}</div> : null}
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
  let mounted = false;

  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    root.unmount();
    container.remove();
    modalHandles.delete(handle);
  }

  function closeWithMotion() {
    if (destroyed || !currentOpen) return;
    currentOpen = false;
    render();
  }

  function ModalInstance() {
    useEffect(() => {
      mounted = true;
      // 创建后立即 destroy 也先建立关闭生命周期，不能跳过完成回调而遗留宿主。
      if (!currentOpen) render();
    }, []);
    return <ModalRoot {...currentConfig} open={!mounted || currentOpen} onOpenChange={(nextOpen) => {
      currentConfig.onOpenChange?.(nextOpen);
      if (!nextOpen) closeWithMotion();
    }} afterOpenChange={(nextOpen) => {
      // 命令式弹框必须先通知关闭完成，再释放根节点，避免业务关闭句柄永远不能清理。
      try {
        currentConfig.afterOpenChange?.(nextOpen);
      } finally {
        if (!nextOpen) queueMicrotask(cleanup);
      }
    }} />;
  }

  function render() {
    root.render(<ModalInstance />);
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

/** 模态框组件。 */
export const Modal = Object.assign(ModalRoot, {
  /** 直接打开实例，返回更新和关闭句柄；关闭动画完成后先调用 afterOpenChange(false)，再卸载实例。 */
  open: openModal,
  /** 显示普通信息提示。 */
  info: preset("info", { title: "提示" }),
  /** 显示成功提示。 */
  success: preset("success", { title: "操作成功" }),
  /** 显示警告提示。 */
  warning: preset("warning", { title: "请注意" }),
  /** 显示错误提示。 */
  error: preset("error", { title: "操作失败" }),
  /** 打开确认弹框，支持异步确认；返回 false 可阻止关闭。 */
  confirm: preset("confirm", { title: "确认操作" }),
  /** 关闭由此 API 打开的所有弹层。 */
  destroyAll() {
    [...modalHandles].forEach((handle) => handle.destroy());
  },
});

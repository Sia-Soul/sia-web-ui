import { OverlayContentSkeleton } from "./OverlayContentSkeleton";
import { useOverlayExitPlaceholder } from "./useOverlayExitPlaceholder";
import { Skeleton } from "./Skeleton";
import { useOverlayMotion } from "./overlayMotion";
import { withTitleTooltip } from "./titleTooltip";
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Icon } from "./Icon";
import { FloatingScrollbarProvider } from "./FloatingScrollbarProvider";
import { OverlayPortal, useOverlayLifecycle } from "./Overlay";
import type { OverlayApiHandle } from "./Modal";
import type { OverlayContainer } from "./Overlay";

/** 抽屉的位置类型。 */
export type DrawerPlacement = "left" | "right" | "top" | "bottom";

/** DrawerPush的配置。 */
export interface DrawerPushConfig {
  /** 抽屉推开父级时的位移距离。 */
  distance?: number | string;
}

/** 子抽屉打开时是否推开父抽屉，以及推开距离的配置。 */
export type DrawerPush = boolean | DrawerPushConfig;

/** 抽屉的属性配置。 */
export interface DrawerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** 是否显示抽屉；打开为 320ms 弹性滑入，关闭为 180ms 无回弹滑出，结束后卸载。快速切换从当前画面接续，系统减少动态效果时直接切换。 */
  open: boolean;
  /** 是否在入场完成后才挂载正文，默认 false，立即挂载；设为 true 时等待入场完成。关闭时正文卸载并由等高骨架占位，随外壳完成退场。仅延后子组件挂载，不会延后父组件已执行的数据计算。 */
  deferContent?: boolean;
  /** 入场等待及关闭退场期间的正文占位，未传时入场显示两列六行静态骨架，关闭时按已显示的可见控件和文字行生成近似布局骨架（最多 80 块），尚未挂载正文时沿用入场骨架；占位阶段裁剪溢出且不显示滚动条，正文就绪后恢复滚动。配合固定高度可避免尺寸变化，入场时仅 deferContent=true 生效，关闭时始终生效；传 null 可关闭占位内容。 */
  loadingFallback?: ReactNode;
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 抽屉主体内容；溢出时默认使用不占布局空间的浮动滚动条，标题及底部操作区保持固定。 */
  children?: ReactNode;
  /** 主体之外的补充内容或操作区。 */
  extra?: ReactNode;
  /** 自定义底部操作区，传 null 隐藏 */
  footer?: ReactNode;
  /**
   * 出现方向
   * @defaultValue "right"
   */
  placement?: DrawerPlacement;
  /**
   * 抽屉宽度或高度
   * @defaultValue placement === "top" || placement === "bottom" ? 320 : 760
   */
  size?: number | string;
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
   组件或浮层的堆叠层级。
   * @defaultValue 1000
   */
  zIndex?: number;
  /** 子抽屉打开时是否推移当前抽屉，默认开启。 */
  push?: DrawerPush;
  /** 适用于同级 Portal 渲染的多层抽屉，按层数累计推移。 */
  pushDepth?: number;
  /** 弹层挂载目标；可提供元素或返回元素的函数，默认挂载到页面容器。 */
  getContainer?: OverlayContainer;
  /** 请求关闭时触发的回调。 */
  onClose?: () => void;
  /** 打开状态改变时触发，参数为新的打开状态。 */
  onOpenChange?: (open: boolean) => void;
  /** 真实展开动画完成且正文已提交后触发；deferContent=true 时等待延后正文挂载，快速关闭会取消尚未完成的展开回调。 */
  afterOpen?: () => void;
  /** 关闭动画完成且面板已隐藏后触发。 */
  afterClose?: () => void;
}

/** DrawerOpen的配置。 */
export interface DrawerOpenConfig extends Omit<DrawerProps, "open"> {}

const drawerHandles = new Set<OverlayApiHandle<DrawerOpenConfig>>();
const DEFAULT_DRAWER_PUSH_DISTANCE = 180;

interface DrawerStackContextValue {
  setChildOpen: (id: string, open: boolean) => void;
}

const DrawerStackContext = createContext<DrawerStackContextValue | null>(null);

function createPushOffset(distance: number | string, depth: number, negative: boolean) {
  if (depth <= 0) return "0px";
  if (typeof distance === "number") return `${(negative ? -1 : 1) * distance * depth}px`;
  const operator = negative ? " - " : " + ";
  return `calc(0px${operator}${Array.from({ length: depth }, () => distance).join(operator)})`;
}

const DrawerRoot = forwardRef<HTMLDivElement, DrawerProps>(function Drawer(
  {
    open,
    deferContent = false,
    loadingFallback,
    title,
    children,
    extra,
    footer,
    placement = "right",
    size = placement === "top" || placement === "bottom" ? 320 : 760,
    closable = true,
    maskClosable = true,
    keyboard = true,
    zIndex = 1000,
    push = true,
    pushDepth = 0,
    getContainer,
    onClose,
    onOpenChange,
    afterOpen,
    afterClose,
    className = "",
    style,
    ...props
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const drawerId = useId();
  const parentStack = useContext(DrawerStackContext);
  const motion = useOverlayMotion(open, localRef, "drawer", placement, true, (value) => value ? afterOpen?.() : afterClose?.());
  const { present: rendered, closing } = motion;
  const bodyReady = !closing && (!deferContent || motion.settled);
  const exitPlaceholder = useOverlayExitPlaceholder(open, rendered, localRef, bodyRef, bodyReady && loadingFallback === undefined);
  const [openChildIds, setOpenChildIds] = useState<Set<string>>(() => new Set());

  const setChildOpen = useCallback((id: string, childOpen: boolean) => {
    setOpenChildIds((current) => {
      const hasId = current.has(id);
      if (hasId === childOpen) return current;
      const next = new Set(current);
      if (childOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const stackContextValue = useMemo<DrawerStackContextValue>(() => ({ setChildOpen }), [setChildOpen]);

  useEffect(() => {
    if (!parentStack) return undefined;
    // 推移跟随 open 同步变化；rendered 只负责保留子抽屉直到退场结束。
    parentStack.setChildOpen(drawerId, open);
    return () => parentStack.setChildOpen(drawerId, false);
  }, [drawerId, open, parentStack]);

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

  const pushEnabled = push !== false;
  const pushDistance = typeof push === "object" ? push.distance ?? DEFAULT_DRAWER_PUSH_DISTANCE : DEFAULT_DRAWER_PUSH_DISTANCE;
  const automaticPushDepth = openChildIds.size > 0 ? 1 : 0;
  const configuredPushDepth = Number.isFinite(pushDepth) ? Math.max(0, Math.floor(pushDepth)) : 0;
  const effectivePushDepth = pushEnabled ? Math.max(automaticPushDepth, configuredPushDepth) : 0;
  const horizontalPush = placement === "left" || placement === "right";
  const negativePush = placement === "right" || placement === "bottom";
  const pushOffset = createPushOffset(pushDistance, effectivePushDepth, negativePush);
  const mergedStyle = {
    ...style,
    "--sia-drawer-size": typeof size === "number" ? `${size}px` : size,
    "--sia-drawer-push-x": horizontalPush ? pushOffset : "0px",
    "--sia-drawer-push-y": horizontalPush ? "0px" : pushOffset,
  } as CSSProperties;

  return <DrawerStackContext.Provider value={stackContextValue}>
    <OverlayPortal container={getContainer}>
      <div className="sia-drawer-root" data-state={closing ? "closing" : "open"} style={{ zIndex }}>
        <button className="sia-drawer__mask" type="button" aria-label="关闭抽屉" onClick={() => maskClosable && requestClose()} />
        <div
          ref={setRef}
          className={`sia-drawer sia-drawer--${placement} ${className}`.trim()}
          style={{ ...mergedStyle, ...exitPlaceholder.panelStyle, animation: "none", transformOrigin: placement === "left" ? "left center" : placement === "right" ? "right center" : placement === "top" ? "center top" : "center bottom" }}
          data-push-depth={effectivePushDepth}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          {...withTitleTooltip(props)}
        >
          <div className="sia-drawer__header">
            <div className="sia-drawer__heading">
              {closable ? <button type="button" className="sia-drawer__close" aria-label="关闭抽屉" onClick={requestClose}><Icon name="close" size={17} /></button> : null}
              {title ? <strong id={titleId}>{title}</strong> : null}
            </div>
            {extra ? <div className="sia-drawer__extra">{extra}</div> : null}
          </div>
          <div ref={bodyRef} className={`sia-drawer__body${deferContent && bodyReady ? " sia-overlay-body--ready" : ""}`} aria-busy={!bodyReady} style={exitPlaceholder.bodyStyle}>{bodyReady ? children : loadingFallback !== undefined ? loadingFallback : closing && exitPlaceholder.layout ? <OverlayContentSkeleton layout={exitPlaceholder.layout} /> : <Skeleton />}</div>
          {/* 正文就绪后再接管滚动，骨架阶段不创建无意义的滚动轨道。 */}
          <FloatingScrollbarProvider targetRef={bodyRef} disabled={!bodyReady} />
          {footer && (bodyReady || closing && motion.entered) ? <div className="sia-drawer__footer">{footer}</div> : null}
        </div>
      </div>
    </OverlayPortal>
  </DrawerStackContext.Provider>;
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
  let mounted = false;

  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    root.unmount();
    container.remove();
    drawerHandles.delete(handle);
  }

  function closeWithMotion() {
    if (destroyed || !currentOpen) return;
    currentOpen = false;
    render();
  }

  function DrawerInstance() {
    useEffect(() => {
      mounted = true;
      // 立即 destroy 也先建立生命周期，以真实退场完成释放宿主。
      if (!currentOpen) render();
    }, []);
    return <DrawerRoot
      {...currentConfig}
      open={!mounted || currentOpen}
      onOpenChange={(nextOpen) => {
        currentConfig.onOpenChange?.(nextOpen);
        if (!nextOpen) closeWithMotion();
      }}
      afterOpen={() => currentConfig.afterOpen?.()}
      afterClose={() => {
        try { currentConfig.afterClose?.(); }
        finally { queueMicrotask(cleanup); }
      }}
    />;
  }

  function render() {
    root.render(<DrawerInstance />);
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

/** 从屏幕边缘弹性回弹展开的抽屉；主体默认使用浮动滚动条，支持四个方向、嵌套推移、重正文延后挂载及静态 API。 */
export const Drawer = Object.assign(DrawerRoot, {
  /** 直接打开实例，返回可用于更新或关闭的操作句柄。 */
  open: openDrawer,
  /** 关闭由此 API 打开的所有弹层。 */
  destroyAll() {
    [...drawerHandles].forEach((handle) => handle.destroy());
  },
});

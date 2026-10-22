import { useEffect, useRef } from "react";
import { withTitleTooltip } from "./titleTooltip";
import type {
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { Icon } from "./Icon";

/** 窗口控制操作名称。 */
export type WindowAction = "start-dragging" | "minimize" | "toggle-maximize" | "close";
/** 窗口控制按钮可执行的操作。 */
export type WindowControlAction = Exclude<WindowAction, "start-dragging">;
/** 执行窗口控制操作的回调函数。 */
export type WindowActionHandler = (action: WindowAction) => void | Promise<void>;
/** 标题栏操作区域的对齐方式。 */
export type WindowTitleBarActionsAlign = "left" | "right";

/** 窗口控制按钮的显示和无障碍文案。 */
export interface WindowControlLabels {
  /** 最小化窗口。 */
  minimize: string;
  /** 最大化窗口。 */
  maximize: string;
  /** 还原窗口尺寸或还原初始状态。 */
  restore: string;
  /** 关闭当前界面或实例。 */
  close: string;
}

/** 窗口框架的属性配置。 */
export interface WindowFrameProps extends HTMLAttributes<HTMLDivElement> {
  /** 标题栏内容或配置。 */
  titleBar?: ReactNode;
  /** 是否允许选择普通界面文字，默认 true；false 时当前文档内（含弹层）的普通文字和图片不可拖选，输入框、文本域及可编辑区域仍能正常选择和编辑。 */
  textSelectable?: boolean;
}

/** 窗口控制按钮的属性配置。 */
export interface WindowControlsProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 当前窗口是否已最大化。
   * @defaultValue false
   */
  maximized?: boolean;
  /**
   * 是否显示最小化按钮。
   * @defaultValue true
   */
  showMinimize?: boolean;
  /**
   * 是否显示最大化或还原按钮。
   * @defaultValue true
   */
  showMaximize?: boolean;
  /**
   * 是否显示关闭按钮。
   * @defaultValue true
   */
  showClose?: boolean;
  /**
   * 不允许执行的窗口操作集合。
   * @defaultValue []
   */
  disabledActions?: readonly WindowControlAction[];
  /** 各操作入口的显示或无障碍文案。 */
  labels?: Partial<WindowControlLabels>;
  /** 操作按钮被触发时调用。 */
  onAction?: WindowActionHandler;
}

/** 窗口标题栏的属性配置。 */
export interface WindowTitleBarProps extends HTMLAttributes<HTMLElement> {
  /** 标题前的内容区域。 */
  leading?: ReactNode;
  /** 附加的操作按钮区域。 */
  actions?: ReactNode;
  /**
   * 操作区域的对齐方式。
   * @defaultValue "right"
   */
  actionsAlign?: WindowTitleBarActionsAlign;
  /**
   是否显示窗口控制按钮。
   * @defaultValue true
   */
  controls?: boolean | ReactNode;
  /**
   * 当前窗口是否已最大化。
   * @defaultValue false
   */
  maximized?: boolean;
  /**
   * 是否允许拖拽。
   * @defaultValue true
   */
  draggable?: boolean;
  /** 不允许执行的窗口操作集合。 */
  disabledActions?: readonly WindowControlAction[];
  /** 窗口控制按钮的文案。 */
  controlLabels?: Partial<WindowControlLabels>;
  /** 操作发生时调用；主键按住并移动至少 2 CSS 像素时触发 start-dragging，静止按住不触发；双击触发 toggle-maximize。 */
  onWindowAction?: WindowActionHandler;
}

const DEFAULT_LABELS: WindowControlLabels = {
  minimize: "最小化",
  maximize: "最大化",
  restore: "还原",
  close: "关闭",
};

const NON_DRAG_SELECTOR = [
  "button",
  "input",
  "textarea",
  "select",
  "a",
  "label",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
  "[role='button']",
  "[role='link']",
  "[role='menuitem']",
  "[role='tab']",
  "[data-sia-window-no-drag]",
].join(",");

/** 窗口框架组件。 */
export function WindowFrame({
  titleBar,
  textSelectable = true,
  className = "",
  children,
  ...props
}: WindowFrameProps) {
  return (
    <div
      className={`sia-window-frame ${className}`.trim()}
      data-sia-window-mode="custom"
      data-sia-text-selectable={textSelectable}
      {...withTitleTooltip(props)}
    >
      {titleBar}
      {children}
    </div>
  );
}

/** 窗口控制按钮组件。 */
export function WindowControls({
  maximized = false,
  showMinimize = true,
  showMaximize = true,
  showClose = true,
  disabledActions = [],
  labels,
  onAction,
  className = "",
  ...props
}: WindowControlsProps) {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const isDisabled = (action: WindowControlAction) => (
    !onAction || disabledActions.includes(action)
  );

  function runAction(action: WindowControlAction) {
    void onAction?.(action);
  }

  return (
    <div
      className={`sia-window-controls ${className}`.trim()}
      data-sia-window-no-drag=""
      aria-label="窗口控制"
      {...withTitleTooltip(props)}
    >
      {showMinimize ? (
        <button
          type="button"
          className="sia-window-control"
          aria-label={mergedLabels.minimize}
          {...withTitleTooltip({ title: mergedLabels.minimize })}
          disabled={isDisabled("minimize")}
          onClick={() => runAction("minimize")}
        >
          <Icon name="minus" size={14} />
        </button>
      ) : null}
      {showMaximize ? (
        <button
          type="button"
          className="sia-window-control"
          aria-label={maximized ? mergedLabels.restore : mergedLabels.maximize}
          {...withTitleTooltip({ title: maximized ? mergedLabels.restore : mergedLabels.maximize })}
          disabled={isDisabled("toggle-maximize")}
          onClick={() => runAction("toggle-maximize")}
        >
          <Icon name={maximized ? "fullscreen-exit" : "fullscreen"} size={13} />
        </button>
      ) : null}
      {showClose ? (
        <button
          type="button"
          className="sia-window-control sia-window-control--close"
          aria-label={mergedLabels.close}
          {...withTitleTooltip({ title: mergedLabels.close })}
          disabled={isDisabled("close")}
          onClick={() => runAction("close")}
        >
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </div>
  );
}

/** 窗口标题栏组件。 */
export function WindowTitleBar({
  leading,
  actions,
  actionsAlign = "right",
  controls = true,
  maximized = false,
  draggable = true,
  disabledActions,
  controlLabels,
  onWindowAction,
  className = "",
  children,
  onMouseDown,
  ...props
}: WindowTitleBarProps) {
  // 等待真实拖动意图再交给宿主，避免静止按住时进入 Windows 非客户区等待循环。
  const cancelDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelDrag.current?.(), [draggable]);
  function handleMouseDown(event: ReactMouseEvent<HTMLElement>) {
    cancelDrag.current?.();
    onMouseDown?.(event);
    if (
      event.defaultPrevented
      || !draggable
      || !onWindowAction
      || event.button !== 0
    ) return;

    const target = event.target;
    if (!(target instanceof Element) || target.closest(NON_DRAG_SELECTOR)) return;

    event.preventDefault();
    if (event.detail > 1) { void onWindowAction("toggle-maximize"); return; }
    const origin = { x: event.clientX, y: event.clientY };
    const run = onWindowAction;
    function cancel() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", cancel, true);
      window.removeEventListener("blur", cancel);
      cancelDrag.current = null;
    }
    function move(next: MouseEvent) {
      if ((next.buttons & 1) === 0) { cancel(); return; }
      if (Math.hypot(next.clientX - origin.x, next.clientY - origin.y) < 2) return;
      cancel();
      void run("start-dragging");
    }
    cancelDrag.current = cancel;
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", cancel, true);
    window.addEventListener("blur", cancel);
  }

  const renderedControls = controls === true ? (
    <WindowControls
      maximized={maximized}
      disabledActions={disabledActions}
      labels={controlLabels}
      onAction={onWindowAction}
    />
  ) : controls || null;
  const renderedActions = actions ? (
    <div className="sia-window-titlebar__actions" data-sia-window-no-drag="">
      {actions}
    </div>
  ) : null;

  return (
    <header
      className={`sia-window-titlebar ${className}`.trim()}
      data-actions-align={actionsAlign}
      onMouseDown={handleMouseDown}
      {...withTitleTooltip(props)}
    >
      {leading ? <div className="sia-window-titlebar__leading">{leading}</div> : null}
      {actionsAlign === "left" ? renderedActions : null}
      {children}
      <div className="sia-window-titlebar__drag-region" aria-hidden="true" />
      {actionsAlign === "right" ? renderedActions : null}
      {renderedControls}
    </header>
  );
}

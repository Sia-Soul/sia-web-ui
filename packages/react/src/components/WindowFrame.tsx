import type {
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { Icon } from "./Icon";

export type WindowAction = "start-dragging" | "minimize" | "toggle-maximize" | "close";
export type WindowControlAction = Exclude<WindowAction, "start-dragging">;
export type WindowActionHandler = (action: WindowAction) => void | Promise<void>;
export type WindowTitleBarActionsAlign = "left" | "right";

export interface WindowControlLabels {
  minimize: string;
  maximize: string;
  restore: string;
  close: string;
}

export interface WindowFrameProps extends HTMLAttributes<HTMLDivElement> {
  titleBar?: ReactNode;
}

export interface WindowControlsProps extends HTMLAttributes<HTMLDivElement> {
  maximized?: boolean;
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
  disabledActions?: readonly WindowControlAction[];
  labels?: Partial<WindowControlLabels>;
  onAction?: WindowActionHandler;
}

export interface WindowTitleBarProps extends HTMLAttributes<HTMLElement> {
  leading?: ReactNode;
  actions?: ReactNode;
  actionsAlign?: WindowTitleBarActionsAlign;
  controls?: boolean | ReactNode;
  maximized?: boolean;
  draggable?: boolean;
  disabledActions?: readonly WindowControlAction[];
  controlLabels?: Partial<WindowControlLabels>;
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

export function WindowFrame({
  titleBar,
  className = "",
  children,
  ...props
}: WindowFrameProps) {
  return (
    <div
      className={`sia-window-frame ${className}`.trim()}
      data-sia-window-mode="custom"
      {...props}
    >
      {titleBar}
      {children}
    </div>
  );
}

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
      {...props}
    >
      {showMinimize ? (
        <button
          type="button"
          className="sia-window-control"
          aria-label={mergedLabels.minimize}
          title={mergedLabels.minimize}
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
          title={maximized ? mergedLabels.restore : mergedLabels.maximize}
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
          title={mergedLabels.close}
          disabled={isDisabled("close")}
          onClick={() => runAction("close")}
        >
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </div>
  );
}

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
  function handleMouseDown(event: ReactMouseEvent<HTMLElement>) {
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
    void onWindowAction(event.detail > 1 ? "toggle-maximize" : "start-dragging");
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
      {...props}
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

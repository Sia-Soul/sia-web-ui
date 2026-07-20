import { cloneElement, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { Button } from "./Button";
import { Icon } from "./Icon";
import type { FloatingPlacement } from "./FloatingDisplay";
import { Popover } from "./FloatingDisplay";
import { useControllableState } from "./shared";

export interface PopconfirmProps {
  children: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  okText?: ReactNode;
  cancelText?: ReactNode;
  okButtonProps?: React.ComponentProps<typeof Button>;
  cancelButtonProps?: React.ComponentProps<typeof Button>;
  placement?: FloatingPlacement;
  trigger?: "click" | "hover" | "focus";
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  showCancel?: boolean;
  icon?: ReactNode;
  onConfirm?: (event?: React.MouseEvent) => void | boolean | Promise<void | boolean>;
  onCancel?: (event?: React.MouseEvent) => void;
  onOpenChange?: (open: boolean) => void;
}

export function Popconfirm({
  children, title, description, okText = "确定", cancelText = "取消", okButtonProps, cancelButtonProps, placement = "top",
  trigger = "click", open, defaultOpen = false, disabled = false, showCancel = true, icon = <Icon name="question" variant="filled" />,
  onConfirm, onCancel, onOpenChange,
}: PopconfirmProps) {
  const [visible, setVisible] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const [loading, setLoading] = useState(false);
  const content = <div className="sia-popconfirm">
    <div className="sia-popconfirm__message"><span>{icon}</span><div><strong>{title}</strong>{description ? <p>{description}</p> : null}</div></div>
    <div className="sia-popconfirm__actions">
      {showCancel ? <Button size="small" {...cancelButtonProps} onClick={(event) => { cancelButtonProps?.onClick?.(event); onCancel?.(event); setVisible(false); }}>{cancelText}</Button> : null}
      <Button size="small" variant="primary" {...okButtonProps} loading={loading || okButtonProps?.loading} onClick={async (event) => {
        okButtonProps?.onClick?.(event);
        const result = onConfirm?.(event);
        if (result instanceof Promise) { setLoading(true); try { if (await result !== false) setVisible(false); } finally { setLoading(false); } }
        else if (result !== false) setVisible(false);
      }}>{okText}</Button>
    </div>
  </div>;
  return <Popover content={content} placement={placement} trigger={disabled ? [] : trigger} open={visible} onOpenChange={setVisible}>{children}</Popover>;
}

export type ProgressStatus = "normal" | "active" | "success" | "exception";
export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  percent?: number;
  type?: "line" | "circle" | "dashboard";
  status?: ProgressStatus;
  showInfo?: boolean;
  format?: (percent?: number, successPercent?: number) => ReactNode;
  strokeColor?: string | { from: string; to: string };
  trailColor?: string;
  strokeWidth?: number;
  width?: number;
  steps?: number;
  success?: { percent?: number; strokeColor?: string };
  size?: "small" | "default" | number | readonly [number, number];
}

export function Progress({
  percent = 0, type = "line", status, showInfo = true, format, strokeColor, trailColor, strokeWidth = 8, width = 120, steps,
  success, size = "default", className = "", style, ...props
}: ProgressProps) {
  const safe = Math.max(0, Math.min(100, percent));
  const resolved = status ?? (safe >= 100 ? "success" : "normal");
  const color = typeof strokeColor === "string" ? strokeColor : undefined;
  const background = typeof strokeColor === "object" ? `linear-gradient(90deg, ${strokeColor.from}, ${strokeColor.to})` : color;
  const label = format?.(safe, success?.percent) ?? (resolved === "exception" ? <Icon name="close" /> : resolved === "success" ? <Icon name="check" /> : `${safe}%`);
  if (type !== "line") {
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const dash = circumference * (safe / 100);
    return <div className={`sia-progress sia-progress--${type} sia-progress--${resolved} ${className}`.trim()} style={{ width, height: width, ...style }} {...props}>
      <svg viewBox="0 0 100 100" role="progressbar" aria-valuenow={safe}>
        <circle className="sia-progress__trail" cx="50" cy="50" r={radius} style={{ stroke: trailColor }} />
        <circle className="sia-progress__circle" cx="50" cy="50" r={radius} style={{ stroke: color, strokeDasharray: type === "dashboard" ? `${circumference * .75} ${circumference * .25}` : circumference, strokeDashoffset: (type === "dashboard" ? circumference * .75 : circumference) - dash * (type === "dashboard" ? .75 : 1), strokeWidth }} />
      </svg>
      {showInfo ? <span className="sia-progress__text">{label}</span> : null}
    </div>;
  }
  const height = Array.isArray(size) ? size[1] : typeof size === "number" ? size : size === "small" ? 6 : strokeWidth;
  return <div className={`sia-progress sia-progress--line sia-progress--${resolved} ${className}`.trim()} style={style} {...props}>
    <div className="sia-progress__outer" style={{ height, backgroundColor: trailColor }}>
      {steps ? <div className="sia-progress__steps">{Array.from({ length: steps }, (_, index) => <span className={index < Math.round(steps * safe / 100) ? "is-active" : ""} style={{ background: index < Math.round(steps * safe / 100) ? background : trailColor }} key={index} />)}</div>
        : <><span className="sia-progress__bar" style={{ width: `${safe}%`, background }} />{success?.percent ? <span className="sia-progress__success" style={{ width: `${success.percent}%`, background: success.strokeColor }} /> : null}</>}
    </div>
    {showInfo ? <span className="sia-progress__info">{label}</span> : null}
  </div>;
}

export interface SpinProps extends HTMLAttributes<HTMLDivElement> {
  spinning?: boolean;
  size?: "small" | "default" | "large";
  tip?: ReactNode;
  indicator?: ReactNode;
  delay?: number;
  fullscreen?: boolean;
}
export function Spin({ spinning = true, size = "default", tip, indicator, delay = 0, fullscreen = false, className = "", children, ...props }: SpinProps) {
  const [visible, setVisible] = useState(delay === 0 && spinning);
  useEffect(() => {
    if (!spinning) { setVisible(false); return; }
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay, spinning]);
  const spinner = visible ? <div className={`sia-spin sia-spin--${size}`} role="status" aria-live="polite">{indicator ?? <span className="sia-spin__indicator"><i /><i /><i /><i /></span>}{tip ? <span className="sia-spin__tip">{tip}</span> : null}</div> : null;
  if (fullscreen) return visible && typeof document !== "undefined" ? createPortal(<div className="sia-spin-fullscreen">{spinner}</div>, document.body) : null;
  if (!children) return <div className={`sia-spin-wrap ${className}`.trim()} {...props}>{spinner}</div>;
  return <div className={`sia-spin-container${visible ? " is-spinning" : ""} ${className}`.trim()} {...props}>{children}{visible ? <div className="sia-spin-mask">{spinner}</div> : null}</div>;
}

export interface WatermarkFont { color?: string; fontSize?: number; fontWeight?: number | string; fontFamily?: string; fontStyle?: string; textAlign?: CanvasTextAlign }
export interface WatermarkProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
  content?: string | readonly string[];
  image?: string;
  width?: number;
  height?: number;
  rotate?: number;
  zIndex?: number;
  gap?: readonly [number, number];
  offset?: readonly [number, number];
  font?: WatermarkFont;
}
function escapeXml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]!)); }
export function Watermark({ content = "Sia Web UI", image, width = 120, height = 64, rotate = -22, zIndex = 9, gap = [100, 100], offset = [0, 0], font, className = "", children, ...props }: WatermarkProps) {
  const background = useMemo(() => {
    const tileWidth = width + gap[0], tileHeight = height + gap[1];
    const lines = Array.isArray(content) ? content : [content];
    const family = font?.fontFamily ?? "sans-serif", size = font?.fontSize ?? 16, weight = font?.fontWeight ?? 400, color = font?.color ?? "rgba(0,0,0,.15)";
    const body = image
      ? `<image href="${escapeXml(image)}" x="0" y="0" width="${width}" height="${height}"/>`
      : lines.map((line, index) => `<text x="${width / 2}" y="${height / 2 + (index - (lines.length - 1) / 2) * (size + 5)}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="${size}" font-weight="${weight}" font-family="${family}">${escapeXml(line)}</text>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}"><g transform="translate(${offset[0]} ${offset[1]}) rotate(${rotate} ${width / 2} ${height / 2})">${body}</g></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [content, font?.color, font?.fontFamily, font?.fontSize, font?.fontWeight, gap[0], gap[1], height, image, offset[0], offset[1], rotate, width]);
  return <div className={`sia-watermark ${className}`.trim()} {...props}>{children}<div className="sia-watermark__layer" aria-hidden="true" style={{ zIndex, backgroundImage: background }} /></div>;
}

export type NotificationType = "info" | "success" | "warning" | "error";
export type NotificationPlacement = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
export interface NotificationConfig {
  key?: string | number;
  type?: NotificationType;
  message: ReactNode;
  description?: ReactNode;
  duration?: number;
  placement?: NotificationPlacement;
  icon?: ReactNode;
  btn?: ReactNode;
  closeIcon?: ReactNode;
  role?: string;
  onClick?: () => void;
  onClose?: () => void;
}
type NotificationEntry = NotificationConfig & { key: string | number };
const notificationListeners = new Set<(entries: NotificationEntry[]) => void>();
let notificationEntries: NotificationEntry[] = [];
let notificationSeed = 0;
let notificationHost: HTMLDivElement | null = null;
const notificationTimers = new Map<string | number, number>();
function emitNotifications() { notificationListeners.forEach((listener) => listener([...notificationEntries])); }
function closeNotification(key: string | number) {
  const entry = notificationEntries.find((item) => item.key === key);
  notificationEntries = notificationEntries.filter((item) => item.key !== key);
  window.clearTimeout(notificationTimers.get(key)); notificationTimers.delete(key); emitNotifications(); entry?.onClose?.();
}
function NotificationHost() {
  const [entries, setEntries] = useState(notificationEntries);
  useEffect(() => { notificationListeners.add(setEntries); return () => { notificationListeners.delete(setEntries); }; }, []);
  const placements: NotificationPlacement[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"];
  return <>{placements.map((placement) => <div className={`sia-notification sia-notification--${placement}`} key={placement}>
    {entries.filter((item) => (item.placement ?? "topRight") === placement).map((item) => <div className={`sia-notification__notice sia-notification__notice--${item.type ?? "info"}`} role={item.role ?? "alert"} key={item.key} onClick={item.onClick}>
      <span className="sia-notification__icon">{item.icon ?? <Icon name={item.type === "success" ? "circle-check" : item.type === "warning" ? "warning" : item.type === "error" ? "circle-close" : "info"} variant="filled" />}</span>
      <div><strong>{item.message}</strong>{item.description ? <p>{item.description}</p> : null}{item.btn}</div>
      <button type="button" aria-label="关闭通知" onClick={(event) => { event.stopPropagation(); closeNotification(item.key); }}>{item.closeIcon ?? <Icon name="close" size={14} />}</button>
    </div>)}
  </div>)}</>;
}
function ensureNotificationHost() {
  if (typeof document === "undefined" || notificationHost) return;
  notificationHost = document.createElement("div"); notificationHost.dataset.siaNotificationHost = "";
  document.body.appendChild(notificationHost); createRoot(notificationHost).render(<NotificationHost />);
}
function openNotification(config: NotificationConfig) {
  if (typeof window === "undefined" || typeof document === "undefined") return { key: config.key ?? "ssr", close: () => undefined };
  ensureNotificationHost();
  const key = config.key ?? `sia-notification-${++notificationSeed}`;
  const entry = { ...config, key };
  const exists = notificationEntries.some((item) => item.key === key);
  notificationEntries = exists ? notificationEntries.map((item) => item.key === key ? entry : item) : [...notificationEntries, entry];
  emitNotifications();
  window.clearTimeout(notificationTimers.get(key));
  if ((config.duration ?? 4.5) > 0) notificationTimers.set(key, window.setTimeout(() => closeNotification(key), (config.duration ?? 4.5) * 1000));
  return { key, close: () => closeNotification(key) };
}
export const notification = {
  open: openNotification,
  info: (config: Omit<NotificationConfig, "type">) => openNotification({ ...config, type: "info" }),
  success: (config: Omit<NotificationConfig, "type">) => openNotification({ ...config, type: "success" }),
  warning: (config: Omit<NotificationConfig, "type">) => openNotification({ ...config, type: "warning" }),
  error: (config: Omit<NotificationConfig, "type">) => openNotification({ ...config, type: "error" }),
  destroy: (key?: string | number) => {
    if (key !== undefined) closeNotification(key);
    else { [...notificationEntries].forEach((item) => closeNotification(item.key)); }
  },
};

export interface TourStep {
  title?: ReactNode;
  description?: ReactNode;
  cover?: ReactNode;
  target?: HTMLElement | null | (() => HTMLElement | null);
  placement?: FloatingPlacement | "center";
  nextButtonProps?: React.ComponentProps<typeof Button> & { children?: ReactNode };
  prevButtonProps?: React.ComponentProps<typeof Button> & { children?: ReactNode };
}
export interface TourProps {
  open?: boolean;
  steps: readonly TourStep[];
  current?: number;
  defaultCurrent?: number;
  mask?: boolean;
  closable?: boolean;
  disabledInteraction?: boolean;
  onChange?: (current: number) => void;
  onClose?: (current: number) => void;
  onFinish?: () => void;
}
export function Tour({ open = false, steps, current, defaultCurrent = 0, mask = true, closable = true, disabledInteraction = false, onChange, onClose, onFinish }: TourProps) {
  const [index, setIndex] = useControllableState({ value: current, defaultValue: defaultCurrent, onChange });
  const [, force] = useState(0);
  useEffect(() => {
    if (!open) return;
    const update = () => force((value) => value + 1);
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open]);
  if (!open || !steps[index] || typeof document === "undefined") return null;
  const step = steps[index];
  const target = typeof step.target === "function" ? step.target() : step.target;
  const rect = target?.getBoundingClientRect();
  const placement = step.placement ?? (rect ? "bottom" : "center");
  const panelStyle: CSSProperties = placement === "center" || !rect ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
    : placement.startsWith("bottom") ? { top: rect.bottom + 14, left: rect.left + rect.width / 2, transform: "translateX(-50%)" }
      : placement.startsWith("top") ? { top: rect.top - 14, left: rect.left + rect.width / 2, transform: "translate(-50%, -100%)" }
        : placement === "left" ? { top: rect.top + rect.height / 2, left: rect.left - 14, transform: "translate(-100%, -50%)" }
          : { top: rect.top + rect.height / 2, left: rect.right + 14, transform: "translateY(-50%)" };
  return createPortal(<div className="sia-tour" role="dialog" aria-modal="true">
    {mask && !rect ? <div className="sia-tour__mask" /> : null}
    {rect ? <div className="sia-tour__target" style={{ top: rect.top - 5, left: rect.left - 5, width: rect.width + 10, height: rect.height + 10, pointerEvents: disabledInteraction ? "auto" : "none", boxShadow: mask ? "0 0 0 5px var(--sia-color-surface), 0 0 0 9999px rgb(0 0 0 / 46%)" : "0 0 0 5px var(--sia-color-surface)" }} /> : null}
    <div className="sia-tour__panel" style={panelStyle}>
      {closable ? <button className="sia-tour__close" aria-label="关闭引导" onClick={() => onClose?.(index)}><Icon name="close" size={14} /></button> : null}
      {step.cover}<strong>{step.title}</strong>{step.description ? <div className="sia-tour__description">{step.description}</div> : null}
      <footer><span>{index + 1} / {steps.length}</span><div>{index > 0 ? <Button size="small" {...step.prevButtonProps} onClick={() => setIndex(index - 1)}>{step.prevButtonProps?.children ?? "上一步"}</Button> : null}<Button size="small" variant="primary" {...step.nextButtonProps} onClick={() => { if (index >= steps.length - 1) onFinish?.(); else setIndex(index + 1); }}>{step.nextButtonProps?.children ?? (index >= steps.length - 1 ? "完成" : "下一步")}</Button></div></footer>
    </div>
  </div>, document.body);
}

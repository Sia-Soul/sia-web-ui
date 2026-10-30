import { withTitleTooltip } from "./titleTooltip";
import { cloneElement, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { Button } from "./Button";
import { Icon } from "./Icon";
import type { FloatingPlacement, TooltipProps } from "./FloatingDisplay";
import { Popover } from "./FloatingDisplay";
import { useControllableState } from "./shared";
import { useOverlayMotion } from "./overlayMotion";

/** 气泡确认的属性配置。 */
export interface PopconfirmProps {
  /** 触发确认框的元素；默认在该元素上方居中显示，空间不足时自动避让。 */
  children: ReactElement;
  /** 标题内容，可传入文本或 React 节点。 */
  title: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode;
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
  /** 确定按钮的 Button 属性。 */
  okButtonProps?: React.ComponentProps<typeof Button>;
  /** 取消按钮的 Button 属性。 */
  cancelButtonProps?: React.ComponentProps<typeof Button>;
  /**
   * 相对于触发元素的弹出方向和对齐位置。
   * @defaultValue "top"
   */
  placement?: FloatingPlacement;
  /** 是否显示箭头，默认 true；设置 { pointAtCenter: true } 时指向触发元素中心。 */
  arrow?: TooltipProps["arrow"];
  /** 是否自动翻转和贴边偏移，默认 true；滚动时跟随目标，目标完全离开可视区域时隐藏。 */
  autoAdjustOverflow?: boolean;
  /** 是否跳过气泡直接确认，默认 false；为 true 时仅点击触发元素会调用 onConfirm，disabled 优先，异步执行期间忽略重复点击。 */
  skipConfirm?: boolean;
  /**
   * 触发显示的交互方式。
   * @defaultValue "click"
   */
  trigger?: "click" | "hover" | "focus";
  /** 是否打开；传入后由外部控制显示状态。 */
  open?: boolean;
  /**
   * 非受控模式下的初始打开状态。
   * @defaultValue false
   */
  defaultOpen?: boolean;
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /**
   * 是否显示取消按钮。
   * @defaultValue true
   */
  showCancel?: boolean;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 点击确定或跳过确认时调用，参数为点击事件；返回 false 保持打开，其余同步结果关闭。返回 Promise 时显示加载状态，成功且结果不为 false 时关闭；抛错或拒绝时保持打开并调用 onConfirmError。受控模式通过 onOpenChange 请求关闭，需外部更新 open。 */
  onConfirm?: (event?: React.MouseEvent) => void | boolean | PromiseLike<void | boolean>;
  /** 确认回调抛错或 Promise 拒绝时调用，参数为原始错误；可用于展示失败提示，默认保持气泡并恢复按钮，不自动展示错误文案。 */
  onConfirmError?: (error: unknown) => void;
  /** 点击取消按钮时调用，参数为点击事件；点击外部关闭不会触发此回调。 */
  onCancel?: (event?: React.MouseEvent) => void;
  /** 打开状态改变时触发，参数为新的打开状态。 */
  onOpenChange?: (open: boolean) => void;
}

/** 气泡确认组件。 */
export function Popconfirm({
  children, title, description, okText = "确定", cancelText = "取消", okButtonProps, cancelButtonProps, placement = "top",
  trigger = "click", open, defaultOpen = false, disabled = false, showCancel = true, icon = <Icon name="question" variant="filled" />,
  onConfirm, onConfirmError, onCancel, onOpenChange, arrow = true, autoAdjustOverflow = true, skipConfirm = false,
}: PopconfirmProps) {
  const [visible, setVisible] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef(false);
  const requestRef = useRef(0);
  function changeVisible(next: boolean) {
    if (!next) {
      // 关闭后作废旧请求，避免其完成时关闭后来重新打开的气泡。
      requestRef.current++;
      pendingRef.current = false;
      setLoading(false);
    }
    setVisible(next);
  }
  useEffect(() => {
    if (!visible) { requestRef.current++; pendingRef.current = false; setLoading(false); }
    return () => { requestRef.current++; };
  }, [visible]);
  async function confirm(event: React.MouseEvent) {
    if (disabled || pendingRef.current || okButtonProps?.loading || okButtonProps?.disabled) return;
    pendingRef.current = true;
    const request = ++requestRef.current;
    try {
      const result = onConfirm?.(event);
      if (result && typeof result === "object" && typeof result.then === "function") setLoading(true);
      const resolved = await result;
      if (request === requestRef.current && resolved !== false && visible) changeVisible(false);
    } catch (error) {
      if (request === requestRef.current) onConfirmError?.(error);
    } finally {
      if (request === requestRef.current) { pendingRef.current = false; setLoading(false); }
    }
  }
  const content = <div className="sia-popconfirm">
    <div className="sia-popconfirm__message"><span>{icon}</span><div><strong>{title}</strong>{description ? <p>{description}</p> : null}</div></div>
    <div className="sia-popconfirm__actions">
      {showCancel ? <Button size="small" {...cancelButtonProps} onClick={(event) => {
        cancelButtonProps?.onClick?.(event);
        if (event.defaultPrevented) return;
        onCancel?.(event);
        changeVisible(false);
      }}>{cancelText}</Button> : null}
      <Button size="small" variant="primary" {...okButtonProps} loading={loading || okButtonProps?.loading} onClick={(event) => {
        okButtonProps?.onClick?.(event);
        if (!event.defaultPrevented) void confirm(event);
      }}>{okText}</Button>
    </div>
  </div>;
  const target = skipConfirm ? cloneElement(children, { onClick: (event: React.MouseEvent) => {
    children.props.onClick?.(event);
    if (!event.defaultPrevented) void confirm(event);
  } }) : children;
  return <Popover content={content} placement={placement} arrow={arrow} autoAdjustOverflow={autoAdjustOverflow} trigger={disabled || skipConfirm ? [] : trigger} open={visible && !skipConfirm && !disabled} onOpenChange={changeVisible}>{target}</Popover>;
}

/** 进度的状态类型。 */
export type ProgressStatus = "normal" | "active" | "success" | "exception";
/** 进度的属性配置。 */
export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 进度百分比。
   * @defaultValue 0
   */
  percent?: number;
  /**
   * 类型标识，用于选择对应的表现形式。
   * @defaultValue "line"
   */
  type?: "line" | "circle" | "dashboard";
  /** 当前状态，用于选择对应的状态样式。 */
  status?: ProgressStatus;
  /**
   * 是否显示进度文本。
   * @defaultValue true
   */
  showInfo?: boolean;
  /** 显示格式或格式化函数。 */
  format?: (percent?: number, successPercent?: number) => ReactNode;
  /** 描边或进度条颜色。 */
  strokeColor?: string | {
  /** 范围、渐变或转换的起始值。 */
  from: string;
  /** 范围、渐变或转换的结束值。 */
  to: string };
  /** 未完成部分的轨道颜色。 */
  trailColor?: string;
  /**
   * 描边或进度轨道粗细。
   * @defaultValue 8
   */
  strokeWidth?: number;
  /**
   * 宽度；数值按像素处理，字符串可使用 CSS 尺寸。
   * @defaultValue 120
   */
  width?: number;
  /** 步骤集合或进度分段配置。 */
  steps?: number;
  /** 成功进度部分的配置。 */
  success?: {
  /**
   * 进度百分比。
   * @defaultValue 0
   */
  percent?: number;
  /** 描边或进度条颜色。 */
  strokeColor?: string };
  /**
   * 组件尺寸；用于调整控件高度、字号和间距。
   * @defaultValue "default"
   */
  size?: "small" | "default" | number | readonly [number, number];
}

/** 进度组件。 */
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
    return <div className={`sia-progress sia-progress--${type} sia-progress--${resolved} ${className}`.trim()} style={{ width, height: width, ...style }} {...withTitleTooltip(props)}>
      <svg viewBox="0 0 100 100" role="progressbar" aria-valuenow={safe}>
        <circle className="sia-progress__trail" cx="50" cy="50" r={radius} style={{ stroke: trailColor }} />
        <circle className="sia-progress__circle" cx="50" cy="50" r={radius} style={{ stroke: color, strokeDasharray: type === "dashboard" ? `${circumference * .75} ${circumference * .25}` : circumference, strokeDashoffset: (type === "dashboard" ? circumference * .75 : circumference) - dash * (type === "dashboard" ? .75 : 1), strokeWidth }} />
      </svg>
      {showInfo ? <span className="sia-progress__text">{label}</span> : null}
    </div>;
  }
  const height = Array.isArray(size) ? size[1] : typeof size === "number" ? size : size === "small" ? 6 : strokeWidth;
  return <div className={`sia-progress sia-progress--line sia-progress--${resolved} ${className}`.trim()} style={style} {...withTitleTooltip(props)}>
    <div className="sia-progress__outer" style={{ height, backgroundColor: trailColor }}>
      {steps ? <div className="sia-progress__steps">{Array.from({ length: steps }, (_, index) => <span className={index < Math.round(steps * safe / 100) ? "is-active" : ""} style={{ background: index < Math.round(steps * safe / 100) ? background : trailColor }} key={index} />)}</div>
        : <><span className="sia-progress__bar" style={{ width: `${safe}%`, background }} />{success?.percent ? <span className="sia-progress__success" style={{ width: `${success.percent}%`, background: success.strokeColor }} /> : null}</>}
    </div>
    {showInfo ? <span className="sia-progress__info">{label}</span> : null}
  </div>;
}

/** 加载指示器的属性配置。 */
export interface SpinProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 是否显示加载指示器。
   * @defaultValue true
   */
  spinning?: boolean;
  /**
   * 组件尺寸；用于调整控件高度、字号和间距。
   * @defaultValue "default"
   */
  size?: "small" | "default" | "large";
  /** 加载说明文本 */
  tip?: ReactNode;
  /** 自定义加载指示器。 */
  indicator?: ReactNode;
  /**
   * 显示加载状态前的延迟时间。
   * @defaultValue 0
   */
  delay?: number;
  /**
   是否以全屏形式展示。
   * @defaultValue false
   */
  fullscreen?: boolean;
}
/** 加载指示器组件；等待 delay 后以 180ms 淡入，停止时沿相同轨迹反向淡出并卸载，减少动态效果时直接切换。 */
export function Spin({ spinning = true, size = "default", tip, indicator, delay = 0, fullscreen = false, className = "", children, ...props }: SpinProps) {
  const [visible, setVisible] = useState(delay === 0 && spinning);
  const motionRef = useRef<HTMLDivElement>(null);
  const motion = useOverlayMotion(visible, motionRef, "fade");
  useEffect(() => {
    if (!spinning) { setVisible(false); return; }
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay, spinning]);
  const spinner = motion.present ? <div ref={!fullscreen && !children ? motionRef : undefined} className={`sia-spin sia-spin--${size}`} role="status" aria-live="polite">{indicator ?? <span className="sia-spin__indicator"><i /><i /><i /><i /></span>}{tip ? <span className="sia-spin__tip">{tip}</span> : null}</div> : null;
  if (fullscreen) return motion.present && typeof document !== "undefined" ? createPortal(<div ref={motionRef} className="sia-spin-fullscreen" style={{ pointerEvents: visible ? undefined : "none" }}>{spinner}</div>, document.body) : null;
  if (!children) return <div className={`sia-spin-wrap ${className}`.trim()} {...withTitleTooltip(props)}>{spinner}</div>;
  return <div className={`sia-spin-container${visible ? " is-spinning" : ""} ${className}`.trim()} {...withTitleTooltip(props)}>{children}{motion.present ? <div ref={motionRef} className="sia-spin-mask" style={{ pointerEvents: visible ? undefined : "none" }}>{spinner}</div> : null}</div>;
}

/** 水印文字的字体、颜色和对齐配置。 */
export interface WatermarkFont {
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 文字大小，单位为像素。 */
  fontSize?: number;
  /** 文字粗细，可使用数字或 CSS 字重名称。 */
  fontWeight?: number | string;
  /** 字体族名称。 */
  fontFamily?: string;
  /** 字体样式，例如 normal 或 italic。 */
  fontStyle?: string;
  /** 文本的水平对齐方式。 */
  textAlign?: CanvasTextAlign }
/** 水印的属性配置。 */
export interface WatermarkProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
  /**
   需要显示的内容，支持文本或 React 节点。
   * @defaultValue "Sia Web UI"
   */
  content?: string | readonly string[];
  /** 图片资源配置。 */
  image?: string;
  /**
   * 宽度；数值按像素处理，字符串可使用 CSS 尺寸。
   * @defaultValue 120
   */
  width?: number;
  /**
   * 高度；数值按像素处理，字符串可使用 CSS 尺寸。
   * @defaultValue 64
   */
  height?: number;
  /**
   * 旋转角度。
   * @defaultValue -22
   */
  rotate?: number;
  /**
   组件或浮层的堆叠层级。
   * @defaultValue 9
   */
  zIndex?: number;
  /**
   * 预设或自定义间距
   * @defaultValue [100, 100]
   */
  gap?: readonly [number, number];
  /**
   * 相对于默认位置的偏移。
   * @defaultValue [0, 0]
   */
  offset?: readonly [number, number];
  /** 颜色、字号、字重与字体 */
  font?: WatermarkFont;
}
function escapeXml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]!)); }
/** 水印组件。 */
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
  return <div className={`sia-watermark ${className}`.trim()} {...withTitleTooltip(props)}>{children}<div className="sia-watermark__layer" aria-hidden="true" style={{ zIndex, backgroundImage: background }} /></div>;
}

/** Notification的类型标识。 */
export type NotificationType = "info" | "success" | "warning" | "error";
/** Notification的位置类型。 */
export type NotificationPlacement = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
/** Notification的配置。 */
export interface NotificationConfig {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key?: string | number;
  /** 类型标识，用于选择对应的表现形式。 */
  type?: NotificationType;
  /** 提示或错误消息文本。 */
  message: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode;
  /** 自动关闭延迟，单位为秒；0 表示不自动关闭。 */
  duration?: number;
  /** 相对于触发元素的弹出方向和对齐位置。 */
  placement?: NotificationPlacement;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 消息或通知的自定义操作按钮。 */
  btn?: ReactNode;
  /** 自定义关闭图标。 */
  closeIcon?: ReactNode;
  /** 元素的无障碍语义角色。 */
  role?: string;
  /** 点击时触发，参数为当前点击事件或项目上下文。 */
  onClick?: () => void;
  /** 请求关闭时同步触发一次，通知在弹性回弹退场完成后移除；重复关闭不重复触发。 */
  onClose?: () => void;
}
type NotificationEntry = NotificationConfig & { key: string | number; closing?: boolean };
const notificationListeners = new Set<(entries: NotificationEntry[]) => void>();
let notificationEntries: NotificationEntry[] = [];
let notificationSeed = 0;
let notificationHost: HTMLDivElement | null = null;
const notificationTimers = new Map<string | number, number>();
function emitNotifications() { notificationListeners.forEach((listener) => listener([...notificationEntries])); }
function closeNotification(key: string | number) {
  const entry = notificationEntries.find((item) => item.key === key);
  if (!entry || entry.closing) return;
  notificationEntries = notificationEntries.map(item => item.key === key ? { ...item, closing: true } : item);
  window.clearTimeout(notificationTimers.get(key)); notificationTimers.delete(key); emitNotifications(); entry?.onClose?.();
}
/** 通知正文保留至退场结束；同 key 重开时由动效层取消旧退场。 */
function NotificationNotice({ item }: { item: NotificationEntry }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useOverlayMotion(!item.closing, ref, "message");
  useEffect(() => {
    if (motion.present || !item.closing) return;
    notificationEntries = notificationEntries.filter(candidate => candidate.key !== item.key || !candidate.closing);
    emitNotifications();
  }, [motion.present, item.key, item.closing]);
  if (!motion.present) return null;
  return <div ref={ref} style={{ animation: "none", pointerEvents: item.closing ? "none" : undefined }} aria-hidden={item.closing || undefined} className={`sia-notification__notice sia-notification__notice--${item.type ?? "info"}`} role={item.role ?? "alert"} onClick={item.onClick}>
    <span className="sia-notification__icon">{item.icon ?? <Icon name={item.type === "success" ? "circle-check" : item.type === "warning" ? "warning" : item.type === "error" ? "circle-close" : "info"} variant="filled" />}</span>
    <div><strong>{item.message}</strong>{item.description ? <p>{item.description}</p> : null}{item.btn}</div>
    <button type="button" aria-label="关闭通知" onClick={(event) => { event.stopPropagation(); closeNotification(item.key); }}>{item.closeIcon ?? <Icon name="close" size={14} />}</button>
  </div>;
}
function NotificationHost() {
  const [entries, setEntries] = useState(notificationEntries);
  useEffect(() => { notificationListeners.add(setEntries); return () => { notificationListeners.delete(setEntries); }; }, []);
  const placements: NotificationPlacement[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"];
  return <>{placements.map((placement) => <div className={`sia-notification sia-notification--${placement}`} key={placement}>
    {entries.filter((item) => (item.placement ?? "topRight") === placement).map((item) => <NotificationNotice item={item} key={item.key} />)}
  </div>)}</>;
}
function ensureNotificationHost() {
  if (typeof document === "undefined" || notificationHost) return;
  notificationHost = document.createElement("div"); notificationHost.dataset.siaNotificationHost = "";
  document.body.appendChild(notificationHost); createRoot(notificationHost).render(<NotificationHost />);
}
function openNotification(config: NotificationConfig): {
  /** 通知唯一标识，可传给 notification.destroy 关闭指定通知。 */
  key: string | number;
  /** 关闭本条通知。 */
  close: () => void;
} {
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
/** 全局通知 API，支持标题、说明、自定义操作及弹性回弹开合；退场完成后移除通知。 */
export const notification = {
  /** 直接打开实例，返回可用于更新或关闭的操作句柄。 */
  open: openNotification,
  /** 显示普通信息提示。 */
  info: (config: Omit<NotificationConfig, "type">) => openNotification({ ...config, type: "info" }),
  /** 显示成功提示。 */
  success: (config: Omit<NotificationConfig, "type">) => openNotification({ ...config, type: "success" }),
  /** 显示警告提示。 */
  warning: (config: Omit<NotificationConfig, "type">) => openNotification({ ...config, type: "warning" }),
  /** 显示错误提示。 */
  error: (config: Omit<NotificationConfig, "type">) => openNotification({ ...config, type: "error" }),
  /** 关闭指定实例；未指定标识时关闭所有实例。 */
  destroy: (key?: string | number) => {
    if (key !== undefined) closeNotification(key);
    else { [...notificationEntries].forEach((item) => closeNotification(item.key)); }
  },
};

/** 操作引导的一步，定义目标元素、说明及操作按钮。 */
export interface TourStep {
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode;
  /** 顶部封面内容。 */
  cover?: ReactNode;
  /** 关联的目标元素或获取目标元素的函数。 */
  target?: HTMLElement | null | (() => HTMLElement | null);
  /** 相对于触发元素的弹出方向和对齐位置。 */
  placement?: FloatingPlacement | "center";
  /** 下一步按钮的属性。 */
  nextButtonProps?: React.ComponentProps<typeof Button> & {
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode };
  /** 上一步按钮的属性。 */
  prevButtonProps?: React.ComponentProps<typeof Button> & {
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode };
}
/** 操作引导的属性配置。 */
export interface TourProps {
  /**
   * 是否打开；传入后由外部控制显示状态。
   * @defaultValue false
   */
  open?: boolean;
  /** 步骤集合或进度分段配置。 */
  steps: readonly TourStep[];
  /** 当前引导步骤索引，从 0 开始。 */
  current?: number;
  /**
   * 非受控模式的初始页码或步骤位置。
   * @defaultValue 0
   */
  defaultCurrent?: number;
  /**
   * 遮罩是否显示或自定义遮罩内容。
   * @defaultValue true
   */
  mask?: boolean;
  /**
   * 是否显示关闭入口。
   * @defaultValue true
   */
  closable?: boolean;
  /**
   * 加载期间是否阻止与内容交互。
   * @defaultValue false
   */
  disabledInteraction?: boolean;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (current: number) => void;
  /** 请求关闭时触发的回调。 */
  onClose?: (current: number) => void;
  /** 流程完成或表单校验通过并提交时调用。 */
  onFinish?: () => void;
}
/** 操作引导组件；整体以 180ms 淡入，关闭时按相同轨迹反播后卸载，减少动态效果时直接切换。 */
export function Tour({ open = false, steps, current, defaultCurrent = 0, mask = true, closable = true, disabledInteraction = false, onChange, onClose, onFinish }: TourProps) {
  const [index, setIndex] = useControllableState({ value: current, defaultValue: defaultCurrent, onChange });
  const [, force] = useState(0);
  const motionRef = useRef<HTMLDivElement>(null);
  const motion = useOverlayMotion(open, motionRef, "fade");
  useEffect(() => {
    if (!open) return;
    const update = () => force((value) => value + 1);
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open]);
  if (!motion.present || !steps[index] || typeof document === "undefined") return null;
  const step = steps[index];
  const target = typeof step.target === "function" ? step.target() : step.target;
  const rect = target?.getBoundingClientRect();
  const placement = step.placement ?? (rect ? "bottom" : "center");
  const panelStyle: CSSProperties = placement === "center" || !rect ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
    : placement.startsWith("bottom") ? { top: rect.bottom + 14, left: rect.left + rect.width / 2, transform: "translateX(-50%)" }
      : placement.startsWith("top") ? { top: rect.top - 14, left: rect.left + rect.width / 2, transform: "translate(-50%, -100%)" }
        : placement === "left" ? { top: rect.top + rect.height / 2, left: rect.left - 14, transform: "translate(-100%, -50%)" }
          : { top: rect.top + rect.height / 2, left: rect.right + 14, transform: "translateY(-50%)" };
  return createPortal(<div ref={motionRef} className="sia-tour" role="dialog" aria-modal="true" {...(!open ? { inert: "" } : {})}>
    {mask && !rect ? <div className="sia-tour__mask" /> : null}
    {rect ? <div className="sia-tour__target" style={{ top: rect.top - 5, left: rect.left - 5, width: rect.width + 10, height: rect.height + 10, pointerEvents: disabledInteraction ? "auto" : "none", boxShadow: mask ? "0 0 0 5px var(--sia-color-surface), 0 0 0 9999px rgb(0 0 0 / 46%)" : "0 0 0 5px var(--sia-color-surface)" }} /> : null}
    <div className="sia-tour__panel" style={panelStyle}>
      {closable ? <button className="sia-tour__close" aria-label="关闭引导" onClick={() => onClose?.(index)}><Icon name="close" size={14} /></button> : null}
      {step.cover}<strong>{step.title}</strong>{step.description ? <div className="sia-tour__description">{step.description}</div> : null}
      <footer><span>{index + 1} / {steps.length}</span><div>{index > 0 ? <Button size="small" {...step.prevButtonProps} onClick={() => setIndex(index - 1)}>{step.prevButtonProps?.children ?? "上一步"}</Button> : null}<Button size="small" variant="primary" {...step.nextButtonProps} onClick={() => { if (index >= steps.length - 1) onFinish?.(); else setIndex(index + 1); }}>{step.nextButtonProps?.children ?? (index >= steps.length - 1 ? "完成" : "下一步")}</Button></div></footer>
    </div>
  </div>, document.body);
}

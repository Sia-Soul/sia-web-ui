import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Icon } from "./Icon";
import { useOverlayMotion } from "./overlayMotion";

/** 全局消息的类型标识。 */
export type MessageType = "info" | "success" | "warning" | "error" | "loading";
/** 全局消息的唯一标识，用于更新或关闭已有消息。 */
export type MessageKey = string | number;

/** 全局消息的配置。 */
export interface MessageConfig {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key?: MessageKey;
  /** 消息类型；信息、成功、警告和错误使用实心状态图标，loading 使用旋转加载图标。 */
  type?: MessageType;
  /** 消息正文，支持文本或 React 节点。 */
  content: ReactNode;
  /** 自动关闭延迟，单位为秒；0 表示不自动关闭。 */
  duration?: number;
  /** 是否显示关闭入口。 */
  closable?: boolean;
  /** 请求关闭时同步触发一次；消息退场完成后移除 DOM，重复关闭不重复触发。 */
  onClose?: () => void;
}

/** 全局消息的操作句柄。 */
export interface MessageHandle {
  /** 开始关闭消息，弹性回弹退场完成后移除；重复调用不重复触发 onClose。 */
  close: () => void;
  /** 局部更新当前实例配置，未传入的字段保持原值。 */
  update: (next: Partial<MessageConfig>) => void;
}

interface MessageItem extends MessageConfig {
  key: MessageKey;
  type: MessageType;
  closing?: boolean;
}

let messageSeed = 0;
let messageRoot: Root | null = null;
let messageContainer: HTMLDivElement | null = null;
let messageItems: MessageItem[] = [];
let defaultDuration = 3;
let maxCount = 5;
const messageTimers = new Map<MessageKey, number>();

// 提示状态优先使用框架实心图标；关闭及加载等操作图标保持各自语义。
const messageIcons: Record<MessageType, ReactNode> = {
  info: <Icon name="info" size={18} variant="filled" />,
  success: <Icon name="circle-check" size={18} variant="filled" />,
  warning: <Icon name="warning" size={18} variant="filled" />,
  error: <Icon name="circle-close" size={18} variant="filled" />,
  loading: <Icon name="loader" size={18} spin />,
};

function ensureMessageRoot() {
  if (typeof document === "undefined") return false;
  if (!messageContainer) {
    messageContainer = document.createElement("div");
    messageContainer.className = "sia-message-root";
    document.body.appendChild(messageContainer);
    messageRoot = createRoot(messageContainer);
  }
  return true;
}

/** 关闭后保留消息直到退场完成，重复关闭不会再次触发业务回调。 */
function MessageView({ item }: { item: MessageItem }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useOverlayMotion(!item.closing, ref, "toast", "bottom", true, (open) => {
    if (open) return;
    messageItems = messageItems.filter(candidate => candidate.key !== item.key || !candidate.closing);
    renderMessages();
  });
  useEffect(() => {
    // 创建后同一任务立即关闭时无需退场，但仍要释放尚未挂载的消息记录。
    if (motion.present || !item.closing) return;
    messageItems = messageItems.filter(candidate => candidate.key !== item.key || !candidate.closing);
    renderMessages();
  }, [motion.present, item.key, item.closing]);
  if (!motion.present) return null;
  return <div ref={ref} style={{ animation: "none", pointerEvents: item.closing ? "none" : undefined }} aria-hidden={item.closing || undefined} className={`sia-message sia-message--${item.type}`} role={item.type === "loading" ? "status" : "alert"}>
    <span className="sia-message__icon" aria-hidden="true">{messageIcons[item.type]}</span>
    <span className="sia-message__content">{item.content}</span>
    {item.closable ? <button type="button" className="sia-message__close" aria-label="关闭提示" onClick={() => closeMessage(item.key)}><Icon name="close" size={14} /></button> : null}
  </div>;
}

function renderMessages() {
  if (!ensureMessageRoot()) return;
  messageRoot!.render(<div className="sia-message-list" aria-live="polite">
    {messageItems.map((item) => <MessageView item={item} key={item.key} />)}
  </div>);
}

function closeMessage(key: MessageKey, immediate = false) {
  const item = messageItems.find((candidate) => candidate.key === key);
  if (!item || item.closing) return;
  const timer = messageTimers.get(key);
  if (timer !== undefined) window.clearTimeout(timer);
  messageTimers.delete(key);
  messageItems = immediate ? messageItems.filter(candidate => candidate.key !== key) : messageItems.map(candidate => candidate.key === key ? { ...candidate, closing: true } : candidate);
  item?.onClose?.();
  renderMessages();
}

function scheduleMessage(item: MessageItem) {
  const existingTimer = messageTimers.get(item.key);
  if (existingTimer !== undefined) window.clearTimeout(existingTimer);
  const duration = item.duration ?? (item.type === "loading" ? 0 : defaultDuration);
  if (duration > 0) {
    messageTimers.set(item.key, window.setTimeout(() => closeMessage(item.key), duration * 1000));
  }
}

function openMessage(input: ReactNode | MessageConfig): MessageHandle {
  const config: MessageConfig = typeof input === "object" && input !== null && "content" in input
    ? input as MessageConfig
    : { content: input };
  const key = config.key ?? `sia-message-${++messageSeed}`;
  const item: MessageItem = { ...config, key, type: config.type ?? "info" };
  const existingIndex = messageItems.findIndex((candidate) => candidate.key === key);
  if (existingIndex >= 0) messageItems = messageItems.map((candidate, index) => index === existingIndex ? item : candidate);
  else messageItems = [...messageItems, item];
  // 超出容量时优先立即移除最旧条目，避免保留退场节点导致淘汰循环不收敛。
  messageItems = messageItems.filter(candidate => !candidate.closing);
  while (messageItems.length > maxCount) closeMessage(messageItems[0].key, true);
  renderMessages();
  scheduleMessage(item);

  return {
    close: () => closeMessage(key),
    update(next) {
      const current = messageItems.find((candidate) => candidate.key === key);
      if (!current || current.closing) return;
      const updated = { ...current, ...next, key, type: next.type ?? current.type };
      messageItems = messageItems.map((candidate) => candidate.key === key ? updated : candidate);
      renderMessages();
      scheduleMessage(updated);
    },
  };
}

function shortcut(type: MessageType) {
  return (content: ReactNode, duration?: number) => openMessage({ content, duration, type });
}

/** 全局消息 API，短提示的背景以弹性形变开合，正文和图标只位移与淡入淡出、保持原始尺寸；关闭时保留节点直到退场完成，可通过句柄更新或关闭。 */
export const message = {
  /** 直接打开实例，返回可用于更新或关闭的操作句柄。 */
  open: openMessage,
  /** 显示普通信息提示。 */
  info: shortcut("info"),
  /** 显示成功提示。 */
  success: shortcut("success"),
  /** 显示警告提示。 */
  warning: shortcut("warning"),
  /** 显示错误提示。 */
  error: shortcut("error"),
  /** 显示持续加载提示。 */
  loading: shortcut("loading"),
  /** 关闭指定实例；未指定标识时关闭所有实例。 */
  destroy(key?: MessageKey) {
    if (key !== undefined) {
      closeMessage(key);
      return;
    }
    [...messageItems].forEach((item) => closeMessage(item.key));
  },
  /** 配置消息默认持续时间和最大同时显示数量。 */
  config(config: {
    /** 默认自动关闭时间，单位为秒；0 表示不自动关闭。 */
    duration?: number;
    /** 同时显示的最大消息数量。 */
    maxCount?: number;
  }) {
    if (config.duration !== undefined) defaultDuration = config.duration;
    if (config.maxCount !== undefined) maxCount = Math.max(1, config.maxCount);
  },
};

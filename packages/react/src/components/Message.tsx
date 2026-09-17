import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Icon } from "./Icon";

/** 全局消息的类型标识。 */
export type MessageType = "info" | "success" | "warning" | "error" | "loading";
/** 全局消息的唯一标识，用于更新或关闭已有消息。 */
export type MessageKey = string | number;

/** 全局消息的配置。 */
export interface MessageConfig {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key?: MessageKey;
  /** 类型标识，用于选择对应的表现形式。 */
  type?: MessageType;
  /** 消息正文，默认字号为 14px；支持文本或 React 节点，自定义节点可自行设置字号。 */
  content: ReactNode;
  /** 自动关闭延迟，单位为秒；0 表示不自动关闭。 */
  duration?: number;
  /** 是否显示关闭入口。 */
  closable?: boolean;
  /** 请求关闭时触发的回调。 */
  onClose?: () => void;
}

/** 全局消息的操作句柄。 */
export interface MessageHandle {
  /** 关闭当前界面或实例。 */
  close: () => void;
  /** 局部更新当前实例配置，未传入的字段保持原值。 */
  update: (next: Partial<MessageConfig>) => void;
}

interface MessageItem extends MessageConfig {
  key: MessageKey;
  type: MessageType;
}

let messageSeed = 0;
let messageRoot: Root | null = null;
let messageContainer: HTMLDivElement | null = null;
let messageItems: MessageItem[] = [];
let defaultDuration = 3;
let maxCount = 5;
const messageTimers = new Map<MessageKey, number>();

const messageIcons: Record<MessageType, ReactNode> = {
  info: <Icon name="info" size={18} />,
  success: <Icon name="circle-check" size={18} />,
  warning: <Icon name="warning" size={18} />,
  error: <Icon name="circle-close" size={18} />,
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

function renderMessages() {
  if (!ensureMessageRoot()) return;
  messageRoot!.render(<div className="sia-message-list" aria-live="polite">
    {messageItems.map((item) => <div className={`sia-message sia-message--${item.type}`} key={item.key} role={item.type === "loading" ? "status" : "alert"}>
      <span className="sia-message__icon" aria-hidden="true">{messageIcons[item.type]}</span>
      <span className="sia-message__content">{item.content}</span>
      {item.closable ? <button type="button" className="sia-message__close" aria-label="关闭提示" onClick={() => closeMessage(item.key)}><Icon name="close" size={14} /></button> : null}
    </div>)}
  </div>);
}

function closeMessage(key: MessageKey) {
  const item = messageItems.find((candidate) => candidate.key === key);
  const timer = messageTimers.get(key);
  if (timer !== undefined) window.clearTimeout(timer);
  messageTimers.delete(key);
  messageItems = messageItems.filter((candidate) => candidate.key !== key);
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
  while (messageItems.length > maxCount) closeMessage(messageItems[0].key);
  renderMessages();
  scheduleMessage(item);

  return {
    close: () => closeMessage(key),
    update(next) {
      const current = messageItems.find((candidate) => candidate.key === key);
      if (!current) return;
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

/** 全局消息 API，可直接显示成功、错误、警告等短提示，并通过句柄关闭。 */
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

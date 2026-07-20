import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Icon } from "./Icon";

export type MessageType = "info" | "success" | "warning" | "error" | "loading";
export type MessageKey = string | number;

export interface MessageConfig {
  key?: MessageKey;
  type?: MessageType;
  content: ReactNode;
  duration?: number;
  closable?: boolean;
  onClose?: () => void;
}

export interface MessageHandle {
  close: () => void;
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

export const message = {
  open: openMessage,
  info: shortcut("info"),
  success: shortcut("success"),
  warning: shortcut("warning"),
  error: shortcut("error"),
  loading: shortcut("loading"),
  destroy(key?: MessageKey) {
    if (key !== undefined) {
      closeMessage(key);
      return;
    }
    [...messageItems].forEach((item) => closeMessage(item.key));
  },
  config(config: { duration?: number; maxCount?: number }) {
    if (config.duration !== undefined) defaultDuration = config.duration;
    if (config.maxCount !== undefined) maxCount = Math.max(1, config.maxCount);
  },
};

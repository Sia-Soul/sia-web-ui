import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

/** 自适应容器的实测尺寸，单位为 CSS 像素。 */
export interface AutoSizerSize {
  /** 容器内容区宽度，隐藏时为零。 */
  width: number;
  /** 容器内容区高度，隐藏时为零。 */
  height: number;
}
/** 填充具有明确宽高的父容器，并向内容提供可用尺寸。 */
export interface AutoSizerProps {
  /** 按实测内容区尺寸渲染；隐藏或尚未测量时不渲染，重新显示后自动恢复。 */
  children: (size: AutoSizerSize) => ReactNode;
}
/** 将尺寸监听集中在框架内，适用于需要像素坐标的图表等内容。 */
export function AutoSizer({ children }: AutoSizerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<AutoSizerSize>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div className="sia-auto-sizer" ref={ref}><div className="sia-auto-sizer__content">{size.width > 0 && size.height > 0 ? children(size) : null}</div></div>;
}

/** 非模态任务浮层配置，不管理业务任务或轮询。 */
export interface FloatingPanelProps {
  /** 是否显示；关闭时卸载内容，不显示遮罩，也不抢夺焦点。 */
  open: boolean;
  /** 浮层可访问名称，同时作为标题展示。 */
  title: string;
  /** 任务状态或进度内容。 */
  children: ReactNode;
  /** 固定在视口的角落。@defaultValue "bottomRight" */
  placement?: "bottomRight" | "bottomLeft" | "topRight" | "topLeft";
}
/** 使用框架默认外观展示持续任务；挂载到 body，避免被业务容器裁剪。 */
export function FloatingPanel({ open, title, children, placement = "bottomRight" }: FloatingPanelProps) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(<section className={`sia-floating-panel sia-floating-panel--${placement}`} aria-label={title} role="status">
    <strong className="sia-floating-panel__title">{title}</strong>{children}
  </section>, document.body);
}

/** 排序列表的稳定标识。 */
export type SortableKey = string | number;
/** 受控排序列表；只通知顺序，不保存业务数据。 */
export interface SortableListProps {
  /** 按当前顺序排列的唯一稳定标识，不允许重复。 */
  items: readonly SortableKey[];
  /** 根据标识渲染条目内容；第三个参数为框架手柄，handlePlacement="custom" 时须将其放入标题等位置；拖动和键盘排序仅由该手柄发起。 */
  renderItem: (key: SortableKey, index: number, handle: ReactNode) => ReactNode;
  /** 手柄位置；before 在条目前独占一行，custom 由 renderItem 放置框架提供的手柄。@defaultValue "before" */
  handlePlacement?: "before" | "custom";
  /** 手柄的内容，接收稳定标识和当前位置；未指定时显示拖动图标，可返回卡片标题文字。 */
  handleContent?: (key: SortableKey, index: number) => ReactNode;
  /** 拖放或手柄方向键完成移动时返回新顺序；无变化、取消、禁用时不触发。 */
  onOrderChange: (items: SortableKey[]) => void;
  /** 排列方向；横向内容超出时在列表内滚动。@defaultValue "horizontal" */
  direction?: "horizontal" | "vertical";
  /** 禁止拖放和键盘排序，不禁用条目内部业务控件。@defaultValue false */
  disabled?: boolean;
}
/** 拖放与键盘共用受控顺序，输入控件无需参与拖动事件。 */
export function SortableList({ items, renderItem, onOrderChange, direction = "horizontal", disabled = false, handlePlacement = "before", handleContent }: SortableListProps) {
  const [dragging, setDragging] = useState<SortableKey | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const clear = () => { setDragging(null); setTarget(null); };
  const move = (key: SortableKey, insertion: number) => {
    const from = items.indexOf(key);
    if (disabled || from < 0) return;
    const to = Math.max(0, Math.min(items.length - 1, insertion > from ? insertion - 1 : insertion));
    if (to === from) return;
    const next = [...items];
    next.splice(from, 1); next.splice(to, 0, key);
    onOrderChange(next);
  };
  // 禁用、外部删除正在拖动项时立即清理，避免迟到的 drop 改动新数据。
  useEffect(() => { if (disabled || (dragging !== null && !items.includes(dragging))) clear(); }, [disabled, dragging, items]);
  return <div className={`sia-sortable-list sia-sortable-list--${direction}`} role="list" onDragLeave={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
  }}>
    {items.map((key, index) => {
      // 自定义位置复用同一个手柄实现，保证鼠标、键盘和禁用行为完全一致。
      const handle = <button type="button" className={`sia-sortable-list__handle${handlePlacement === "custom" ? " sia-sortable-list__handle--custom" : ""}`} draggable={!disabled} disabled={disabled} aria-label={`调整第 ${index + 1} 项顺序`} title="拖动排序，或使用方向键移动"
        onDragStart={event => { if (disabled) { event.preventDefault(); return; } setDragging(key); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(key)); }}
        onDragEnd={clear} onKeyDown={event => {
          const previous = direction === "horizontal" ? "ArrowLeft" : "ArrowUp";
          const next = direction === "horizontal" ? "ArrowRight" : "ArrowDown";
          if (event.key === previous || event.key === next) { event.preventDefault(); move(key, event.key === previous ? index - 1 : index + 2); }
        }}>{handleContent ? handleContent(key, index) : <Icon name="menu" size={16} />}</button>;
      return <div role="listitem" key={key} className={`sia-sortable-list__item${dragging === key ? " is-dragging" : ""}${target === index ? " is-drop-before" : ""}${target === items.length && index === items.length - 1 ? " is-drop-after" : ""}`}
      onDragOver={event => {
        if (disabled || dragging === null) return;
        event.preventDefault(); event.dataTransfer.dropEffect = "move";
        const rect = event.currentTarget.getBoundingClientRect();
        setTarget(index + (direction === "horizontal" ? Number(event.clientX > rect.left + rect.width / 2) : Number(event.clientY > rect.top + rect.height / 2)));
      }} onDrop={event => { if (dragging === null || disabled) return; event.preventDefault(); if (target !== null) move(dragging, target); clear(); }}>
      {handlePlacement === "before" ? handle : null}
      {renderItem(key, index, handle)}
    </div>; })}
  </div>;
}

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useOverlayMotion } from "./overlayMotion";

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
  /** 是否显示；入场以 180ms 淡入，关闭沿同一轨迹反播后卸载内容。减少动态效果时直接切换，不显示遮罩，也不抢夺焦点。 */
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
  const ref = useRef<HTMLElement>(null);
  const motion = useOverlayMotion(open, ref, "fade");
  if (!motion.present || typeof document === "undefined") return null;
  return createPortal(<section ref={ref} className={`sia-floating-panel sia-floating-panel--${placement}`} aria-label={title} role="status" {...(!open ? { inert: "" } : {})}>
    <strong className="sia-floating-panel__title">{title}</strong>{children}
  </section>, document.body);
}

/** 排序列表的稳定标识。 */
export type SortableKey = string | number;
/** 受控排序列表；只通知顺序，不保存业务数据。 */
export interface SortableListProps {
  /** 按当前顺序排列的唯一稳定标识，不允许重复。 */
  items: readonly SortableKey[];
  /** 根据标识和已提交索引渲染内容；第三个参数为框架手柄，custom 模式须放入标题等位置。拖动预览只移动原节点，不重挂载或提前改变索引，输入草稿保持。 */
  renderItem: (key: SortableKey, index: number, handle: ReactNode) => ReactNode;
  /** 手柄位置；before 在条目前独占一行，custom 由 renderItem 放置框架提供的手柄。@defaultValue "before" */
  handlePlacement?: "before" | "custom";
  /** 手柄的内容，接收稳定标识和当前位置；未指定时显示拖动图标，可返回卡片标题文字。 */
  handleContent?: (key: SortableKey, index: number) => ReactNode;
  /** 指针在列表内松手并完成 160ms 吸附动画后，或手柄方向键移动后，返回一次新顺序，调用方须回填 items。减少动态效果时立即提交；预览、原位放下、Esc/列表外取消、禁用、外部顺序变化均不触发，不等待回调返回值。 */
  onOrderChange: (items: SortableKey[]) => void;
  /** 排列及拖动轴；按轴移动至少 4px 开始预览，相邻项以 180ms 让位，靠近列表滚动边缘自动滚动。仅由手柄发起，不影响内部输入；减少动态效果时相邻项直接定位。@defaultValue "horizontal" */
  direction?: "horizontal" | "vertical";
  /** 禁止拖放和键盘排序，不禁用条目内部业务控件。@defaultValue false */
  disabled?: boolean;
}
/** 拖放与键盘共用受控顺序；指针预览不重挂载内容，也不改变 renderItem 的业务索引。 */
export function SortableList({ items, renderItem, onOrderChange, direction = "horizontal", disabled = false, handlePlacement = "before", handleContent }: SortableListProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ items, onOrderChange });
  latest.current = { items, onOrderChange };
  const startRef = useRef<(event: PointerEvent, key: SortableKey, handle: HTMLButtonElement) => void>(() => {});
  // 相同顺序的父级重渲染不打断拖动；真正的外部顺序变化必须废弃旧预览。
  const signature = JSON.stringify(items);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const horizontal = direction === "horizontal";
    let session: {
      key: SortableKey; pointer: number; handle: HTMLButtonElement; keys: SortableKey[];
      nodes: HTMLElement[]; rects: DOMRect[]; from: number; to: number;
      start: number; clientX: number; clientY: number; scroll: number; active: boolean;
    } | null = null;
    let frame = 0;
    let settling: Animation | null = null;
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clear = () => {
      cancelAnimationFrame(frame);
      settling?.cancel(); settling = null;
      const previous = session; session = null;
      root.classList.remove("is-sorting");
      previous?.nodes.forEach(node => {
        node.classList.remove("is-dragging");
        node.style.removeProperty("transform");
        node.style.removeProperty("transition");
      });
      if (placeholderRef.current) placeholderRef.current.hidden = true;
      if (previous?.handle.hasPointerCapture(previous.pointer)) previous.handle.releasePointerCapture(previous.pointer);
    };
    const displacement = (s: NonNullable<typeof session>) => {
      const start = (r: DOMRect) => horizontal ? r.left : r.top;
      const length = (r: DOMRect) => horizontal ? r.width : r.height;
      const indices = s.keys.map((_, index) => index);
      indices.splice(s.from, 1); indices.splice(s.to, 0, s.from);
      const gap = Number.parseFloat(getComputedStyle(root).gap) || 0;
      let cursor = start(s.rects[0]);
      const offsets = s.rects.map(() => 0);
      indices.forEach(index => { offsets[index] = cursor - start(s.rects[index]); cursor += length(s.rects[index]) + gap; });
      return offsets;
    };
    const transform = (offset: number) => horizontal ? `translate3d(${offset}px, 0, 0)` : `translate3d(0, ${offset}px, 0)`;
    const paint = () => {
      const s = session;
      if (!s || !s.active || settling) return;
      const bounds = root.getBoundingClientRect();
      const coordinate = horizontal ? s.clientX : s.clientY;
      const scroll = horizontal ? root.scrollLeft : root.scrollTop;
      const origin = s.rects[s.from];
      const first = s.rects[0];
      const last = s.rects[s.rects.length - 1];
      // 限制在原内容范围内，避免变换撑大滚动宽度后边缘自动滚动无限延伸。
      const minimum = horizontal ? first.left - origin.left : first.top - origin.top;
      const maximum = horizontal ? last.right - origin.right : last.bottom - origin.bottom;
      const delta = Math.max(minimum, Math.min(maximum, coordinate - s.start + scroll - s.scroll));
      const center = (horizontal ? origin.left + origin.width / 2 : origin.top + origin.height / 2) + delta;
      // 使用未变换的初始几何判断落点，避免相邻项让位过程中反复抖动。
      s.to = s.rects.filter((rect, index) => index !== s.from && center > (horizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2)).length;
      const offsets = displacement(s);
      s.nodes.forEach((node, index) => { node.style.transform = transform(index === s.from ? delta : offsets[index]); });
      const preview = placeholderRef.current;
      if (preview) {
        preview.hidden = false;
        preview.style.width = `${origin.width}px`;
        preview.style.height = `${origin.height}px`;
        preview.style.left = `${origin.left - bounds.left + root.scrollLeft - (horizontal ? scroll - s.scroll : 0) + (horizontal ? offsets[s.from] : 0)}px`;
        preview.style.top = `${origin.top - bounds.top + root.scrollTop - (!horizontal ? scroll - s.scroll : 0) + (!horizontal ? offsets[s.from] : 0)}px`;
      }
    };
    let lastTime = 0;
    const tick = (time: number) => {
      const s = session;
      if (!s || !s.active || settling) return;
      const bounds = root.getBoundingClientRect();
      const point = horizontal ? s.clientX : s.clientY;
      const start = horizontal ? bounds.left : bounds.top;
      const end = horizontal ? bounds.right : bounds.bottom;
      const crossInside = horizontal ? s.clientY >= bounds.top && s.clientY <= bounds.bottom : s.clientX >= bounds.left && s.clientX <= bounds.right;
      // 靠近容器边缘自动滚动，按帧时间计算速度，快慢刷新率保持一致。
      const edge = 44;
      const speed = !crossInside || point < start || point > end ? 0 : point < start + edge ? -Math.min(1, (start + edge - point) / edge) : point > end - edge ? Math.min(1, (point - end + edge) / edge) : 0;
      const distance = speed * Math.min(32, time - (lastTime || time)) * .65;
      lastTime = time;
      if (horizontal) root.scrollLeft += distance; else root.scrollTop += distance;
      paint(); frame = requestAnimationFrame(tick);
    };
    startRef.current = (event, key, handle) => {
      if (disabled || event.button !== 0 || !event.isPrimary || session || settling) return;
      const keys = [...latest.current.items];
      const from = keys.indexOf(key);
      if (from < 0) return;
      const nodes = Array.from(root.children).filter(node => node.getAttribute("role") === "listitem") as HTMLElement[];
      session = { key, pointer: event.pointerId, handle, keys, nodes, rects: nodes.map(node => node.getBoundingClientRect()), from, to: from,
        start: horizontal ? event.clientX : event.clientY, clientX: event.clientX, clientY: event.clientY,
        scroll: horizontal ? root.scrollLeft : root.scrollTop, active: false };
      handle.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      const s = session;
      if (!s || settling || event.pointerId !== s.pointer) return;
      s.clientX = event.clientX; s.clientY = event.clientY;
      if (!s.active && Math.abs((horizontal ? event.clientX : event.clientY) - s.start) >= 4) {
        s.active = true;
        root.classList.add("is-sorting");
        s.nodes[s.from].classList.add("is-dragging");
        s.nodes.forEach((node, index) => { node.style.transition = index === s.from || reduced() ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1)"; });
        lastTime = 0; frame = requestAnimationFrame(tick);
      }
      if (s.active) { event.preventDefault(); paint(); }
    };
    const pointerUp = (event: PointerEvent) => {
      const s = session;
      if (!s || settling || event.pointerId !== s.pointer) return;
      const bounds = root.getBoundingClientRect();
      if (!s.active || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) { clear(); return; }
      s.clientX = event.clientX; s.clientY = event.clientY; paint();
      cancelAnimationFrame(frame);
      const finish = () => {
        if (session !== s) return;
        const next = [...s.keys]; next.splice(s.from, 1); next.splice(s.to, 0, s.key);
        const changed = s.from !== s.to;
        clear();
        if (changed) latest.current.onOrderChange(next);
      };
      // 原节点吸附到预览槽后才提交一次；不复制表单，避免重复注册和丢失输入状态。
      if (reduced()) { finish(); return; }
      const node = s.nodes[s.from];
      settling = node.animate([{ transform: node.style.transform }, { transform: transform(displacement(s)[s.from]) }], { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
      settling.finished.then(finish, () => {});
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && session) { event.preventDefault(); event.stopPropagation(); clear(); } };
    const cancelPointer = (event: PointerEvent) => { if (event.pointerId === session?.pointer && !settling) clear(); };
    const cancelClick = (event: MouseEvent) => { if (session?.active || settling) { event.preventDefault(); event.stopPropagation(); } };
    window.addEventListener("pointermove", pointerMove, { passive: false });
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", cancelPointer);
    window.addEventListener("keydown", escape, true);
    window.addEventListener("blur", clear);
    window.addEventListener("resize", clear);
    root.addEventListener("lostpointercapture", cancelPointer);
    root.addEventListener("click", cancelClick, true);
    return () => {
      clear(); startRef.current = () => {};
      window.removeEventListener("pointermove", pointerMove); window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", cancelPointer); window.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", clear); window.removeEventListener("resize", clear);
      root.removeEventListener("lostpointercapture", cancelPointer); root.removeEventListener("click", cancelClick, true);
    };
  }, [disabled, direction, signature]);
  return <div ref={rootRef} className={`sia-sortable-list sia-sortable-list--${direction}`} role="list">
    <div ref={placeholderRef} className="sia-sortable-list__placeholder" aria-hidden="true" hidden />
    {items.map((key, index) => {
      const handle = <button type="button" className={`sia-sortable-list__handle${handlePlacement === "custom" ? " sia-sortable-list__handle--custom" : ""}`} disabled={disabled} aria-label={`调整第 ${index + 1} 项顺序`} title="拖动排序，或使用方向键移动"
        onPointerDown={event => startRef.current(event.nativeEvent, key, event.currentTarget)} onDragStart={event => event.preventDefault()}
        onKeyDown={event => {
          if (rootRef.current?.classList.contains("is-sorting")) return;
          const previous = direction === "horizontal" ? "ArrowLeft" : "ArrowUp";
          const next = direction === "horizontal" ? "ArrowRight" : "ArrowDown";
          if (event.key !== previous && event.key !== next) return;
          event.preventDefault();
          const to = index + (event.key === previous ? -1 : 1);
          if (disabled || to < 0 || to >= items.length) return;
          const order = [...items]; order.splice(index, 1); order.splice(to, 0, key); onOrderChange(order);
        }}>{handleContent ? handleContent(key, index) : <Icon name="menu" size={16} />}</button>;
      return <div role="listitem" key={key} className="sia-sortable-list__item">
        {handlePlacement === "before" ? handle : null}{renderItem(key, index, handle)}
      </div>;
    })}
  </div>;
}

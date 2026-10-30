import type { CSSProperties } from "react";

/** 已显示正文的可见布局快照；只记录几何信息，不复制文字、输入值或业务 DOM。 */
export interface OverlaySkeletonLayout {
  /** 正文可见区域高度，单位 CSS px。 */
  height: number;
  /** 已裁剪到可见区域的占位矩形，位置和尺寸均为 CSS px。 */
  blocks: CSSProperties[];
}

// 将复合控件作为一个整体，避免输入框、清空按钮、字数统计被重复计为多条骨架。
const controlSelector = '.sia-input-control, .sia-textarea-control, .sia-input-number, .sia-select__trigger, .sia-switch-wrap, .sia-checkbox, .sia-radio, input, textarea, select, button, img, svg, canvas, video, [role="combobox"], [role="checkbox"], [role="radio"], [role="switch"], [contenteditable="true"], .sia-table';

/** 按可见控件和文本行采集近似骨架；限制遍历与块数量，避免重表格或长列表拖慢退出。 */
export function captureOverlaySkeleton(body: HTMLElement): OverlaySkeletonLayout {
  const bounds = body.getBoundingClientRect();
  const scaleX = body.offsetWidth ? bounds.width / body.offsetWidth : 1;
  const scaleY = body.offsetHeight ? bounds.height / body.offsetHeight : 1;
  const css = getComputedStyle(body);
  const paddingLeft = parseFloat(css.paddingLeft) || 0;
  const paddingTop = parseFloat(css.paddingTop) || 0;
  const width = Math.max(0, body.clientWidth - paddingLeft - (parseFloat(css.paddingRight) || 0));
  const height = Math.max(0, body.clientHeight - paddingTop - (parseFloat(css.paddingBottom) || 0));
  const blocks: CSSProperties[] = [];
  const addRect = (rect: DOMRect, radius: string) => {
    const x = (rect.left - bounds.left) / (scaleX || 1) - body.clientLeft - paddingLeft;
    const y = (rect.top - bounds.top) / (scaleY || 1) - body.clientTop - paddingTop;
    const left = Math.max(0, x), top = Math.max(0, y);
    const right = Math.min(width, x + rect.width / (scaleX || 1));
    const bottom = Math.min(height, y + rect.height / (scaleY || 1));
    if (right - left < 2 || bottom - top < 2 || blocks.length >= 80) return;
    blocks.push({ position: "absolute", left, top, width: right - left, height: bottom - top, borderRadius: radius });
  };
  const pending: Node[] = [];
  for (let index = Math.min(body.childNodes.length, 600) - 1; index >= 0; index--) pending.push(body.childNodes[index]!);
  let inspected = 0;
  while (pending.length && inspected++ < 600 && blocks.length < 80) {
    const node = pending.pop()!;
    if (node instanceof Element) {
      if (node.matches('script, style, [hidden], .sia-skeleton, .sia-scrollbar-track')) continue;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      if (node.matches(controlSelector)) {
        addRect(node.getBoundingClientRect(), style.borderRadius || "4px");
        continue;
      }
      // 深度优先按可见顺序处理，最多读取有限节点；大容器不一次性复制所有子节点。
      for (let index = Math.min(node.childNodes.length, 600 - inspected - pending.length) - 1; index >= 0; index--) pending.push(node.childNodes[index]!);
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects()).slice(0, 3)) addRect(rect, "4px");
    }
  }
  return { height, blocks };
}

/** 仅绘制静态几何占位，保持已显示内容的可见布局，不重新挂载业务组件。 */
export function OverlayContentSkeleton({ layout }: { /** 已缓存的关闭前正文布局。 */ layout: OverlaySkeletonLayout }) {
  return <div className="sia-skeleton sia-overlay-content-skeleton" aria-hidden="true" style={{ position: "relative", height: layout.height, overflow: "hidden" }}>
    {layout.blocks.map((style, index) => <span className="sia-skeleton__block" key={index} style={style} />)}
  </div>;
}

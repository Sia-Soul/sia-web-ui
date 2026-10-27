import type { TableCellFocusOptions } from './types';

/** 在页面最高组件层播放先增长一圈、再从尾部收拢到头部的边框光线，颜色、速度和线宽按定位配置生效。不拦截鼠标，目标消失或离开可见区即清理；调用前须确保目标已定位稳定。 */
export function playCellFocusGlow(cell: HTMLTableCellElement, isVisible: () => boolean, onFinish: () => void, options?: TableCellFocusOptions): () => void {
  const namespace = 'http://www.w3.org/2000/svg';
  const glow = document.createElementNS(namespace, 'svg');
  glow.classList.add('sia-table__cell-focus-glow');
  glow.setAttribute('aria-hidden', 'true');
  // 颜色通过公开参数传入，描边和柔光共用 currentColor；无效 CSS 颜色由浏览器忽略并回退默认值。
  if (options?.color) glow.style.color = options.color;
  // 非法数值回退默认值，并限制极端参数，避免零时长闪烁或过粗描边。
  const requestedSpeed = options?.speed, requestedWidth = options?.lineWidth;
  const speed = typeof requestedSpeed === 'number' && Number.isFinite(requestedSpeed) && requestedSpeed > 0 ? Math.min(10, Math.max(0.1, requestedSpeed)) : 1;
  const lineWidth = typeof requestedWidth === 'number' && Number.isFinite(requestedWidth) && requestedWidth > 0 ? Math.min(12, Math.max(1, requestedWidth)) : 4;
  // 增长与收拢各占一半时长，默认均为 300ms，倍率对两个阶段同等生效。
  glow.style.setProperty('--sia-cell-focus-duration', `${600 / speed}ms`);
  // 单条描边从左上角不断增长，尾端固定；不移动短光段，也不填充单元格内部。
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('pathLength', '100');
  glow.appendChild(path);
  let frame = 0, disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    glow.remove();
    onFinish();
  };
  const position = () => {
    if (!cell.isConnected || !isVisible()) { cleanup(); return; }
    const rect = cell.getBoundingClientRect();
    Object.assign(glow.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    // 使用真实宽高绘制闭合矩形，归一化路径长度使任意宽高比都恰好走一圈。
    // 描边向内留出半线宽；窄格同步缩小线宽，避免线条中心落到格外。
    const actualWidth = Math.min(lineWidth, rect.width, rect.height), inset = actualWidth / 2;
    path.style.strokeWidth = `${actualWidth}px`;
    path.setAttribute('d', `M ${inset} ${inset} H ${rect.width - inset} V ${rect.height - inset} H ${inset} Z`);
    frame = requestAnimationFrame(position);
  };
  position();
  if (!disposed) document.body.appendChild(glow);
  glow.addEventListener('animationend', event => { if (event.target === glow) cleanup(); });
  return cleanup;
}

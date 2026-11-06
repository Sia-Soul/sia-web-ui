import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import type { TableColumn, TableRow } from "./types";
import { getTableValue, normalizeFixed } from "./utils";

/** 滚动事件内同步绘制视口内容；DOM 提交、主题或尺寸变化时合并重绘并清除过期骨架。 */
export function TableCanvasLayer<T>({ viewport, rows, columns, widths, rowHeight, headerHeight }: {
  viewport: RefObject<HTMLDivElement>;
  rows: readonly TableRow<T>[];
  columns: readonly TableColumn<T>[];
  widths: ReadonlyMap<string, number>;
  rowHeight: number;
  headerHeight: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const scroller = viewport.current;
    if (!canvas || !scroller) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const width = scroller.clientWidth, height = scroller.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      }
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      // 与同尺寸原生单元格使用相同字体和内边距，按需选字时位置不能跳动。
      const style = getComputedStyle(scroller.querySelector('td[data-column-key]') ?? scroller);
      const padding = Number.parseFloat(style.paddingLeft) || 12;
      const foreground = getComputedStyle(scroller).color;
      // 仅检查已提交的 DOM 标记，不测量布局；空值渲染也视为就绪，避免永久显示骨架。
      const readyCells = new Map<number, Set<string>>();
      scroller.querySelectorAll<HTMLElement>("tr[data-canvas-row-index]").forEach(element => {
        const keys = new Set<string>();
        element.querySelectorAll<HTMLElement>('[data-canvas-dom-ready="true"]').forEach(cell => keys.add(cell.dataset.columnKey!));
        readyCells.set(Number(element.dataset.canvasRowIndex), keys);
      });
      ctx.font = `${style.fontSize} ${style.fontFamily}`; ctx.textBaseline = "middle";
      const leftWidth = columns.reduce((n, c) => n + (normalizeFixed(c.fixed) === "left" ? widths.get(c.key) ?? 160 : 0), 0);
      const rightWidth = columns.reduce((n, c) => n + (normalizeFixed(c.fixed) === "right" ? widths.get(c.key) ?? 160 : 0), 0);
      let offset = 0, fixedLeft = 0, fixedRight = rightWidth;
      const geometry = columns.map(column => {
        const cellWidth = widths.get(column.key) ?? 160;
        const fixed = normalizeFixed(column.fixed);
        const x = fixed === "left" ? fixedLeft : fixed === "right" ? width - fixedRight : offset - scroller.scrollLeft;
        offset += cellWidth;
        if (fixed === "left") fixedLeft += cellWidth;
        if (fixed === "right") fixedRight -= cellWidth;
        return { column, x, cellWidth, fixed };
      });
      const first = Math.max(0, Math.floor(scroller.scrollTop / rowHeight));
      const last = Math.min(rows.length, Math.ceil((scroller.scrollTop + height) / rowHeight));
      for (const { column, x, cellWidth, fixed } of geometry) {
        if (x + cellWidth <= 0 || x >= width) continue;
        const clipLeft = Math.max(x, fixed ? 0 : leftWidth);
        const clipRight = Math.min(x + cellWidth, fixed ? width : width - rightWidth);
        if (clipRight <= clipLeft) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(clipLeft, headerHeight, clipRight - clipLeft, height - headerHeight); ctx.clip();
        for (let index = first; index < last; index++) {
          const row = rows[index];
          const y = headerHeight + index * rowHeight - scroller.scrollTop + rowHeight / 2;
          // 原生交互内容及按需激活的文字不能与画布重复绘制。
          if (readyCells.get(index)?.has(column.key)) continue;
          if (!column.canvasRender && column.render) {
            // 快速滚动时 Canvas 先于 React 窗口到达新行，用静态灰条填补交互内容的短暂空窗。
            // 已挂载内容不遮盖，不添加动画、定时器或可点击的虚假按钮。
            if (!readyCells.get(index)?.has(column.key)) {
              const skeletonWidth = Math.max(0, Math.min(cellWidth - padding * 2, 120));
              const skeletonX = column.align === "right" ? x + cellWidth - skeletonWidth - padding : column.align === "center" ? x + (cellWidth - skeletonWidth) / 2 : x + padding;
              ctx.save(); ctx.fillStyle = foreground; ctx.globalAlpha = 0.12;
              ctx.beginPath(); ctx.roundRect(skeletonX, y - 6, skeletonWidth, 12, 4); ctx.fill(); ctx.restore();
            }
            continue;
          }
          const value = getTableValue(row.record, column.dataIndex, column.code ?? column.key);
          const content = column.canvasRender
            ? column.canvasRender(value, row.record, row.sourceIndex, { row, rowIndex: index, column })
            : { text: value == null ? "" : String(value) };
          if (!content?.text) continue;
          const available = Math.max(0, cellWidth - padding * 2 - (content.background ? 16 : 0));
          let text = content.text;
          if (ctx.measureText(text).width > available) {
            // 二分截断避免对超长 JSON/说明逐字符测量。
            let lo = 0, hi = text.length;
            while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (ctx.measureText(text.slice(0, mid) + "…").width <= available) lo = mid; else hi = mid - 1; }
            text = text.slice(0, lo) + "…";
          }
          const textWidth = ctx.measureText(text).width;
          const total = textWidth + (content.background ? 16 : 0);
          const tx = column.align === "right" ? x + cellWidth - total - padding : column.align === "center" ? x + (cellWidth - total) / 2 : x + padding;
          if (content.background) {
            ctx.fillStyle = content.background; ctx.beginPath(); ctx.roundRect(tx, y - 12, total, 24, 4); ctx.fill();
          }
          ctx.fillStyle = content.color ?? foreground;
          ctx.fillText(text, tx + (content.background ? 8 : 0), y);
        }
        ctx.restore();
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    // 原生表头已随 scrollLeft 移动，不能再推迟到下一动画帧才移动画布文字。
    // 捕获阶段先绘制，避免 React 的可见单元格更新占用本次事件后才开始同步内容。
    const onScroll = () => { cancelAnimationFrame(frame); draw(); };
    scroller.addEventListener("scroll", onScroll, { passive: true, capture: true });
    // 滚轮的合成线程滚动会先移动 DOM 再派发 scroll，导致视口外的 Canvas 短暂错位。
    // 横移统一在主线程设置滚动位置并立即重绘；保留缩放和到边界后的页面滚动。
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || !event.cancelable) return;
      const dx = event.deltaX || (event.shiftKey ? event.deltaY : 0);
      if (!dx) return;
      const scale = event.deltaMode === 1 ? rowHeight : event.deltaMode === 2 ? scroller.clientWidth : 1;
      const next = Math.max(0, Math.min(scroller.scrollWidth - scroller.clientWidth, scroller.scrollLeft + dx * scale));
      if (next === scroller.scrollLeft) return;
      event.preventDefault();
      scroller.scrollLeft = next;
      if (event.deltaX && event.deltaY) scroller.scrollTop += event.deltaY * (event.deltaMode === 2 ? scroller.clientHeight : scale);
      onScroll();
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    const resize = new ResizeObserver(schedule); resize.observe(scroller);
    // React 提交新窗口后即使滚动已停止，也必须重新绘制以清掉骨架。
    const content = new MutationObserver(schedule);
    content.observe(scroller, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-canvas-row-index", "data-canvas-dom-ready", "data-column-key"] });
    // 主题和缩放变化后重新按当前主题及像素比绘制。
    const theme = new MutationObserver(schedule); theme.observe(document.documentElement, { attributes: true });
    window.addEventListener("resize", schedule); draw();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); content.disconnect(); theme.disconnect(); scroller.removeEventListener("scroll", onScroll, true); scroller.removeEventListener("wheel", onWheel); window.removeEventListener("resize", schedule); };
  }, [viewport, rows, columns, widths, rowHeight, headerHeight]);
  return <canvas ref={canvasRef} aria-hidden="true" className="sia-table__canvas-layer" />;
}

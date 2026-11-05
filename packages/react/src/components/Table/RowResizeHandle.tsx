import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";

// 调整只在结束时提交一次，便于调用方把行高变化纳入撤销；取消、失去捕获时还原预览。
export function RowResizeHandle({ height, min, max, onPreview, onCommit }: {
  height: number;
  min: number;
  max: number;
  onPreview: (height: number | null) => void;
  onCommit: (height: number) => void;
}) {
  const drag = useRef<{ id: number; start: number; height: number; next: number } | null>(null);
  const previewCallback = useRef(onPreview);
  previewCallback.current = onPreview;
  useEffect(() => {
    // 虚拟行卸载、关闭调整功能或窗口失焦，都不能留下未提交的临时高度。
    const cancel = () => {
      if (!drag.current) return;
      drag.current = null;
      previewCallback.current(null);
    };
    window.addEventListener("blur", cancel);
    return () => { window.removeEventListener("blur", cancel); cancel(); };
  }, []);
  const clamp = (value: number) => Math.max(min, Math.min(max, Math.round(value)));
  const finish = (event: PointerEvent, commit: boolean) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    onPreview(null);
    if (commit && current.next !== current.height) onCommit(current.next);
  };
  return <span
    className="sia-table__row-resize-handle"
    role="separator" aria-label="调整行高" aria-orientation="horizontal"
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={height} tabIndex={0}
    onClick={event => event.stopPropagation()}
    onDoubleClick={event => event.stopPropagation()}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      drag.current = { id: event.pointerId, start: event.clientY, height, next: height };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      event.stopPropagation();
      current.next = clamp(current.height + event.clientY - current.start);
      onPreview(current.next);
    }}
    onPointerUp={event => finish(event, true)}
    onPointerCancel={event => finish(event, false)}
    onLostPointerCapture={event => finish(event, false)}
    onKeyDown={event => {
      if (event.key === "Escape" && drag.current) {
        drag.current = null;
        onPreview(null);
        event.stopPropagation();
      }
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      event.stopPropagation();
      const next = clamp(height + (event.key === "ArrowUp" ? -10 : 10));
      if (next !== height) onCommit(next);
    }}
  />;
}

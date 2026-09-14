import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { HTMLAttributes, PointerEvent as ReactPointerEvent, ReactNode } from "react";

type ScrollAreaElement = "div" | "main" | "nav";

export interface OverlayScrollAreaProps extends HTMLAttributes<HTMLElement> {
  as?: ScrollAreaElement;
  children: ReactNode;
  viewportClassName?: string;
}

interface ScrollbarDrag {
  pointerId: number;
  startCoordinate: number;
  startScroll: number;
  scrollPerPixel: number;
}

export const OverlayScrollArea = forwardRef<HTMLElement, OverlayScrollAreaProps>(function OverlayScrollArea(
  {
    as: Viewport = "div",
    children,
    className = "",
    viewportClassName = "",
    ...viewportProps
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<ScrollbarDrag | null>(null);

  useImperativeHandle(forwardedRef, () => viewportRef.current!, []);

  const updateScrollbar = useCallback(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return;
    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    root.dataset.overflowY = String(maxScroll > 1);
    const trackLength = root.querySelector<HTMLElement>(".overlay-scroll-area__scrollbar")?.clientHeight ?? 0;
    const thumbLength = maxScroll > 1
      ? Math.min(trackLength, Math.max(40, trackLength * viewport.clientHeight / viewport.scrollHeight))
      : 0;
    const thumbPosition = maxScroll > 0
      ? viewport.scrollTop / maxScroll * Math.max(0, trackLength - thumbLength)
      : 0;

    root.dataset.overflowY = String(maxScroll > 1);
    root.style.setProperty("--overlay-scrollbar-size", `${thumbLength}px`);
    root.style.setProperty("--overlay-scrollbar-position", `${thumbPosition}px`);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(viewport);
    observer.observe(content);
    updateScrollbar();
    return () => observer.disconnect();
  }, [updateScrollbar]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const track = event.currentTarget;
    const thumb = track.firstElementChild as HTMLElement | null;
    if (!viewport || !thumb || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const maxScroll = viewport.scrollHeight - viewport.clientHeight;
    const thumbRect = thumb.getBoundingClientRect();
    if (event.clientY < thumbRect.top || event.clientY > thumbRect.bottom) {
      const ratio = Math.max(0, Math.min(1, (event.clientY - track.getBoundingClientRect().top - thumb.offsetHeight / 2) / Math.max(1, track.clientHeight - thumb.offsetHeight)));
      viewport.scrollTop = ratio * maxScroll;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startCoordinate: event.clientY,
      startScroll: viewport.scrollTop,
      scrollPerPixel: maxScroll / Math.max(1, track.clientHeight - thumb.offsetHeight),
    };
    if (rootRef.current) rootRef.current.dataset.scrollbarDragging = "true";
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || !viewport || drag.pointerId !== event.pointerId) return;
    viewport.scrollTop = drag.startScroll + (event.clientY - drag.startCoordinate) * drag.scrollPerPixel;
  }, []);

  const handlePointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (rootRef.current) rootRef.current.dataset.scrollbarDragging = "false";
  }, []);

  return (
    <div ref={rootRef} className={`overlay-scroll-area ${className}`.trim()} data-overflow-y="false">
      <Viewport
        {...viewportProps}
        ref={viewportRef as never}
        data-sia-native-scrollbar=""
        className={`overlay-scroll-area__viewport ${viewportClassName}`.trim()}
        onScroll={updateScrollbar}
      >
        <div ref={contentRef} className="overlay-scroll-area__content">{children}</div>
      </Viewport>
      <div className="sia-scrollbar-track overlay-scroll-area__scrollbar" aria-hidden="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div className="overlay-scroll-area__thumb" />
      </div>
    </div>
  );
});

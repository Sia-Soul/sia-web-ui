import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ForwardedRef, HTMLAttributes, RefObject } from "react";
import { createPortal } from "react-dom";

export type PopupPortalPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "right-end" | "left-start" | "left-end";

export interface PopupPortalProps extends HTMLAttributes<HTMLDivElement> {
  anchorRef: RefObject<HTMLElement | null>;
  open?: boolean;
  placement?: PopupPortalPlacement;
  offset?: number;
  viewportPadding?: number;
}

type PopupPosition = {
  top: number;
  left: number;
  anchorWidth: number;
  availableHeight: number;
  placement: PopupPortalPlacement;
};

function setForwardedRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * 页面级弹层容器。使用 fixed + Portal 避开父容器 overflow，并跟随锚点滚动和缩放。
 */
export const PopupPortal = forwardRef<HTMLDivElement, PopupPortalProps>(function PopupPortal(
  {
    anchorRef,
    open = true,
    placement = "bottom-start",
    offset = 6,
    viewportPadding = 8,
    className = "",
    style,
    children,
    ...props
  },
  forwardedRef,
) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<PopupPosition>();

  useLayoutEffect(() => {
    if (!open || typeof document === "undefined") {
      setPosition(undefined);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      const popup = popupRef.current;
      if (!anchor || !popup) return;
      const anchorRect = anchor.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      let resolvedPlacement = placement;
      const availableBelow = Math.max(0, viewportHeight - viewportPadding - anchorRect.bottom - offset);
      const availableAbove = Math.max(0, anchorRect.top - offset - viewportPadding);
      const availableRight = Math.max(0, viewportWidth - viewportPadding - anchorRect.right - offset);
      const availableLeft = Math.max(0, anchorRect.left - offset - viewportPadding);
      const horizontalSide = placement.startsWith("right") || placement.startsWith("left");
      if (horizontalSide) {
        const prefersRight = placement.startsWith("right");
        const fitsRight = popupRect.width <= availableRight;
        const fitsLeft = popupRect.width <= availableLeft;
        if (prefersRight && !fitsRight && (fitsLeft || availableLeft > availableRight)) {
          resolvedPlacement = placement.replace("right", "left") as PopupPortalPlacement;
        } else if (!prefersRight && !fitsLeft && (fitsRight || availableRight > availableLeft)) {
          resolvedPlacement = placement.replace("left", "right") as PopupPortalPlacement;
        }
      } else {
        const prefersBottom = placement.startsWith("bottom");
        const fitsBelow = popupRect.height <= availableBelow;
        const fitsAbove = popupRect.height <= availableAbove;
        if (prefersBottom && !fitsBelow && (fitsAbove || availableAbove > availableBelow)) {
          resolvedPlacement = placement.replace("bottom", "top") as PopupPortalPlacement;
        } else if (!prefersBottom && !fitsAbove && (fitsBelow || availableBelow > availableAbove)) {
          resolvedPlacement = placement.replace("top", "bottom") as PopupPortalPlacement;
        }
      }

      const resolvedHorizontalSide = resolvedPlacement.startsWith("right") || resolvedPlacement.startsWith("left");
      const top = resolvedHorizontalSide
        ? resolvedPlacement.endsWith("end") ? anchorRect.bottom - popupRect.height : anchorRect.top
        : resolvedPlacement.startsWith("bottom") ? anchorRect.bottom + offset : anchorRect.top - popupRect.height - offset;
      const availableHeight = resolvedHorizontalSide
        ? Math.max(0, viewportHeight - viewportPadding * 2)
        : resolvedPlacement.startsWith("bottom") ? availableBelow : availableAbove;
      const alignedLeft = resolvedHorizontalSide
        ? resolvedPlacement.startsWith("right") ? anchorRect.right + offset : anchorRect.left - popupRect.width - offset
        : resolvedPlacement.endsWith("end") ? anchorRect.right - popupRect.width : anchorRect.left;
      const next: PopupPosition = {
        top: clamp(top, viewportPadding, viewportHeight - popupRect.height - viewportPadding),
        left: clamp(alignedLeft, viewportPadding, viewportWidth - popupRect.width - viewportPadding),
        anchorWidth: anchorRect.width,
        availableHeight,
        placement: resolvedPlacement,
      };
      setPosition((current) => current
        && current.top === next.top
        && current.left === next.left
        && current.anchorWidth === next.anchorWidth
        && current.availableHeight === next.availableHeight
        && current.placement === next.placement
        ? current
        : next);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new ResizeObserver(update);
    if (anchorRef.current) observer.observe(anchorRef.current);
    if (popupRef.current) observer.observe(popupRef.current);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
    };
  }, [anchorRef, offset, open, placement, viewportPadding]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={(node) => {
        popupRef.current = node;
        setForwardedRef(forwardedRef, node);
      }}
      className={`sia-popup-portal ${className}`.trim()}
      data-sia-popup-layer=""
      data-placement={position?.placement ?? placement}
      style={{
        ...style,
        "--sia-popup-anchor-width": `${position?.anchorWidth ?? anchorRef.current?.getBoundingClientRect().width ?? 0}px`,
        "--sia-popup-available-height": position ? `${position.availableHeight}px` : undefined,
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
      } as CSSProperties}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
});

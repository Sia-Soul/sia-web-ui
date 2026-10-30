import { withTitleTooltip } from "./titleTooltip";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ForwardedRef, HTMLAttributes, RefObject } from "react";
import { createPortal } from "react-dom";
import { useOverlayMotion } from "./overlayMotion";

/** 弹出方位与对齐边，空间不足时自动翻转到可用一侧。 */
export type PopupPortalPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "right-end" | "left-start" | "left-end";

/** 页面级弹出层的定位与生命周期配置。 */
export interface PopupPortalProps extends HTMLAttributes<HTMLDivElement> {
  /** 定位锚点，跟随其位置和布局尺寸。 */
  anchorRef: RefObject<HTMLElement | null>;
  /** 是否打开，默认 true；关闭后保留节点直到退出动画完成。 */
  open?: boolean;
  /** 首选方向及对齐边，默认 bottom-start。 */
  placement?: PopupPortalPlacement;
  /** 与锚点的距离，单位 CSS px，默认 6。 */
  offset?: number;
  /** 与视口边缘的最小距离，单位 CSS px，默认 8。 */
  viewportPadding?: number;
  /** 真实开合动画完成后通知最终状态；被反向打断的阶段不通知。 */
  afterOpenChange?: (open: boolean) => void;
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
 * 页面级弹层容器。使用 fixed + Portal 避开父容器 overflow，并跟随锚点滚动和缩放。打开为 260ms 缩放淡入、弹大回收后归位的果冻动效，关闭为 140ms 无回弹缩小淡出；快速切换从当前画面接续，最终外观沿用组件样式。
 */
export const PopupPortal = forwardRef<HTMLDivElement, PopupPortalProps>(function PopupPortal(
  {
    anchorRef,
    open = true,
    placement = "bottom-start",
    offset = 6,
    viewportPadding = 8,
    afterOpenChange,
    className = "",
    style,
    children,
    ...props
  },
  forwardedRef,
) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<PopupPosition>();
  const motion = useOverlayMotion(open, popupRef, "popup", position?.placement ?? placement, !!position, afterOpenChange);

  useLayoutEffect(() => {
    if (!motion.present || typeof document === "undefined") {
      setPosition(undefined);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      const popup = popupRef.current;
      if (!anchor || !popup) return;
      const anchorRect = anchor.getBoundingClientRect();
      // 定位使用未缩放的布局尺寸，避免回弹缩放导致翻转判断和坐标抖动。
      const popupRect = { width: popup.offsetWidth, height: popup.offsetHeight };
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
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); });
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("sia-overlay-motion-end", schedule);
    const observer = new ResizeObserver(schedule);
    if (anchorRef.current) observer.observe(anchorRef.current);
    if (popupRef.current) observer.observe(popupRef.current);
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("sia-overlay-motion-end", schedule);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [anchorRef, offset, motion.present, placement, viewportPadding]);

  if (!motion.present || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={(node) => {
        popupRef.current = node;
        setForwardedRef(forwardedRef, node);
      }}
      className={`sia-popup-portal ${className}`.trim()}
      data-sia-popup-layer=""
      data-placement={position?.placement ?? placement}
      data-state={motion.closing ? "closing" : "open"}
      aria-hidden={motion.closing || undefined}
      style={{
        ...style,
        "--sia-popup-anchor-width": `${position?.anchorWidth ?? anchorRef.current?.getBoundingClientRect().width ?? 0}px`,
        "--sia-popup-available-height": position ? `${position.availableHeight}px` : undefined,
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
        animation: "none",
        pointerEvents: motion.closing ? "none" : style?.pointerEvents,
        // 以靠近触发器的边缘中心为缩放原点，业务显式原点优先。
        transformOrigin: style?.transformOrigin ?? ((position?.placement ?? placement).startsWith("left") ? "right center"
          : (position?.placement ?? placement).startsWith("right") ? "left center"
          : (position?.placement ?? placement).startsWith("top") ? "center bottom" : "center top"),
      } as CSSProperties}
      {...withTitleTooltip(props)}
    >
      {children}
    </div>,
    document.body,
  );
});

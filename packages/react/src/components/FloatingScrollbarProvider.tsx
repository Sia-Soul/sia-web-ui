"use client";

import { useEffect } from "react";

export interface FloatingScrollbarProviderProps {
  disabled?: boolean;
}

type ScrollAxis = "horizontal" | "vertical";

type ScrollbarEntry = {
  target: HTMLElement;
  horizontalTrack: HTMLDivElement;
  horizontalThumb: HTMLDivElement;
  verticalTrack: HTMLDivElement;
  verticalThumb: HTMLDivElement;
  hideTimer: number | null;
  hoveringTarget: boolean;
  hoveringTrack: boolean;
  dragging: boolean;
  cleanup: () => void;
};

const scrollableOverflow = new Set(["auto", "scroll", "overlay"]);
const clippingOverflow = new Set(["auto", "scroll", "overlay", "hidden", "clip"]);

function isRootScroller(target: HTMLElement) {
  return target === document.scrollingElement || target === document.documentElement;
}

function canScroll(target: HTMLElement, axis: ScrollAxis) {
  if (target.matches(".sia-table__viewport, [data-sia-native-scrollbar]")) return false;
  if (isRootScroller(target)) {
    return axis === "horizontal"
      ? target.scrollWidth > target.clientWidth + 1
      : target.scrollHeight > target.clientHeight + 1;
  }
  const style = getComputedStyle(target);
  const overflow = axis === "horizontal" ? style.overflowX : style.overflowY;
  const hasOverflow = axis === "horizontal"
    ? target.scrollWidth > target.clientWidth + 1
    : target.scrollHeight > target.clientHeight + 1;
  return hasOverflow && scrollableOverflow.has(overflow);
}

function visibleRect(target: HTMLElement) {
  if (isRootScroller(target)) {
    return { top: 0, right: window.innerWidth, bottom: window.innerHeight, left: 0, width: window.innerWidth, height: window.innerHeight };
  }

  const ownRect = target.getBoundingClientRect();
  let top = Math.max(0, ownRect.top);
  let right = Math.min(window.innerWidth, ownRect.right);
  let bottom = Math.min(window.innerHeight, ownRect.bottom);
  let left = Math.max(0, ownRect.left);
  let parent = target.parentElement;

  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = getComputedStyle(parent);
    const clipX = clippingOverflow.has(style.overflowX);
    const clipY = clippingOverflow.has(style.overflowY);
    if (clipX || clipY) {
      const rect = parent.getBoundingClientRect();
      if (clipX) {
        left = Math.max(left, rect.left);
        right = Math.min(right, rect.right);
      }
      if (clipY) {
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
      }
    }
    parent = parent.parentElement;
  }

  return {
    top,
    right,
    bottom,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function createTrack(axis: ScrollAxis) {
  const track = document.createElement("div");
  const thumb = document.createElement("div");
  track.className = `sia-floating-scrollbar sia-floating-scrollbar--${axis}`;
  thumb.className = "sia-floating-scrollbar__thumb";
  track.dataset.axis = axis;
  track.setAttribute("aria-hidden", "true");
  track.append(thumb);
  return { track, thumb };
}

export function FloatingScrollbarProvider({ disabled = false }: FloatingScrollbarProviderProps) {
  useEffect(() => {
    if (disabled) return;

    const layer = document.createElement("div");
    layer.className = "sia-floating-scrollbar-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);

    const entries = new Map<HTMLElement, ScrollbarEntry>();
    let scanFrame = 0;
    let updateFrame = 0;

    const setEntryVisible = (entry: ScrollbarEntry, visible: boolean) => {
      entry.horizontalTrack.classList.toggle("sia-floating-scrollbar--visible", visible);
      entry.verticalTrack.classList.toggle("sia-floating-scrollbar--visible", visible);
    };

    const showEntry = (entry: ScrollbarEntry) => {
      if (entry.hideTimer !== null) window.clearTimeout(entry.hideTimer);
      entry.hideTimer = null;
      setEntryVisible(entry, true);
    };

    const scheduleHide = (entry: ScrollbarEntry, delay = 500) => {
      if (entry.hideTimer !== null) window.clearTimeout(entry.hideTimer);
      entry.hideTimer = window.setTimeout(() => {
        entry.hideTimer = null;
        if (!entry.hoveringTarget && !entry.hoveringTrack && !entry.dragging) setEntryVisible(entry, false);
      }, delay);
    };

    const updateEntry = (entry: ScrollbarEntry) => {
      const { target, horizontalTrack, horizontalThumb, verticalTrack, verticalThumb } = entry;
      const hasHorizontal = canScroll(target, "horizontal");
      const hasVertical = canScroll(target, "vertical");
      const rect = visibleRect(target);
      const thickness = 8;

      horizontalTrack.hidden = !hasHorizontal || rect.width <= thickness || rect.height <= 0;
      verticalTrack.hidden = !hasVertical || rect.height <= thickness || rect.width <= 0;

      if (!horizontalTrack.hidden) {
        const trackWidth = Math.max(0, rect.width - (hasVertical ? thickness : 0));
        const thumbWidth = Math.max(24, Math.min(trackWidth, trackWidth * target.clientWidth / target.scrollWidth));
        const travel = Math.max(0, trackWidth - thumbWidth);
        const maxScroll = Math.max(1, target.scrollWidth - target.clientWidth);
        horizontalTrack.style.left = `${rect.left}px`;
        horizontalTrack.style.top = `${rect.bottom - thickness}px`;
        horizontalTrack.style.width = `${trackWidth}px`;
        horizontalTrack.style.height = `${thickness}px`;
        horizontalThumb.style.width = `${thumbWidth}px`;
        horizontalThumb.style.transform = `translate3d(${travel * target.scrollLeft / maxScroll}px, 0, 0)`;
      }

      if (!verticalTrack.hidden) {
        const trackHeight = Math.max(0, rect.height - (hasHorizontal ? thickness : 0));
        const thumbHeight = Math.max(24, Math.min(trackHeight, trackHeight * target.clientHeight / target.scrollHeight));
        const travel = Math.max(0, trackHeight - thumbHeight);
        const maxScroll = Math.max(1, target.scrollHeight - target.clientHeight);
        verticalTrack.style.left = `${rect.right - thickness}px`;
        verticalTrack.style.top = `${rect.top}px`;
        verticalTrack.style.width = `${thickness}px`;
        verticalTrack.style.height = `${trackHeight}px`;
        verticalThumb.style.height = `${thumbHeight}px`;
        verticalThumb.style.transform = `translate3d(0, ${travel * target.scrollTop / maxScroll}px, 0)`;
      }
    };

    const scheduleUpdateAll = () => {
      if (updateFrame) return;
      updateFrame = window.requestAnimationFrame(() => {
        updateFrame = 0;
        entries.forEach(updateEntry);
      });
    };

    const bindTrackDrag = (entry: ScrollbarEntry, axis: ScrollAxis, track: HTMLDivElement, thumb: HTMLDivElement) => {
      const target = entry.target;

      const onTrackPointerEnter = () => {
        entry.hoveringTrack = true;
        showEntry(entry);
      };
      const onTrackPointerLeave = () => {
        entry.hoveringTrack = false;
        scheduleHide(entry);
      };
      const onTrackPointerDown = (event: PointerEvent) => {
        if (event.target === thumb || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const trackRect = track.getBoundingClientRect();
        const thumbRect = thumb.getBoundingClientRect();
        const trackLength = axis === "vertical" ? trackRect.height : trackRect.width;
        const thumbLength = axis === "vertical" ? thumbRect.height : thumbRect.width;
        const pointer = axis === "vertical" ? event.clientY - trackRect.top : event.clientX - trackRect.left;
        const ratio = Math.max(0, Math.min(1, (pointer - thumbLength / 2) / Math.max(1, trackLength - thumbLength)));
        if (axis === "vertical") target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);
        else target.scrollLeft = ratio * (target.scrollWidth - target.clientWidth);
      };
      const onThumbPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        entry.dragging = true;
        showEntry(entry);
        thumb.setPointerCapture(event.pointerId);

        const startPointer = axis === "vertical" ? event.clientY : event.clientX;
        const startScroll = axis === "vertical" ? target.scrollTop : target.scrollLeft;
        const trackRect = track.getBoundingClientRect();
        const thumbRect = thumb.getBoundingClientRect();
        const trackLength = axis === "vertical" ? trackRect.height : trackRect.width;
        const thumbLength = axis === "vertical" ? thumbRect.height : thumbRect.width;
        const maxScroll = axis === "vertical"
          ? target.scrollHeight - target.clientHeight
          : target.scrollWidth - target.clientWidth;
        const travel = Math.max(1, trackLength - thumbLength);

        const onPointerMove = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== event.pointerId) return;
          const pointer = axis === "vertical" ? moveEvent.clientY : moveEvent.clientX;
          const nextScroll = startScroll + (pointer - startPointer) * maxScroll / travel;
          if (axis === "vertical") target.scrollTop = nextScroll;
          else target.scrollLeft = nextScroll;
        };
        const onPointerUp = (upEvent: PointerEvent) => {
          if (upEvent.pointerId !== event.pointerId) return;
          entry.dragging = false;
          thumb.releasePointerCapture(event.pointerId);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerUp);
          scheduleHide(entry);
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
      };

      track.addEventListener("pointerenter", onTrackPointerEnter);
      track.addEventListener("pointerleave", onTrackPointerLeave);
      track.addEventListener("pointerdown", onTrackPointerDown);
      thumb.addEventListener("pointerdown", onThumbPointerDown);

      return () => {
        track.removeEventListener("pointerenter", onTrackPointerEnter);
        track.removeEventListener("pointerleave", onTrackPointerLeave);
        track.removeEventListener("pointerdown", onTrackPointerDown);
        thumb.removeEventListener("pointerdown", onThumbPointerDown);
      };
    };

    const resizeObserver = new ResizeObserver((observedEntries) => {
      observedEntries.forEach(({ target }) => {
        const entry = entries.get(target as HTMLElement);
        if (entry) updateEntry(entry);
      });
    });

    const addTarget = (target: HTMLElement) => {
      if (entries.has(target)) return;
      const horizontal = createTrack("horizontal");
      const vertical = createTrack("vertical");
      layer.append(horizontal.track, vertical.track);

      const onPointerEnter = () => {
        const entry = entries.get(target);
        if (!entry) return;
        entry.hoveringTarget = true;
        showEntry(entry);
      };
      const onPointerLeave = () => {
        const entry = entries.get(target);
        if (!entry) return;
        entry.hoveringTarget = false;
        scheduleHide(entry);
      };
      const onScroll = () => {
        const entry = entries.get(target);
        if (!entry) return;
        updateEntry(entry);
        showEntry(entry);
        scheduleHide(entry, 700);
      };

      target.addEventListener("pointerenter", onPointerEnter);
      target.addEventListener("pointerleave", onPointerLeave);
      target.addEventListener("scroll", onScroll, { passive: true });

      const entry: ScrollbarEntry = {
        target,
        horizontalTrack: horizontal.track,
        horizontalThumb: horizontal.thumb,
        verticalTrack: vertical.track,
        verticalThumb: vertical.thumb,
        hideTimer: null,
        hoveringTarget: false,
        hoveringTrack: false,
        dragging: false,
        cleanup: () => undefined,
      };
      const cleanupHorizontal = bindTrackDrag(entry, "horizontal", horizontal.track, horizontal.thumb);
      const cleanupVertical = bindTrackDrag(entry, "vertical", vertical.track, vertical.thumb);
      entry.cleanup = () => {
        if (entry.hideTimer !== null) window.clearTimeout(entry.hideTimer);
        cleanupHorizontal();
        cleanupVertical();
        target.removeEventListener("pointerenter", onPointerEnter);
        target.removeEventListener("pointerleave", onPointerLeave);
        target.removeEventListener("scroll", onScroll);
        resizeObserver.unobserve(target);
        horizontal.track.remove();
        vertical.track.remove();
      };
      entries.set(target, entry);
      resizeObserver.observe(target);
      updateEntry(entry);
    };

    const removeTarget = (target: HTMLElement) => {
      const entry = entries.get(target);
      if (!entry) return;
      entry.cleanup();
      entries.delete(target);
    };

    const scanTargets = () => {
      scanFrame = 0;
      const candidates = [document.scrollingElement, ...document.querySelectorAll<HTMLElement>("*")]
        .filter((target): target is HTMLElement => target instanceof HTMLElement);
      const nextTargets = new Set<HTMLElement>();

      candidates.forEach((target) => {
        if (canScroll(target, "horizontal") || canScroll(target, "vertical")) {
          nextTargets.add(target);
          addTarget(target);
        }
      });
      entries.forEach((_entry, target) => {
        if (!target.isConnected || !nextTargets.has(target)) removeTarget(target);
        else updateEntry(_entry);
      });
    };

    const scheduleScan = () => {
      if (scanFrame) return;
      scanFrame = window.requestAnimationFrame(scanTargets);
    };

    const mutationObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => !layer.contains(mutation.target))) scheduleScan();
    });
    mutationObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    window.addEventListener("resize", scheduleUpdateAll);
    window.addEventListener("scroll", scheduleUpdateAll, true);
    scheduleScan();

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdateAll);
      window.removeEventListener("scroll", scheduleUpdateAll, true);
      if (scanFrame) window.cancelAnimationFrame(scanFrame);
      if (updateFrame) window.cancelAnimationFrame(updateFrame);
      entries.forEach((entry) => entry.cleanup());
      entries.clear();
      layer.remove();
    };
  }, [disabled]);

  return null;
}

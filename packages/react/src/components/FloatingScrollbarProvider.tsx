"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import { useScrollbarProximity } from "./useScrollbarProximity";
import { registerFloatingScrollbar, setFloatingScrollbarDragging } from "./floatingScrollbarOwnership";

/** 浮动滚动条接入组件的属性配置。 */
export interface FloatingScrollbarProviderProps {
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /** 仅接管指定容器；不传时接管页面中的滚动容器。 */
  targetRef?: RefObject<HTMLElement | null>;
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
  track.className = `sia-scrollbar-track sia-floating-scrollbar sia-floating-scrollbar--${axis}`;
  thumb.className = "sia-floating-scrollbar__thumb";
  track.dataset.axis = axis;
  track.setAttribute("aria-hidden", "true");
  track.append(thumb);
  return { track, thumb };
}

/** 为页面或指定容器接入浮动滚动条；悬停、滚动或拖动时显示，离开且停止交互后隐藏，不占用布局宽度。轨道保留滚动容器的交互归属，供菜单判断内部操作；布局变化重新发现容器，定尺寸脱离文档流元素的定位变化仅复核相关子树与祖先。 */
export function FloatingScrollbarProvider({ disabled = false, targetRef }: FloatingScrollbarProviderProps) {
  useScrollbarProximity();
  useEffect(() => {
    if (disabled) return;

    const layer = document.createElement("div");
    layer.className = "sia-floating-scrollbar-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);

    const entries = new Map<HTMLElement, ScrollbarEntry>();
    let scanFrame = 0;
    let updateFrame = 0;
    // 高频定位样式只会影响所在子树及祖先的溢出；尺寸等布局变化仍须发现兄弟容器。
    const dirtyStyles = new Set<HTMLElement>();
    let fullScan = true;

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
      const thickness = 10;

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
        setFloatingScrollbarDragging(track, true);
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
          setFloatingScrollbarDragging(track, false);
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
      // 轨道位于独立 Portal 层，但点击和拖动仍属于原滚动容器。
      const releaseHorizontalOwner = registerFloatingScrollbar(horizontal.track, target);
      const releaseVerticalOwner = registerFloatingScrollbar(vertical.track, target);
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
        hoveringTarget: target.matches(":hover"),
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
        releaseHorizontalOwner();
        releaseVerticalOwner();
        target.removeEventListener("pointerenter", onPointerEnter);
        target.removeEventListener("pointerleave", onPointerLeave);
        target.removeEventListener("scroll", onScroll);
        resizeObserver.unobserve(target);
        target.removeAttribute("data-sia-floating-scrollbar");
        horizontal.track.remove();
        vertical.track.remove();
      };
      entries.set(target, entry);
      target.setAttribute("data-sia-floating-scrollbar", "");
      resizeObserver.observe(target);
      updateEntry(entry);
      if (entry.hoveringTarget) showEntry(entry);
    };

    const removeTarget = (target: HTMLElement) => {
      const entry = entries.get(target);
      if (!entry) return;
      entry.cleanup();
      entries.delete(target);
    };

    const scanTargets = () => {
      scanFrame = 0;
      // 表格视口拥有独立滚动条，不扫描其数万单元格；原生滚动区域同样由自身负责。
      const managedSelector = ".sia-table__viewport, [data-sia-native-scrollbar], .sia-scrollbar-track, .sia-floating-scrollbar-layer";
      const discovered = new Set<HTMLElement>();
      if (!targetRef) {
        const roots = fullScan ? [document.body] : [...dirtyStyles].filter(node => node.isConnected);
        for (const root of roots) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
            acceptNode: node => (node as Element).matches(managedSelector) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
          });
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node instanceof HTMLElement) discovered.add(node);
          }
          // 子元素的尺寸、定位和显示变化可能让任意祖先开始或停止滚动。
          for (let node: HTMLElement | null = root; node; node = node.parentElement) discovered.add(node);
        }
      }
      const candidates = (targetRef ? [targetRef.current] : [document.scrollingElement, ...discovered])
        .filter((target): target is HTMLElement => target instanceof HTMLElement);
      const nextTargets = new Set<HTMLElement>();

      candidates.forEach((target) => {
        if (canScroll(target, "horizontal") || canScroll(target, "vertical")) {
          nextTargets.add(target);
          if (entries.has(target) || !target.hasAttribute("data-sia-floating-scrollbar")) addTarget(target);
        }
      });
      entries.forEach((_entry, target) => {
        if (!target.isConnected || ((fullScan || candidates.includes(target)) && !nextTargets.has(target))) removeTarget(target);
        else updateEntry(_entry);
      });
      dirtyStyles.clear();
      fullScan = false;
    };

    const scheduleScan = (complete = true) => {
      fullScan ||= complete;
      if (scanFrame) return;
      scanFrame = window.requestAnimationFrame(scanTargets);
    };

    const previousStyle = document.createElement("div").style;
    const positionProperties = new Set(["left", "top", "transform"]);
    const mutationObserver = new MutationObserver((mutations) => {
      // 滚动条位置、虚拟行增删与单元格高亮均不改变外部滚动容器，不能触发全页扫描。
      let relevant = false;
      for (const mutation of mutations) {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (!target || layer.contains(target) || target.closest(".sia-table__viewport, [data-sia-native-scrollbar], .sia-scrollbar-track")) continue;
        relevant = true;
        // 只有定尺寸、脱离文档流元素的纯定位更新可局部处理；flex 兄弟缩放等必须全量发现。
        let positionOnly = false;
        if (mutation.type === "attributes" && mutation.attributeName === "style" && target instanceof HTMLElement) {
          previousStyle.cssText = mutation.oldValue ?? "";
          const keys = new Set([...Array.from(previousStyle), ...Array.from(target.style)]);
          const changed = [...keys].filter(key => previousStyle.getPropertyValue(key) !== target.style.getPropertyValue(key) || previousStyle.getPropertyPriority(key) !== target.style.getPropertyPriority(key));
          if (!changed.length) continue;
          const fixedSize = target.style.width.endsWith("px") && target.style.height.endsWith("px");
          positionOnly = fixedSize && changed.every(key => positionProperties.has(key)) && ["absolute", "fixed"].includes(getComputedStyle(target).position);
        }
        if (positionOnly && target instanceof HTMLElement) dirtyStyles.add(target);
        else fullScan = true;
      }
      if (relevant) scheduleScan(false);
    });
    mutationObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ["class", "style", "hidden"] });
    const onResize = () => scheduleScan();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", scheduleUpdateAll, true);
    scheduleScan();

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", scheduleUpdateAll, true);
      if (scanFrame) window.cancelAnimationFrame(scanFrame);
      if (updateFrame) window.cancelAnimationFrame(updateFrame);
      entries.forEach((entry) => entry.cleanup());
      entries.clear();
      layer.remove();
    };
  }, [disabled, targetRef]);

  return null;
}

import { captureOverlaySkeleton } from "./OverlayContentSkeleton";
import type { OverlaySkeletonLayout } from "./OverlayContentSkeleton";
import { useLayoutEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";

/** 缓存打开期间的布局尺寸，关闭时锁定外壳和正文占位；随提交及布局变化更新，不跟随动画逐帧测量，也不读取变换后的尺寸。 */
export function useOverlayExitPlaceholder(
  open: boolean,
  present: boolean,
  panelRef: RefObject<HTMLElement | null>,
  bodyRef: RefObject<HTMLElement | null>,
  captureContent: boolean,
) {
  const layout = useRef<OverlaySkeletonLayout>();
  const dimensions = useRef({ panelHeight: 0, bodyHeight: 0 });
  useLayoutEffect(() => {
    if (!open || !present) {
      // 快照使用可见坐标，卸载长正文后从零滚动位置绘制，避免占位再次被卷走。
      if (present && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollLeft = 0;
      return;
    }
    if (!captureContent) layout.current = undefined;
    const panel = panelRef.current;
    const body = bodyRef.current;
    if (!panel) return;
    // 在关闭的 React 提交前保存尺寸，避免业务同时清空 children 后才测量到空壳。
    const measure = () => {
      dimensions.current = { panelHeight: panel.offsetHeight, bodyHeight: body?.offsetHeight ?? 0 };
      if (captureContent && body) layout.current = captureOverlaySkeleton(body);
    };
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); }); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    if (body) observer.observe(body);
    // 子组件更新可能不改变容器高度；合并布局变化，关闭点击/键盘事件前再同步一次。
    const mutations = new MutationObserver(schedule);
    const beforePointerAction = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('button, [role="button"]')) measure();
    };
    // 普通文字输入不触发布局扫描；Esc 关闭前同步缓存，其他变化由观察器合并处理。
    const beforeKeyboardAction = (event: KeyboardEvent) => { if (event.key === "Escape") measure(); };
    if (captureContent && body) {
      mutations.observe(body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
      body.addEventListener("scroll", schedule, { passive: true });
      panel.addEventListener("pointerdown", beforePointerAction, true);
      panel.addEventListener("keydown", beforeKeyboardAction, true);
    }
    return () => {
      observer.disconnect(); mutations.disconnect();
      if (frame) cancelAnimationFrame(frame);
      body?.removeEventListener("scroll", schedule);
      panel.removeEventListener("pointerdown", beforePointerAction, true);
      panel.removeEventListener("keydown", beforeKeyboardAction, true);
    };
  });
  const closing = !open && present;
  const panelStyle: CSSProperties | undefined = closing && dimensions.current.panelHeight > 0
    ? { height: dimensions.current.panelHeight, boxSizing: "border-box", overflow: "hidden" } : undefined;
  const bodyStyle: CSSProperties | undefined = closing && dimensions.current.bodyHeight > 0
    ? { height: dimensions.current.bodyHeight, flex: "0 0 auto", boxSizing: "border-box" } : undefined;
  return { panelStyle, bodyStyle, layout: layout.current, hadBody: dimensions.current.bodyHeight > 0 };
}

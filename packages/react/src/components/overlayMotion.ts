import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { popupFluidFrames, popupEnterDuration, popupExitDuration, popupInitialScale, popupTravelOffset } from "./popupFluidMotion";

type MotionKind = "drawer" | "modal" | "popup" | "tooltip" | "message" | "toast" | "fade";
type MotionPhase = "entering" | "open" | "closing" | "closed";

/** 弹层仅动画合成属性，通过明确的过冲和一次回收表现果冻弹性，稳定后恢复原始尺寸。 */
function motionFrames(kind: MotionKind, placement: string): Keyframe[] {
  if (kind === "fade") return [{ opacity: 0 }, { opacity: 1 }];
  // 短消息正文只位移，不参与缩放；背景另用伪元素形变，避免文字被拉伸和重复采样。
  if (kind === "toast") return [
    { opacity: 0, transform: "translateY(-6px)", offset: 0 },
    { opacity: 1, transform: "translateY(3px)", offset: .68 },
    { opacity: 1, transform: "translateY(-1px)", offset: .86 },
    { opacity: 1, transform: "none", offset: 1 },
  ];
  if (kind === "drawer") {
    const axis = placement === "left" || placement === "right" ? "X" : "Y";
    const sign = placement === "left" || placement === "top" ? -1 : 1;
    const outside = `translate${axis}(${sign * 100}%)`;
    return [
      { transform: outside, offset: 0 },
      { transform: `translate${axis}(0) scale${axis}(1.065)`, offset: .68 },
      { transform: `translate${axis}(0) scale${axis}(.975)`, offset: .86 },
      { transform: "none", offset: 1 },
    ];
  }
  const modal = kind === "modal";
  // 小浮层提高入场过冲和回收幅度，以短促形变强化弹性；大弹框沿用原有幅度。
  return [
    { opacity: 0, transform: `translateY(${modal ? 18 : -6}px) scale(${modal ? .9 : .88})`, offset: 0 },
    { opacity: 1, transform: modal ? "scale(1.075, 1.05)" : "scale(1.11, 1.085)", offset: .68 },
    { opacity: 1, transform: modal ? "scale(.965, .98)" : "scale(.945, .965)", offset: .86 },
    { opacity: 1, transform: "none", offset: 1 },
  ];
}

/** 保留退场节点并订阅真实动画完成；下拉面板沿触发器方向连续展开并快速收回，Modal/Drawer 弹性入场并快速无回弹退出，其他提示等时长反播。减少动态效果时直接完成，仅供框架弹层使用。 */
export function useOverlayMotion(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  kind: MotionKind,
  placement = "bottom",
  ready = true,
  onFinish?: (open: boolean) => void,
  enabled = true,
) {
  const [phase, setPhase] = useState<MotionPhase>(open ? "entering" : "closed");
  const present = open || phase !== "closed";
  const [entered, setEntered] = useState(false);
  // 普通提示保存正向时间轴；面板单独保存一次画面快照以衔接不同的开合轨迹。
  const position = useRef<number>();
  const snapshot = useRef<{ transform: string; opacity: string; maskOpacity?: string }>();
  const notify = useRef<boolean>();
  const callback = useRef(onFinish);
  callback.current = onFinish;

  useLayoutEffect(() => {
    const node = ref.current;
    if (!present || !ready || !node) return;
    let cancelled = false;
    let animation: Animation | undefined;
    let surfaceAnimation: Animation | undefined;
    let maskAnimation: Animation | undefined;
    const panel = kind === "drawer" || kind === "modal";
    const fluid = kind === "popup";
    const mask = kind === "modal" ? node.closest<HTMLElement>(".sia-modal-root")
      : kind === "drawer" ? node.closest(".sia-drawer-root")?.querySelector<HTMLElement>(".sia-drawer__mask") : null;
    setPhase(open ? "entering" : "closing");
    const finish = () => {
      if (cancelled) return;
      position.current = undefined;
      snapshot.current = undefined;
      // 入场结束释放动画效果，避免静止面板长期占用独立合成层。
      if (open) { animation?.cancel(); surfaceAnimation?.cancel(); maskAnimation?.cancel(); }
      notify.current = open;
      setEntered(open);
      setPhase(open ? "open" : "closed");
      // WAAPI 完成不产生 CSS animationend，通知依附面板的气泡重新校准坐标。
      node.dispatchEvent(new Event("sia-overlay-motion-end", { bubbles: true }));
    };
    const reduced = node.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)");
    const completeImmediately = () => { animation?.cancel(); surfaceAnimation?.cancel(); maskAnimation?.cancel(); finish(); };
    if (!enabled || reduced?.matches || !node.animate) {
      finish();
    } else {
      let frames = fluid ? popupFluidFrames(placement, open) : motionFrames(kind, placement);
      const start = snapshot.current;
      const enterDuration = fluid ? popupEnterDuration : kind === "drawer" ? 320 : kind === "modal" ? 240 : kind === "fade" ? 180 : 280;
      // Modal/Drawer 关闭直接回到入场起点；下拉面板缩小淡出，仅在交接时采样一次画面。
      let duration = fluid && !open ? popupExitDuration : panel && !open ? kind === "drawer" ? 180 : 160 : enterDuration;
      if (fluid && start) {
        // 中途反向直接接续到新目标，不重复入场回弹；同时考虑剩余缩放与位移，避免突然跳回位置。
        const current = new DOMMatrix(start.transform);
        const destination = new DOMMatrix(String(frames[frames.length - 1].transform));
        const remaining = Math.min(1, Math.max(.15, Math.max(Math.abs(destination.a - current.a), Math.abs(destination.d - current.d)) / (1 - popupInitialScale), Math.hypot(current.e - destination.e, current.f - destination.f) / popupTravelOffset));
        frames = [{ offset: 0, transform: start.transform, opacity: start.opacity }, { ...frames[frames.length - 1], offset: 1 }];
        duration *= remaining;
      }
      if (panel) {
        if (!open) frames = [{ transform: start?.transform ?? "none", opacity: start?.opacity ?? 1 }, { ...frames[0], offset: 1 }];
        else if (start) frames = [{ ...frames[0], transform: start.transform, opacity: start.opacity }, ...frames.slice(1)];
      }
      const options: KeyframeAnimationOptions = {
        duration, easing: fluid ? open ? "cubic-bezier(.2,.7,.2,1)" : "cubic-bezier(.4,0,1,1)" : panel && !open ? "cubic-bezier(.4,0,1,1)" : kind === "fade" ? "ease-in-out" : "cubic-bezier(.2,.7,.2,1)",
        direction: panel || fluid || open ? "normal" : "reverse", fill: "both",
      };
      animation = node.animate(frames, options);
      if (!panel && !fluid && position.current !== undefined) animation.currentTime = open ? position.current : duration - position.current;
      // 交接位置只消费一次；动画恰好完成但完成回调尚未执行时，也不能复用上次的位置。
      position.current = undefined;
      snapshot.current = undefined;
      // 遮罩共享外壳的方向与播放位置，中途关闭也不单独重播全长淡出。
      if (mask) {
        maskAnimation = mask.animate([{ opacity: start?.maskOpacity ?? (open ? 0 : 1) }, { opacity: open ? 1 : 0 }], { ...options, pseudoElement: kind === "modal" ? "::before" : undefined });
        maskAnimation.currentTime = animation.currentTime;
        if (animation.startTime !== null) maskAnimation.startTime = animation.startTime;
      }
      if (kind === "toast") {
        // 背景与正文共用方向和时间轴，保持文字稳定，反向切换也不会跳帧。
        const surfaceFrames = motionFrames("message", placement).map(frame => ({
          offset: frame.offset,
          transform: String(frame.transform).replace(/translateY\([^)]*\)\s*/g, ""),
        }));
        surfaceAnimation = node.animate(surfaceFrames, { ...options, pseudoElement: "::before" });
        surfaceAnimation.currentTime = animation.currentTime;
        if (animation.startTime !== null) surfaceAnimation.startTime = animation.startTime;
      }
      animation.finished.then(finish, () => {});
      reduced?.addEventListener("change", completeImmediately, { once: true });
    }
    return () => {
      cancelled = true;
      reduced?.removeEventListener("change", completeImmediately);
      // 先捕获当前画面再取消动画，避免快速开关时闪回静态样式；无逐帧布局读取。
      if (animation && (animation.playState === "running" || animation.playState === "paused")) {
        if (panel || fluid) {
          const css = node.ownerDocument.defaultView!.getComputedStyle(node);
          snapshot.current = { transform: css.transform, opacity: css.opacity,
            maskOpacity: mask ? node.ownerDocument.defaultView!.getComputedStyle(mask, kind === "modal" ? "::before" : null).opacity : undefined };
        } else {
          const time = Number(animation.currentTime ?? 0);
          const duration = Number(animation.effect?.getTiming().duration ?? 0);
          position.current = open ? time : duration - time;
        }
      }
      animation?.cancel();
      surfaceAnimation?.cancel();
      maskAnimation?.cancel();
    };
  }, [open, present, ready, kind, placement, enabled, ref]);

  useEffect(() => {
    if (notify.current === undefined) return;
    const completedOpen = notify.current;
    notify.current = undefined;
    // 在正文提交 DOM 后通知业务，afterOpen 中可以读取字段和聚焦。
    if (completedOpen === open) callback.current?.(completedOpen);
  }, [phase, open]);
  return { present, entered, settled: phase === "open", closing: !open, phase };
}

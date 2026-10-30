import { useEffect, useRef } from "react";

/** 点击反馈只缩放指定图形，不缩放标签文字；小图形以 360ms 在 0.68～1.34 倍间回弹，宽控件以 320ms 在 0.92～1.08 倍间回弹。每次激活采样一次，连续激活从当前比例接续。 */
export function usePressFeedback() {
  const running = useRef<Animation>();
  const cleanup = useRef<(() => void)>();
  useEffect(() => () => cleanup.current?.(), []);
  return (node: HTMLElement | null, compact = true) => {
    if (!node?.animate) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const from = getComputedStyle(node).scale;
    cleanup.current?.();
    const animation = node.animate([
      { scale: from === "none" ? "1" : from, offset: 0 },
      // 小控件放大过冲和二次回收，避免十几像素的图形回弹难以察觉。
      { scale: compact ? ".68" : ".92", offset: .18 },
      { scale: compact ? "1.34" : "1.08", offset: .46 },
      { scale: compact ? ".88" : ".96", offset: .7 },
      { scale: compact ? "1.08" : "1.025", offset: .86 },
      { scale: "1", offset: 1 },
    ], { duration: compact ? 360 : 320, easing: "cubic-bezier(.3,0,.25,1)" });
    running.current = animation;
    // 只在播放期间订阅，避免大量表格复选框闲置时各自长期监听系统设置。
    const stop = () => {
      animation.cancel();
      media.removeEventListener("change", stop);
      if (running.current === animation) { running.current = undefined; cleanup.current = undefined; }
    };
    cleanup.current = stop;
    media.addEventListener("change", stop, { once: true });
    animation.onfinish = stop;
  };
}

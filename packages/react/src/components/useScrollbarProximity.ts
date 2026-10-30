import { useEffect } from "react";

let users = 0;
let cleanup: (() => void) | undefined;

// 表格和自动接管共享一份被动指针监听器，最后一个使用者卸载时释放。
export function useScrollbarProximity() {
  useEffect(acquireScrollbarProximity, []);
}

/** 注册共享滚动条邻近检测，返回释放函数；首次注册才绑定监听器。 */
export function acquireScrollbarProximity() {
    if (users++ === 0) {
      let frame = 0;
      let x = -Infinity;
      let y = -Infinity;
      const nearby = new Set<HTMLElement>();
      const clear = () => {
        nearby.forEach(track => track.removeAttribute("data-scrollbar-near"));
        nearby.clear();
      };
      const update = () => {
        frame = 0;
        const next = new Set<HTMLElement>();
        document.querySelectorAll<HTMLElement>(".sia-scrollbar-track").forEach(track => {
          const rect = track.getBoundingClientRect();
          const proximity = Number.parseFloat(getComputedStyle(track).getPropertyValue("--sia-scrollbar-proximity")) || 16;
          if (rect.width && rect.height && x >= rect.left - proximity && x <= rect.right + proximity && y >= rect.top - proximity && y <= rect.bottom + proximity) {
            next.add(track);
            if (!nearby.has(track)) track.setAttribute("data-scrollbar-near", "true");
          }
        });
        nearby.forEach(track => { if (!next.has(track)) track.removeAttribute("data-scrollbar-near"); });
        nearby.clear();
        next.forEach(track => nearby.add(track));
      };
      const move = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        x = event.clientX;
        y = event.clientY;
        if (!frame) frame = requestAnimationFrame(update);
      };
      const leave = () => { x = y = -Infinity; clear(); };
      document.addEventListener("pointermove", move, { passive: true });
      document.documentElement.addEventListener("pointerleave", leave);
      window.addEventListener("blur", leave);
      cleanup = () => {
        if (frame) cancelAnimationFrame(frame);
        document.removeEventListener("pointermove", move);
        document.documentElement.removeEventListener("pointerleave", leave);
        window.removeEventListener("blur", leave);
        clear();
      };
    }
    return () => { if (--users === 0) { cleanup?.(); cleanup = undefined; } };
}

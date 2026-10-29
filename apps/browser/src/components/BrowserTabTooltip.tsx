import { listenNative } from "../nativeEvents";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Tooltip, applySiaTheme } from "@sia.soul/sia-react-ui";

/** 收缩标签的只读提示内容，完整名称、网址及状态分别展示。 */
export interface TabTooltipContent {
  /** 标签或分组的完整名称。 */
  title: string;
  /** 标签页网址；分组和空白页可以省略。 */
  url?: string;
  /** 分组路径、标签数量或休眠及声音状态。 */
  detail?: string;
}

interface TabTooltipPayload extends TabTooltipContent {
  /** 当前界面的深色主题状态。 */
  darkMode: boolean;
  /** 原生端的悬停代次，仅允许当前提示完成排版后显示窗口。 */
  revision?: number;
}

/** 原生窗口与网页预览共用相同的 Sia Tooltip 内容和排版。 */
function tooltipContent(content: TabTooltipContent): ReactNode {
  return <div className="browser-tab-tooltip-content">
    <strong>{content.title}</strong>
    {content.url ? <span className="browser-tab-tooltip-url">{content.url}</span> : null}
    {content.detail ? <span className="browser-tab-tooltip-detail">{content.detail}</span> : null}
  </div>;
}

/** 收缩列表的悬停入口；桌面提示跨越原生网页层，预览直接使用框架气泡。 */
export function useCompactTabTooltip(enabled: boolean) {
  const timer = useRef<number>();
  const anchor = useRef<HTMLElement | null>(null);
  const queue = useRef(Promise.resolve());
  const [preview, setPreview] = useState<{ content: TabTooltipContent; x: number; y: number } | null>(null);
  const send = (command: string, args?: Record<string, unknown>) => {
    // 按发送顺序执行，避免快速移出时迟到的显示请求重新打开提示。
    queue.current = queue.current.then(async () => {
      await window.__TAURI__?.core.invoke(command, args);
    }).catch(() => undefined);
  };
  const close = () => {
    window.clearTimeout(timer.current);
    anchor.current = null;
    setPreview(null);
    if (window.__TAURI__) send("close_browser_tab_tooltip");
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape" || event.key === "Tab") close(); };
    const visibility = () => { if (document.hidden) close(); };
    // 滚动、切换窗口、展开列表或卸载时清理，避免气泡留在旧图标旁边。
    window.addEventListener("scroll", close, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", keydown);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      close();
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", keydown);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled]);
  const handlers = (content: TabTooltipContent) => ({
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      if (!enabled || event.buttons) return;
      close();
      const element = event.currentTarget;
      anchor.current = element;
      // 短暂停留过滤快速经过，气泡本身不做淡入淡出动画。
      timer.current = window.setTimeout(() => {
        if (!element.isConnected || anchor.current !== element) return;
        const rect = element.getBoundingClientRect();
        if (window.__TAURI__) send("show_browser_tab_tooltip", {
          payload: { ...content, darkMode: document.documentElement.getAttribute("data-sia-theme") === "dark" },
          anchor: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
        else setPreview({ content, x: rect.right, y: rect.top });
      }, 180);
    },
    onMouseLeave: close,
  });
  const bubble = preview ? <Tooltip open trigger={[]} placement="right-start" overlayClassName="browser-tab-tooltip"
    title={tooltipContent(preview.content)}>
    <span className="browser-tab-tooltip-anchor" style={{ left: preview.x, top: preview.y }} />
  </Tooltip> : null;
  return { handlers, bubble };
}

/** 独立原生提示窗口只渲染 Sia 气泡，不接收鼠标点击或键盘焦点。 */
export default function BrowserTabTooltipWindow() {
  const [payload, setPayload] = useState<TabTooltipPayload | null>(null);
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let receivedEvent = false;
    void listenNative<TabTooltipPayload>("sia://browser-tab-tooltip", ({ payload: next }) => {
      receivedEvent = true;
      if (!disposed) setPayload(next);
    }).then((dispose) => { if (disposed) dispose(); else unlisten = dispose; });
    void window.__TAURI__?.core.invoke<TabTooltipPayload | null>("get_browser_tab_tooltip_state").then((next) => {
      if (!disposed && !receivedEvent) setPayload(next);
    });
    return () => { disposed = true; unlisten?.(); };
  }, []);
  useEffect(() => { if (payload) applySiaTheme(payload.darkMode ? "dark" : "light"); }, [payload]);
  useEffect(() => {
    if (payload?.revision === undefined) return;
    // 子组件的布局 effect 已完成；隐藏的原生窗口可能暂停动画帧，因此直接测量。
    const bubble = document.querySelector<HTMLElement>(".browser-tab-tooltip");
    if (!bubble) return;
    const present = () => void window.__TAURI__?.core.invoke("present_browser_tab_tooltip", {
      revision: payload.revision, height: bubble.getBoundingClientRect().height,
    }).catch(() => undefined);
    const observer = new ResizeObserver(present);
    observer.observe(bubble);
    present();
    return () => observer.disconnect();
  }, [payload]);
  return payload ? <Tooltip open trigger={[]} placement="right-start" overlayClassName="browser-tab-tooltip" title={tooltipContent(payload)}>
    <span className="browser-tab-tooltip-anchor" style={{ left: 8, top: 12 }} />
  </Tooltip> : null;
}

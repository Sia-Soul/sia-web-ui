import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button, Splitter, message } from "@sia.soul/sia-react-ui";

/** 原生工具会话按标签保存；独立窗口不占用分隔面板。 */
interface DockStatus {
  tabId: string;
  docked: boolean;
}

/** 统一入口供主界面、网页加速键及浮动 Tree 调用，避免直接打开未停靠窗口。 */
export function requestBrowserDevtools(tabId: string) {
  window.dispatchEvent(new CustomEvent("sia-open-devtools", { detail: tabId }));
}

/** 复用 Sia Splitter 排列网页与原生工具占位；工具本体仍由 WebView2 渲染。 */
export default function BrowserDevtoolsWorkspace({ tabId, children, onLayout, onSessionsChange }: {
  /** 当前活动标签，切换后仅显示该标签的工具。 */
  tabId: string;
  /** 原有网页宿主节点，停靠与关闭不会重新挂载网页内容。 */
  children: ReactNode;
  /** 网页区域尺寸变化后同步原生网页边界。 */
  onLayout: () => void;
  /** 工具会话变化时通知外壳；这些标签应暂缓自动休眠，避免销毁调试会话。 */
  onSessionsChange: (tabIds: string[]) => void;
}) {
  const [sessions, setSessions] = useState<DockStatus[]>([]);
  const [position, setPosition] = useState<"bottom" | "right">("bottom");
  const toolHost = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const opening = useRef(new Set<string>());
  const active = useRef(tabId);
  active.current = tabId;
  const docked = sessions.some(session => session.tabId === tabId && session.docked);
  const monitoring = sessions.length > 0;

  useEffect(() => { onSessionsChange(sessions.map(session => session.tabId)); }, [sessions, onSessionsChange]);

  const sync = useCallback(async () => {
    if (!window.__TAURI__ || busy.current) return;
    busy.current = true;
    try {
      const rect = toolHost.current?.getBoundingClientRect();
      // 未完成 React 布局或当前无工具时隐藏原生窗口，避免覆盖标题栏与其他标签。
      const bounds = docked && rect && rect.width > 0 && rect.height > 0
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
      const next = await window.__TAURI__.core.invoke<DockStatus[]>("layout_browser_devtools", { tabId, bounds });
      if (Array.isArray(next)) setSessions(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    } catch {
      // 单次布局失败保留现有面板，下一次尺寸变化或状态轮询重新同步。
    } finally { busy.current = false; }
  }, [tabId, docked]);

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => { onLayout(); void sync(); });
    if (workspace.current) observer.observe(workspace.current);
    if (toolHost.current) observer.observe(toolHost.current);
    onLayout();
    void sync();
    // 原生工具自身的关闭按钮不会产生 DOM 事件，定期清理已关闭会话。
    // 没有工具会话时不启动空轮询，浏览器闲置不会持续发送原生布局命令。
    const timer = monitoring ? window.setInterval(() => { void sync(); }, 400) : undefined;
    return () => { observer.disconnect(); if (timer !== undefined) window.clearInterval(timer); };
  }, [sync, position, monitoring, onLayout]);

  useEffect(() => {
    const open = async (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (!id || opening.current.has(id)) return;
      if (!window.__TAURI__) { message.info("开发者工具仅在桌面版可用。"); return; }
      opening.current.add(id);
      try {
        const attached = await window.__TAURI__.core.invoke<boolean>("open_browser_devtools", { tabId: id });
        if (attached) setSessions(current => [...current.filter(session => session.tabId !== id), { tabId: id, docked: true }]);
        else message.info("当前工具窗口保持独立显示；可以关闭后按 F12 重新尝试停靠。");
      } catch (error) { message.warning(String(error)); }
      finally { opening.current.delete(id); }
    };
    window.addEventListener("sia-open-devtools", open);
    return () => window.removeEventListener("sia-open-devtools", open);
  }, []);

  async function control(action: "close" | "detach") {
    const id = active.current;
    try {
      await window.__TAURI__?.core.invoke("control_browser_devtools", { tabId: id, action });
      setSessions(current => action === "close" ? current.filter(session => session.tabId !== id)
        : current.map(session => session.tabId === id ? { ...session, docked: false } : session));
    } catch (error) { message.warning(String(error)); }
  }

  return <div ref={workspace} className={`browser-devtools-workspace${docked ? " is-docked" : ""}`}>
    <Splitter orientation={position === "bottom" ? "vertical" : "horizontal"}
      onResize={() => { onLayout(); void sync(); }} onResizeEnd={() => { onLayout(); void sync(); }}
      onPointerDownCapture={event => {
        // 跨越原生网页和工具窗口时仍由外壳接收拖动，避免鼠标移出细分隔条后失去拖动事件。
        if (event.target instanceof Element && event.target.closest("[role='separator']")) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}>
      <Splitter.Panel defaultSize={62} min={20}>{children}</Splitter.Panel>
      <Splitter.Panel defaultSize={38} min={20}>
        {docked ? <section className="browser-devtools-dock" aria-label="开发者工具">
          <header className="browser-devtools-toolbar">
            <strong>开发者工具</strong>
            <Button size="small" variant="text" aria-pressed={position === "bottom"} onClick={() => setPosition("bottom")}>底部</Button>
            <Button size="small" variant="text" aria-pressed={position === "right"} onClick={() => setPosition("right")}>右侧</Button>
            <Button size="small" variant="text" onClick={() => void control("detach")}>独立窗口</Button>
            <Button size="small" variant="text" onClick={() => void control("close")}>关闭</Button>
          </header>
          <div ref={toolHost} className="browser-devtools-native-host" />
        </section> : null}
      </Splitter.Panel>
    </Splitter>
  </div>;
}

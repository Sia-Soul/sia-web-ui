import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { Spin, Splitter, message } from "@sia.soul/sia-react-ui";
import type { BrowserMenuItem } from "./BrowserMenuWindow";

/** 原生工具会话按标签保存；独立窗口不占用分隔面板。 */
interface DockStatus {
  tabId: string;
  docked: boolean;
  /** 原生内容完成定位及窗框裁剪后才为 true；此前保留加载提示。 */
  ready?: boolean;
}

/** 统一入口供主界面、网页加速键及浮动 Tree 调用，避免直接打开未停靠窗口。 */
export function requestBrowserDevtools(tabId: string) {
  window.dispatchEvent(new CustomEvent("sia-open-devtools", { detail: tabId }));
}

/** 将分隔条菜单的控制动作送到工具工作区；未知动作忽略，目标标签由打开菜单时确定。 */
export function controlBrowserDevtools(tabId: string, action: string) {
  window.dispatchEvent(new CustomEvent("sia-control-devtools", { detail: { tabId, action } }));
}

/** 复用 Sia Splitter 排列网页与原生工具占位；工具本体仍由 WebView2 渲染。 */
export default function BrowserDevtoolsWorkspace({ tabId, children, onLayout, onSessionsChange, onMenu }: {
  /** 当前活动标签，切换后仅显示该标签的工具。 */
  tabId: string;
  /** 原有网页宿主节点，停靠与关闭不会重新挂载网页内容。 */
  children: ReactNode;
  /** 网页区域尺寸变化后同步原生网页边界。 */
  onLayout: () => void;
  /** 工具会话变化时通知外壳；这些标签应暂缓自动休眠，避免销毁调试会话。 */
  onSessionsChange: (tabIds: string[]) => void;
  /** 在分隔条右键位置打开原生菜单，确保菜单可覆盖网页和 DevTools 窗口。 */
  onMenu: (event: MouseEvent, items: BrowserMenuItem[]) => void;
}) {
  const [sessions, setSessions] = useState<DockStatus[]>([]);
  const [position, setPosition] = useState<"bottom" | "right">("bottom");
  const toolHost = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const opening = useRef(new Map<string, symbol>());
  const revision = useRef(0);
  const [openingIds, setOpeningIds] = useState<string[]>([]);
  const docked = sessions.some(session => session.tabId === tabId && session.docked);
  const expanded = docked || openingIds.includes(tabId);
  const ready = sessions.some(session => session.tabId === tabId && session.docked && session.ready);
  const monitoring = sessions.length > 0 || openingIds.length > 0;

  useEffect(() => { onSessionsChange([...new Set([...sessions.map(session => session.tabId), ...openingIds])]); }, [sessions, openingIds, onSessionsChange]);

  const sync = useCallback(async () => {
    if (!window.__TAURI__ || busy.current) return;
    busy.current = true;
    const requestedRevision = revision.current;
    try {
      const rect = toolHost.current?.getBoundingClientRect();
      // 未完成 React 布局或当前无工具时隐藏原生窗口，避免覆盖标题栏与其他标签。
      const bounds = expanded && rect && rect.width > 0 && rect.height > 0
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
      const next = await window.__TAURI__.core.invoke<DockStatus[]>("layout_browser_devtools", { tabId, bounds });
      if (requestedRevision === revision.current && Array.isArray(next)) setSessions(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    } catch {
      // 单次布局失败保留现有面板，下一次尺寸变化或状态轮询重新同步。
    } finally { busy.current = false; }
  }, [tabId, expanded]);

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
      const request = Symbol(id);
      opening.current.set(id, request);
      revision.current++;
      setOpeningIds(current => [...current, id]);
      try {
        // 先提交占位布局，再启动原生窗口；等待两帧使网页边界与加载提示有机会完成绘制。
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (opening.current.get(id) !== request) return;
        const attached = await window.__TAURI__.core.invoke<boolean>("open_browser_devtools", { tabId: id });
        if (opening.current.get(id) !== request) return;
        revision.current++;
        if (attached) setSessions(current => [...current.filter(session => session.tabId !== id), { tabId: id, docked: true, ready: false }]);
        else message.info("当前工具窗口保持独立显示；可以关闭后按 F12 重新尝试停靠。");
      } catch (error) { if (opening.current.get(id) === request) message.warning(String(error)); }
      finally {
        if (opening.current.get(id) === request) {
          opening.current.delete(id);
          setOpeningIds(current => current.filter(value => value !== id));
        }
      }
    };
    window.addEventListener("sia-open-devtools", open);
    return () => window.removeEventListener("sia-open-devtools", open);
  }, []);

  useEffect(() => {
    const control = async (event: Event) => {
      const { tabId: id, action } = (event as CustomEvent<{ tabId: string; action: string }>).detail;
      if (action === "bottom" || action === "right") { setPosition(action); return; }
      if (action !== "close" && action !== "detach") return;
      // 关闭尚在准备中的面板立即撤销本地占位；晚到的打开结果不能重新展开面板。
      opening.current.delete(id);
      revision.current++;
      setOpeningIds(current => current.filter(value => value !== id));
      try {
        await window.__TAURI__?.core.invoke("control_browser_devtools", { tabId: id, action });
        setSessions(current => action === "close" ? current.filter(session => session.tabId !== id)
          : current.map(session => session.tabId === id ? { ...session, docked: false } : session));
      } catch (error) { message.warning(String(error)); }
    };
    window.addEventListener("sia-control-devtools", control);
    return () => window.removeEventListener("sia-control-devtools", control);
  }, []);

  return <div ref={workspace} className={`browser-devtools-workspace${expanded ? " is-docked" : ""}`}>
    <Splitter orientation={position === "bottom" ? "vertical" : "horizontal"}
      onContextMenu={event => {
        // 只接管分隔条右键，网页和 DevTools 内容保留各自原生菜单。
        if (!(event.target instanceof Element) || !event.target.closest("[role='separator']")) return;
        event.preventDefault();
        onMenu(event, [
          { key: `devtools|${tabId}|bottom`, label: "停靠到底部", checked: position === "bottom" },
          { key: `devtools|${tabId}|right`, label: "停靠到右侧", checked: position === "right" },
          { key: `devtools|${tabId}|detach`, label: "独立窗口" },
          { key: `devtools|${tabId}|close`, label: "关闭开发者工具" },
        ]);
      }}
      onResize={() => { onLayout(); void sync(); }} onResizeEnd={() => { onLayout(); void sync(); }}
      onPointerDownCapture={event => {
        // 跨越原生网页和工具窗口时仍由外壳接收拖动，避免鼠标移出细分隔条后失去拖动事件。
        if (event.target instanceof Element && event.target.closest("[role='separator']")) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}>
      <Splitter.Panel defaultSize={62} min={20}>{children}</Splitter.Panel>
      <Splitter.Panel defaultSize={38} min={20}>
        {expanded ? <section className="browser-devtools-dock" aria-label="开发者工具" aria-busy={!ready}>
          {/* 原生内容直接填满工具面板；停靠控制放到分隔条右键菜单中。 */}
          <div ref={toolHost} className="browser-devtools-native-host">
            {!ready ? <Spin className="browser-devtools-loading" tip="正在加载开发者工具…" /> : null}
          </div>
        </section> : null}
      </Splitter.Panel>
    </Splitter>
  </div>;
}

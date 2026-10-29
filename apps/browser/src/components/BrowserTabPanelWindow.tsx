import { listenNative } from "../nativeEvents";
import { useEffect, useMemo, useRef, useState } from "react";
import { applySiaTheme, message } from "@sia.soul/sia-react-ui";
import type { BrowserGroup, BrowserTab } from "../browserTypes";
import { ROOT_GROUP_ID } from "../browserTypes";
import VerticalTabTree from "./VerticalTabTree";

export interface FloatingTabPanelPayload {
  groups: BrowserGroup[];
  tabs: BrowserTab[];
  activeId: string;
  darkMode: boolean;
  closedTabCount: number;
  panelExpanded: boolean;
  panelPinned: boolean;
  panelWidth: number;
  collapsedGroupIds: string[];
  collapsedSmallGroupIds: string[];
}

interface FloatingTabPanelAction {
  action: string;
  value?: string;
}

async function invokeNative<T>(command: string, args?: Record<string, unknown>) {
  if (!window.__TAURI__) throw new Error("浮动标签面板仅在桌面版中可用");
  return window.__TAURI__.core.invoke<T>(command, args);
}

export default function BrowserTabPanelWindow() {
  const [payload, setPayload] = useState<FloatingTabPanelPayload | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const panelVisibleRef = useRef(false);
  const panelOpeningRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let pollTimer: number | undefined;
    let lastPayloadSignature = "";
    const acceptPayload = (nextPayload: FloatingTabPanelPayload) => {
      if (disposed) return;
      const signature = JSON.stringify(nextPayload);
      if (signature === lastPayloadSignature) return;
      lastPayloadSignature = signature;
      setPayload(nextPayload);
    };
    const readCurrentState = () => {
      void invokeNative<FloatingTabPanelPayload | null>("get_floating_tab_panel_state")
        .then((state) => {
          if (state) acceptPayload(state);
        })
        .catch(() => undefined);
    };
    readCurrentState();
    pollTimer = window.setInterval(readCurrentState, 200);
    if (window.__TAURI__) {
      void listenNative<FloatingTabPanelPayload>(
        "sia://floating-tab-panel-state",
        ({ payload: nextPayload }) => {
          acceptPayload(nextPayload);
        },
      ).then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      });
    }
    return () => {
      disposed = true;
      if (pollTimer !== undefined) window.clearInterval(pollTimer);
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!payload) return;
    applySiaTheme(payload.darkMode ? "dark" : "light");
  }, [payload]);

  useEffect(() => {
    if (!window.__TAURI__) return undefined;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let openFrame: number | undefined;
    let settleFrame: number | undefined;
    void listenNative<boolean>(
      "sia://floating-tab-panel-visibility",
      ({ payload: visible }) => {
        if (disposed) return;
        if (!visible) {
          if (openFrame !== undefined) window.cancelAnimationFrame(openFrame);
          if (settleFrame !== undefined) window.cancelAnimationFrame(settleFrame);
          panelOpeningRef.current = false;
          panelVisibleRef.current = false;
          setPanelVisible(false);
          return;
        }
        if (panelVisibleRef.current || panelOpeningRef.current) return;
        panelOpeningRef.current = true;
        setPanelVisible(false);
        openFrame = window.requestAnimationFrame(() => {
          settleFrame = window.requestAnimationFrame(() => {
            if (!disposed) {
              panelOpeningRef.current = false;
              panelVisibleRef.current = true;
              setPanelVisible(true);
            }
          });
        });
      },
    ).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => {
      disposed = true;
      panelOpeningRef.current = false;
      if (openFrame !== undefined) window.cancelAnimationFrame(openFrame);
      if (settleFrame !== undefined) window.cancelAnimationFrame(settleFrame);
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const documentRoot = document.documentElement;
    // 离开浮动侧栏仍按原生位置收起；滚动条可见性由 Tree 内的框架组件管理。
    const handlePointerLeave = () => {
      if (!payload?.panelPinned) {
        void invokeNative("close_floating_tab_panel_if_pointer_outside").catch(() => undefined);
      }
    };
    documentRoot.addEventListener("mouseleave", handlePointerLeave);
    return () => {
      documentRoot.removeEventListener("mouseleave", handlePointerLeave);
    };
  }, [payload?.panelPinned]);

  const orderedTabs = useMemo(() => {
    if (!payload) return [];
    const ordered: BrowserTab[] = [];
    for (const group of payload.groups) {
      const groupTabs = payload.tabs.filter((tab) => tab.groupId === group.id);
      for (const smallGroup of group.smallGroups) {
        ordered.push(...groupTabs.filter((tab) => tab.smallGroupId === smallGroup.id));
      }
      ordered.push(...groupTabs.filter((tab) => !tab.smallGroupId));
    }
    ordered.push(...payload.tabs.filter((tab) => tab.groupId === ROOT_GROUP_ID));
    return ordered;
  }, [payload]);

  function sendAction(action: string, value?: string) {
    void invokeNative("floating_tab_panel_action", {
      action: { action, value } satisfies FloatingTabPanelAction,
    }).catch((error) => {
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function openTabMenu(tabId: string, x: number, y: number) {
    if (!payload) return;
    const contextTab = payload.tabs.find((tab) => tab.id === tabId);
    if (!contextTab) return;
    const contextIndex = orderedTabs.findIndex((tab) => tab.id === tabId);
    void invokeNative("show_browser_tab_menu", {
      tabId,
      adjacentDirection: "下方",
      groups: payload.groups.map((group) => ({
        id: group.id,
        name: group.name,
        disabled: group.id === contextTab.groupId && !contextTab.smallGroupId,
      })),
      pinned: Boolean(contextTab.pinned),
      muted: Boolean(contextTab.muted),
      disableCloseOthers: payload.tabs.length <= 1,
      disableCloseFollowing: contextIndex < 0 || contextIndex >= orderedTabs.length - 1,
      disableReopenClosed: payload.closedTabCount === 0,
      darkMode: payload.darkMode,
      sourceWindow: "sia-tab-panel-window",
      x,
      y,
    }).catch((error) => {
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  if (!payload) return null;

  return (
    <div
      className={`browser-floating-tab-panel-host${payload.panelPinned ? " is-pinned" : ""}`}
    >
      <div
        className={`browser-floating-tab-panel${payload.panelPinned ? " is-pinned" : ""}${panelVisible ? " is-visible" : ""}`}
        onContextMenu={(event) => {
          event.preventDefault();
          const target = event.target;
          const tabElement = target instanceof Element
            ? target.closest<HTMLElement>("[data-browser-tab-id]")
            : null;
          const tabId = tabElement?.dataset.browserTabId;
          if (tabId) openTabMenu(tabId, event.clientX, event.clientY);
        }}
      >
        <VerticalTabTree
            floatingWindow={!payload.panelPinned}
            panelExpanded={payload.panelExpanded}
            panelPinned={payload.panelPinned}
            panelWidth={payload.panelWidth}
            groups={payload.groups}
            tabs={payload.tabs}
            activeId={payload.activeId}
            collapsedGroupIds={payload.collapsedGroupIds ?? []}
            collapsedSmallGroupIds={payload.collapsedSmallGroupIds ?? []}
            onSelect={(tabId) => sendAction("select", tabId)}
            // 使用结构化内容传递目标分组，避免名称或标识中的分隔符影响解析。
            // 同时传递插入锚点，让独立侧栏与主窗口使用相同的排序及跨组移动规则。
            onMoveTab={(tabId, groupId, smallGroupId, beforeTabId) => sendAction("move-tab", JSON.stringify({ tabId, groupId, smallGroupId, beforeTabId }))}
            onMoveGroup={(item, target) => sendAction("move-group", JSON.stringify({ item, target }))}
            onDetach={(item) => {
              // 在源面板立即读取鼠标落点，避免跨 WebView 消息延迟后用户已移动鼠标。
              void invokeNative<[number, number] | null>("browser_drag_outside").then(position => {
                if (position) sendAction("detach", JSON.stringify({ item, position }));
              }).catch(error => message.error(String(error)));
            }}
            onClose={(tabId) => sendAction("close", tabId)}
            onToggleAudio={(tabId) => sendAction("toggle-audio", tabId)}
            onNewTab={(groupId, smallGroupId) => {
              sendAction("new-tab", [groupId, smallGroupId ?? ""].join("|"));
            }}
            onNewRootTab={() => sendAction("new-root-tab")}
            onNewGroup={() => sendAction("new-group")}
            onToggleGroup={(groupId) => sendAction("toggle-group", groupId)}
            onToggleSmallGroup={(smallGroupId) => sendAction("toggle-small-group", smallGroupId)}
            onTreeActionsOpen={(groupId, smallGroupId, x, y) => {
              void invokeNative("show_browser_tree_menu", {
                groupId,
                smallGroupId,
                darkMode: payload.darkMode,
                sourceWindow: "sia-tab-panel-window",
                x,
                y,
              }).catch((error) => {
                message.error(error instanceof Error ? error.message : String(error));
              });
            }}
            onPinPanel={() => sendAction("toggle-panel-pin")}
            onPanelWidthChange={(width) => sendAction("resize-panel", String(width))}
        />
      </div>
    </div>
  );
}

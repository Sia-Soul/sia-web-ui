import { useEffect, useMemo, useState } from "react";
import { applySiaTheme, message } from "@sia-ui/react";
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
      void window.__TAURI__.event.listen<FloatingTabPanelPayload>(
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
      className="browser-floating-tab-panel"
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
        floatingWindow
        panelExpanded={payload.panelExpanded}
        panelPinned={payload.panelPinned}
        panelWidth={payload.panelWidth}
        groups={payload.groups}
        tabs={payload.tabs}
        activeId={payload.activeId}
        collapsedGroupIds={payload.collapsedGroupIds ?? []}
        collapsedSmallGroupIds={payload.collapsedSmallGroupIds ?? []}
        onSelect={(tabId) => sendAction("select", tabId)}
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
  );
}

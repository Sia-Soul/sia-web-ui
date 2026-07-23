import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent as ReactMouseEvent } from "react";
import {
  Button,
  Icon,
  Input,
  Modal,
  applySiaTheme,
  message,
  type IconName,
} from "@sia-ui/react";
import HorizontalTabStrip from "./components/HorizontalTabStrip";
import VerticalTabTree from "./components/VerticalTabTree";
import {
  BROWSER_GROUPS,
  DEFAULT_GROUP_ID,
  ROOT_GROUP_ID,
  type BrowserGroup,
  type BrowserTab,
  type TabLayoutMode,
} from "./browserTypes";

interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BrowserNativeEvent {
  tabId: string;
  kind: "load" | "title" | "new-window" | "audio" | "error";
  groupId?: string;
  url?: string;
  title?: string;
  loading?: boolean;
  audible?: boolean;
  muted?: boolean;
  message?: string;
}

interface BrowserPersistedState {
  version: 1 | 2;
  tabs: BrowserTab[];
  groups: BrowserGroup[];
  activeId: string;
  tabLayout: TabLayoutMode;
  layoutPreferenceSet?: boolean;
  bookmarks?: Bookmark[];
  showBookmarksBar?: boolean;
}

interface Bookmark {
  title: string;
  url: string;
}

interface QuickLink extends Bookmark {
  icon: IconName;
  tone: string;
}

type TreeEditKind = "new-small-group" | "rename-group" | "rename-small-group";

interface TreeEditDialog {
  kind: TreeEditKind;
  groupId: string;
  smallGroupId?: string;
}

const isDesktopRuntime = Boolean(window.__TAURI__);

const DEFAULT_BOOKMARKS: readonly Bookmark[] = [
  { title: "Sia WebUI", url: "https://github.com" },
  { title: "Tauri", url: "https://tauri.app" },
  { title: "React", url: "https://react.dev" },
];

const QUICK_LINKS: readonly QuickLink[] = [
  { title: "GitHub", url: "https://github.com", icon: "github", tone: "#24292f" },
  { title: "Tauri", url: "https://tauri.app", icon: "desktop", tone: "#ffc131" },
  { title: "React", url: "https://react.dev", icon: "component", tone: "#149eca" },
  { title: "MDN", url: "https://developer.mozilla.org", icon: "book", tone: "#6b57ff" },
  { title: "Bing", url: "https://www.bing.com", icon: "search", tone: "#0c8a7b" },
  { title: "设置", url: "", icon: "settings", tone: "#607089" },
];

const GROUP_COLOR_PALETTE = [
  "#5548f6",
  "#a244f2",
  "#f05a13",
  "#119d91",
  "#2867df",
  "#d13b77",
  "#b17900",
  "#0086b3",
] as const;

const TAB_SLEEP_DELAY_MS = 30 * 60 * 1000;

function createTabId() {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createGroupId() {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createSmallGroupId(groupId: string) {
  return `${groupId}-small-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createBlankTab(groupId = DEFAULT_GROUP_ID, smallGroupId?: string): BrowserTab {
  return {
    id: createTabId(),
    title: "新标签页",
    url: "",
    loading: false,
    hasWebview: false,
    sleeping: false,
    audible: false,
    muted: false,
    groupId,
    smallGroupId,
  };
}

const FIRST_TAB = createBlankTab();

function resolveAddress(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value)) return `http://${value}`;
  if (!/\s/.test(value) && (/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(value) || /^\d{1,3}(?:\.\d{1,3}){3}/.test(value))) {
    return `https://${value}`;
  }
  return `https://www.bing.com/search?q=${encodeURIComponent(value)}`;
}

function hostLabel(url: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function invokeNative<T>(command: string, args?: Record<string, unknown>) {
  if (!window.__TAURI__) return undefined;
  return window.__TAURI__.core.invoke<T>(command, args);
}

export default function App() {
  const [tabs, setTabs] = useState<BrowserTab[]>([FIRST_TAB]);
  const [activeId, setActiveId] = useState(FIRST_TAB.id);
  const [addressDraft, setAddressDraft] = useState("");
  const [newTabQuery, setNewTabQuery] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [groups, setGroups] = useState<BrowserGroup[]>(() => [...BROWSER_GROUPS]);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [treeEditDialog, setTreeEditDialog] = useState<TreeEditDialog | null>(null);
  const [treeEditName, setTreeEditName] = useState("");
  const [tabLayout, setTabLayout] = useState<TabLayoutMode>("vertical");
  const [layoutPreferenceSet, setLayoutPreferenceSet] = useState(false);
  const [stateHydrated, setStateHydrated] = useState(!isDesktopRuntime);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([...DEFAULT_BOOKMARKS]);
  const [showBookmarksBar, setShowBookmarksBar] = useState(true);
  const [closedTabs, setClosedTabs] = useState<BrowserTab[]>([]);
  const pageHostRef = useRef<HTMLDivElement | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const addressFocusedRef = useRef(false);
  const previewNoticeShownRef = useRef(false);
  const boundsRef = useRef<BrowserBounds>({ x: 0, y: 126, width: 1200, height: 700 });
  const activeTabRef = useRef<BrowserTab>(FIRST_TAB);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeId) ?? tabs[0],
    [activeId, tabs],
  );
  const activeBookmarked = Boolean(activeTab?.url && bookmarks.some((bookmark) => bookmark.url === activeTab.url));

  useEffect(() => {
    if (activeTab) activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const candidates = tabs.filter((tab) => (
      tab.id !== activeId
      && tab.hasWebview
      && !tab.sleeping
      && tab.inactiveSince !== undefined
    ));
    if (candidates.length === 0) return undefined;

    const nextSleepAt = Math.min(...candidates.map((tab) => (tab.inactiveSince ?? Date.now()) + TAB_SLEEP_DELAY_MS));
    const delay = Math.max(0, nextSleepAt - Date.now());
    const timer = window.setTimeout(() => {
      const now = Date.now();
      const sleepingIds = new Set(candidates
        .filter((tab) => (
          tab.id !== activeId
          && tab.inactiveSince !== undefined
          && now - tab.inactiveSince >= TAB_SLEEP_DELAY_MS
        ))
        .map((tab) => tab.id));
      if (sleepingIds.size === 0) return;

      setTabs((current) => current.map((tab) => sleepingIds.has(tab.id)
        ? { ...tab, loading: false, hasWebview: false, sleeping: true, audible: false }
        : tab));
      if (isDesktopRuntime) {
        for (const tabId of sleepingIds) {
          void invokeNative("close_browser_tab", { tabId }).catch(() => undefined);
        }
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [activeId, tabs]);

  const updateTab = useCallback((tabId: string, patch: Partial<BrowserTab>) => {
    setTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, ...patch } : tab));
  }, []);

  const showPreviewNotice = useCallback(() => {
    if (previewNoticeShownRef.current) return;
    previewNoticeShownRef.current = true;
    message.info("当前是 Web 界面预览；运行 pnpm browser:dev 后会使用原生 WebView2 加载网页。");
  }, []);

  const openTab = useCallback((url?: string, groupId?: string, smallGroupId?: string) => {
    const currentTab = activeTabRef.current;
    const resolvedGroupId = groupId ?? currentTab.groupId ?? DEFAULT_GROUP_ID;
    const resolvedSmallGroupId = smallGroupId ?? (groupId ? undefined : currentTab.smallGroupId);
    const tab = createBlankTab(resolvedGroupId, resolvedSmallGroupId);
    const targetUrl = url ? resolveAddress(url) : "";
    const nextTab: BrowserTab = targetUrl
      ? { ...tab, title: hostLabel(targetUrl) || "正在加载", url: targetUrl, loading: true, hasWebview: true }
      : tab;

    const inactiveSince = Date.now();
    setTabs((current) => [
      ...current.map((item) => item.id === currentTab.id ? { ...item, inactiveSince } : item),
      nextTab,
    ]);
    setActiveId(nextTab.id);
    setAddressDraft(targetUrl);

    if (!isDesktopRuntime) {
      if (targetUrl) showPreviewNotice();
      return;
    }

    const command = targetUrl ? "open_browser_tab" : "switch_browser_tab";
    const args = targetUrl
      ? { tabId: nextTab.id, groupId: nextTab.groupId, url: targetUrl, bounds: boundsRef.current }
      : { tabId: nextTab.id, bounds: boundsRef.current };
    void invokeNative(command, args).catch((error) => {
      updateTab(nextTab.id, { loading: false, title: "加载失败" });
      message.error(error instanceof Error ? error.message : String(error));
    });
  }, [showPreviewNotice, updateTab]);

  function openAdjacentTab(sourceId: string, duplicate = false) {
    const source = tabs.find((tab) => tab.id === sourceId);
    if (!source) return;
    const blankTab = createBlankTab(source.groupId, source.smallGroupId);
    const nextTab: BrowserTab = duplicate && source.url
      ? {
          ...blankTab,
          title: source.title,
          url: source.url,
          loading: true,
          hasWebview: true,
          muted: source.muted,
        }
      : blankTab;
    const inactiveSince = Date.now();
    setTabs((current) => {
      const sourceIndex = current.findIndex((tab) => tab.id === sourceId);
      const next = current.map((tab) => tab.id === activeId ? { ...tab, inactiveSince } : tab);
      next.splice(Math.max(0, sourceIndex) + 1, 0, nextTab);
      return next;
    });
    activeTabRef.current = nextTab;
    setActiveId(nextTab.id);
    setAddressDraft(nextTab.url);

    if (!isDesktopRuntime) {
      if (nextTab.url) showPreviewNotice();
      return;
    }
    if (!nextTab.url) {
      void invokeNative("switch_browser_tab", {
        tabId: nextTab.id,
        bounds: boundsRef.current,
      }).catch(() => undefined);
      return;
    }
    void invokeNative("open_browser_tab", {
      tabId: nextTab.id,
      groupId: nextTab.groupId,
      url: nextTab.url,
      bounds: boundsRef.current,
    }).then(() => {
      if (nextTab.muted) {
        return invokeNative("set_browser_tab_muted", { tabId: nextTab.id, muted: true });
      }
      return undefined;
    }).catch((error) => {
      updateTab(nextTab.id, { loading: false, hasWebview: false, sleeping: true });
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  const syncBrowserBounds = useCallback(() => {
    const host = pageHostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const bounds: BrowserBounds = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
    boundsRef.current = bounds;
    if (isDesktopRuntime) {
      void invokeNative("set_browser_bounds", { bounds }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    syncBrowserBounds();
    const observer = new ResizeObserver(syncBrowserBounds);
    if (pageHostRef.current) observer.observe(pageHostRef.current);
    window.addEventListener("resize", syncBrowserBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncBrowserBounds);
    };
  }, [syncBrowserBounds]);

  useEffect(() => {
    if (!isDesktopRuntime) return undefined;
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;

    void invokeNative<BrowserPersistedState | null>("load_browser_state")
      .then((state) => {
        if (cancelled || !state || !Array.isArray(state.tabs) || state.tabs.length === 0) return;
        const savedActiveId = state.tabs.some((tab) => tab.id === state.activeId)
          ? state.activeId
          : state.tabs[0].id;
        const restoredTabs = state.tabs.map((tab) => {
          const active = tab.id === savedActiveId;
          return {
            ...tab,
            loading: active && Boolean(tab.url),
            hasWebview: active && Boolean(tab.url),
            sleeping: !active && Boolean(tab.url),
            inactiveSince: active ? undefined : tab.inactiveSince,
            audible: false,
            muted: Boolean(tab.muted),
            pinned: Boolean(tab.pinned),
          };
        });
        const restoredActiveTab = restoredTabs.find((tab) => tab.id === savedActiveId) ?? restoredTabs[0];

        setTabs(restoredTabs);
        setGroups(Array.isArray(state.groups) ? state.groups : [...BROWSER_GROUPS]);
        setActiveId(restoredActiveTab.id);
        setAddressDraft(restoredActiveTab.url);
        setTabLayout(
          state.layoutPreferenceSet
            ? (state.tabLayout === "horizontal" ? "horizontal" : "vertical")
            : "vertical",
        );
        setLayoutPreferenceSet(Boolean(state.layoutPreferenceSet));
        if (Array.isArray(state.bookmarks)) setBookmarks(state.bookmarks);
        setShowBookmarksBar(state.showBookmarksBar !== false);
        activeTabRef.current = restoredActiveTab;

        if (restoredActiveTab.url) {
          firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
              if (cancelled) return;
              syncBrowserBounds();
              void invokeNative("open_browser_tab", {
                tabId: restoredActiveTab.id,
                groupId: restoredActiveTab.groupId,
                url: restoredActiveTab.url,
                bounds: boundsRef.current,
              }).then(() => {
                if (restoredActiveTab.muted) {
                  return invokeNative("set_browser_tab_muted", {
                    tabId: restoredActiveTab.id,
                    muted: true,
                  });
                }
                return undefined;
              }).catch((error) => {
                updateTab(restoredActiveTab.id, { loading: false, hasWebview: false, sleeping: true });
                message.error(error instanceof Error ? error.message : String(error));
              });
            });
          });
        }
      })
      .catch((error) => {
        if (!cancelled) message.warning(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setStateHydrated(true);
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [syncBrowserBounds, updateTab]);

  useEffect(() => {
    if (!isDesktopRuntime || !stateHydrated) return undefined;
    const timer = window.setTimeout(() => {
      const state: BrowserPersistedState = {
        version: 2,
        activeId,
        tabLayout,
        layoutPreferenceSet,
        groups,
        bookmarks,
        showBookmarksBar,
        tabs: tabs.map((tab) => ({
          ...tab,
          loading: false,
          hasWebview: false,
          sleeping: tab.id !== activeId && Boolean(tab.url),
          inactiveSince: tab.id === activeId ? undefined : tab.inactiveSince,
          audible: false,
        })),
      };
      void invokeNative("save_browser_state", { state }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [activeId, bookmarks, groups, layoutPreferenceSet, showBookmarksBar, stateHydrated, tabLayout, tabs]);

  useEffect(() => {
    if (!isDesktopRuntime || !window.__TAURI__) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;

    void window.__TAURI__.event.listen<BrowserNativeEvent>("sia://browser-event", ({ payload }) => {
      if (payload.kind === "new-window" && payload.url) {
        openTab(payload.url, payload.groupId);
        return;
      }
      if (payload.kind === "error") {
        if (payload.message) message.warning(payload.message);
        return;
      }
      setTabs((current) => current.map((tab) => {
        if (tab.id !== payload.tabId) return tab;
        if (payload.kind === "title") {
          return { ...tab, title: payload.title?.trim() || hostLabel(tab.url) || "新标签页" };
        }
        if (payload.kind === "audio") {
          return {
            ...tab,
            audible: payload.audible ?? tab.audible,
            muted: payload.muted ?? tab.muted,
          };
        }
        return {
          ...tab,
          url: payload.url ?? tab.url,
          loading: payload.loading ?? tab.loading,
          hasWebview: true,
          sleeping: false,
        };
      }));
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [openTab]);

  useEffect(() => {
    if (!addressFocusedRef.current) setAddressDraft(activeTab?.url ?? "");
  }, [activeId, activeTab?.url]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncBrowserBounds);
    return () => window.cancelAnimationFrame(frame);
  }, [syncBrowserBounds, tabLayout]);

  function navigate(rawValue: string, tabId = activeId) {
    const targetUrl = resolveAddress(rawValue);
    if (!targetUrl) return;
    updateTab(tabId, {
      url: targetUrl,
      title: hostLabel(targetUrl) || "正在加载",
      loading: true,
      hasWebview: true,
      sleeping: false,
    });
    if (tabId === activeId) setAddressDraft(targetUrl);

    if (!isDesktopRuntime) {
      showPreviewNotice();
      return;
    }
    void invokeNative("open_browser_tab", {
      tabId,
      groupId: tabs.find((tab) => tab.id === tabId)?.groupId ?? DEFAULT_GROUP_ID,
      url: targetUrl,
      bounds: boundsRef.current,
    }).catch((error) => {
      updateTab(tabId, { loading: false, title: "加载失败" });
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function handleAddressSubmit(event: FormEvent) {
    event.preventDefault();
    navigate(addressDraft);
  }

  function handleNewTabSearch(event: FormEvent) {
    event.preventDefault();
    navigate(newTabQuery);
  }

  function selectTab(tabId: string) {
    const selected = tabs.find((tab) => tab.id === tabId);
    if (!selected || tabId === activeId) return;
    const shouldRestore = selected.sleeping && Boolean(selected.url);
    const inactiveSince = Date.now();
    const activatedTab: BrowserTab = {
      ...selected,
      loading: shouldRestore ? true : selected.loading,
      hasWebview: shouldRestore ? true : selected.hasWebview,
      sleeping: false,
      inactiveSince: undefined,
    };
    activeTabRef.current = activatedTab;
    setTabs((current) => current.map((tab) => {
      if (tab.id === tabId) return activatedTab;
      if (tab.id === activeId) return { ...tab, inactiveSince };
      return tab;
    }));
    setActiveId(tabId);
    setAddressDraft(selected?.url ?? "");
    if (isDesktopRuntime) {
      const command = shouldRestore ? "open_browser_tab" : "switch_browser_tab";
      const args = shouldRestore
        ? {
            tabId,
            groupId: selected.groupId,
            url: selected.url,
            bounds: boundsRef.current,
          }
        : { tabId, bounds: boundsRef.current };
      void invokeNative(command, args)
        .then(() => {
          if (shouldRestore && selected.muted) {
            return invokeNative("set_browser_tab_muted", { tabId, muted: true });
          }
          return undefined;
        })
        .catch((error) => {
          if (shouldRestore) {
            updateTab(tabId, { loading: false, hasWebview: false, sleeping: true });
          }
          message.error(error instanceof Error ? error.message : String(error));
        });
    }
  }

  function closeTab(tabId: string) {
    closeTabsByIds([tabId]);
  }

  function closeTabsByIds(tabIds: readonly string[]) {
    const closingIds = new Set(tabIds);
    const removedTabs = tabs.filter((tab) => closingIds.has(tab.id));
    if (removedTabs.length === 0) return;
    const firstClosedIndex = Math.min(...removedTabs.map((tab) => tabs.findIndex((item) => item.id === tab.id)));
    let remaining = tabs.filter((tab) => !closingIds.has(tab.id));
    if (remaining.length === 0) {
      const source = removedTabs[0];
      remaining = [createBlankTab(source.groupId, source.smallGroupId)];
    }
    setClosedTabs((current) => [...current, ...removedTabs].slice(-20));

    if (isDesktopRuntime) {
      for (const tab of removedTabs) {
        void invokeNative("close_browser_tab", { tabId: tab.id }).catch(() => undefined);
      }
    }

    if (!closingIds.has(activeId)) {
      setTabs(remaining);
      return;
    }

    const nextIndex = Math.min(firstClosedIndex, remaining.length - 1);
    const nextTab = remaining[nextIndex];
    const shouldRestore = nextTab.sleeping && Boolean(nextTab.url);
    const activatedTab: BrowserTab = {
      ...nextTab,
      loading: shouldRestore ? true : nextTab.loading,
      hasWebview: shouldRestore ? true : nextTab.hasWebview,
      sleeping: false,
      inactiveSince: undefined,
    };
    remaining = remaining.map((tab, index) => index === nextIndex ? activatedTab : tab);
    activeTabRef.current = activatedTab;
    setTabs(remaining);
    setActiveId(activatedTab.id);
    setAddressDraft(activatedTab.url);
    if (!isDesktopRuntime) return;

    const command = shouldRestore ? "open_browser_tab" : "switch_browser_tab";
    const args = shouldRestore
      ? {
          tabId: activatedTab.id,
          groupId: activatedTab.groupId,
          url: activatedTab.url,
          bounds: boundsRef.current,
        }
      : { tabId: activatedTab.id, bounds: boundsRef.current };
    void invokeNative(command, args)
      .then(() => {
        if (shouldRestore && activatedTab.muted) {
          return invokeNative("set_browser_tab_muted", {
            tabId: activatedTab.id,
            muted: true,
          });
        }
        return undefined;
      })
      .catch(() => undefined);
  }

  function goHome() {
    if (!activeTab) return;
    updateTab(activeTab.id, {
      title: "新标签页",
      url: "",
      loading: false,
      hasWebview: false,
      sleeping: false,
      inactiveSince: undefined,
      audible: false,
      muted: false,
    });
    setAddressDraft("");
    if (isDesktopRuntime) {
      void invokeNative("close_browser_tab", { tabId: activeTab.id }).catch(() => undefined);
    }
  }

  function runPageAction(action: "back" | "forward" | "reload" | "stop") {
    if (!activeTab?.hasWebview) return;
    if (action === "stop") updateTab(activeTab.id, { loading: false });
    if (action === "reload") updateTab(activeTab.id, { loading: true });
    if (!isDesktopRuntime) {
      showPreviewNotice();
      return;
    }
    void invokeNative("browser_page_action", { tabId: activeTab.id, action }).catch((error) => {
      message.warning(error instanceof Error ? error.message : String(error));
    });
  }

  function toggleTabAudio(tabId: string) {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;
    const muted = !tab.muted;
    updateTab(tabId, { muted });
    if (!isDesktopRuntime || !tab.hasWebview) return;
    void invokeNative("set_browser_tab_muted", { tabId, muted }).catch((error) => {
      updateTab(tabId, { muted: !muted });
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function refreshTab(tabId: string) {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab?.url) {
      message.info("当前标签页还没有打开网页。");
      return;
    }
    if (tab.sleeping || !tab.hasWebview) {
      if (tab.id !== activeId) selectTab(tab.id);
      else navigate(tab.url, tab.id);
      return;
    }
    updateTab(tab.id, { loading: true });
    if (!isDesktopRuntime) {
      showPreviewNotice();
      return;
    }
    void invokeNative("browser_page_action", { tabId: tab.id, action: "reload" }).catch((error) => {
      updateTab(tab.id, { loading: false });
      message.warning(error instanceof Error ? error.message : String(error));
    });
  }

  function moveTabToGroup(tabId: string, groupId: string) {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab || !groups.some((group) => group.id === groupId)) return;
    const active = tab.id === activeId;
    const updatedTab: BrowserTab = {
      ...tab,
      groupId,
      smallGroupId: undefined,
      loading: active && Boolean(tab.url),
      hasWebview: active && Boolean(tab.url),
      sleeping: !active && Boolean(tab.url),
      audible: false,
    };
    setTabs((current) => current.map((item) => item.id === tabId ? updatedTab : item));
    if (active) activeTabRef.current = updatedTab;
    if (!isDesktopRuntime || !tab.hasWebview) return;

    void invokeNative("close_browser_tab", { tabId }).then(() => {
      if (!active || !tab.url) return undefined;
      return invokeNative("open_browser_tab", {
        tabId,
        groupId,
        url: tab.url,
        bounds: boundsRef.current,
      }).then(() => {
        if (tab.muted) {
          return invokeNative("set_browser_tab_muted", { tabId, muted: true });
        }
        return undefined;
      });
    }).catch((error) => {
      updateTab(tabId, { loading: false, hasWebview: false, sleeping: Boolean(tab.url) });
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function togglePinnedTab(tabId: string) {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;
    const pinned = !tab.pinned;
    setTabs((current) => {
      const updated = { ...tab, pinned };
      const without = current.filter((item) => item.id !== tabId);
      if (pinned) return [updated, ...without];
      let lastPinnedIndex = -1;
      without.forEach((item, index) => {
        if (item.pinned) lastPinnedIndex = index;
      });
      without.splice(lastPinnedIndex + 1, 0, updated);
      return without;
    });
    if (tab.id === activeId) activeTabRef.current = { ...tab, pinned };
  }

  function reopenLastClosedTab() {
    const closed = closedTabs.at(-1);
    if (!closed) return;
    const groupId = groups.some((group) => group.id === closed.groupId)
      ? closed.groupId
      : DEFAULT_GROUP_ID;
    const restored: BrowserTab = {
      ...closed,
      id: createTabId(),
      groupId,
      loading: Boolean(closed.url),
      hasWebview: Boolean(closed.url),
      sleeping: false,
      inactiveSince: undefined,
      audible: false,
    };
    setClosedTabs((current) => current.slice(0, -1));
    setTabs((current) => {
      const activeIndex = current.findIndex((tab) => tab.id === activeId);
      const next = current.map((tab) => tab.id === activeId
        ? { ...tab, inactiveSince: Date.now() }
        : tab);
      next.splice(Math.max(0, activeIndex) + 1, 0, restored);
      return next;
    });
    activeTabRef.current = restored;
    setActiveId(restored.id);
    setAddressDraft(restored.url);
    if (!isDesktopRuntime) return;
    if (!restored.url) {
      void invokeNative("switch_browser_tab", {
        tabId: restored.id,
        bounds: boundsRef.current,
      }).catch(() => undefined);
      return;
    }
    void invokeNative("open_browser_tab", {
      tabId: restored.id,
      groupId: restored.groupId,
      url: restored.url,
      bounds: boundsRef.current,
    }).then(() => {
      if (restored.muted) {
        return invokeNative("set_browser_tab_muted", { tabId: restored.id, muted: true });
      }
      return undefined;
    }).catch((error) => {
      updateTab(restored.id, { loading: false, hasWebview: false, sleeping: true });
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function showTabContextMenu(tabId: string, event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;
    if (!isDesktopRuntime) {
      message.info("标签页右键菜单仅在 Tauri 桌面版本中显示。");
      return;
    }
    const orderedTabs = getLayoutOrderedTabs();
    const tabIndex = orderedTabs.findIndex((item) => item.id === tabId);
    void invokeNative("show_tab_context_menu", {
      options: {
        tabId,
        groups: groups.map((group) => ({ id: group.id, name: group.name })),
        vertical: tabLayout === "vertical",
        muted: tab.muted,
        pinned: Boolean(tab.pinned),
        canCloseFollowing: tabIndex >= 0 && tabIndex < orderedTabs.length - 1,
        canReopen: closedTabs.length > 0,
        x: event.clientX,
        y: event.clientY,
      },
    }).catch((error) => {
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function showMoreMenu(event: ReactMouseEvent<HTMLElement>) {
    if (!isDesktopRuntime) {
      message.info("更多菜单仅在 Tauri 桌面版本中显示。");
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    void invokeNative("show_browser_more_menu", {
      tabLayout,
      showBookmarksBar,
      darkMode,
      x: Math.max(8, rect.right - 220),
      y: rect.bottom,
    }).catch((error) => {
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function handleNativeMenuAction(action: string) {
    if (action.startsWith("more:")) {
      const key = action.slice("more:".length);
      if (key === "tab-layout") {
        changeTabLayout(tabLayout === "horizontal" ? "vertical" : "horizontal");
      } else if (key === "bookmarks") {
        if (!showBookmarksBar) setShowBookmarksBar(true);
        message.info(`书签栏中有 ${bookmarks.length} 个书签`);
      } else if (key === "bookmark-bar") {
        setShowBookmarksBar((current) => !current);
      } else if (key === "theme") {
        handleThemeChange(!darkMode);
      } else {
        message.info(key === "history" ? "历史记录将在下一阶段接入。" : "设置中心将在下一阶段接入。");
      }
      return;
    }

    const [prefix, tabId, key, value] = action.split("|");
    if (prefix !== "tab" || !tabId || !key) return;
    const orderedTabs = getLayoutOrderedTabs();
    const tabIndex = orderedTabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex < 0 && key !== "reopen-closed") return;
    if (key === "new-adjacent") openAdjacentTab(tabId);
    else if (key === "move" && value) moveTabToGroup(tabId, value);
    else if (key === "refresh") refreshTab(tabId);
    else if (key === "duplicate") openAdjacentTab(tabId, true);
    else if (key === "move-window") message.info("独立浏览器窗口将在下一阶段接入。");
    else if (key === "toggle-pin") togglePinnedTab(tabId);
    else if (key === "toggle-mute") toggleTabAudio(tabId);
    else if (key === "close") closeTabsByIds([tabId]);
    else if (key === "close-others") closeTabsByIds(tabs.filter((tab) => tab.id !== tabId).map((tab) => tab.id));
    else if (key === "close-following") closeTabsByIds(orderedTabs.slice(tabIndex + 1).map((tab) => tab.id));
    else if (key === "reopen-closed") reopenLastClosedTab();
  }

  function getLayoutOrderedTabs() {
    if (tabLayout === "horizontal") return [...tabs];
    const ordered: BrowserTab[] = [];
    for (const group of groups) {
      const groupTabs = tabs.filter((tab) => tab.groupId === group.id);
      for (const smallGroup of group.smallGroups) {
        ordered.push(...groupTabs.filter((tab) => tab.smallGroupId === smallGroup.id));
      }
      ordered.push(...groupTabs.filter((tab) => !tab.smallGroupId));
    }
    ordered.push(...tabs.filter((tab) => tab.groupId === ROOT_GROUP_ID));
    return ordered;
  }

  function runWindowAction(action: "start-dragging" | "minimize" | "toggle-maximize" | "close") {
    if (!isDesktopRuntime) {
      showPreviewNotice();
      return;
    }
    void invokeNative("browser_window_action", { action }).catch((error) => {
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function handleTitlebarMouseDown(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, input, textarea, select, a, [role='button'], [data-tauri-drag-region='false']")) return;
    if (target.closest("[data-tauri-drag-region]:not([data-tauri-drag-region='false'])")) return;
    event.preventDefault();
    runWindowAction(event.detail > 1 ? "toggle-maximize" : "start-dragging");
  }

  function toggleBookmark() {
    if (!activeTab?.url) {
      message.info("请先打开一个网页。");
      return;
    }
    if (activeBookmarked) {
      setBookmarks((current) => current.filter((bookmark) => bookmark.url !== activeTab.url));
      message.success("已移除书签");
    } else {
      setBookmarks((current) => [...current, { title: activeTab.title || hostLabel(activeTab.url), url: activeTab.url }]);
      message.success("已添加到书签栏");
    }
  }

  function handleThemeChange(checked: boolean) {
    setDarkMode(checked);
    applySiaTheme(checked ? "dark" : "light");
  }

  function changeTabLayout(layout: TabLayoutMode) {
    setLayoutPreferenceSet(true);
    setTabLayout(layout);
    window.requestAnimationFrame(syncBrowserBounds);
  }

  function openNewGroupModal() {
    setNewGroupName("");
    setNewGroupOpen(true);
  }

  function createGroup() {
    const name = newGroupName.trim();
    if (!name) {
      message.warning("请输入分组名称");
      return false;
    }
    if (groups.some((group) => group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      message.warning("已存在同名分组");
      return false;
    }

    const group: BrowserGroup = {
      id: createGroupId(),
      name,
      color: GROUP_COLOR_PALETTE[groups.length % GROUP_COLOR_PALETTE.length],
      smallGroups: [],
    };
    setGroups((current) => [...current, group]);
    message.success(`已新建分组“${name}”`);
  }

  function openTreeEditDialog(kind: TreeEditKind, groupId: string, smallGroupId?: string) {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;
    const initialName = kind === "rename-group"
      ? group.name
      : kind === "rename-small-group"
        ? group.smallGroups.find((item) => item.id === smallGroupId)?.name ?? ""
        : "";
    setTreeEditName(initialName);
    setTreeEditDialog({ kind, groupId, smallGroupId });
  }

  function submitTreeEdit() {
    if (!treeEditDialog) return false;
    const name = treeEditName.trim();
    if (!name) {
      message.warning(treeEditDialog.kind === "rename-group" ? "请输入分组名称" : "请输入小分组名称");
      return false;
    }

    const group = groups.find((item) => item.id === treeEditDialog.groupId);
    if (!group) return false;

    if (treeEditDialog.kind === "rename-group") {
      if (groups.some((item) => item.id !== group.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        message.warning("已存在同名分组");
        return false;
      }
      setGroups((current) => current.map((item) => item.id === group.id ? { ...item, name } : item));
      message.success("分组已重命名");
      return;
    }

    const duplicateSmallGroup = group.smallGroups.some((item) => (
      item.id !== treeEditDialog.smallGroupId
      && item.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    ));
    if (duplicateSmallGroup) {
      message.warning("当前分组中已存在同名小分组");
      return false;
    }

    if (treeEditDialog.kind === "new-small-group") {
      setGroups((current) => current.map((item) => item.id === group.id
        ? {
            ...item,
            smallGroups: [...item.smallGroups, { id: createSmallGroupId(group.id), name }],
          }
        : item));
      message.success(`已在“${group.name}”中新建小分组`);
      return;
    }

    setGroups((current) => current.map((item) => item.id === group.id
      ? {
          ...item,
          smallGroups: item.smallGroups.map((smallGroup) => (
            smallGroup.id === treeEditDialog.smallGroupId ? { ...smallGroup, name } : smallGroup
          )),
        }
      : item));
    message.success("小分组已重命名");
  }

  function removeTreeTabs(groupId: string, smallGroupId?: string) {
    const removedTabs = tabs.filter((tab) => (
      tab.groupId === groupId && (smallGroupId === undefined || tab.smallGroupId === smallGroupId)
    ));
    if (removedTabs.length === 0) return;
    const removedIds = new Set(removedTabs.map((tab) => tab.id));
    const remainingTabs = tabs.filter((tab) => !removedIds.has(tab.id));
    let nextTabs = remainingTabs.length > 0 ? remainingTabs : [createBlankTab(ROOT_GROUP_ID)];
    let activatedTab: BrowserTab | undefined;
    let shouldRestore = false;
    if (removedIds.has(activeId)) {
      const nextTab = nextTabs[0];
      shouldRestore = nextTab.sleeping && Boolean(nextTab.url);
      activatedTab = {
        ...nextTab,
        loading: shouldRestore ? true : nextTab.loading,
        hasWebview: shouldRestore ? true : nextTab.hasWebview,
        sleeping: false,
        inactiveSince: undefined,
      };
      nextTabs = nextTabs.map((tab, index) => index === 0 ? activatedTab as BrowserTab : tab);
    }
    setTabs(nextTabs);

    if (isDesktopRuntime) {
      for (const tab of removedTabs) {
        void invokeNative("close_browser_tab", { tabId: tab.id }).catch(() => undefined);
      }
    }

    if (activatedTab) {
      activeTabRef.current = activatedTab;
      setActiveId(activatedTab.id);
      setAddressDraft(activatedTab.url);
      if (isDesktopRuntime) {
        const command = shouldRestore ? "open_browser_tab" : "switch_browser_tab";
        const args = shouldRestore
          ? {
              tabId: activatedTab.id,
              groupId: activatedTab.groupId,
              url: activatedTab.url,
              bounds: boundsRef.current,
            }
          : { tabId: activatedTab.id, bounds: boundsRef.current };
        void invokeNative(command, args)
          .then(() => {
            if (shouldRestore && activatedTab?.muted) {
              return invokeNative("set_browser_tab_muted", {
                tabId: activatedTab.id,
                muted: true,
              });
            }
            return undefined;
          })
          .catch(() => undefined);
      }
    }
  }

  function confirmClearGroupData(groupId: string, smallGroupId?: string) {
    const group = groups.find((item) => item.id === groupId);
    const smallGroup = group?.smallGroups.find((item) => item.id === smallGroupId);
    if (!group) return;
    const targetTabs = tabs.filter((tab) => (
      tab.groupId === groupId && (smallGroupId === undefined || tab.smallGroupId === smallGroupId)
    ));
    const targetName = smallGroup ? `小分组“${smallGroup.name}”` : `分组“${group.name}”`;

    Modal.confirm({
      title: "清除浏览数据",
      children: smallGroup
        ? `${targetName}与所属分组共享 Cookie。继续后将清除相关 WebView 的缓存、Cookie 和站点数据。`
        : `确定清除${targetName}的缓存、Cookie 和站点数据吗？`,
      okText: "清除",
      okButtonProps: { danger: true },
      onOk: async () => {
        if (isDesktopRuntime) {
          await invokeNative("clear_browser_tabs_data", { tabIds: targetTabs.map((tab) => tab.id) });
        }
        message.success(`已清除${targetName}的浏览数据`);
      },
    });
  }

  function confirmDeleteGroup(groupId: string) {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;
    Modal.confirm({
      title: "删除标签组",
      children: `删除“${group.name}”后，该分组及其中的所有标签页和小分组都会关闭。`,
      okText: "删除",
      okButtonProps: { danger: true },
      onOk: () => {
        removeTreeTabs(groupId);
        setGroups((current) => current.filter((item) => item.id !== groupId));
        message.success(`已删除标签组“${group.name}”`);
      },
    });
  }

  function confirmDeleteSmallGroup(groupId: string, smallGroupId: string) {
    const group = groups.find((item) => item.id === groupId);
    const smallGroup = group?.smallGroups.find((item) => item.id === smallGroupId);
    if (!group || !smallGroup) return;
    Modal.confirm({
      title: "删除小分组",
      children: `删除“${smallGroup.name}”后，其中的所有标签页都会关闭。`,
      okText: "删除",
      okButtonProps: { danger: true },
      onOk: () => {
        removeTreeTabs(groupId, smallGroupId);
        setGroups((current) => current.map((item) => item.id === groupId
          ? { ...item, smallGroups: item.smallGroups.filter((entry) => entry.id !== smallGroupId) }
          : item));
        message.success(`已删除小分组“${smallGroup.name}”`);
      },
    });
  }

  useEffect(() => {
    if (!isDesktopRuntime || !window.__TAURI__) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void window.__TAURI__.event.listen<string>("sia://native-menu-action", ({ payload }) => {
      handleNativeMenuAction(payload);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [
    activeId,
    bookmarks.length,
    closedTabs,
    darkMode,
    groups,
    showBookmarksBar,
    tabLayout,
    tabs,
  ]);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      const commandKey = event.ctrlKey || event.metaKey;
      if (commandKey && event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        reopenLastClosedTab();
        return;
      }
      if (commandKey && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openAdjacentTab(activeId, true);
        return;
      }
      if (commandKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleTabAudio(activeId);
        return;
      }
      if (commandKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        openTab();
        return;
      }
      if (commandKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        addressInputRef.current?.focus();
        addressInputRef.current?.select();
        return;
      }
      if (commandKey && event.key.toLowerCase() === "w") {
        event.preventDefault();
        closeTab(activeId);
        return;
      }
      if ((commandKey && event.key.toLowerCase() === "r") || event.key === "F5") {
        event.preventDefault();
        runPageAction("reload");
        return;
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        runPageAction("back");
        return;
      }
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        runPageAction("forward");
        return;
      }
      if (event.key === "Escape" && activeTab?.loading) {
        runPageAction("stop");
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [activeId, activeTab?.loading, openTab, tabs]);

  function renderTitlebarActions() {
    return (
      <div className="browser-titlebar-actions" data-tauri-drag-region="false">
        <Button
          className="toolbar-icon-button"
          variant="text"
          size="small"
          icon={<Icon name="download" size={17} />}
          aria-label="下载"
          title="下载"
          onClick={() => message.info("下载管理器将在下一阶段接入。")}
        />
        <Button
          className="profile-button"
          variant="filled"
          size="small"
          aria-label="用户"
          title="用户"
          onClick={() => message.info("多用户配置将在下一阶段接入。")}
        >
          S
        </Button>
        <Button
          className="toolbar-icon-button"
          variant="text"
          size="small"
          icon={<Icon name="more-vertical" size={18} />}
          aria-label="更多"
          title="更多"
          onClick={showMoreMenu}
        />
      </div>
    );
  }

  function renderNavigationControls() {
    return (
      <>
        <div className="browser-toolbar__navigation">
          <Button
            className="toolbar-icon-button"
            variant="text"
            size="small"
            icon={<Icon name="arrow-left" size={18} />}
            aria-label="后退"
            title="后退"
            disabled={!activeTab?.hasWebview}
            onClick={() => runPageAction("back")}
          />
          <Button
            className="toolbar-icon-button"
            variant="text"
            size="small"
            icon={<Icon name="arrow-right" size={18} />}
            aria-label="前进"
            title="前进"
            disabled={!activeTab?.hasWebview}
            onClick={() => runPageAction("forward")}
          />
          <Button
            className="toolbar-icon-button"
            variant="text"
            size="small"
            icon={<Icon name={activeTab?.loading ? "close" : "refresh"} size={17} />}
            aria-label={activeTab?.loading ? "停止加载" : "重新加载"}
            title={activeTab?.loading ? "停止加载" : "重新加载"}
            disabled={!activeTab?.hasWebview}
            onClick={() => runPageAction(activeTab?.loading ? "stop" : "reload")}
          />
          <Button
            className="toolbar-icon-button"
            variant="text"
            size="small"
            icon={<Icon name="home" size={17} />}
            aria-label="主页"
            title="主页"
            onClick={goHome}
          />
        </div>

        <form className="address-form" onSubmit={handleAddressSubmit}>
          <Input
            ref={addressInputRef}
            className="address-input"
            value={addressDraft}
            prefix={<Icon name={activeTab?.url?.startsWith("https://") ? "lock" : "search"} size={14} />}
            suffix={activeTab?.url ? <span className="address-host">{hostLabel(activeTab.url)}</span> : undefined}
            allowClear
            aria-label="地址和搜索栏"
            placeholder="搜索或输入网址"
            spellCheck={false}
            onFocus={(event) => {
              addressFocusedRef.current = true;
              event.currentTarget.select();
            }}
            onBlur={() => {
              addressFocusedRef.current = false;
              setAddressDraft(activeTab?.url ?? "");
            }}
            onChange={(event) => setAddressDraft(event.target.value)}
          />
          <Button
            className={`bookmark-button${activeBookmarked ? " is-active" : ""}`}
            variant="text"
            size="small"
            icon={<Icon name="star" variant={activeBookmarked ? "filled" : "outline"} size={17} />}
            aria-label={activeBookmarked ? "移除书签" : "添加书签"}
            title={activeBookmarked ? "移除书签" : "添加书签"}
            onClick={toggleBookmark}
          />
        </form>
        {activeTab?.loading ? <span className="browser-loading-line" aria-hidden="true" /> : null}
      </>
    );
  }

  return (
    <div className={`browser-shell browser-shell--${tabLayout}`}>
      <header
        className={`browser-titlebar${tabLayout === "vertical" ? " is-vertical" : ""}`}
        onMouseDown={handleTitlebarMouseDown}
      >
        <div className="browser-brand" data-tauri-drag-region="deep" aria-label="Sia Browser">
          <span className="browser-brand__mark" aria-hidden="true">
            <strong>Sia</strong>
            <small>browser</small>
          </span>
        </div>

        {tabLayout === "horizontal" ? (
          <HorizontalTabStrip
            tabs={tabs}
            activeId={activeId}
            onSelect={selectTab}
            onClose={closeTab}
            onToggleAudio={toggleTabAudio}
            onContextMenu={showTabContextMenu}
            onNew={() => openTab()}
          />
        ) : (
          <div className="vertical-titlebar-navigation">
            {renderNavigationControls()}
          </div>
        )}

        <div className="browser-titlebar__drag-space" data-tauri-drag-region="deep" />

        {renderTitlebarActions()}

        <div className="window-controls" data-tauri-drag-region="false">
          <Button
            className="window-control"
            variant="text"
            size="small"
            icon={<Icon name="minus" size={14} />}
            aria-label="最小化"
            onClick={() => runWindowAction("minimize")}
          />
          <Button
            className="window-control"
            variant="text"
            size="small"
            icon={<Icon name="fullscreen" size={13} />}
            aria-label="最大化或还原"
            onClick={() => runWindowAction("toggle-maximize")}
          />
          <Button
            className="window-control window-control--close"
            variant="text"
            size="small"
            icon={<Icon name="close" size={14} />}
            aria-label="关闭"
            onClick={() => runWindowAction("close")}
          />
        </div>
      </header>

      {tabLayout === "horizontal" ? (
        <section className="browser-toolbar" aria-label="浏览器工具栏">
          {renderNavigationControls()}
        </section>
      ) : null}

      <div className="browser-workspace">
        {tabLayout === "vertical" ? (
          <VerticalTabTree
            groups={groups}
            tabs={tabs}
            activeId={activeId}
            onSelect={selectTab}
            onClose={closeTab}
            onToggleAudio={toggleTabAudio}
            onContextMenu={showTabContextMenu}
            onNewTab={(groupId, smallGroupId) => openTab(undefined, groupId, smallGroupId)}
            onNewRootTab={() => openTab(undefined, ROOT_GROUP_ID)}
            onNewGroup={openNewGroupModal}
            onNewSmallGroup={(groupId) => openTreeEditDialog("new-small-group", groupId)}
            onRenameGroup={(groupId) => openTreeEditDialog("rename-group", groupId)}
            onRenameSmallGroup={(groupId, smallGroupId) => openTreeEditDialog("rename-small-group", groupId, smallGroupId)}
            onClearGroupData={confirmClearGroupData}
            onDeleteGroup={confirmDeleteGroup}
            onDeleteSmallGroup={confirmDeleteSmallGroup}
          />
        ) : null}
        <div className="browser-content">
          {showBookmarksBar ? (
            <nav className="bookmarks-bar" aria-label="书签栏">
              <span className="bookmarks-bar__label"><Icon name="star" size={13} />书签</span>
              {bookmarks.map((bookmark) => (
                <Button
                  key={bookmark.url}
                  className="bookmark-link"
                  variant="text"
                  size="small"
                  onClick={() => navigate(bookmark.url)}
                >
                  {bookmark.title}
                </Button>
              ))}
              <span className="bookmarks-bar__spacer" />
            </nav>
          ) : null}

          <main ref={pageHostRef} className="browser-page-host">
        {!activeTab?.hasWebview ? (
          <section className="new-tab-page">
            <div className="new-tab-page__ambient new-tab-page__ambient--one" />
            <div className="new-tab-page__ambient new-tab-page__ambient--two" />
            <div className="new-tab-content">
              <div className="new-tab-logo" aria-hidden="true">
                <span>S</span>
              </div>
              <h1>去探索，去创造。</h1>
              <p>由 Sia WebUI 与 Tauri 驱动的轻量浏览器</p>
              <form className="new-tab-search" onSubmit={handleNewTabSearch}>
                <Input
                  value={newTabQuery}
                  size="large"
                  prefix={<Icon name="search" size={19} />}
                  allowClear
                  aria-label="搜索网络"
                  placeholder="搜索网页或输入网址"
                  onChange={(event) => setNewTabQuery(event.target.value)}
                />
                <Button type="submit" variant="primary" size="large" aria-label="搜索" icon={<Icon name="arrow-right" size={18} />} />
              </form>
              <div className="quick-links" aria-label="快捷访问">
                {QUICK_LINKS.map((link) => (
                  <Button
                    key={link.title}
                    className="quick-link"
                    variant="text"
                    onClick={() => {
                      if (link.url) navigate(link.url);
                      else message.info("设置中心将在下一阶段接入。");
                    }}
                  >
                    <span className="quick-link__icon" style={{ "--quick-link-tone": link.tone } as React.CSSProperties}>
                      <Icon name={link.icon} size={22} />
                    </span>
                    <span>{link.title}</span>
                  </Button>
                ))}
              </div>
            </div>
            <footer className="new-tab-footer">
              <span><Icon name="shield-check" size={14} /> 隐私保护已开启</span>
              <span>Sia Browser 0.1</span>
            </footer>
          </section>
        ) : !isDesktopRuntime ? (
          <section className="web-preview-placeholder">
            <div className="web-preview-placeholder__card">
              <span className="web-preview-placeholder__icon"><Icon name="desktop" size={28} /></span>
              <h2>浏览器外壳预览</h2>
              <p>桌面模式会在这里创建独立子 WebView，直接加载真实网站，不受 iframe 限制。</p>
              <code>{activeTab.url}</code>
              <Button variant="primary" icon={<Icon name="refresh" size={16} />} onClick={() => showPreviewNotice()}>
                查看运行方式
              </Button>
            </div>
          </section>
        ) : (
          <div className="native-webview-placeholder" aria-label="网页内容区域">
            <Icon name="loader" size={24} spin />
            <span>正在连接网页视图…</span>
          </div>
        )}
          </main>
        </div>
      </div>
      <Modal
        open={newGroupOpen}
        title="新建分组"
        width={380}
        centered
        okText="创建"
        onOk={createGroup}
        onOpenChange={setNewGroupOpen}
      >
        <div className="new-group-form">
          <label htmlFor="new-group-name">分组名称</label>
          <Input
            id="new-group-name"
            value={newGroupName}
            autoFocus
            maxLength={24}
            placeholder="例如：测试环境"
            onChange={(event) => setNewGroupName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && createGroup() !== false) setNewGroupOpen(false);
            }}
          />
          <small>每个分组使用独立的 Cookie 数据目录。</small>
        </div>
      </Modal>
      <Modal
        open={Boolean(treeEditDialog)}
        title={treeEditDialog?.kind === "new-small-group"
          ? "新建小分组"
          : treeEditDialog?.kind === "rename-group"
            ? "重命名分组"
            : "重命名小分组"}
        width={380}
        centered
        okText={treeEditDialog?.kind === "new-small-group" ? "创建" : "保存"}
        onOk={submitTreeEdit}
        onOpenChange={(open) => {
          if (!open) setTreeEditDialog(null);
        }}
      >
        <div className="new-group-form">
          <label htmlFor="tree-edit-name">
            {treeEditDialog?.kind === "rename-group" ? "分组名称" : "小分组名称"}
          </label>
          <Input
            id="tree-edit-name"
            value={treeEditName}
            autoFocus
            maxLength={24}
            placeholder={treeEditDialog?.kind === "rename-group" ? "请输入分组名称" : "请输入小分组名称"}
            onChange={(event) => setTreeEditName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && submitTreeEdit() !== false) setTreeEditDialog(null);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}

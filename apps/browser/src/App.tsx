import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import {
  Button,
  Icon,
  Input,
  WindowFrame,
  WindowTitleBar,
  applySiaTheme,
  message,
  type IconName,
  type WindowAction,
} from "@sia.soul/sia-react-ui";
import HorizontalTabStrip from "./components/HorizontalTabStrip";
import VerticalTabTree from "./components/VerticalTabTree";
import type { BrowserOverlayPayload } from "./components/BrowserOverlayWindow";
import type { FloatingTabPanelPayload } from "./components/BrowserTabPanelWindow";
import type {
  BrowserMenuItem,
  BrowserMenuPayload,
  BrowserPanelEntry,
} from "./components/BrowserMenuWindow";
import BrowserSettingsPage, {
  type BrowserExtensionRecord,
  type BrowserSettingsSection,
} from "./components/BrowserSettingsPage";
import type { PasswordSubmission } from "./components/PasswordManagerModal";
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

interface BrowserDownloadNativeEvent {
  id: string;
  tabId: string;
  state: "waiting" | "started" | "progress" | "finished";
  receivedBytes: number;
  totalBytes?: number;
  success?: boolean;
  sourceUrl?: string;
  filePath?: string;
  fileName?: string;
  unsafe?: boolean;
  fileDeleted?: boolean;
}

interface BrowserPersistedState {
  version: 1 | 2 | 3;
  tabs: BrowserTab[];
  groups: BrowserGroup[];
  activeId: string;
  tabLayout: TabLayoutMode;
  layoutPreferenceSet?: boolean;
  bookmarks?: Bookmark[];
  showBookmarksBar?: boolean;
  verticalPanelPinned?: boolean;
  verticalPanelWidth?: number;
  history?: BrowserHistoryEntry[];
  downloads?: BrowserDownloadNativeEvent[];
  alwaysOpenDownloadExtensions?: string[];
  downloadDirectory?: string;
  askBeforeDownload?: boolean;
}

interface Bookmark {
  title: string;
  url: string;
}

interface BrowserHistoryEntry {
  id: string;
  tabId: string;
  title: string;
  url: string;
  visitedAt: number;
}

interface BrowserNavigationStack {
  entries: Array<{
    id: string;
    title: string;
    url: string;
  }>;
  index: number;
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

interface BrowserOverlayAction {
  action: string;
  value?: string;
}

const isDesktopRuntime = Boolean(window.__TAURI__);
const SETTINGS_URL = "sia://settings";

function isInternalBrowserUrl(url?: string) {
  return url === SETTINGS_URL;
}

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
const COMPACT_VERTICAL_PANEL_WIDTH = 56;
const DEFAULT_VERTICAL_PANEL_WIDTH = 292;
const FLOATING_TAB_PANEL_SHADOW_SPACE = 8;

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
  if (/^(https?|chrome-extension):\/\//i.test(value) || /^about:/i.test(value)) return value;
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

function downloadFileExtension(fileNameOrPath?: string) {
  if (!fileNameOrPath) return "";
  const name = fileNameOrPath.split(/[\\/]/).at(-1) ?? "";
  const separator = name.lastIndexOf(".");
  return separator > 0 ? name.slice(separator).toLocaleLowerCase() : "";
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
  const [tabLayout, setTabLayout] = useState<TabLayoutMode>("vertical");
  const [layoutPreferenceSet, setLayoutPreferenceSet] = useState(false);
  const [stateHydrated, setStateHydrated] = useState(!isDesktopRuntime);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([...DEFAULT_BOOKMARKS]);
  const [showBookmarksBar, setShowBookmarksBar] = useState(true);
  const [closedTabs, setClosedTabs] = useState<BrowserTab[]>([]);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [verticalPanelPinned, setVerticalPanelPinned] = useState(true);
  const [verticalPanelWidth, setVerticalPanelWidth] = useState(DEFAULT_VERTICAL_PANEL_WIDTH);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([]);
  const [collapsedSmallGroupIds, setCollapsedSmallGroupIds] = useState<string[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<Record<string, BrowserDownloadNativeEvent>>({});
  const [alwaysOpenDownloadExtensions, setAlwaysOpenDownloadExtensions] = useState<string[]>([]);
  const [downloadDirectory, setDownloadDirectory] = useState("");
  const [askBeforeDownload, setAskBeforeDownload] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<BrowserHistoryEntry[]>([]);
  const [downloadPulseToken, setDownloadPulseToken] = useState(0);
  const [settingsSection, setSettingsSection] = useState<BrowserSettingsSection>("general");
  const pageHostRef = useRef<HTMLDivElement | null>(null);
  const downloadButtonRef = useRef<HTMLButtonElement | null>(null);
  const verticalPanelAnchorRef = useRef<HTMLDivElement | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const addressFocusedRef = useRef(false);
  const previewNoticeShownRef = useRef(false);
  const boundsRef = useRef<BrowserBounds>({ x: 0, y: 126, width: 1200, height: 700 });
  const floatingPanelOpenRef = useRef(false);
  const alwaysOpenDownloadExtensionsRef = useRef<string[]>([]);
  const autoOpenedDownloadIdsRef = useRef(new Set<string>());
  const showDownloadsPanelRef = useRef<() => void>(() => undefined);
  const activeTabRef = useRef<BrowserTab>(FIRST_TAB);
  const tabsRef = useRef<BrowserTab[]>([FIRST_TAB]);
  const navigationStacksRef = useRef<Record<string, BrowserNavigationStack>>({});
  const navigationTargetRef = useRef<Record<string, number | undefined>>({});
  const nativeMenuActionHandlerRef = useRef<(action: string) => void>(() => undefined);
  const browserOverlayActionHandlerRef = useRef<(payload: BrowserOverlayAction) => void>(
    () => undefined,
  );
  const floatingPanelActionHandlerRef = useRef<(payload: BrowserOverlayAction) => void>(
    () => undefined,
  );

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeId) ?? tabs[0],
    [activeId, tabs],
  );
  const activeBookmarked = Boolean(
    activeTab?.url
    && !isInternalBrowserUrl(activeTab.url)
    && bookmarks.some((bookmark) => bookmark.url === activeTab.url),
  );
  alwaysOpenDownloadExtensionsRef.current = alwaysOpenDownloadExtensions;
  const allDownloadTasks = Object.values(downloadTasks);
  const activeDownloadTasks = allDownloadTasks.filter((task) => task.state !== "finished");
  const downloadHasUnknownSize = activeDownloadTasks.some((task) => !task.totalBytes);
  const downloadTotalBytes = activeDownloadTasks.reduce(
    (total, task) => total + (task.totalBytes ?? 0),
    0,
  );
  const downloadReceivedBytes = activeDownloadTasks.reduce(
    (total, task) => total + Math.min(task.receivedBytes, task.totalBytes ?? task.receivedBytes),
    0,
  );
  const downloadProgress = downloadTotalBytes > 0
    ? Math.min(1, downloadReceivedBytes / downloadTotalBytes)
    : 0;

  useEffect(() => {
    if (activeTab) activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    const preventDefaultContextMenu = (event: Event) => event.preventDefault();
    document.addEventListener("contextmenu", preventDefaultContextMenu);
    return () => document.removeEventListener("contextmenu", preventDefaultContextMenu);
  }, []);

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

  const activateNativeTab = useCallback(async (tab: BrowserTab, forceOpen = false) => {
    if (!isDesktopRuntime) return;
    if (isInternalBrowserUrl(tab.url)) {
      updateTab(tab.id, {
        loading: false,
        hasWebview: false,
        sleeping: false,
      });
      await invokeNative("hide_browser_pages");
      return;
    }

    const openWebview = async () => {
      if (!tab.url) {
        await invokeNative("hide_browser_pages");
        return;
      }
      updateTab(tab.id, {
        loading: true,
        hasWebview: true,
        sleeping: false,
      });
      await invokeNative("open_browser_tab", {
        tabId: tab.id,
        groupId: tab.groupId,
        url: tab.url,
        bounds: boundsRef.current,
      });
      if (tab.muted) {
        await invokeNative("set_browser_tab_muted", { tabId: tab.id, muted: true });
      }
    };

    if (forceOpen) {
      await openWebview();
      return;
    }

    const found = await invokeNative<boolean>("switch_browser_tab", {
      tabId: tab.id,
      bounds: boundsRef.current,
    });
    if (found) return;

    // 持久化状态中的 hasWebview 只代表上次运行时的状态。
    // 应用重启后原生子 WebView 不存在，切换时必须按当前 URL 自动重建。
    await openWebview();
  }, [updateTab]);

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

    void activateNativeTab(nextTab, Boolean(targetUrl)).catch((error) => {
      updateTab(nextTab.id, { loading: false, title: "加载失败" });
      message.error(error instanceof Error ? error.message : String(error));
    });
  }, [activateNativeTab, showPreviewNotice, updateTab]);

  const openExtensionOptionsTab = useCallback(async (
    extension: BrowserExtensionRecord,
  ): Promise<string | undefined> => {
    const optionsPage = extension.optionsPage?.trim();
    if (!optionsPage) throw new Error(`扩展“${extension.name}”没有提供配置页面`);

    const absoluteOptionsUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(optionsPage);
    const currentTab = activeTabRef.current;
    const nextTab = {
      ...createBlankTab(
        currentTab.groupId ?? DEFAULT_GROUP_ID,
        currentTab.smallGroupId,
      ),
      title: `${extension.name} - 选项`,
      url: absoluteOptionsUrl ? optionsPage : "about:blank",
      loading: true,
      hasWebview: true,
    };
    const inactiveSince = Date.now();
    setTabs((current) => [
      ...current.map((item) => (
        item.id === currentTab.id ? { ...item, inactiveSince } : item
      )),
      nextTab,
    ]);
    activeTabRef.current = nextTab;
    setActiveId(nextTab.id);
    setAddressDraft(nextTab.url);

    if (!isDesktopRuntime) {
      showPreviewNotice();
      return extension.browserId;
    }

    try {
      await activateNativeTab(nextTab, true);
      if (absoluteOptionsUrl) return extension.browserId;

      const browserId = extension.browserId ?? await invokeNative<string>(
        "resolve_browser_extension_id",
        {
          id: extension.id,
          name: extension.name,
        },
      );
      if (!browserId) throw new Error(`无法获取扩展“${extension.name}”的运行时标识`);

      const optionsUrl = `chrome-extension://${browserId}/${optionsPage.replace(/^\/+/, "")}`;
      const optionsTab: BrowserTab = {
        ...nextTab,
        url: optionsUrl,
        loading: true,
        hasWebview: true,
      };
      activeTabRef.current = optionsTab;
      updateTab(nextTab.id, {
        url: optionsUrl,
        title: `${extension.name} - 选项`,
        loading: true,
        hasWebview: true,
        sleeping: false,
      });
      setAddressDraft(optionsUrl);
      await activateNativeTab(optionsTab, true);
      return browserId;
    } catch (error) {
      void invokeNative("close_browser_tab", { tabId: nextTab.id }).catch(() => undefined);
      setTabs((current) => current.filter((tab) => tab.id !== nextTab.id));
      activeTabRef.current = currentTab;
      setActiveId(currentTab.id);
      setAddressDraft(currentTab.url);
      throw error;
    }
  }, [activateNativeTab, showPreviewNotice, updateTab]);

  function openAdjacentTab(sourceId: string, duplicate = false) {
    const source = tabs.find((tab) => tab.id === sourceId);
    if (!source) return;
    const blankTab = createBlankTab(source.groupId, source.smallGroupId);
    const internalSource = isInternalBrowserUrl(source.url);
    const nextTab: BrowserTab = duplicate && source.url
      ? {
          ...blankTab,
          title: source.title,
          url: source.url,
          loading: !internalSource,
          hasWebview: !internalSource,
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
    void activateNativeTab(nextTab, Boolean(nextTab.url) && !internalSource).catch((error) => {
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

  function createFloatingTabPanelPayload(): FloatingTabPanelPayload {
    return {
      groups,
      tabs,
      activeId,
      darkMode,
      closedTabCount: closedTabs.length,
      panelExpanded: true,
      panelPinned: verticalPanelPinned,
      panelWidth: verticalPanelWidth,
      collapsedGroupIds,
      collapsedSmallGroupIds,
    };
  }

  function presentIndependentTabPanel() {
    const panelAnchor = verticalPanelAnchorRef.current;
    if (!panelAnchor) return;
    const rect = panelAnchor.getBoundingClientRect();
    void invokeNative("open_floating_tab_panel", {
      payload: createFloatingTabPanelPayload(),
      bounds: {
        x: Math.max(0, Math.floor(rect.left)),
        y: Math.round(rect.top),
        width: verticalPanelPinned
          ? Math.max(1, verticalPanelWidth - FLOATING_TAB_PANEL_SHADOW_SPACE)
          : verticalPanelWidth,
        height: Math.max(1, Math.round(rect.height)),
      },
    }).catch((error) => {
      floatingPanelOpenRef.current = false;
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function showIndependentTabPanel() {
    if (
      !isDesktopRuntime
      || tabLayout !== "vertical"
      || verticalPanelPinned
      || floatingPanelOpenRef.current
    ) {
      return;
    }
    floatingPanelOpenRef.current = true;
    presentIndependentTabPanel();
  }

  function hideIndependentTabPanel() {
    floatingPanelOpenRef.current = false;
    void invokeNative("close_floating_tab_panel").catch(() => undefined);
  }

  function toggleVerticalPanelPinned() {
    if (verticalPanelPinned) {
      floatingPanelOpenRef.current = false;
      void invokeNative("close_floating_tab_panel").catch(() => undefined);
      setVerticalPanelPinned(false);
      return;
    }
    floatingPanelOpenRef.current = true;
    setVerticalPanelPinned(true);
  }

  useEffect(() => {
    if (
      !isDesktopRuntime
      || tabLayout !== "vertical"
      || (!verticalPanelPinned && !floatingPanelOpenRef.current)
    ) {
      return;
    }
    void invokeNative("update_floating_tab_panel", {
      payload: createFloatingTabPanelPayload(),
    }).catch(() => undefined);
  }, [
    activeId,
    closedTabs.length,
    collapsedGroupIds,
    collapsedSmallGroupIds,
    darkMode,
    groups,
    tabLayout,
    tabs,
    verticalPanelPinned,
    verticalPanelWidth,
  ]);

  useEffect(() => {
    if (!isDesktopRuntime) return undefined;
    if (!stateHydrated || tabLayout !== "vertical") {
      floatingPanelOpenRef.current = false;
      void invokeNative("close_floating_tab_panel").catch(() => undefined);
      return undefined;
    }
    let presentFrame = 0;
    if (verticalPanelPinned) {
      floatingPanelOpenRef.current = true;
      presentFrame = window.requestAnimationFrame(presentIndependentTabPanel);
    } else {
      floatingPanelOpenRef.current = false;
      void invokeNative("close_floating_tab_panel").catch(() => undefined);
    }
    const handleWindowResize = () => {
      if (verticalPanelPinned || floatingPanelOpenRef.current) {
        presentIndependentTabPanel();
      }
    };
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.cancelAnimationFrame(presentFrame);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [
    stateHydrated,
    tabLayout,
    verticalPanelPinned,
    verticalPanelWidth,
  ]);

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
          const internal = isInternalBrowserUrl(tab.url);
          return {
            ...tab,
            loading: active && Boolean(tab.url) && !internal,
            hasWebview: active && Boolean(tab.url) && !internal,
            sleeping: !active && Boolean(tab.url) && !internal,
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
        if (Array.isArray(state.history)) setHistoryEntries(state.history.slice(0, 1000));
        if (Array.isArray(state.downloads)) {
          setDownloadTasks(Object.fromEntries(
            state.downloads
              .filter((item) => item?.id)
              .map((item) => [
                item.id,
                item.state === "finished"
                  ? item
                  : { ...item, state: "finished" as const, success: false },
              ]),
          ));
        }
        if (Array.isArray(state.alwaysOpenDownloadExtensions)) {
          setAlwaysOpenDownloadExtensions(
            state.alwaysOpenDownloadExtensions.filter((extension) => typeof extension === "string"),
          );
        }
        if (typeof state.downloadDirectory === "string") {
          setDownloadDirectory(state.downloadDirectory);
        }
        setAskBeforeDownload(Boolean(state.askBeforeDownload));
        setShowBookmarksBar(state.showBookmarksBar !== false);
        const restoredPanelPinned = state.verticalPanelPinned !== false;
        setVerticalPanelPinned(restoredPanelPinned);
        setVerticalPanelWidth(
          Math.min(
            440,
            Math.max(220, state.verticalPanelWidth ?? DEFAULT_VERTICAL_PANEL_WIDTH),
          ),
        );
        activeTabRef.current = restoredActiveTab;

        if (restoredActiveTab.url && !isInternalBrowserUrl(restoredActiveTab.url)) {
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
        version: 3,
        activeId,
        tabLayout,
        layoutPreferenceSet,
        groups,
        bookmarks,
        history: historyEntries,
        downloads: allDownloadTasks.filter((task) => task.state === "finished").slice(-200),
        alwaysOpenDownloadExtensions,
        downloadDirectory,
        askBeforeDownload,
        showBookmarksBar,
        verticalPanelPinned,
        verticalPanelWidth,
        tabs: tabs.map((tab) => ({
          ...tab,
          loading: false,
          hasWebview: false,
          sleeping: tab.id !== activeId && Boolean(tab.url) && !isInternalBrowserUrl(tab.url),
          inactiveSince: tab.id === activeId ? undefined : tab.inactiveSince,
          audible: false,
        })),
      };
      void invokeNative("save_browser_state", { state }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    activeId,
    alwaysOpenDownloadExtensions,
    askBeforeDownload,
    bookmarks,
    downloadDirectory,
    groups,
    historyEntries,
    layoutPreferenceSet,
    showBookmarksBar,
    stateHydrated,
    tabLayout,
    tabs,
    allDownloadTasks,
    verticalPanelPinned,
    verticalPanelWidth,
  ]);

  useEffect(() => {
    if (!isDesktopRuntime || !stateHydrated) return;
    if (!downloadDirectory) {
      void invokeNative<string>("get_default_download_directory")
        .then((directory) => {
          if (directory) setDownloadDirectory(directory);
        })
        .catch(() => undefined);
      return;
    }
    void invokeNative("set_download_preferences", {
      directory: downloadDirectory,
      askBeforeDownload,
    }).catch((error) => {
      message.warning(error instanceof Error ? error.message : String(error));
    });
  }, [askBeforeDownload, downloadDirectory, stateHydrated]);

  useEffect(() => {
    if (!isDesktopRuntime || !window.__TAURI__) return;
    let unlisten: (() => void) | undefined;
    let unlistenPassword: (() => void) | undefined;
    let disposed = false;

    void window.__TAURI__.event.listen<BrowserNativeEvent>("sia://browser-event", ({ payload }) => {
      if (payload.kind === "new-window" && payload.url) {
        const sourceTab = tabsRef.current.find((tab) => tab.id === payload.tabId);
        openTab(
          payload.url,
          sourceTab?.groupId ?? payload.groupId,
          sourceTab?.smallGroupId,
        );
        return;
      }
      if (payload.kind === "error") {
        if (payload.message) message.warning(payload.message);
        return;
      }
      const eventUrl = payload.url?.trim();
      const usableEventUrl = eventUrl && eventUrl !== "about:blank"
        ? eventUrl
        : undefined;
      if (payload.kind === "load" && payload.loading === false && usableEventUrl) {
        const tab = tabsRef.current.find((item) => item.id === payload.tabId);
        const stack = navigationStacksRef.current[payload.tabId] ?? {
          entries: [],
          index: -1,
        };
        const targetIndex = navigationTargetRef.current[payload.tabId];
        if (
          targetIndex !== undefined &&
          stack.entries[targetIndex]?.url === usableEventUrl
        ) {
          stack.index = targetIndex;
        } else if (stack.entries[stack.index]?.url !== usableEventUrl) {
          stack.entries = stack.entries.slice(0, stack.index + 1);
          stack.entries.push({
            id: `navigation-${payload.tabId}-${Date.now()}`,
            title: tab?.title || hostLabel(usableEventUrl) || usableEventUrl,
            url: usableEventUrl,
          });
          stack.index = stack.entries.length - 1;
        }
        navigationTargetRef.current[payload.tabId] = undefined;
        navigationStacksRef.current[payload.tabId] = stack;

        const visitedAt = Date.now();
        setHistoryEntries((current) => {
          const latest = current[0];
          if (
            latest?.url === usableEventUrl &&
            visitedAt - latest.visitedAt < 2_000
          ) {
            return current;
          }
          return [{
            id: `history-${payload.tabId}-${visitedAt}`,
            tabId: payload.tabId,
            title: tab?.title || hostLabel(usableEventUrl) || usableEventUrl,
            url: usableEventUrl,
            visitedAt,
          }, ...current].slice(0, 1000);
        });
      } else if (payload.kind === "title" && payload.title?.trim()) {
        const title = payload.title.trim();
        const stack = navigationStacksRef.current[payload.tabId];
        if (stack?.entries[stack.index]) stack.entries[stack.index].title = title;
        setHistoryEntries((current) => {
          const index = current.findIndex((entry) => entry.tabId === payload.tabId);
          if (index < 0 || current[index].title === title) return current;
          const next = [...current];
          next[index] = { ...next[index], title };
          return next;
        });
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
          url: usableEventUrl ?? tab.url,
          loading: payload.loading ?? tab.loading,
          hasWebview: true,
          sleeping: false,
        };
      }));
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });

    void window.__TAURI__.event.listen<PasswordSubmission>(
      "sia://password-submission",
      ({ payload }) => {
        if (!payload.password || !payload.origin) return;
        openBrowserOverlay({
          kind: "password-save",
          ...payload,
          darkMode,
        });
      },
    ).then((dispose) => {
      if (disposed) dispose();
      else unlistenPassword = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
      unlistenPassword?.();
    };
  }, [darkMode, openTab]);

  useEffect(() => {
    if (!isDesktopRuntime || !window.__TAURI__) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void window.__TAURI__.event.listen<BrowserDownloadNativeEvent>(
      "sia://browser-download",
      ({ payload }) => {
        if (payload.state === "waiting" || payload.state === "started") {
          setDownloadPulseToken((current) => current + 1);
        }
        setDownloadTasks((current) => {
          return {
            ...current,
            [payload.id]: {
              ...current[payload.id],
              ...payload,
            },
          };
        });
        if (payload.state === "waiting") {
          window.requestAnimationFrame(() => showDownloadsPanelRef.current());
        }
        if (
          payload.state === "finished"
          && payload.success !== false
          && payload.filePath
          && !autoOpenedDownloadIdsRef.current.has(payload.id)
        ) {
          const extension = downloadFileExtension(payload.fileName || payload.filePath);
          if (extension && alwaysOpenDownloadExtensionsRef.current.includes(extension)) {
            autoOpenedDownloadIdsRef.current.add(payload.id);
            void invokeNative("open_download_file", { path: payload.filePath }).catch(() => undefined);
          }
        }
      },
    ).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isDesktopRuntime || !window.__TAURI__) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void window.__TAURI__.event.listen("sia://extensions-changed", () => {
      setTabs((current) => current.map((tab) => (
        isInternalBrowserUrl(tab.url)
          ? tab
          : {
              ...tab,
              hasWebview: false,
              sleeping: Boolean(tab.url),
              loading: false,
              audible: false,
            }
      )));
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!addressFocusedRef.current) setAddressDraft(activeTab?.url ?? "");
  }, [activeId, activeTab?.url]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncBrowserBounds);
    const transitionTimer = window.setTimeout(syncBrowserBounds, 220);
    const settledTimer = window.setTimeout(syncBrowserBounds, 700);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(transitionTimer);
      window.clearTimeout(settledTimer);
    };
  }, [
    stateHydrated,
    syncBrowserBounds,
    tabLayout,
    verticalPanelPinned,
    verticalPanelWidth,
  ]);

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
    const shouldRestore = selected.sleeping && Boolean(selected.url) && !isInternalBrowserUrl(selected.url);
    const inactiveSince = Date.now();
    const activatedTab: BrowserTab = {
      ...selected,
      loading: shouldRestore ? true : selected.loading,
      hasWebview: isInternalBrowserUrl(selected.url) ? false : (shouldRestore ? true : selected.hasWebview),
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
      void activateNativeTab(activatedTab, shouldRestore)
        .catch((error) => {
          updateTab(tabId, { loading: false, hasWebview: false, sleeping: Boolean(selected.url) });
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
    const shouldRestore = nextTab.sleeping && Boolean(nextTab.url) && !isInternalBrowserUrl(nextTab.url);
    const activatedTab: BrowserTab = {
      ...nextTab,
      loading: shouldRestore ? true : nextTab.loading,
      hasWebview: isInternalBrowserUrl(nextTab.url) ? false : (shouldRestore ? true : nextTab.hasWebview),
      sleeping: false,
      inactiveSince: undefined,
    };
    remaining = remaining.map((tab, index) => index === nextIndex ? activatedTab : tab);
    activeTabRef.current = activatedTab;
    setTabs(remaining);
    setActiveId(activatedTab.id);
    setAddressDraft(activatedTab.url);
    if (!isDesktopRuntime) return;

    void activateNativeTab(activatedTab, shouldRestore)
      .catch(() => undefined);
  }

  function goHome() {
    if (!activeTab) return;
    const homeTab: BrowserTab = {
      ...activeTab,
      title: "新标签页",
      url: "",
      loading: false,
      hasWebview: false,
      sleeping: false,
      inactiveSince: undefined,
      audible: false,
      muted: false,
    };
    activeTabRef.current = homeTab;
    setTabs((current) => current.map((tab) => tab.id === homeTab.id ? homeTab : tab));
    setAddressDraft("");
    if (isDesktopRuntime) {
      void invokeNative("close_browser_tab", { tabId: homeTab.id }).catch((error) => {
        message.error(error instanceof Error ? error.message : String(error));
      });
    }
  }

  function runPageAction(
    action: "back" | "forward" | "reload" | "reload-hard" | "reload-clear-cache" | "stop",
  ) {
    if (!activeTab?.hasWebview) return;
    if (action === "stop") updateTab(activeTab.id, { loading: false });
    if (action.startsWith("reload")) updateTab(activeTab.id, { loading: true });
    const stack = navigationStacksRef.current[activeTab.id];
    if (action === "back" && stack && stack.index > 0) {
      navigationTargetRef.current[activeTab.id] = stack.index - 1;
    } else if (action === "forward" && stack && stack.index < stack.entries.length - 1) {
      navigationTargetRef.current[activeTab.id] = stack.index + 1;
    }
    if (!isDesktopRuntime) {
      showPreviewNotice();
      return;
    }
    void invokeNative("browser_page_action", { tabId: activeTab.id, action }).catch((error) => {
      message.warning(error instanceof Error ? error.message : String(error));
    });
  }

  function showBrowserPanel(
    payload: BrowserMenuPayload,
    anchor: { x: number; y: number },
    size: { width: number; height: number },
  ) {
    if (!isDesktopRuntime) {
      showPreviewNotice();
      return;
    }
    const width = Math.min(size.width, Math.max(260, window.innerWidth - 20));
    const height = Math.min(size.height, Math.max(160, window.innerHeight - 20));
    const x = Math.max(0, Math.min(anchor.x, window.innerWidth - width));
    const y = Math.max(0, Math.min(anchor.y, window.innerHeight - height));
    void invokeNative("show_browser_panel", {
      payload,
      sourceWindow: "main",
      x,
      y,
      width,
      height,
    }).catch((error) => {
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function showBackHistoryPanel(x: number, y: number) {
    if (!activeTab) return;
    const stack = navigationStacksRef.current[activeTab.id];
    const backEntries = stack
      ? stack.entries.slice(0, Math.max(0, stack.index)).map((entry, index) => ({
          entry,
          index,
        })).reverse()
      : [];
    const items: BrowserMenuItem[] = backEntries.length
      ? backEntries.map(({ entry, index }) => ({
          key: `navigation|back|${activeTab.id}|${index}`,
          label: entry.title || hostLabel(entry.url) || entry.url,
          subtitle: entry.url,
        }))
      : [{
          label: "当前页面没有可后退的地址",
          disabled: true,
        }];
    showBrowserPanel(
      {
        darkMode,
        kind: "back-history",
        heading: "后退历史",
        items,
      },
      { x, y },
      {
        width: 380,
        height: Math.min(430, 54 + Math.max(1, items.length) * 50),
      },
    );
  }

  function showRefreshPanel(x: number, y: number) {
    showBrowserPanel(
      {
        darkMode,
        kind: "menu",
        items: [
          { key: "refresh|normal", label: "正常刷新", shortcut: "Ctrl+R" },
          { key: "refresh|hard", label: "硬刷新", shortcut: "Ctrl+Shift+R" },
          { key: "refresh|clear-cache", label: "清空缓存并进行硬刷新" },
        ],
      },
      { x, y },
      { width: 310, height: 136 },
    );
  }

  function downloadPanelEntries(): BrowserPanelEntry[] {
    return allDownloadTasks
      .slice()
      .reverse()
      .map((task) => ({
        id: task.id,
        title: task.fileName || task.sourceUrl || "未命名下载",
        fileName: task.fileName,
        filePath: task.filePath,
        url: task.sourceUrl,
        state: task.state,
        receivedBytes: task.receivedBytes,
        totalBytes: task.totalBytes,
        success: task.success,
        alwaysOpen: alwaysOpenDownloadExtensions.includes(
          downloadFileExtension(task.fileName || task.filePath),
        ),
        unsafe: task.unsafe,
        fileDeleted: task.fileDeleted,
      }));
  }

  function showDownloadsPanel(x: number, y: number) {
    showBrowserPanel(
      {
        darkMode,
        kind: "downloads",
        items: [],
        entries: downloadPanelEntries(),
      },
      { x, y },
      { width: 440, height: 720 },
    );
  }
  showDownloadsPanelRef.current = () => {
    const rect = downloadButtonRef.current?.getBoundingClientRect();
    showDownloadsPanel(
      rect ? rect.right - 440 : Math.max(12, window.innerWidth - 460),
      rect ? rect.bottom : 76,
    );
  };

  function showHistoryPanel(x = window.innerWidth - 520, y = 48) {
    const entries: BrowserPanelEntry[] = historyEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      timestamp: entry.visitedAt,
      timeLabel: new Date(entry.visitedAt).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    }));
    showBrowserPanel(
      {
        darkMode,
        kind: "history",
        items: [],
        entries,
      },
      { x, y },
      { width: 500, height: 760 },
    );
  }

  function showBookmarksPanel(x = window.innerWidth - 520, y = 48) {
    const entries: BrowserPanelEntry[] = bookmarks.map((bookmark, index) => ({
      id: `bookmark-${index}`,
      title: bookmark.title,
      url: bookmark.url,
      active: bookmark.url === activeTab?.url,
    }));
    showBrowserPanel(
      {
        darkMode,
        kind: "bookmarks",
        items: [],
        entries,
        currentTitle: activeTab?.title,
        currentUrl: activeTab?.url,
      },
      { x, y },
      { width: 500, height: 760 },
    );
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
    const internal = isInternalBrowserUrl(closed.url);
    const restored: BrowserTab = {
      ...closed,
      id: createTabId(),
      groupId,
      loading: Boolean(closed.url) && !internal,
      hasWebview: Boolean(closed.url) && !internal,
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
    void activateNativeTab(restored, Boolean(restored.url) && !internal).catch((error) => {
      updateTab(restored.id, { loading: false, hasWebview: false, sleeping: true });
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function handleNativeMenuAction(action: string) {
    if (action.startsWith("navigation|back|")) {
      const [, , tabId, targetIndexValue] = action.split("|");
      const targetIndex = Number(targetIndexValue);
      const stack = navigationStacksRef.current[tabId];
      if (
        !stack ||
        !Number.isInteger(targetIndex) ||
        targetIndex < 0 ||
        targetIndex >= stack.index
      ) return;
      const offset = targetIndex - stack.index;
      navigationTargetRef.current[tabId] = targetIndex;
      void invokeNative("browser_page_action", {
        tabId,
        action: `history-go:${offset}`,
      }).catch((error) => {
        navigationTargetRef.current[tabId] = undefined;
        message.warning(error instanceof Error ? error.message : String(error));
      });
      return;
    }

    if (action.startsWith("refresh|")) {
      const key = action.slice("refresh|".length);
      if (key === "normal") runPageAction("reload");
      else if (key === "hard") runPageAction("reload-hard");
      else if (key === "clear-cache") runPageAction("reload-clear-cache");
      return;
    }

    if (action.startsWith("panel|downloads|")) {
      const [, , key, id] = action.split("|");
      const task = id ? downloadTasks[id] : undefined;
      if (key === "open" && id) {
        if (!task?.filePath || task.fileDeleted) {
          message.warning("找不到这个下载文件的位置。");
          return;
        }
        void invokeNative("open_download_file", { path: task.filePath }).catch((error) => {
          message.warning(error instanceof Error ? error.message : String(error));
        });
      } else if (key === "folder") {
        const target = task ?? allDownloadTasks.slice().reverse().find((item) => item.filePath && !item.fileDeleted);
        if (!target?.filePath || target.fileDeleted) {
          message.info("暂无可定位的下载文件。");
          return;
        }
        void invokeNative("show_download_in_folder", { path: target.filePath }).catch((error) => {
          message.warning(error instanceof Error ? error.message : String(error));
        });
      } else if (key === "always-open" && task) {
        const extension = downloadFileExtension(task.fileName || task.filePath);
        if (!extension) {
          message.warning("无法识别这个下载文件的类型。");
          return;
        }
        setAlwaysOpenDownloadExtensions((current) => {
          const enabled = current.includes(extension);
          message.success(enabled
            ? `已取消自动打开 ${extension} 文件`
            : `以后下载完成后将自动打开 ${extension} 文件`);
          return enabled
            ? current.filter((item) => item !== extension)
            : [...current, extension];
        });
      } else if (key === "copy-link" && task?.sourceUrl) {
        void navigator.clipboard.writeText(task.sourceUrl)
          .then(() => message.success("下载链接已复制"))
          .catch(() => message.warning("无法复制下载链接"));
      } else if (key === "report-unsafe" && task) {
        setDownloadTasks((current) => ({
          ...current,
          [task.id]: { ...current[task.id], unsafe: true },
        }));
        message.warning("已在 Sia 中将该下载标记为不安全");
      } else if (key === "delete-file" && task?.filePath && !task.fileDeleted) {
        void invokeNative("delete_download_file", { path: task.filePath })
          .then(() => {
            setDownloadTasks((current) => ({
              ...current,
              [task.id]: { ...current[task.id], fileDeleted: true },
            }));
            message.success("下载文件已删除");
          })
          .catch((error) => {
            message.warning(error instanceof Error ? error.message : String(error));
          });
      } else if (key === "remove" && task) {
        if (task.state === "waiting") {
          void invokeNative("resolve_pending_download", {
            id: task.id,
            choice: "cancel",
          }).catch(() => undefined);
        }
        setDownloadTasks((current) => {
          const next = { ...current };
          delete next[task.id];
          return next;
        });
      } else if (
        task
        && task.state === "waiting"
        && ["confirm-open", "confirm-save-as", "confirm-save"].includes(key)
      ) {
        const choice = key.replace("confirm-", "");
        void invokeNative<boolean>("resolve_pending_download", {
          id: task.id,
          choice,
        }).then((resolved) => {
          if (!resolved) message.info("已取消选择保存位置，下载仍在等待确认。");
        }).catch((error) => {
          message.warning(error instanceof Error ? error.message : String(error));
        });
      } else {
        message.info("完整下载管理页将在后续版本中提供。");
      }
      return;
    }

    if (action.startsWith("panel|history|")) {
      const [, , key, id] = action.split("|");
      if (key === "open" && id) {
        const entry = historyEntries.find((item) => item.id === id);
        if (entry) navigate(entry.url);
      } else if (key === "clear") {
        setHistoryEntries([]);
        message.success("历史记录已清除");
      } else {
        message.info("更多历史记录操作将在后续版本中提供。");
      }
      return;
    }

    if (action.startsWith("panel|bookmarks|")) {
      const [, , key, id] = action.split("|");
      if (key === "open" && id) {
        const index = Number(id.replace("bookmark-", ""));
        const bookmark = bookmarks[index];
        if (bookmark) navigate(bookmark.url);
      } else if (key === "add-current") {
        if (!activeTab?.url) {
          message.info("请先打开一个网页。");
        } else if (activeBookmarked) {
          message.info("当前页面已经在收藏夹中。");
        } else {
          setBookmarks((current) => [
            ...current,
            {
              title: activeTab.title || hostLabel(activeTab.url),
              url: activeTab.url,
            },
          ]);
          message.success("已添加到收藏夹");
        }
      } else if (key === "new-folder") {
        message.info("收藏夹文件夹将在下一阶段接入。");
      } else {
        message.info("更多收藏夹操作将在后续版本中提供。");
      }
      return;
    }

    if (action.startsWith("more:")) {
      const key = action.slice("more:".length);
      if (key === "tab-layout") {
        changeTabLayout(tabLayout === "horizontal" ? "vertical" : "horizontal");
      } else if (key === "bookmarks") {
        showBookmarksPanel();
      } else if (key === "bookmark-bar") {
        setShowBookmarksBar((current) => !current);
      } else if (key === "passwords") {
        openBrowserOverlay({ kind: "passwords", darkMode });
      } else if (key === "theme") {
        handleThemeChange(!darkMode);
      } else if (key === "history") {
        showHistoryPanel();
      } else if (key === "settings") {
        openSettingsTab();
      } else {
        message.info("设置中心将在下一阶段接入。");
      }
      return;
    }

    if (action.startsWith("tree|")) {
      const [, groupId, smallGroupIdValue, key] = action.split("|");
      if (!groupId || !key) return;
      const smallGroupId = smallGroupIdValue || undefined;
      if (key === "new-tab") openTab(undefined, groupId, smallGroupId);
      else if (key === "new-small-group") openTreeEditDialog("new-small-group", groupId);
      else if (key === "rename") {
        openTreeEditDialog(
          smallGroupId ? "rename-small-group" : "rename-group",
          groupId,
          smallGroupId,
        );
      } else if (key === "clear-data") confirmClearGroupData(groupId, smallGroupId);
      else if (key === "delete") {
        if (smallGroupId) confirmDeleteSmallGroup(groupId, smallGroupId);
        else confirmDeleteGroup(groupId);
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

  function handleFloatingTabPanelAction(payload: BrowserOverlayAction) {
    const { action, value = "" } = payload;
    if (action === "select" && value) selectTab(value);
    else if (action === "close" && value) closeTab(value);
    else if (action === "toggle-audio" && value) toggleTabAudio(value);
    else if (action === "new-root-tab") openTab(undefined, ROOT_GROUP_ID);
    else if (action === "new-group") openNewGroupModal();
    else if (action === "new-tab") {
      const [groupId, smallGroupId] = value.split("|");
      if (groupId) openTab(undefined, groupId, smallGroupId || undefined);
    } else if (action === "collapse-panel") {
      hideIndependentTabPanel();
    } else if (action === "toggle-group" && value) {
      setCollapsedGroupIds((current) => (
        current.includes(value)
          ? current.filter((id) => id !== value)
          : [...current, value]
      ));
    } else if (action === "toggle-small-group" && value) {
      setCollapsedSmallGroupIds((current) => (
        current.includes(value)
          ? current.filter((id) => id !== value)
          : [...current, value]
      ));
    } else if (action === "toggle-panel-pin") {
      toggleVerticalPanelPinned();
    } else if (action === "resize-panel") {
      const nextWidth = Number(value);
      if (Number.isFinite(nextWidth)) {
        setVerticalPanelWidth(Math.min(440, Math.max(220, Math.round(nextWidth))));
      }
    }
  }

  nativeMenuActionHandlerRef.current = handleNativeMenuAction;
  browserOverlayActionHandlerRef.current = handleBrowserOverlayAction;
  floatingPanelActionHandlerRef.current = handleFloatingTabPanelAction;

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

  function openBrowserOverlay(payload: BrowserOverlayPayload) {
    if (!isDesktopRuntime) {
      showPreviewNotice();
      return;
    }
    void invokeNative("open_browser_overlay", { payload }).catch((error) => {
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function openSettingsTab(section: BrowserSettingsSection = "general") {
    setSettingsSection(section);
    const existing = tabs.find((tab) => tab.url === SETTINGS_URL);
    if (existing) {
      if (existing.id !== activeId) {
        selectTab(existing.id);
      } else if (isDesktopRuntime) {
        void invokeNative("hide_browser_pages").catch(() => undefined);
      }
      return;
    }

    const currentTab = activeTabRef.current;
    const settingsTab: BrowserTab = {
      ...createBlankTab(currentTab.groupId, currentTab.smallGroupId),
      title: "Sia设置",
      url: SETTINGS_URL,
    };
    const inactiveSince = Date.now();
    activeTabRef.current = settingsTab;
    setTabs((current) => [
      ...current.map((tab) => tab.id === currentTab.id ? { ...tab, inactiveSince } : tab),
      settingsTab,
    ]);
    setActiveId(settingsTab.id);
    setAddressDraft(SETTINGS_URL);
    if (isDesktopRuntime) {
      void invokeNative("hide_browser_pages").catch((error) => {
        message.error(error instanceof Error ? error.message : String(error));
      });
    }
  }

  function openTabActionMenu(tabId: string, x: number, y: number) {
    const contextTab = tabs.find((tab) => tab.id === tabId);
    if (!contextTab) return;
    const orderedTabs = getLayoutOrderedTabs();
    const contextTabIndex = orderedTabs.findIndex((tab) => tab.id === contextTab.id);
    void invokeNative("show_browser_tab_menu", {
      tabId: contextTab.id,
      adjacentDirection: tabLayout === "vertical" ? "下方" : "右侧",
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        disabled: group.id === contextTab.groupId && !contextTab.smallGroupId,
      })),
      pinned: Boolean(contextTab.pinned),
      muted: Boolean(contextTab.muted),
      disableCloseOthers: tabs.length <= 1,
      disableCloseFollowing: contextTabIndex < 0 || contextTabIndex >= orderedTabs.length - 1,
      disableReopenClosed: closedTabs.length === 0,
      darkMode,
      sourceWindow: "main",
      x,
      y,
    }).catch((error) => {
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function openTreeActionMenu(
    groupId: string,
    smallGroupId: string | undefined,
    x: number,
    y: number,
  ) {
    void invokeNative("show_browser_tree_menu", {
      groupId,
      smallGroupId,
      darkMode,
      sourceWindow: "main",
      x,
      y,
    }).catch((error) => {
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function renderTabContextScope(children: ReactNode) {
    return (
      <span
        className="browser-tab-context-scope"
        onContextMenu={(event) => {
          event.preventDefault();
          const target = event.target;
          const tabElement = target instanceof Element
            ? target.closest<HTMLElement>("[data-browser-tab-id]")
            : null;
          const tabId = tabElement?.dataset.browserTabId;
          if (tabId) openTabActionMenu(tabId, event.clientX, event.clientY);
        }}
      >
        {children}
      </span>
    );
  }

  function runWindowAction(action: WindowAction) {
    if (!isDesktopRuntime) {
      showPreviewNotice();
      return;
    }
    if (action === "toggle-maximize") setWindowMaximized((value) => !value);
    void invokeNative("browser_window_action", { action }).catch((error) => {
      if (action === "toggle-maximize") setWindowMaximized((value) => !value);
      message.error(error instanceof Error ? error.message : String(error));
    });
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
    openBrowserOverlay({
      kind: "form",
      formKind: "new-group",
      title: "新建分组",
      label: "分组名称",
      placeholder: "例如：测试环境",
      description: "每个分组使用独立的 Cookie 数据目录。",
      darkMode,
    });
  }

  function createGroup(nameValue: string) {
    const name = nameValue.trim();
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
    openBrowserOverlay({
      kind: "form",
      formKind: kind,
      title: kind === "new-small-group"
        ? "新建小分组"
        : kind === "rename-group"
          ? "重命名分组"
          : "重命名小分组",
      label: kind === "rename-group" ? "分组名称" : "小分组名称",
      initialValue: initialName,
      placeholder: kind === "rename-group" ? "请输入分组名称" : "请输入小分组名称",
      groupId,
      smallGroupId,
      darkMode,
    });
  }

  function submitTreeEdit(treeEditDialog: TreeEditDialog, nameValue: string) {
    const name = nameValue.trim();
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
      shouldRestore = nextTab.sleeping && Boolean(nextTab.url) && !isInternalBrowserUrl(nextTab.url);
      activatedTab = {
        ...nextTab,
        loading: shouldRestore ? true : nextTab.loading,
        hasWebview: isInternalBrowserUrl(nextTab.url) ? false : (shouldRestore ? true : nextTab.hasWebview),
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
        void activateNativeTab(activatedTab, shouldRestore)
          .catch(() => undefined);
      }
    }
  }

  function confirmClearGroupData(groupId: string, smallGroupId?: string) {
    const group = groups.find((item) => item.id === groupId);
    const smallGroup = group?.smallGroups.find((item) => item.id === smallGroupId);
    if (!group) return;
    const targetName = smallGroup ? `小分组“${smallGroup.name}”` : `分组“${group.name}”`;
    openBrowserOverlay({
      kind: "confirm",
      title: "清除浏览数据",
      description: smallGroup
        ? `${targetName}与所属分组共享 Cookie。继续后将清除相关 WebView 的缓存、Cookie 和站点数据。`
        : `确定清除${targetName}的缓存、Cookie 和站点数据吗？`,
      okText: "清除",
      danger: true,
      action: ["confirm", "clear-data", groupId, smallGroupId ?? ""].join("|"),
      darkMode,
    });
  }

  function confirmDeleteGroup(groupId: string) {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;
    openBrowserOverlay({
      kind: "confirm",
      title: "删除标签组",
      description: `删除“${group.name}”后，该分组及其中的所有标签页和小分组都会关闭。`,
      okText: "删除",
      danger: true,
      action: ["confirm", "delete-group", groupId].join("|"),
      darkMode,
    });
  }

  function confirmDeleteSmallGroup(groupId: string, smallGroupId: string) {
    const group = groups.find((item) => item.id === groupId);
    const smallGroup = group?.smallGroups.find((item) => item.id === smallGroupId);
    if (!group || !smallGroup) return;
    openBrowserOverlay({
      kind: "confirm",
      title: "删除小分组",
      description: `删除“${smallGroup.name}”后，其中的所有标签页都会关闭。`,
      okText: "删除",
      danger: true,
      action: ["confirm", "delete-small-group", groupId, smallGroupId].join("|"),
      darkMode,
    });
  }

  function handleBrowserOverlayAction(payload: BrowserOverlayAction) {
    const { action, value = "" } = payload;
    if (action.startsWith("confirm|")) {
      const [, command, groupId, smallGroupIdValue] = action.split("|");
      if (!groupId || !command) return;
      const smallGroupId = smallGroupIdValue || undefined;
      const group = groups.find((item) => item.id === groupId);
      const smallGroup = group?.smallGroups.find((item) => item.id === smallGroupId);
      if (!group) return;
      if (command === "clear-data") {
        const targetTabs = tabs.filter((tab) => (
          tab.groupId === groupId && (smallGroupId === undefined || tab.smallGroupId === smallGroupId)
        ));
        const targetName = smallGroup ? `小分组“${smallGroup.name}”` : `分组“${group.name}”`;
        void invokeNative("clear_browser_tabs_data", {
          tabIds: targetTabs.map((tab) => tab.id),
        }).then(() => {
          message.success(`已清除${targetName}的浏览数据`);
        }).catch((error) => {
          message.error(error instanceof Error ? error.message : String(error));
        });
      } else if (command === "delete-group") {
        removeTreeTabs(groupId);
        setGroups((current) => current.filter((item) => item.id !== groupId));
        message.success(`已删除标签组“${group.name}”`);
      } else if (command === "delete-small-group" && smallGroupId && smallGroup) {
        removeTreeTabs(groupId, smallGroupId);
        setGroups((current) => current.map((item) => item.id === groupId
          ? { ...item, smallGroups: item.smallGroups.filter((entry) => entry.id !== smallGroupId) }
          : item));
        message.success(`已删除小分组“${smallGroup.name}”`);
      }
      return;
    }
    if (action.startsWith("tree|")) {
      const [, groupId, smallGroupIdValue, key] = action.split("|");
      if (!groupId || !key) return;
      const smallGroupId = smallGroupIdValue || undefined;
      if (key === "new-tab") openTab(undefined, groupId, smallGroupId);
      else if (key === "new-small-group") openTreeEditDialog("new-small-group", groupId);
      else if (key === "rename") {
        openTreeEditDialog(
          smallGroupId ? "rename-small-group" : "rename-group",
          groupId,
          smallGroupId,
        );
      } else if (key === "clear-data") confirmClearGroupData(groupId, smallGroupId);
      else if (key === "delete") {
        if (smallGroupId) confirmDeleteSmallGroup(groupId, smallGroupId);
        else confirmDeleteGroup(groupId);
      }
      return;
    }
    if (!action.startsWith("form|")) {
      handleNativeMenuAction(action);
      return;
    }
    const [, kind, groupId, smallGroupId] = action.split("|");
    if (kind === "new-group") {
      createGroup(value);
      return;
    }
    if (
      (kind === "new-small-group" || kind === "rename-group" || kind === "rename-small-group")
      && groupId
    ) {
      submitTreeEdit({
        kind,
        groupId,
        smallGroupId: smallGroupId || undefined,
      }, value);
    }
  }

  useEffect(() => {
    if (!isDesktopRuntime || !window.__TAURI__) return;
    let unlistenNative: (() => void) | undefined;
    let unlistenOverlay: (() => void) | undefined;
    let unlistenFloatingPanel: (() => void) | undefined;
    let unlistenFloatingPanelVisibility: (() => void) | undefined;
    let unlistenFloatingPanelError: (() => void) | undefined;
    let disposed = false;
    void window.__TAURI__.event.listen<string>("sia://native-menu-action", ({ payload }) => {
      nativeMenuActionHandlerRef.current(payload);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlistenNative = dispose;
    });
    void window.__TAURI__.event.listen<BrowserOverlayAction>(
      "sia://browser-overlay-action",
      ({ payload }) => {
        browserOverlayActionHandlerRef.current(payload);
      },
    ).then((dispose) => {
      if (disposed) dispose();
      else unlistenOverlay = dispose;
    });
    void window.__TAURI__.event.listen<BrowserOverlayAction>(
      "sia://floating-tab-panel-action",
      ({ payload }) => {
        floatingPanelActionHandlerRef.current(payload);
      },
    ).then((dispose) => {
      if (disposed) dispose();
      else unlistenFloatingPanel = dispose;
    });
    void window.__TAURI__.event.listen<boolean>(
      "sia://floating-tab-panel-visibility",
      ({ payload }) => {
        floatingPanelOpenRef.current = payload;
      },
    ).then((dispose) => {
      if (disposed) dispose();
      else unlistenFloatingPanelVisibility = dispose;
    });
    void window.__TAURI__.event.listen<string>(
      "sia://floating-tab-panel-error",
      ({ payload }) => {
        floatingPanelOpenRef.current = false;
        message.error(payload);
      },
    ).then((dispose) => {
      if (disposed) dispose();
      else unlistenFloatingPanelError = dispose;
    });
    return () => {
      disposed = true;
      unlistenNative?.();
      unlistenOverlay?.();
      unlistenFloatingPanel?.();
      unlistenFloatingPanelVisibility?.();
      unlistenFloatingPanelError?.();
    };
  }, []);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      const commandKey = event.ctrlKey || event.metaKey;
      if (event.key === "F12" || (commandKey && event.shiftKey && event.key.toLowerCase() === "i")) {
        event.preventDefault();
        void invokeNative("open_browser_devtools", { tabId: activeId }).catch((error) => {
          message.warning(error instanceof Error ? error.message : String(error));
        });
        return;
      }
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
    const activeDownloadCount = activeDownloadTasks.length;
    const downloadPercent = Math.round(downloadProgress * 100);
    return (
      <div className="browser-titlebar-actions">
        <Button
          className="toolbar-icon-button"
          variant="text"
          size="small"
          icon={<Icon name="puzzle" size={18} />}
          aria-label="扩展"
          title="扩展"
          onClick={() => openSettingsTab("extensions")}
        />
        <Button
          className="toolbar-icon-button"
          variant="text"
          size="small"
          icon={<Icon name="star" size={18} />}
          aria-label="收藏夹"
          title="收藏夹"
          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
            const rect = event.currentTarget.getBoundingClientRect();
            showBookmarksPanel(rect.right - 500, rect.bottom);
          }}
        />
        <Button
          className="toolbar-icon-button"
          variant="text"
          size="small"
          icon={<Icon name="clock" size={18} />}
          aria-label="历史记录"
          title="历史记录"
          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
            const rect = event.currentTarget.getBoundingClientRect();
            showHistoryPanel(rect.right - 500, rect.bottom);
          }}
        />
        <div
          className={`browser-download-action${activeDownloadCount > 0 ? " is-active" : ""}${downloadHasUnknownSize ? " is-indeterminate" : ""}`}
          aria-label={activeDownloadCount > 0
            ? `${activeDownloadCount} 个下载任务，${downloadHasUnknownSize ? "正在下载" : `总进度 ${downloadPercent}%`}`
            : "下载"}
        >
          {activeDownloadCount > 0 ? (
            <svg className="browser-download-progress" viewBox="0 0 40 40" aria-hidden="true">
              <circle className="browser-download-progress__track" cx="20" cy="20" r="18" pathLength="100" />
              <circle
                className="browser-download-progress__value"
                cx="20"
                cy="20"
                r="18"
                pathLength="100"
                style={{ strokeDashoffset: 100 - downloadProgress * 100 }}
              />
            </svg>
          ) : null}
          {downloadPulseToken > 0 ? (
            <span
              key={downloadPulseToken}
              className="browser-download-action__pulse"
              aria-hidden="true"
            />
          ) : null}
          <Button
            ref={downloadButtonRef}
            className="toolbar-icon-button"
            variant="text"
            size="small"
            icon={<Icon name="download" size={17} />}
            aria-label="下载"
            title={activeDownloadCount > 0
              ? `${activeDownloadCount} 个下载任务${downloadHasUnknownSize ? "" : ` · ${downloadPercent}%`}`
              : "下载"}
            onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
              const rect = event.currentTarget.getBoundingClientRect();
              showDownloadsPanel(rect.right - 440, rect.bottom);
            }}
          />
        </div>
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
          className="toolbar-icon-button browser-more-trigger"
          variant="text"
          size="small"
          icon={<Icon name="more-vertical" size={18} />}
          aria-label="更多"
          title="更多"
          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
            const rect = event.currentTarget.getBoundingClientRect();
            void invokeNative("show_browser_more_menu", {
              tabLayout,
              showBookmarksBar,
              darkMode,
              sourceWindow: "main",
              x: rect.left,
              y: rect.bottom,
            }).catch((error) => {
              message.error(error instanceof Error ? error.message : String(error));
            });
          }}
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
            onContextMenu={(event: ReactMouseEvent<HTMLButtonElement>) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              showBackHistoryPanel(rect.left, rect.bottom);
            }}
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
            onContextMenu={(event: ReactMouseEvent<HTMLButtonElement>) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              showRefreshPanel(rect.left, rect.bottom);
            }}
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
            aria-label="打开收藏夹"
            title="打开收藏夹"
            onClick={() => showBookmarksPanel()}
            onContextMenu={(event: ReactMouseEvent<HTMLButtonElement>) => {
              event.preventDefault();
              toggleBookmark();
            }}
          />
        </form>
        {activeTab?.loading ? <span className="browser-loading-line" aria-hidden="true" /> : null}
      </>
    );
  }

  return (
    <WindowFrame
      className={`browser-shell browser-shell--${tabLayout}`}
      titleBar={(
        <WindowTitleBar
          className={`browser-titlebar${tabLayout === "vertical" ? " is-vertical" : ""}`}
          leading={(
            <div className="browser-brand" aria-label="Sia Browser">
              <span className="browser-brand__mark" aria-hidden="true">
                <strong>Sia</strong>
                <small>browser</small>
              </span>
            </div>
          )}
          actions={renderTitlebarActions()}
          maximized={windowMaximized}
          onWindowAction={runWindowAction}
        >
          {tabLayout === "horizontal" ? (
            renderTabContextScope(
              <HorizontalTabStrip
                tabs={tabs}
                activeId={activeId}
                onSelect={selectTab}
                onClose={closeTab}
                onToggleAudio={toggleTabAudio}
                onNew={() => openTab()}
              />,
            )
          ) : (
            <div className="vertical-titlebar-navigation">
              {renderNavigationControls()}
            </div>
          )}
        </WindowTitleBar>
      )}
    >

      {tabLayout === "horizontal" ? (
        <section className="browser-toolbar" aria-label="浏览器工具栏">
          {renderNavigationControls()}
        </section>
      ) : null}

      <div className="browser-workspace">
        {tabLayout === "vertical" ? (
          <div
            ref={verticalPanelAnchorRef}
            className={`vertical-tab-panel-main${verticalPanelPinned ? " is-pinned" : " is-auto-hide"}`}
            style={{
              width: verticalPanelPinned
                ? verticalPanelWidth
                : COMPACT_VERTICAL_PANEL_WIDTH,
              minWidth: verticalPanelPinned
                ? verticalPanelWidth
                : COMPACT_VERTICAL_PANEL_WIDTH,
            }}
            onPointerEnter={showIndependentTabPanel}
          >
            {!verticalPanelPinned ? renderTabContextScope(
              <VerticalTabTree
                groups={groups}
                tabs={tabs}
                activeId={activeId}
                collapsedGroupIds={collapsedGroupIds}
                collapsedSmallGroupIds={collapsedSmallGroupIds}
                panelExpanded={verticalPanelPinned}
                panelPinned={verticalPanelPinned}
                panelWidth={verticalPanelWidth}
                onSelect={selectTab}
                onClose={closeTab}
                onToggleAudio={toggleTabAudio}
                onNewTab={(groupId, smallGroupId) => openTab(undefined, groupId, smallGroupId)}
                onNewRootTab={() => openTab(undefined, ROOT_GROUP_ID)}
                onNewGroup={openNewGroupModal}
                onToggleGroup={(groupId) => {
                  setCollapsedGroupIds((current) => (
                    current.includes(groupId)
                      ? current.filter((id) => id !== groupId)
                      : [...current, groupId]
                  ));
                }}
                onToggleSmallGroup={(smallGroupId) => {
                  setCollapsedSmallGroupIds((current) => (
                    current.includes(smallGroupId)
                      ? current.filter((id) => id !== smallGroupId)
                      : [...current, smallGroupId]
                  ));
                }}
                onTreeActionsOpen={openTreeActionMenu}
                onPinPanel={toggleVerticalPanelPinned}
                onPanelWidthChange={(width) => {
                  setVerticalPanelWidth(Math.min(440, Math.max(220, Math.round(width))));
                }}
              />,
            ) : null}
          </div>
        ) : null}
        <div className="browser-content">
          {showBookmarksBar && activeTab?.url !== SETTINGS_URL ? (
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
        {activeTab?.url === SETTINGS_URL ? (
          <BrowserSettingsPage
            activeDownloadCount={activeDownloadTasks.length}
            askBeforeDownload={askBeforeDownload}
            downloadDirectory={downloadDirectory}
            downloadCount={allDownloadTasks.length}
            initialSection={settingsSection}
            onAskBeforeDownloadChange={setAskBeforeDownload}
            onChooseDownloadDirectory={() => {
              void invokeNative<string | null>("choose_download_directory", {
                current: downloadDirectory,
              }).then((directory) => {
                if (directory) setDownloadDirectory(directory);
              }).catch((error) => {
                message.error(error instanceof Error ? error.message : String(error));
              });
            }}
            onOpenDefaultBrowserSettings={() => {
              void invokeNative("open_default_browser_settings").catch((error) => {
                message.error(error instanceof Error ? error.message : String(error));
              });
            }}
            onOpenDownloads={() => {
              showDownloadsPanel(Math.max(12, window.innerWidth - 460), 76);
            }}
            onOpenExtensionOptions={openExtensionOptionsTab}
          />
        ) : !activeTab?.hasWebview ? (
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
                      else openSettingsTab();
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
    </WindowFrame>
  );
}

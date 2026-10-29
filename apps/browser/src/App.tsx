import { listenNative } from "./nativeEvents";
import { extensionMatchesScope } from "./extensionScopes";
import { browserShortcut } from "./browserShortcuts";
import { newestDownloadsFirst, nextDownloadStartedAt } from "./downloadOrder";
import { normalizeTabSleep, tabSleepMilliseconds, type TabSleepPreference } from "./browserPreferences";
import { materializeBookmarks, type Bookmark, type BookmarkFolder, type ImportedBookmark } from "./bookmarks";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import {
  Button,
  Dropdown,
  Icon,
  Input,
  WindowFrame,
  WindowTitleBar,
  applySiaTheme,
  message,
  type IconName,
  type MenuItem,
  type WindowAction,
} from "@sia.soul/sia-react-ui";
import BrowserFavicon, { BrowserBrandGlyph } from "./components/BrowserFavicon";
import type { BrowserDropTarget } from "./browserTypes";
import VerticalTabTree from "./components/VerticalTabTree";
import BrowserDevtoolsWorkspace, { requestBrowserDevtools, controlBrowserDevtools } from "./components/BrowserDevtoolsWorkspace";
import { extractTreeItem, moveTreeGroup, profileScopeGroups, type GroupDropTarget, type TreeDragItem } from "./tabTreeMove";
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
} from "./browserTypes";

interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BrowserNativeEvent {
  tabId: string;
  kind: "load" | "title" | "new-window" | "close-requested" | "audio" | "error" | "favicon";
  /** 网页内核读取的 PNG 数据地址，空字符串表示清除当前站点图标。 */
  faviconUrl?: string;
  groupId?: string;
  url?: string;
  title?: string;
  loading?: boolean;
  audible?: boolean;
  muted?: boolean;
  message?: string;
}

interface BrowserDownloadNativeEvent {
  /** 首次收到此下载事件的时间，毫秒；持久化后保持不变，不随完成或进度更新。 */
  startedAt?: number;
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
  /** 休眠偏好与最近关闭记录跨启动保留，兼容没有这些字段的旧会话。 */
  tabSleep?: TabSleepPreference;
  closedEntries?: BrowserClosedEntry[];
  version: 1 | 2 | 3;
  tabs: BrowserTab[];
  groups: BrowserGroup[];
  activeId: string;
  bookmarks?: Bookmark[];
  /** 收藏目录与链接分开保存，兼容旧版根目录收藏。 */
  bookmarkFolders?: BookmarkFolder[];
  showBookmarksBar?: boolean;
  verticalPanelPinned?: boolean;
  verticalPanelWidth?: number;
  history?: BrowserHistoryEntry[];
  downloads?: BrowserDownloadNativeEvent[];
  alwaysOpenDownloadExtensions?: string[];
  downloadDirectory?: string;
  askBeforeDownload?: boolean;
  /** 仅在同进程交接时使用，冷启动不恢复运行期引用。 */
  liveTransfer?: {
    popupTabs: Array<[string, string]>;
    loadedPopupTabs: string[];
    navigationStacks: Record<string, BrowserNavigationStack>;
    navigationTargets: Record<string, number | undefined>;
  };
}

interface BrowserHistoryEntry {
  id: string;
  tabId: string;
  title: string;
  url: string;
  visitedAt: number;
}

/** 一次关闭操作；分组保留完整结构，用于展开查看和按原分组恢复。 */
interface BrowserClosedEntry {
  id: string;
  closedAt: number;
  tabs: BrowserTab[];
  group?: BrowserGroup;
  smallGroupId?: string;
  title: string;
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

const COMPACT_VERTICAL_PANEL_WIDTH = 56;
const DEFAULT_VERTICAL_PANEL_WIDTH = 292;
const FLOATING_TAB_PANEL_SHADOW_SPACE = 8;
// 面板表面距工具栏按钮底部 12px，保留间隔并使弹出位置贴近入口。
const TOOLBAR_PANEL_GAP = 12;

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
  // 本地 HTML 入口已由原生层校验，保留 file URL，不能当成搜索词发送到搜索引擎。
  if (/^(https?|chrome-extension|file):\/\//i.test(value) || /^about:/i.test(value)) return value;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value)) return `http://${value}`;
  if (!/\s/.test(value) && (/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(value) || /^\d{1,3}(?:\.\d{1,3}){3}/.test(value))) {
    return `https://${value}`;
  }
  return `https://www.bing.com/search?q=${encodeURIComponent(value)}`;
}

function hostLabel(url: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "file:" ? decodeURIComponent(parsed.pathname.split('/').pop() || '本地网页')
      : parsed.hostname.replace(/^www\./, "");
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
  // 调试中的后台网页暂缓休眠，避免切换标签后自动销毁 DevTools 会话。
  const [devtoolsTabIds, setDevtoolsTabIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState(FIRST_TAB.id);
  const [addressDraft, setAddressDraft] = useState("");
  const [newTabQuery, setNewTabQuery] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  // 扩展信息预加载，点击面板时无需等待磁盘扫描。
  const [toolbarExtensions, setToolbarExtensions] = useState<BrowserExtensionRecord[]>([]);
  useEffect(() => {
    // 网页中的密码候选面板是独立 Shadow DOM，需要显式同步浏览器当前的 Sia 主题变量。
    applySiaTheme(darkMode ? "dark" : "light");
    if (!isDesktopRuntime) return;
    // 网页 Profile 独立于外壳 CSS，显式同步以覆盖系统主题和以前保存的深色偏好。
    void invokeNative("set_browser_theme", { darkMode })
      .catch(() => message.error("网页主题同步失败，请重试切换主题"));
    const syncPasswordTheme = () => {
      const styles = getComputedStyle(document.documentElement);
      const color = (name: string) => styles.getPropertyValue(name).trim();
      void invokeNative("set_browser_password_theme", {
        theme: {
          darkMode,
          colors: {
            surface: color("--sia-color-surface"), text: color("--sia-color-text"),
            secondary: color("--sia-color-text-secondary"), border: color("--sia-color-border"),
            primary: color("--sia-color-primary"), hover: color("--sia-color-primary-light"),
            scrollbar: color("--sia-scrollbar-thumb"),
          },
        },
      }).catch(() => message.error("密码面板主题同步失败，请重试切换主题"));
    };
    syncPasswordTheme();
    const observer = new MutationObserver(syncPasswordTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-sia-theme"] });
    return () => observer.disconnect();
  }, [darkMode]);
  const [groups, setGroups] = useState<BrowserGroup[]>(() => [...BROWSER_GROUPS]);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const detachingRef = useRef(false);
  const restoredSessionRef = useRef(false);
  const [restoredPageReady, setRestoredPageReady] = useState(false);
  /** 所有创建入口统一继承小分组的数据空间，包含复制、相邻新建及最后一页的占位页。 */
  function createScopedBlankTab(groupId = DEFAULT_GROUP_ID, smallGroupId?: string) {
    const tab = createBlankTab(groupId, smallGroupId);
    tab.profileGroupId = groupsRef.current.find(group => group.id === groupId)?.smallGroups
      .find(small => small.id === smallGroupId)?.profileGroupId;
    return tab;
  }
  const [stateHydrated, setStateHydrated] = useState(!isDesktopRuntime);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([...DEFAULT_BOOKMARKS]);
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolder[]>([]);
  // 首次启动保留单行导航布局；恢复会话时仍尊重已保存的书签栏偏好。
  const [showBookmarksBar, setShowBookmarksBar] = useState(false);
  const [openBookmarkFolder, setOpenBookmarkFolder] = useState<string>();
  const bookmarkFolderTriggers = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!window.__TAURI__) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    // 原生菜单在网页上点击外部或按 Escape 也能关闭，同步 Dropdown 的受控展开状态。
    void listenNative<{ visible: boolean; panelKey?: string }>("sia://browser-menu-visibility", ({ payload }) => {
      setOpenBookmarkFolder(payload.visible && payload.panelKey?.startsWith("bookmark-folder|")
        ? payload.panelKey.slice("bookmark-folder|".length) : undefined);
    }).then(dispose => { if (disposed) dispose(); else unlisten = dispose; });
    return () => { disposed = true; unlisten?.(); };
  }, []);
  const [closedTabs, setClosedTabs] = useState<BrowserClosedEntry[]>([]);
  const [tabSleep, setTabSleep] = useState<TabSleepPreference>({ value: 1, unit: "hours" });
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [windowActive, setWindowActive] = useState(() => document.hasFocus());
  const [windowResizeEdges, setWindowResizeEdges] = useState("");
  useEffect(() => {
    if (!isDesktopRuntime || !window.__TAURI__) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    // 缩放命中来自原生窗口边缘；主文档无法通过 CSS :hover 读取该区域。
    void listenNative<string>("sia://window-resize-edges", ({ payload }) => {
      if (!disposed) setWindowResizeEdges(payload);
    }).then((dispose) => { if (disposed) dispose(); else unlisten = dispose; });
    return () => { disposed = true; unlisten?.(); };
  }, []);
  useEffect(() => {
    let disposed = false;
    let revision = 0;
    const disposers: (() => void)[] = [];
    // 原生网页获得焦点也会让外壳 document 失焦，桌面模式必须查询整个窗口的激活状态。
    const refresh = () => {
      const request = ++revision;
      if (!isDesktopRuntime) {
        setWindowActive(document.hasFocus());
        return;
      }
      void invokeNative<boolean>("is_browser_window_active").then((active) => {
        if (!disposed && request === revision) setWindowActive(active === true);
      }).catch((error) => console.error("读取浏览器窗口激活状态失败", error));
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("blur", refresh);
    if (isDesktopRuntime && window.__TAURI__) {
      for (const name of ["tauri://focus", "tauri://blur"]) {
        void listenNative(name, refresh).then((dispose) => {
          if (disposed) dispose(); else { disposers.push(dispose); refresh(); }
        });
      }
    }
    refresh();
    return () => {
      disposed = true;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("blur", refresh);
      disposers.forEach((dispose) => dispose());
    };
  }, []);
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
  // 鼠标聚焦保留原生光标命中位置，键盘或快捷键聚焦仍全选地址。
  const addressPointerFocusRef = useRef(false);
  // 首次鼠标聚焦延迟到点击完成才全选；记录移动，避免覆盖原生拖选结果。
  const addressPointerSelectionRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // 行内候选保留原始协议；显示时省略的 http:// 不能在提交时被误转为 https://。
  const addressCompletionRef = useRef<{
    /** 用户实际输入的前缀长度，也是待接受后缀的选区起点。 */
    prefixLength: number;
    /** 地址栏显示的完整候选。 */
    value: string;
    /** 导航使用的原始完整网址。 */
    url: string;
  } | null>(null);
  const addressFocusedRef = useRef(false);
  const previewNoticeShownRef = useRef(false);
  const boundsRef = useRef<BrowserBounds>({ x: 0, y: 126, width: 1200, height: 700 });
  const floatingPanelOpenRef = useRef(false);
  const alwaysOpenDownloadExtensionsRef = useRef<string[]>([]);
  const autoOpenedDownloadIdsRef = useRef(new Set<string>());
  // 记录弹出页的来源，自动关闭时回到发起页面，而不是相邻的旧空白页。
  const popupTabsRef = useRef(new Map<string, string>());
  const loadedPopupTabsRef = useRef(new Set<string>());
  const closePopupRef = useRef<(id: string) => void>(() => undefined);
  const announcedDownloadsRef = useRef(new Set<string>());
  // 仅保留最近触发时间，自动打开面板时仍能高亮新项；不写入下载历史。
  const downloadHighlightsRef = useRef(new Map<string, number>());
  const showDownloadsPanelRef = useRef<() => void>(() => undefined);
  const activeTabRef = useRef<BrowserTab>(FIRST_TAB);
  const tabsRef = useRef<BrowserTab[]>([FIRST_TAB]);
  // 同一标签切换数据空间时禁止重复移动，避免旧 WebView 的关闭回调影响新实例。
  const movingTabIdsRef = useRef(new Set<string>());
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

  // 新建、外部打开和切换标签统一展开其祖先；用户随后手动折叠时不强制重新展开。
  useEffect(() => {
    if (!activeTab) return;
    setCollapsedGroupIds(current => current.includes(activeTab.groupId)
      ? current.filter(id => id !== activeTab.groupId) : current);
    if (activeTab.smallGroupId) {
      setCollapsedSmallGroupIds(current => current.includes(activeTab.smallGroupId!)
        ? current.filter(id => id !== activeTab.smallGroupId) : current);
    }
  }, [activeTab?.id, activeTab?.groupId, activeTab?.smallGroupId]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    const candidates = tabs.filter((tab) => (
      tab.id !== activeId
      && tab.hasWebview
      && !devtoolsTabIds.includes(tab.id)
      && !tab.sleeping
      && tab.inactiveSince !== undefined
    ));
    if (candidates.length === 0) return undefined;

    const sleepDelay = tabSleepMilliseconds(tabSleep);
    const nextSleepAt = Math.min(...candidates.map((tab) => (tab.inactiveSince ?? Date.now()) + sleepDelay));
    const delay = Math.max(0, nextSleepAt - Date.now());
    const timer = window.setTimeout(() => {
      if (detachingRef.current) return;
      const now = Date.now();
      const sleepingIds = new Set(candidates
        .filter((tab) => (
          tab.id !== activeId
          && tab.inactiveSince !== undefined
          && now - tab.inactiveSince >= sleepDelay
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
  }, [activeId, tabs, devtoolsTabIds, tabSleep]);

  const updateTab = useCallback((tabId: string, patch: Partial<BrowserTab>) => {
    setTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, ...patch } : tab));
  }, []);

  const showPreviewNotice = useCallback(() => {
    if (previewNoticeShownRef.current) return;
    previewNoticeShownRef.current = true;
    message.info("当前是 Web 界面预览；运行 pnpm browser:dev 后会使用原生 WebView2 加载网页。");
  }, []);

  // 布局只更新当前标签，后台网页不继承其他标签的开发者工具占位。
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
      void invokeNative("set_browser_bounds", { tabId: activeTabRef.current.id, bounds }).catch(() => undefined);
    }
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
        // 新开及唤醒标签均传递小分组标识，保持其 WebView2 数据空间一致。
        smallGroupId: tab.smallGroupId ?? null,
        profileGroupId: tab.profileGroupId ?? null,
        url: tab.url,
        bounds: boundsRef.current,
      });
      // 原生创建可能晚于停靠布局更新；完成后重新测量当前页，避免旧尺寸覆盖新布局。
      if (activeTabRef.current.id === tab.id) syncBrowserBounds();
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
      groupId: tab.groupId,
      smallGroupId: tab.smallGroupId ?? null,
      profileGroupId: tab.profileGroupId ?? null,
      bounds: boundsRef.current,
    });
    if (found) {
      // 标签切换请求发出时仍可能是上一页的停靠尺寸，不能将该快照作为最终边界。
      if (activeTabRef.current.id === tab.id) syncBrowserBounds();
      return;
    }

    // 持久化状态中的 hasWebview 只代表上次运行时的状态。
    // 应用重启后原生子 WebView 不存在，切换时必须按当前 URL 自动重建。
    await openWebview();
  }, [syncBrowserBounds, updateTab]);

  const openTab = useCallback((url?: string, groupId?: string, smallGroupId?: string, openerId?: string, beforeTabId?: string | null) => {
    const currentTab = activeTabRef.current;
    const resolvedGroupId = groupId ?? currentTab.groupId ?? DEFAULT_GROUP_ID;
    const resolvedSmallGroupId = smallGroupId ?? (groupId ? undefined : currentTab.smallGroupId);
    const tab = createScopedBlankTab(resolvedGroupId, resolvedSmallGroupId);
    if (openerId) popupTabsRef.current.set(tab.id, openerId);
    const targetUrl = url ? resolveAddress(url) : "";
    const nextTab: BrowserTab = targetUrl
      ? { ...tab, title: hostLabel(targetUrl) || "正在加载", url: targetUrl, loading: true, hasWebview: true }
      : tab;

    // 外部请求可能连续到达，立即更新活动引用，避免下一次操作仍读取旧标签。
    activeTabRef.current = nextTab;
    const inactiveSince = Date.now();
    setTabs((current) => {
      const updated = current.map((item) => item.id === currentTab.id ? { ...item, inactiveSince } : item);
      const anchorIndex = updated.findIndex((item) => item.id === (openerId ?? currentTab.id)
        && item.groupId === resolvedGroupId && item.smallGroupId === resolvedSmallGroupId);
      // 普通新建跟随当前标签；明确指定其他分组时仍加入目标分组末尾。
      let insertion = anchorIndex >= 0 ? anchorIndex + 1 : updated.length;
      if (beforeTabId !== undefined) {
        // 文件拖入按投放横线插入；等待原生路径解析期间锚点消失则退到目标区域末尾。
        insertion = beforeTabId === null ? -1 : updated.findIndex(item => item.id === beforeTabId
          && item.groupId === resolvedGroupId && item.smallGroupId === resolvedSmallGroupId);
        if (insertion < 0) {
          insertion = updated.length;
          for (let index = updated.length - 1; index >= 0; index--) {
            if (updated[index].groupId === resolvedGroupId && updated[index].smallGroupId === resolvedSmallGroupId) { insertion = index + 1; break; }
          }
        }
      }
      updated.splice(insertion, 0, nextTab);
      return updated;
    });
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

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    // 网页区拖入保持根级新建；自有 Tree 的文件拖入按有效分组和投放锚点创建，不覆盖当前页面。
    const openDropped = (payload: string | { url: string; target?: BrowserDropTarget }) => {
      if (disposed) return;
      const url = typeof payload === "string" ? payload : payload.url;
      const target = typeof payload === "string" ? undefined : payload.target;
      if (target) {
        const group = groups.find(item => item.id === target.groupId);
        const valid = (group || target.groupId === ROOT_GROUP_ID)
          && (target.smallGroupId === undefined || group?.smallGroups.some(item => item.id === target.smallGroupId))
          && (target.beforeTabId === null || typeof target.beforeTabId === "string");
        if (valid) {
          openTab(url, target.groupId, target.smallGroupId, undefined, target.beforeTabId);
          return;
        }
      }
      openTab(url, ROOT_GROUP_ID);
    };
    const previewDrop = (event: Event) => openDropped((event as CustomEvent<string>).detail);
    window.addEventListener('sia-open-dropped-url', previewDrop);
    if (window.__TAURI__) {
      void listenNative<string | { url: string; target?: BrowserDropTarget }>('sia://open-dropped-url', ({ payload }) => openDropped(payload))
        .then(dispose => { if (disposed) dispose(); else unlisten = dispose; });
    }
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener('sia-open-dropped-url', previewDrop);
    };
  }, [openTab, groups]);

  // 记录已建标签的请求编号；监听重建或确认失败后的重试不会重复创建同一标签。
  const receivedExternalOpens = useRef(new Set<number>());
  useEffect(() => {
    if (!isDesktopRuntime || !stateHydrated || !window.__TAURI__) return undefined;
    let disposed = false;
    let draining = false;
    let notified = false;
    let unlisten: (() => void) | undefined;
    const drain = async () => {
      notified = true;
      if (draining) return;
      draining = true;
      try {
        do {
          notified = false;
          const pending = await invokeNative<Array<{ id: number; url: string }>>("pending_browser_opens") ?? [];
          if (disposed) return;
          for (const request of pending) {
            if (!receivedExternalOpens.current.has(request.id)) {
              openTab(request.url, ROOT_GROUP_ID);
              receivedExternalOpens.current.add(request.id);
            }
          }
          if (pending.length) {
            await invokeNative("acknowledge_browser_opens", { ids: pending.map(request => request.id) });
          }
        } while (notified && !disposed);
      } catch (error) {
        if (!disposed) message.warning(error instanceof Error ? error.message : String(error));
      } finally {
        draining = false;
      }
    };
    // 先订阅再读取积压请求，覆盖会话恢复期间和注册监听前后到达的外部打开。
    void listenNative("sia://external-open-pending", () => { void drain(); })
      .then(dispose => {
        if (disposed) dispose();
        else { unlisten = dispose; void drain(); }
      });
    return () => { disposed = true; unlisten?.(); };
  }, [openTab, stateHydrated]);

  const openExtensionOptionsTab = useCallback(async (
    extension: BrowserExtensionRecord,
  ): Promise<string | undefined> => {
    const optionsPage = extension.optionsPage?.trim();
    if (!optionsPage) throw new Error(`扩展“${extension.name}”没有提供配置页面`);

    const absoluteOptionsUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(optionsPage);
    const currentTab = activeTabRef.current;
    if (!extension.enabled || !extensionMatchesScope(extension.scopes, currentTab.profileGroupId ?? currentTab.groupId, currentTab.smallGroupId)) {
      throw new Error("当前分组未启用此扩展，请切换到允许的分组或调整生效分组");
    }
    const nextTab = {
      ...createScopedBlankTab(
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

      const browserId = await invokeNative<string>(
        "resolve_browser_extension_id",
        {
          id: extension.id,
          tabId: nextTab.id,
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
    const blankTab = createScopedBlankTab(source.groupId, source.smallGroupId);
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

  // 窗口尺寸监听长期存在，必须读取最近一次提交的主题、标签与分组，避免旧闭包覆盖面板状态。
  const presentIndependentTabPanelRef = useRef(presentIndependentTabPanel);
  useLayoutEffect(() => {
    presentIndependentTabPanelRef.current = presentIndependentTabPanel;
  });

  function hideIndependentTabPanel() {
    floatingPanelOpenRef.current = false;
    void invokeNative("close_floating_tab_panel").catch(() => undefined);
  }

  /** 仅通过面板按钮切换展开状态，鼠标经过紧凑列表时保持收缩。 */
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
    tabs,
    verticalPanelPinned,
    verticalPanelWidth,
  ]);

  useEffect(() => {
    if (!isDesktopRuntime) return undefined;
    if (!stateHydrated) {
      floatingPanelOpenRef.current = false;
      void invokeNative("close_floating_tab_panel").catch(() => undefined);
      return undefined;
    }
    let presentFrame = 0;
    if (verticalPanelPinned) {
      floatingPanelOpenRef.current = true;
      presentFrame = window.requestAnimationFrame(() => presentIndependentTabPanelRef.current());
    } else {
      floatingPanelOpenRef.current = false;
      void invokeNative("close_floating_tab_panel").catch(() => undefined);
    }
    const handleWindowResize = () => {
      if (verticalPanelPinned || floatingPanelOpenRef.current) {
        presentIndependentTabPanelRef.current();
      }
    };
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.cancelAnimationFrame(presentFrame);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [
    stateHydrated,
    verticalPanelPinned,
    verticalPanelWidth,
    // 收藏夹栏改变标题区高度，原生标签面板也必须重新测量顶部与可用高度。
    showBookmarksBar,
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

    // 系统关联传入的网址作为根级新标签恢复，不覆盖已保存标签或借用某个小分组的登录态。
    void Promise.all([
      invokeNative<BrowserPersistedState | null>("load_browser_state"),
      window.__SIA_DETACHED_WINDOW__ ? Promise.resolve(null) : invokeNative<string | null>("get_browser_launch_url"),
      window.__SIA_LIVE_TRANSFER__ ? invokeNative<string[]>("transferred_browser_tabs") : Promise.resolve([] as string[]),
    ])
      .then(([savedState, launchUrl, transferredIds]) => {
        const transferred = new Set(transferredIds);
        const launchTab = launchUrl ? { ...createBlankTab(ROOT_GROUP_ID), url: launchUrl, title: hostLabel(launchUrl) } : null;
        const state = launchTab ? {
          ...savedState,
          tabs: [...(savedState?.tabs ?? []), launchTab],
          activeId: launchTab.id,
        } : savedState;
        if (cancelled || !state || !Array.isArray(state.tabs) || state.tabs.length === 0) return;
        const savedActiveId = state.tabs.some((tab) => tab.id === state.activeId)
          ? state.activeId
          : state.tabs[0].id;
        const restoredTabs = state.tabs.map((tab) => {
          const active = tab.id === savedActiveId;
          const internal = isInternalBrowserUrl(tab.url);
          return {
            ...tab,
            // 仅更新旧版自动生成的设置标题，保留用户自定义名称和既有内部地址。
            title: tab.url === SETTINGS_URL && ["Sia设置", "栖页设置"].includes(tab.title) ? "西娅设置" : tab.title,
            loading: transferred.has(tab.id) ? tab.loading : active && Boolean(tab.url) && !internal,
            hasWebview: transferred.has(tab.id) || (active && Boolean(tab.url) && !internal),
            sleeping: !transferred.has(tab.id) && !active && Boolean(tab.url) && !internal,
            inactiveSince: active ? undefined : tab.inactiveSince,
            audible: transferred.has(tab.id) && tab.audible,
            muted: Boolean(tab.muted),
            pinned: Boolean(tab.pinned),
          };
        });
        if (window.__SIA_LIVE_TRANSFER__ && state.liveTransfer) {
          popupTabsRef.current = new Map(state.liveTransfer.popupTabs);
          loadedPopupTabsRef.current = new Set(state.liveTransfer.loadedPopupTabs);
          navigationStacksRef.current = state.liveTransfer.navigationStacks;
          navigationTargetRef.current = state.liveTransfer.navigationTargets;
        }
        const restoredActiveTab = restoredTabs.find((tab) => tab.id === savedActiveId) ?? restoredTabs[0];
        restoredSessionRef.current = true;

        setTabs(restoredTabs);
        setGroups(Array.isArray(state.groups) ? state.groups : [...BROWSER_GROUPS]);
        setActiveId(restoredActiveTab.id);
        setAddressDraft(restoredActiveTab.url);
        // 所有会话统一使用左侧树形标签；旧版布局偏好不再读取，标签和分组仍完整恢复。
        if (Array.isArray(state.bookmarks)) setBookmarks(state.bookmarks);
        if (Array.isArray(state.bookmarkFolders)) setBookmarkFolders(state.bookmarkFolders);
        if (Array.isArray(state.history)) setHistoryEntries(state.history.slice(0, 1000));
        setTabSleep(normalizeTabSleep(state.tabSleep));
        if (Array.isArray(state.closedEntries)) setClosedTabs(state.closedEntries.filter(entry => entry?.id && Array.isArray(entry.tabs) && entry.tabs.length > 0).slice(-20));
        if (Array.isArray(state.downloads)) {
          setDownloadTasks(Object.fromEntries(
            state.downloads
              .filter((item) => item?.id)
              .map((item, index) => [
                item.id,
                { ...(window.__SIA_LIVE_TRANSFER__ || item.state === "finished"
                  ? item
                  : { ...item, state: "finished" as const, success: false }),
                  // 旧版本未记录时间，只能保留已保存的先后顺序；新下载使用实际触发时间。
                  startedAt: item.startedAt ?? index + 1 },
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
        setShowBookmarksBar(state.showBookmarksBar ?? false);
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
              // 启动时已有外部请求选中新标签，就不再让延后的会话恢复抢回网页焦点。
              if (activeTabRef.current.id !== restoredActiveTab.id) {
                updateTab(restoredActiveTab.id, { loading: false, hasWebview: false, sleeping: true });
                return;
              }
              syncBrowserBounds();
              const restorePage = transferred.has(restoredActiveTab.id)
                ? invokeNative<boolean>("switch_browser_tab", {
                  tabId: restoredActiveTab.id, groupId: restoredActiveTab.groupId,
                  smallGroupId: restoredActiveTab.smallGroupId ?? null,
                  profileGroupId: restoredActiveTab.profileGroupId ?? null, bounds: boundsRef.current,
                }).then(found => { if (!found) throw new Error("迁移的网页视图未找到，已保留原页签"); })
                : invokeNative("open_browser_tab", {
                  tabId: restoredActiveTab.id, groupId: restoredActiveTab.groupId,
                  smallGroupId: restoredActiveTab.smallGroupId ?? null,
                  profileGroupId: restoredActiveTab.profileGroupId ?? null,
                  url: restoredActiveTab.url, bounds: boundsRef.current,
                });
              void restorePage.then(() => {
                if (!cancelled) setRestoredPageReady(true);
                // 恢复或迁移完成后重测当前页，避免沿用其他页签的开发工具占位。
                if (activeTabRef.current.id === restoredActiveTab.id) syncBrowserBounds();
                if (restoredActiveTab.muted) return invokeNative("set_browser_tab_muted", { tabId: restoredActiveTab.id, muted: true });
              }).catch((error) => {
                if (window.__SIA_LIVE_TRANSFER__) void invokeNative("reject_detached_window", { error: String(error) });
                updateTab(restoredActiveTab.id, { loading: false, hasWebview: false, sleeping: true });
                message.error(error instanceof Error ? error.message : String(error));
              });
            });
          });
        } else {
          void invokeNative("hide_browser_pages").then(() => setRestoredPageReady(true));
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
    if (stateHydrated && restoredPageReady && restoredSessionRef.current && isDesktopRuntime) {
      void invokeNative("present_detached_window").catch(error => message.error(String(error)));
    }
  }, [stateHydrated, restoredPageReady]);

  useEffect(() => {
    if (stateHydrated && restoredPageReady && restoredSessionRef.current && isDesktopRuntime) {
      void invokeNative("acknowledge_detached_window").catch(error => message.error(String(error)));
    }
  }, [stateHydrated, restoredPageReady]);

  useEffect(() => {
    if (!isDesktopRuntime || !stateHydrated) return undefined;
    const timer = window.setTimeout(() => {
      const state: BrowserPersistedState = {
        version: 3,
        activeId,
        groups,
        bookmarks,
        bookmarkFolders,
        history: historyEntries,
        tabSleep,
        closedEntries: closedTabs,
        // 按旧到新保存最近 200 项，兼容旧版恢复顺序并防止对象键顺序影响保留范围。
        downloads: newestDownloadsFirst(allDownloadTasks.filter((task) => task.state === "finished")).slice(0, 200).reverse(),
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
    bookmarkFolders,
    downloadDirectory,
    groups,
    historyEntries,
    tabSleep,
    closedTabs,
    showBookmarksBar,
    stateHydrated,
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

    void listenNative<BrowserNativeEvent>("sia://browser-event", ({ payload }) => {
      if (payload.kind === "new-window" && payload.url) {
        const sourceTab = tabsRef.current.find((tab) => tab.id === payload.tabId);
        openTab(
          payload.url,
          sourceTab?.groupId ?? payload.groupId,
          sourceTab?.smallGroupId,
          payload.tabId,
        );
        return;
      }
      if (payload.kind === "close-requested") {
        if (popupTabsRef.current.has(payload.tabId)) closePopupRef.current(payload.tabId);
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
        if (popupTabsRef.current.has(payload.tabId)) loadedPopupTabsRef.current.add(payload.tabId);
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
        // 图标事件不改变导航和加载状态；文档地址随图标保存，避免跳转过程中串图。
        if (payload.kind === "favicon") {
          return { ...tab, faviconUrl: payload.faviconUrl, faviconPageUrl: usableEventUrl };
        }
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

    void listenNative<PasswordSubmission>(
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
    void listenNative<BrowserDownloadNativeEvent>(
      "sia://browser-download",
      ({ payload }) => {
        const announce = (payload.state === "waiting" || payload.state === "started")
          && !announcedDownloadsRef.current.has(payload.id);
        if (announce) {
          const now = Date.now();
          for (const [id, startedAt] of downloadHighlightsRef.current) {
            if (now - startedAt >= 1500) downloadHighlightsRef.current.delete(id);
          }
          downloadHighlightsRef.current.set(payload.id, now);
          announcedDownloadsRef.current.add(payload.id);
          setDownloadPulseToken((current) => current + 1);
          // 只清理尚未完成文档导航的弹出页；普通网页及已加载的落地页保持打开。
          if (popupTabsRef.current.has(payload.tabId) && !loadedPopupTabsRef.current.has(payload.tabId)) {
            closePopupRef.current(payload.tabId);
          }
        }
        setDownloadTasks((current) => {
          // 完成通知后仍可能收到排队中的进度；新一轮 started/waiting 才能重新开启同编号任务。
          if (current[payload.id]?.state === "finished" && payload.state === "progress") return current;
          return {
            ...current,
            [payload.id]: {
              ...current[payload.id],
              ...payload,
              startedAt: current[payload.id]?.startedAt ?? payload.startedAt ?? nextDownloadStartedAt(Object.values(current)),
            },
          };
        });
        if (announce) {
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
    void listenNative<{ tabIds?: string[] }>("sia://extensions-changed", ({ payload }) => {
      setTabs((current) => current.map((tab) => (
        isInternalBrowserUrl(tab.url) || (payload?.tabIds && !payload.tabIds.includes(tab.id))
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
    // 焦点进入独立网页 WebView 或其他窗口时，主动结束地址编辑，避免外壳保留选区和焦点样式。
    const blurAddressInput = () => addressInputRef.current?.blur();
    window.addEventListener("blur", blurAddressInput);
    return () => window.removeEventListener("blur", blurAddressInput);
  }, []);

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
      smallGroupId: tabs.find((tab) => tab.id === tabId)?.smallGroupId ?? null,
      profileGroupId: tabs.find((tab) => tab.id === tabId)?.profileGroupId ?? null,
      url: targetUrl,
      bounds: boundsRef.current,
    }).catch((error) => {
      updateTab(tabId, { loading: false, title: "加载失败" });
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  // 受控值提交到 DOM 后再选中后缀，连续输入会自然替换候选而不是追加到完整网址末尾。
  useLayoutEffect(() => {
    const input = addressInputRef.current;
    const completion = addressCompletionRef.current;
    if (input === document.activeElement && completion?.value === addressDraft) {
      input?.setSelectionRange(completion.prefixLength, completion.value.length);
    }
  }, [addressDraft]);

  /** 仅在末尾键入时生成行内候选，删除、粘贴、中间编辑和输入法组词保留原生编辑行为。 */
  function handleAddressChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const value = input.value;
    const nativeEvent = event.nativeEvent as InputEvent;
    addressCompletionRef.current = null;
    if (nativeEvent.inputType === "insertText" && !nativeEvent.isComposing
      && value && !/\s/.test(value) && input.selectionStart === value.length
      && input.selectionEnd === value.length) {
      // 最近历史优先，其次收藏与已打开标签；只补全 HTTP(S) 地址，不补全内部设置页。
      const urls = [
        ...[...historyEntries].sort((left, right) => right.visitedAt - left.visitedAt),
        ...bookmarks,
        ...tabs,
      ];
      for (const { url } of urls) {
        if (!/^https?:\/\//i.test(url)) continue;
        const candidate = /^https?:/i.test(value) ? url : url.replace(/^https?:\/\//i, "");
        // 路径可能区分大小写，使用精确前缀匹配避免改变用户输入的地址语义。
        if (candidate.length <= value.length || !candidate.startsWith(value)) continue;
        addressCompletionRef.current = { prefixLength: value.length, value: candidate, url };
        setAddressDraft(candidate);
        // 连续输入的候选值可能不变，此时 React 不会再次提交，需要立即更新选区。
        input.value = candidate;
        input.setSelectionRange(value.length, candidate.length);
        return;
      }
    }
    setAddressDraft(value);
  }

  function handleAddressSubmit(event: FormEvent) {
    event.preventDefault();
    // 先保存输入再失焦，避免 onBlur 回填旧网址覆盖本次提交；导航随后更新为解析后的网址。
    const completion = addressCompletionRef.current;
    const submittedAddress = completion?.value === addressDraft ? completion.url : addressDraft;
    addressInputRef.current?.blur();
    navigate(submittedAddress);
  }

  function handleNewTabSearch(event: FormEvent) {
    event.preventDefault();
    navigate(newTabQuery);
  }

  function selectTab(tabId: string) {
    if (movingTabIdsRef.current.has(tabId)) return;
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

  closePopupRef.current = (tabId) => {
    closeTabsByIds([tabId], popupTabsRef.current.get(tabId));
  };

  function closeTab(tabId: string) {
    closeTabsByIds([tabId]);
  }

  function closeTabsByIds(tabIds: readonly string[], preferredActiveId?: string) {
    const closingIds = new Set(tabIds);
    for (const id of closingIds) {
      popupTabsRef.current.delete(id);
      loadedPopupTabsRef.current.delete(id);
    }
    const removedTabs = tabs.filter((tab) => closingIds.has(tab.id));
    if (removedTabs.length === 0) return;
    const orderedTabs = getLayoutOrderedTabs();
    const activeIndex = orderedTabs.findIndex((tab) => tab.id === activeId);
    // 相邻位置按面板显示顺序计算，跨分组时也优先选择上方仍保留的标签。
    const adjacentTab = orderedTabs.slice(0, activeIndex).reverse().find((tab) => !closingIds.has(tab.id))
      ?? orderedTabs.slice(activeIndex + 1).find((tab) => !closingIds.has(tab.id));
    let remaining = tabs.filter((tab) => !closingIds.has(tab.id));
    if (remaining.length === 0) {
      const source = removedTabs[0];
      remaining = [createScopedBlankTab(source.groupId, source.smallGroupId)];
    }
    // 同一次批量关闭保留为一条会话，避免丢失恢复时的顺序。
    setClosedTabs((current) => [...current, { id: createTabId(), closedAt: Date.now(), tabs: removedTabs, title: removedTabs[0].title }].slice(-20));

    if (isDesktopRuntime) {
      for (const tab of removedTabs) {
        void invokeNative("close_browser_tab", { tabId: tab.id }).catch(() => undefined);
      }
    }

    if (!closingIds.has(activeId)) {
      setTabs(remaining);
      return;
    }

    const openerIndex = remaining.findIndex(tab => tab.id === preferredActiveId);
    const adjacentIndex = remaining.findIndex(tab => tab.id === adjacentTab?.id);
    const nextIndex = openerIndex >= 0 ? openerIndex : Math.max(0, adjacentIndex);
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

  useEffect(() => {
    if (!isDesktopRuntime || !window.__TAURI__) return;
    let disposed = false;
    let revision = 0;
    const disposers: (() => void)[] = [];
    // 事件到达时重读缓存；旧请求不得覆盖较新的固定或启停状态。
    const refresh = () => {
      const request = ++revision;
      void invokeNative<BrowserExtensionRecord[]>("list_browser_extensions").then((records) => {
        if (!disposed && request === revision) setToolbarExtensions(records ?? []);
      }).catch(() => undefined);
    };
    for (const name of ["sia://extensions-changed", "sia://extension-toolbar-changed"]) {
      void listenNative(name, refresh).then((dispose) => {
        if (disposed) dispose(); else disposers.push(dispose);
      });
    }
    refresh();
    return () => { disposed = true; disposers.forEach((dispose) => dispose()); };
  }, []);

  // 面板标题和上下文事件共用当前父子分组名称，重命名后同步刷新。
  const activeExtensionGroup = groups.find((group) => group.id === activeTab.groupId);
  const activeExtensionHeading = [
    activeExtensionGroup?.name ?? "未分组",
    activeExtensionGroup?.smallGroups.find((small) => small.id === activeTab.smallGroupId)?.name,
  ].filter(Boolean).join(" / ");

  useEffect(() => {
    if (!isDesktopRuntime || !window.__TAURI__) return;
    void invokeNative("update_browser_extension_context", {
      extensionScope: { groupId: activeTab.profileGroupId ?? activeTab.groupId, smallGroupId: activeTab.smallGroupId },
      heading: activeExtensionHeading,
    }).catch(() => undefined);
  }, [activeTab.groupId, activeTab.profileGroupId, activeTab.smallGroupId, activeExtensionHeading]);

  /** 使用缓存立即展示扩展列表，面板自身在后台校准最新安装状态。 */
  function showExtensionsPanel(trigger: HTMLElement) {
    const rect = trigger.getBoundingClientRect();
    showBrowserPanel({
      darkMode, kind: "extensions", panelKey: "extensions", toggleKey: "extensions",
      items: [], extensions: toolbarExtensions, currentUrl: activeTab?.url,
      extensionScope: { groupId: activeTab.profileGroupId ?? activeTab.groupId, smallGroupId: activeTab.smallGroupId },
      heading: activeExtensionHeading,
    }, { x: rect.right - 340, y: rect.bottom }, { width: 340, height: 560 }, trigger);
  }

  function showBrowserPanel(
    payload: BrowserMenuPayload,
    anchor: { x: number; y: number },
    size: { width: number; height: number },
    trigger?: HTMLElement,
  ) {
    if (!isDesktopRuntime) {
      showPreviewNotice();
      return;
    }
    // 面板靠近窗口边缘时仍预留完整阴影空间，与原生 MENU_SHADOW_SPACE 和面板外边距保持一致。
    const shadowSpace = 20;
    const width = Math.min(size.width, Math.max(260, window.innerWidth - shadowSpace * 2));
    const x = Math.max(shadowSpace, Math.min(anchor.x, window.innerWidth - width - shadowSpace));
    const y = Math.max(shadowSpace, Math.min(anchor.y + TOOLBAR_PANEL_GAP, window.innerHeight - shadowSpace - 1));
    // 下方空间不足时缩短滚动区域，不把面板向上挤回工具栏。
    const height = Math.max(1, Math.min(size.height, window.innerHeight - y - shadowSpace));
    void invokeNative("show_browser_panel", {
      // 按钮范围随每次点击更新，缩放或窗口移动后仍能正确识别重复点击。
      payload: { ...payload, triggerBounds: trigger?.getBoundingClientRect().toJSON() ?? payload.triggerBounds },
      sourceWindow: "main",
      x,
      y,
      width,
      height,
    }).catch((error) => {
      // 原生文件夹菜单未能显示时恢复 Dropdown，避免触发器一直保持展开态。
      if (payload.kind === "bookmark-folder") setOpenBookmarkFolder(undefined);
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
        width: 320,
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
      { width: 280, height: 136 },
    );
  }

  function downloadPanelEntries(): BrowserPanelEntry[] {
    return newestDownloadsFirst(allDownloadTasks)
      .map((task) => ({
        id: task.id,
        startedAt: task.startedAt,
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
        highlightStartedAt: downloadHighlightsRef.current.get(task.id),
      }));
  }

  function showDownloadsPanel(x: number, y: number, trigger?: HTMLElement) {
    showBrowserPanel(
      {
        darkMode,
        kind: "downloads",
        panelKey: "downloads",
        toggleKey: trigger ? "downloads" : undefined,
        // 自动打开下载面板后，仍允许通过下载按钮一次点击收起。
        triggerBounds: downloadButtonRef.current?.getBoundingClientRect().toJSON(),
        items: [],
        entries: downloadPanelEntries(),
      },
      { x, y },
      { width: 360, height: 640 },
      trigger,
    );
  }
  showDownloadsPanelRef.current = () => {
    const rect = downloadButtonRef.current?.getBoundingClientRect();
    showDownloadsPanel(
      rect ? rect.right - 360 : Math.max(12, window.innerWidth - 380),
      rect ? rect.bottom : 76,
    );
  };

  function showHistoryPanel(x = window.innerWidth - 380, y = 48, trigger?: HTMLElement) {
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
        panelKey: "history",
        toggleKey: trigger ? "history" : undefined,
        items: [],
        entries,
        // 最近关闭来自真实关闭操作，不能以访问时间过滤代替。
        closedEntries: [...closedTabs].reverse().map(entry => ({
          id: entry.id, title: entry.title, timestamp: entry.closedAt,
          url: entry.tabs.length === 1 && !entry.group ? entry.tabs[0].url : undefined,
          faviconUrl: entry.tabs.length === 1 && !entry.group ? entry.tabs[0].faviconUrl : undefined,
          children: entry.group || entry.tabs.length > 1 ? entry.tabs.map(tab => ({ id: tab.id, title: tab.title, url: tab.url, faviconUrl: tab.faviconUrl })) : [],
        })),
      },
      { x, y },
      { width: 360, height: 640 },
      trigger,
    );
  }

  function showBookmarksPanel(x = window.innerWidth - 380, y = 48, trigger?: HTMLElement) {
    // 原有收藏保持可访问，导入项使用持久化标识，文件夹在面板内展开而不导航网页。
    const entries: BrowserPanelEntry[] = [...bookmarkFolders.map(folder => ({ ...folder, folder: true })), ...bookmarks.map((bookmark, index) => ({
      id: bookmark.id ?? `bookmark-${index}`,
      title: bookmark.title,
      url: bookmark.url,
      parentId: bookmark.parentId,
      order: bookmark.order,
      active: bookmark.url === activeTab?.url,
    }))];
    showBrowserPanel(
      {
        darkMode,
        kind: "bookmarks",
        panelKey: "bookmarks",
        toggleKey: trigger ? "bookmarks" : undefined,
        items: [],
        entries,
        currentTitle: activeTab?.title,
        currentUrl: activeTab?.url,
      },
      { x, y },
      { width: 360, height: 640 },
      trigger,
    );
  }

  /** 生成所选目录的菜单树，保留导入顺序并阻止损坏的父子关系循环。 */
  function bookmarkFolderItems(folderId: string): BrowserMenuItem[] {
    const entries: BrowserPanelEntry[] = [...bookmarkFolders.map(folder => ({ ...folder, folder: true })),
      ...bookmarks.map((bookmark, index) => ({ ...bookmark, id: bookmark.id ?? `bookmark-${index}` }))];
    function children(parentId: string, seen = new Set<string>()): BrowserMenuItem[] {
      if (seen.has(parentId) || seen.size >= 64) return [];
      const visited = new Set([...seen, parentId]);
      const items = entries.filter(entry => entry.parentId === parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(entry => entry.folder
          ? { key: `bookmark-folder|${entry.id}`, label: entry.title, folder: true, children: children(entry.id, visited) }
          : { key: `panel|bookmarks|open|${entry.id}`, label: entry.title, faviconUrl: entry.url });
      return items.length ? items : [{ key: `empty|${parentId}`, label: "此文件夹为空", disabled: true }];
    }
    return children(folderId);
  }

  /** Dropdown 菜单与原生浮层共享同一份目录数据；普通网页预览也可使用框架菜单。 */
  function bookmarkDropdownItems(items: BrowserMenuItem[]): MenuItem[] {
    return items.map((item, index) => ({ key: item.key ?? `bookmark-${index}`, label: item.label, disabled: item.disabled,
      icon: item.folder ? <Icon name="folder" size={16} /> : item.faviconUrl ? <BrowserFavicon url={item.faviconUrl} size={16} /> : undefined,
      children: item.children ? bookmarkDropdownItems(item.children) : undefined }));
  }

  /** 收藏夹栏只打开所选目录的级联菜单；原生浮层覆盖网页，避免普通 DOM 菜单被 WebView 遮挡。 */
  function showBookmarkFolder(folderId: string, trigger: HTMLElement) {
    const items = bookmarkFolderItems(folderId);
    const rect = trigger.getBoundingClientRect();
    showBrowserPanel({ darkMode, kind: "bookmark-folder", items,
      panelKey: `bookmark-folder|${folderId}`, toggleKey: `bookmark-folder|${folderId}` },
      // 每行 32px、相邻行间隔 3px，加上下各 6px 内边距和 1px 边框，避免底部被裁切。
      { x: rect.left, y: rect.bottom }, { width: 320, height: items.length * 35 + 11 }, trigger);
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

  /** 分组整体移动只改变树结构，保留现有网页及其登录数据。 */
  function moveGroup(item: TreeDragItem, target: GroupDropTarget) {
    if (detachingRef.current) return;
    const next = moveTreeGroup(groupsRef.current, tabsRef.current, item, target);
    groupsRef.current = next.groups;
    tabsRef.current = next.tabs;
    setGroups(next.groups);
    setTabs(next.tabs);
    activeTabRef.current = next.tabs.find(tab => tab.id === activeTabRef.current.id) ?? activeTabRef.current;
    if (item.kind === "small-group") setCollapsedGroupIds(current => current.filter(id => id !== target.groupId));
  }

  /** 等新窗口确认接收后再移除源项；失败时保留原分组与页签。 */
  async function detachItem(item: TreeDragItem, position?: [number, number]) {
    if (detachingRef.current) return;
    if (!isDesktopRuntime) { message.info("拖出为独立窗口需要在桌面版浏览器中使用。"); return; }
    const extracted = extractTreeItem(groupsRef.current, tabsRef.current, item);
    if (!extracted) return;
    detachingRef.current = true;
    const selectedIds = new Set(extracted.tabs.map(tab => tab.id));
    const childTabs = extracted.tabs.length ? extracted.tabs : [createScopedBlankTab(extracted.groupId, extracted.smallGroupId)];
    const active = childTabs.find(tab => tab.id === activeTabRef.current.id) ?? childTabs[0];
    const state: BrowserPersistedState = {
      version: 3, groups: extracted.groups, tabs: childTabs, activeId: active.id,
      downloads: Object.values(downloadTasks).filter(task => selectedIds.has(task.tabId)),
      liveTransfer: {
        popupTabs: [...popupTabsRef.current].filter(([id]) => selectedIds.has(id)),
        loadedPopupTabs: [...loadedPopupTabsRef.current].filter(id => selectedIds.has(id)),
        navigationStacks: Object.fromEntries(Object.entries(navigationStacksRef.current).filter(([id]) => selectedIds.has(id))),
        navigationTargets: Object.fromEntries(Object.entries(navigationTargetRef.current).filter(([id]) => selectedIds.has(id))),
      },
      bookmarks, history: historyEntries, showBookmarksBar, verticalPanelPinned, verticalPanelWidth,
      alwaysOpenDownloadExtensions, downloadDirectory, askBeforeDownload,
    };
    try {
      await invokeNative("detach_browser_window", { state, sourceActiveId: activeTabRef.current.id, position: position ?? null });
      let remaining = tabsRef.current.filter(tab => !selectedIds.has(tab.id));
      const nextGroups = groupsRef.current.flatMap(group => {
        if (item.kind === "group" && group.id === item.groupId && !remaining.some(tab => tab.groupId === group.id)) return [];
        if (item.kind === "small-group" && group.id === item.groupId
          && !remaining.some(tab => tab.groupId === group.id && tab.smallGroupId === item.smallGroupId)) {
          return [{ ...group, smallGroups: group.smallGroups.filter(small => small.id !== item.smallGroupId) }];
        }
        return [group];
      });
      if (!remaining.length) remaining = [createBlankTab(ROOT_GROUP_ID)];
      const previousId = activeTabRef.current.id;
      const ordered = getLayoutOrderedTabs();
      const index = ordered.findIndex(tab => tab.id === previousId);
      const adjacent = ordered.slice(0, index).reverse().find(tab => !selectedIds.has(tab.id))
        ?? ordered.slice(index + 1).find(tab => !selectedIds.has(tab.id));
      const nextActive = remaining.find(tab => tab.id === previousId)
        ?? remaining.find(tab => tab.id === adjacent?.id) ?? remaining[0];
      groupsRef.current = nextGroups;
      tabsRef.current = remaining;
      activeTabRef.current = nextActive;
      setGroups(nextGroups);
      setTabs(remaining);
      setActiveId(nextActive.id);
      setAddressDraft(nextActive.url);
      for (const id of selectedIds) { popupTabsRef.current.delete(id); loadedPopupTabsRef.current.delete(id); }
      // 原生网页已经迁移，源窗口只能移除数据，不能再关闭这些 WebView。
      setDownloadTasks(current => Object.fromEntries(Object.entries(current).filter(([, task]) => !selectedIds.has(task.tabId))));
      if (nextActive.id !== previousId) await activateNativeTab(nextActive, nextActive.sleeping);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally { detachingRef.current = false; }
  }

  function detachAfterDrag(item: TreeDragItem) {
    void invokeNative<[number, number] | null>("browser_drag_outside").then(position => {
      if (position) void detachItem(item, position);
    }).catch(error => message.error(String(error)));
  }

  /** 同组按锚点排序且保留网页实例；跨组重建隔离空间，后台页继续休眠。null 锚点表示目标列表末尾。 */
  function moveTabToGroup(tabId: string, groupId: string, smallGroupId?: string, beforeTabId?: string | null) {
    if (detachingRef.current) return;
    const tab = tabs.find((item) => item.id === tabId);
    const group = groups.find((item) => item.id === groupId);
    if (!tab || movingTabIdsRef.current.has(tabId) || (!group && groupId !== ROOT_GROUP_ID)) return;
    if (smallGroupId !== undefined && !group?.smallGroups.some((item) => item.id === smallGroupId)) return;
    if (beforeTabId !== undefined && beforeTabId !== null && !tabs.some((item) => item.id === beforeTabId
      && item.id !== tabId && item.groupId === groupId && item.smallGroupId === smallGroupId)) return;
    const sameGroup = tab.groupId === groupId && tab.smallGroupId === smallGroupId;
    // 仅重排数组，不触发原生关闭/打开命令；顺序由现有会话保存流程持久化。
    const place = (current: BrowserTab[], updated: BrowserTab) => {
      if (beforeTabId === undefined) return current.map((item) => item.id === tabId ? updated : item);
      const remaining = current.filter((item) => item.id !== tabId);
      let index = beforeTabId === null ? -1 : remaining.findIndex((item) => item.id === beforeTabId);
      if (index < 0) {
        // 目标为空时追加全局数组；非空时插在最后一个同组标签之后，不改变其他分组的相对顺序。
        index = remaining.length;
        for (let i = remaining.length - 1; i >= 0; i--) {
          if (remaining[i].groupId === groupId && remaining[i].smallGroupId === smallGroupId) { index = i + 1; break; }
        }
      }
      remaining.splice(index, 0, updated);
      return remaining;
    };
    if (sameGroup) {
      if (beforeTabId === undefined) return;
      setTabs((current) => place(current, current.find((item) => item.id === tabId) ?? tab));
      tabsRef.current = place(tabsRef.current, tabsRef.current.find((item) => item.id === tabId) ?? tab);
      return;
    }
    const active = tab.id === activeId;
    const remote = Boolean(tab.url) && !isInternalBrowserUrl(tab.url);
    // 跨组关闭失败时连同原顺序一起回退，优先使用原后继锚点，避免覆盖其他标签的并发更新。
    const originalIndex = tabs.findIndex((item) => item.id === tabId);
    const originalNextId = tabs[originalIndex + 1]?.id;
    const updatedTab: BrowserTab = {
      ...tab,
      groupId,
      smallGroupId,
      profileGroupId: group?.smallGroups.find(small => small.id === smallGroupId)?.profileGroupId,
      loading: active && remote,
      hasWebview: false,
      sleeping: !active && remote,
      audible: false,
    };
    setTabs((current) => place(current, updatedTab));
    tabsRef.current = place(tabsRef.current, updatedTab);
    setCollapsedGroupIds((current) => current.filter((id) => id !== groupId));
    if (smallGroupId) setCollapsedSmallGroupIds((current) => current.filter((id) => id !== smallGroupId));
    if (active) activeTabRef.current = updatedTab;
    if (!isDesktopRuntime) return;
    movingTabIdsRef.current.add(tabId);
    let oldWebviewClosed = false;

    void invokeNative("close_browser_tab", { tabId }).then(() => {
      oldWebviewClosed = true;
      const latest = tabsRef.current.find((item) => item.id === tabId);
      if (!latest || latest.groupId !== groupId || latest.smallGroupId !== smallGroupId) return;
      // 移动期间切换到了其他页时，当前移动页回到休眠状态，不在后台持续显示加载中。
      if (activeTabRef.current.id !== tabId) {
        updateTab(tabId, { loading: false, hasWebview: false, sleeping: Boolean(latest.url) && !isInternalBrowserUrl(latest.url) });
        return;
      }
      return activateNativeTab(latest, true);
    }).catch((error) => {
      // 旧实例未能关闭时恢复原归属，不能把仍使用旧 Cookie 的页面显示为目标分组页面。
      if (!oldWebviewClosed) {
        const restore = (item: BrowserTab) => item.id === tabId ? {
          ...item, groupId: tab.groupId, smallGroupId: tab.smallGroupId, profileGroupId: tab.profileGroupId,
          loading: false, hasWebview: tab.hasWebview, sleeping: tab.sleeping,
        } : item;
        const restorePlacement = (current: BrowserTab[]) => {
          const item = current.find((candidate) => candidate.id === tabId);
          if (!item) return current;
          const remaining = current.filter((candidate) => candidate.id !== tabId);
          const nextIndex = remaining.findIndex((candidate) => candidate.id === originalNextId);
          remaining.splice(nextIndex >= 0 ? nextIndex : Math.min(originalIndex, remaining.length), 0, restore(item));
          return remaining;
        };
        setTabs(restorePlacement);
        tabsRef.current = restorePlacement(tabsRef.current);
        if (activeTabRef.current.id === tabId) activeTabRef.current = restore(activeTabRef.current);
      } else {
        updateTab(tabId, { loading: false, hasWebview: false, sleeping: remote });
      }
      message.error(error instanceof Error ? error.message : String(error));
    }).finally(() => movingTabIdsRef.current.delete(tabId));
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
    if (closed) restoreClosedEntry(closed.id);
  }

  /** 恢复一个关闭会话或其中一个标签；只激活首项，其余网页保持休眠以避免同时启动多个内核。 */
  function restoreClosedEntry(id: string, childId?: string) {
    const closed = closedTabs.find(entry => entry.id === id);
    if (!closed) return;
    const sources = childId ? closed.tabs.filter(tab => tab.id === childId) : closed.tabs;
    if (!sources.length) return;
    let restoredGroups = groups;
    if (closed.group) {
      const saved = closed.group;
      const smallGroups = closed.smallGroupId ? saved.smallGroups.filter(group => group.id === closed.smallGroupId) : saved.smallGroups;
      const existing = groups.find(group => group.id === saved.id);
      restoredGroups = existing ? groups.map(group => group.id === saved.id ? { ...group, smallGroups: [...group.smallGroups, ...smallGroups.filter(small => !group.smallGroups.some(item => item.id === small.id))] } : group)
        : [...groups, { ...saved, smallGroups }];
      setGroups(restoredGroups);
    }
    const restoredTabs = sources.map((source, index): BrowserTab => {
      const group = restoredGroups.find(group => group.id === source.groupId);
      const remote = Boolean(source.url) && !isInternalBrowserUrl(source.url);
      return { ...source, id: createTabId(), groupId: group?.id ?? (source.groupId === ROOT_GROUP_ID ? ROOT_GROUP_ID : DEFAULT_GROUP_ID),
        smallGroupId: group?.smallGroups.some(item => item.id === source.smallGroupId) ? source.smallGroupId : undefined,
        loading: index === 0 && remote, hasWebview: index === 0 && remote, sleeping: index !== 0 && remote,
        inactiveSince: index === 0 ? undefined : Date.now(), audible: false };
    });
    const restored = restoredTabs[0];
    setClosedTabs(current => current.flatMap(entry => {
      if (entry.id !== id) return [entry];
      const remaining = childId ? entry.tabs.filter(tab => tab.id !== childId) : [];
      return remaining.length ? [{ ...entry, tabs: remaining }] : [];
    }));
    setTabs((current) => {
      const activeIndex = current.findIndex((tab) => tab.id === activeId);
      const next = current.map((tab) => tab.id === activeId
        ? { ...tab, inactiveSince: Date.now() }
        : tab);
      next.splice(Math.max(0, activeIndex) + 1, 0, ...restoredTabs);
      return next;
    });
    activeTabRef.current = restored;
    setActiveId(restored.id);
    setAddressDraft(restored.url);
    if (!isDesktopRuntime) return;
    void activateNativeTab(restored, restored.hasWebview).catch((error) => {
      updateTab(restored.id, { loading: false, hasWebview: false, sleeping: true });
      message.error(error instanceof Error ? error.message : String(error));
    });
  }

  function handleNativeMenuAction(action: string) {
    // 停靠控制从分隔条的原生菜单转发，避免常驻标题工具栏占用网页空间。
    if (action.startsWith("devtools|")) {
      const [, tabId, command] = action.split("|");
      controlBrowserDevtools(tabId, command);
      return;
    }
    if (action.startsWith("shortcut|")) {
      const [, command, sourceTabId] = action.split("|");
      handleShellShortcut(command, sourceTabId);
      return;
    }
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

    // 扩展面板的导航动作沿用主窗口标签管理，确保新页面进入左侧树。
    if (action.startsWith("panel|extensions|")) {
      const [, , key, id] = action.split("|");
      if (key === "store") openTab("https://microsoftedge.microsoft.com/addons/Microsoft-Edge-Extensions-Home");
      else if (key === "options") {
        const extension = toolbarExtensions.find((entry) => entry.id === id);
        if (extension) void openExtensionOptionsTab(extension).catch((error) => message.error(String(error)));
      } else openSettingsTab("extensions");
      return;
    }

    if (action.startsWith("panel|downloads|")) {
      const [, , key, id] = action.split("|");
      // 网页原生快捷键与工具栏使用同一下载面板，快捷键只打开、不切换关闭。
      if (key === "show") {
        showDownloadsPanelRef.current();
        return;
      }
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
        const target = task ?? newestDownloadsFirst(allDownloadTasks).find((item) => item.filePath && !item.fileDeleted);
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
        message.warning("已在西娅浏览器中将该下载标记为不安全");
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
      const [, , key, id, childId] = action.split("|");
      if (key === "restore" && id) restoreClosedEntry(id, childId);
      else if (key === "open" && id) {
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
        const bookmark = bookmarks.find(item => item.id === id) ?? bookmarks[index];
        // 收藏夹面板和目录菜单均新建标签，保留当前页面及其所属分组。
        if (bookmark) openTab(bookmark.url);
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
        openBrowserOverlay({ kind: "bookmark-import", darkMode, folders: bookmarkFolders, folderOnly: true });
      } else if (key === "import" || key === "more") {
        openBrowserOverlay({ kind: "bookmark-import", darkMode, folders: bookmarkFolders });
      } else {
        message.info("更多收藏夹操作将在后续版本中提供。");
      }
      return;
    }

    if (action.startsWith("more:")) {
      const key = action.slice("more:".length);
      if (key === "bookmarks") {
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
    else if (key === "move-window") void detachItem({ kind: "tab", tabId });
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
    else if (action === "show-downloads") showDownloadsPanelRef.current();
    else if (action === "shortcut") handleShellShortcut(value);
    else if (action === "toggle-audio" && value) toggleTabAudio(value);
    else if (action === "new-root-tab") openTab();
    else if (action === "new-group") openNewGroupModal();
    else if (action === "move-group" || action === "detach") {
      try {
        const data = JSON.parse(value);
        const item = data?.item;
        const validItem = item && (item.kind === "tab" && typeof item.tabId === "string"
          || item.kind === "group" && typeof item.groupId === "string"
          || item.kind === "small-group" && typeof item.groupId === "string" && typeof item.smallGroupId === "string");
        if (!validItem) return;
        if (action === "move-group" && typeof data.target?.groupId === "string"
          && (data.target.beforeId === null || typeof data.target.beforeId === "string")) moveGroup(item, data.target);
        if (action === "detach" && Array.isArray(data.position) && data.position.length === 2
          && data.position.every((value: unknown) => typeof value === "number" && Number.isFinite(value))) void detachItem(item, data.position);
      } catch { /* 非法面板消息不修改树或打开窗口。 */ }
    }
    else if (action === "move-tab") {
      // 独立面板传入 JSON；仅接受已存在标签与分组，非法消息不改变状态。
      try {
        const target = JSON.parse(value) as { tabId?: unknown; groupId?: unknown; smallGroupId?: unknown; beforeTabId?: unknown };
        if (typeof target?.tabId === "string" && typeof target.groupId === "string"
          && (target.smallGroupId === undefined || typeof target.smallGroupId === "string")
          && (target.beforeTabId === undefined || target.beforeTabId === null || typeof target.beforeTabId === "string")) {
          moveTabToGroup(target.tabId, target.groupId, target.smallGroupId, target.beforeTabId);
        }
      } catch { /* 忽略格式无效的面板消息。 */ }
    }
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

  /** 按左侧分组、小分组和根标签的显示顺序计算相邻与批量关闭范围。 */
  function getLayoutOrderedTabs() {
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
      ...createScopedBlankTab(currentTab.groupId, currentTab.smallGroupId),
      title: "西娅设置",
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
      // 相邻标签始终按左侧树的可见顺序排列。
      adjacentDirection: "下方",
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
  }

  function openNewGroupModal() {
    openBrowserOverlay({
      kind: "form",
      formKind: "new-group",
      title: "新建分组",
      label: "分组名称",
      placeholder: "例如：测试环境",
      description: "每个小分组独立保存 Cookie；大分组直属标签使用单独的数据空间。",
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
    const group = groups.find(item => item.id === groupId);
    setClosedTabs(current => [...current, { id: createTabId(), closedAt: Date.now(), tabs: removedTabs, group, smallGroupId,
      title: group?.smallGroups.find(item => item.id === smallGroupId)?.name ?? group?.name ?? removedTabs[0].title }].slice(-20));
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
        ? `确定清除${targetName}的缓存、Cookie 和站点数据吗？其他小分组不受影响。`
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
    if (action === "bookmarks-import") {
      // 先完整生成再追加，解析失败不写入半份数据；导入期间目标丢失时明确提示。
      try {
        const result = JSON.parse(value) as { parentId?: string; folderName?: string; nodes?: ImportedBookmark[] };
        if (result.parentId && !bookmarkFolders.some(folder => folder.id === result.parentId)) throw new Error("目标文件夹已不存在，请重新选择");
        let parentId = result.parentId;
        const newFolders: BookmarkFolder[] = [];
        if (result.folderName?.trim()) {
          const folder = { id: crypto.randomUUID(), title: result.folderName.trim(), parentId };
          newFolders.push(folder); parentId = folder.id;
        }
        const imported = materializeBookmarks(result.nodes ?? [], parentId);
        // 根级新项目追加在已有同级项之后，来源内部混合目录/链接顺序保持不变。
        const offset = Math.max(-1, ...bookmarkFolders.filter(folder => folder.parentId === parentId).map(folder => folder.order ?? 0),
          ...bookmarks.filter(bookmark => bookmark.parentId === parentId).map(bookmark => bookmark.order ?? 0)) + 1;
        for (const item of [...imported.folders, ...imported.bookmarks]) if (item.parentId === parentId) item.order = (item.order ?? 0) + offset;
        setBookmarkFolders(current => [...current, ...newFolders, ...imported.folders]);
        setBookmarks(current => [...current, ...imported.bookmarks]);
        message.success(result.nodes ? `已导入 ${imported.bookmarks.length} 个收藏、${imported.folders.length} 个文件夹` : "收藏夹文件夹已创建");
      } catch (error) { message.error(String(error)); }
      return;
    }
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
    void listenNative<string>("sia://native-menu-action", ({ payload }) => {
      nativeMenuActionHandlerRef.current(payload);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlistenNative = dispose;
    });
    void listenNative<BrowserOverlayAction>(
      "sia://browser-overlay-action",
      ({ payload }) => {
        browserOverlayActionHandlerRef.current(payload);
      },
    ).then((dispose) => {
      if (disposed) dispose();
      else unlistenOverlay = dispose;
    });
    void listenNative<BrowserOverlayAction>(
      "sia://floating-tab-panel-action",
      ({ payload }) => {
        floatingPanelActionHandlerRef.current(payload);
      },
    ).then((dispose) => {
      if (disposed) dispose();
      else unlistenFloatingPanel = dispose;
    });
    void listenNative<boolean>(
      "sia://floating-tab-panel-visibility",
      ({ payload }) => {
        floatingPanelOpenRef.current = payload;
      },
    ).then((dispose) => {
      if (disposed) dispose();
      else unlistenFloatingPanelVisibility = dispose;
    });
    void listenNative<string>(
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

  /** 各窗口的外壳快捷键统一使用当前状态，来源标签用于关闭、复制和静音。 */
  function handleShellShortcut(command: string, sourceTabId = activeId) {
    const tabId = tabs.some(tab => tab.id === sourceTabId) ? sourceTabId : activeId;
    // 所有焦点来源共用停靠入口，避免网页内 F12 打开独立的原生窗口。
    if (command === "devtools") requestBrowserDevtools(tabId);
    else if (command === "downloads") showDownloadsPanelRef.current();
    else if (command === "history") showHistoryPanel();
    else if (command === "bookmarks") showBookmarksPanel();
    else if (command === "bookmark") {
      const tab = tabs.find(item => item.id === tabId);
      if (!tab?.url) { message.info("请先打开一个网页。"); return; }
      if (bookmarks.some(bookmark => bookmark.url === tab.url)) { message.info("当前页面已经在收藏夹中。"); return; }
      setBookmarks(current => [...current, { id: crypto.randomUUID(), title: tab.title || hostLabel(tab.url), url: tab.url }]);
      message.success("已添加到收藏夹");
    } else if (command === "bookmark-all") {
      const seen = new Set(bookmarks.map(bookmark => bookmark.url));
      const added = getLayoutOrderedTabs().filter(tab => {
        if (!tab.url || isInternalBrowserUrl(tab.url) || seen.has(tab.url)) return false;
        seen.add(tab.url); return true;
      }).map(tab => ({ id: crypto.randomUUID(), title: tab.title || hostLabel(tab.url), url: tab.url }));
      setBookmarks(current => [...current, ...added]);
      message.success(`已添加 ${added.length} 个收藏`);
    } else if (command === "bookmark-bar") setShowBookmarksBar(current => !current);
    else if (command === "new-tab") openTab();
    else if (command === "reopen-tab") reopenLastClosedTab();
    else if (command === "close-tab") closeTab(tabId);
    else if (command === "duplicate-tab") openAdjacentTab(tabId, true);
    else if (command === "mute-tab") toggleTabAudio(tabId);
    else if (command === "address") {
      // 先将原生焦点从网页或独立面板交还主 WebView，再选择地址文字。
      const focus = () => { addressInputRef.current?.focus(); addressInputRef.current?.select(); };
      if (isDesktopRuntime) void invokeNative("browser_window_action", { action: "focus-address" }).then(focus).catch(error => message.error(String(error)));
      else focus();
    } else if (command === "next-tab" || command === "previous-tab" || command.startsWith("tab-")) {
      const ordered = getLayoutOrderedTabs();
      if (!ordered.length) return;
      const index = ordered.findIndex(tab => tab.id === activeId);
      const target = command === "next-tab" ? (index + 1) % ordered.length
        : command === "previous-tab" ? (index - 1 + ordered.length) % ordered.length
        : command === "tab-last" ? ordered.length - 1 : Number(command.slice(4)) - 1;
      if (ordered[target]) selectTab(ordered[target].id);
    }
  }

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      const command = browserShortcut(event);
      if (command) {
        event.preventDefault();
        if (!event.repeat) handleShellShortcut(command);
        return;
      }
      const commandKey = event.ctrlKey || event.metaKey;
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
  }, [activeId, activeTab?.loading, openTab, tabs, bookmarks, bookmarkFolders, groups, darkMode, historyEntries]);

  /** 单行导航按收藏、历史、扩展、下载、菜单排列，面板展开和收起由左侧面板自身的按钮控制。 */
  function renderTitlebarActions() {
    const activeDownloadCount = activeDownloadTasks.length;
    const downloadPercent = Math.round(downloadProgress * 100);
    return (
      <div className="browser-titlebar-actions">
        <Button
          className="toolbar-icon-button"
          variant="text"
          size="small"
          icon={<Icon name="star" size={18} />}
          aria-label="收藏夹"
          title="收藏夹"
          onContextMenu={(event) => {
            event.preventDefault();
            toggleBookmark();
          }}
          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
            const rect = event.currentTarget.getBoundingClientRect();
            showBookmarksPanel(rect.right - 360, rect.bottom, event.currentTarget);
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
            showHistoryPanel(rect.right - 360, rect.bottom, event.currentTarget);
          }}
        />
        <Button
          className="toolbar-icon-button"
          variant="text"
          size="small"
          icon={<Icon name="puzzle" size={18} />}
          aria-label="扩展"
          title="扩展"
          onClick={(event) => showExtensionsPanel(event.currentTarget)}
        />
        {/* 只展示有限数量的快捷入口，避免挤出地址栏和窗口控制；完整列表仍在扩展面板中。 */}
        <div className="browser-pinned-extensions">
        {toolbarExtensions.filter((extension) => extension.pinned && extension.enabled && extensionMatchesScope(extension.scopes, activeTab.profileGroupId ?? activeTab.groupId, activeTab.smallGroupId)).slice(0, 4).map((extension) => (
          <Button key={extension.id} className="toolbar-icon-button" variant="text" size="small"
            aria-label={`${extension.name} · ${extension.optionsPage ? "扩展选项" : "管理扩展"}`}
            title={`${extension.name} · ${extension.optionsPage ? "扩展选项" : "管理扩展"}`}
            icon={extension.iconUrl ? <img className="browser-extension-icon" src={extension.iconUrl} alt="" /> : <Icon name="puzzle" size={18} />}
            onClick={() => {
              if (extension.optionsPage) void openExtensionOptionsTab(extension).catch((error) => message.error(String(error)));
              else openSettingsTab("extensions");
            }} />
        ))}
        </div>
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
            ><Icon name="file" size={22} /></span>
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
              showDownloadsPanel(rect.right - 360, rect.bottom, event.currentTarget);
            }}
          />
        </div>
        <Button
          className="toolbar-icon-button browser-more-trigger"
          variant="text"
          size="small"
          icon={<Icon name="menu" size={18} />}
          aria-label="更多"
          title="更多"
          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
            const rect = event.currentTarget.getBoundingClientRect();
            void invokeNative("show_browser_more_menu", {
              showBookmarksBar,
              darkMode,
              sourceWindow: "main",
              x: rect.right - 240,
              y: rect.bottom + TOOLBAR_PANEL_GAP,
              triggerBounds: rect.toJSON(),
            }).catch((error) => {
              message.error(error instanceof Error ? error.message : String(error));
            });
          }}
        />
      </div>
    );
  }

  /** 标题栏保留后退、前进和刷新三个导航按钮，地址栏占满其余可用宽度。 */
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
        </div>

        {/* 地址栏自行管理行内补全，关闭浏览器表单历史浮层。 */}
        <form className="address-form" autoComplete="off" onSubmit={handleAddressSubmit}>
          <Input
            ref={addressInputRef}
            className="address-input"
            value={addressDraft}
            prefix={
              <span
                className="browser-address-title"
                title={activeTab?.title || "新标签页"}
                onMouseDown={(event) => {
                  // 前缀默认会把焦点交给输入框；标题需要保留按下事件来启动原生窗口拖动。
                  event.stopPropagation();
                  if (event.button !== 0) return;
                  event.preventDefault();
                  runWindowAction("start-dragging");
                }}
              >
                <Icon name={activeTab?.url?.startsWith("https://") ? "shield" : "search"} size={16} />
                <span className="browser-address-title__text">{activeTab?.title || "新标签页"}</span>
              </span>
            }
            allowClear={false}
            aria-label="地址和搜索栏"
            placeholder="搜索或输入网址"
            spellCheck={false}
            autoComplete="off"
            onPointerDown={(event) => {
              addressPointerFocusRef.current = event.button === 0 && document.activeElement !== event.currentTarget;
              addressPointerSelectionRef.current = addressPointerFocusRef.current
                ? { x: event.clientX, y: event.clientY, moved: false } : null;
            }}
            onPointerMove={(event) => {
              const gesture = addressPointerSelectionRef.current;
              if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 3) {
                gesture.moved = true;
              }
            }}
            onPointerUp={() => { addressPointerFocusRef.current = false; }}
            onPointerCancel={() => {
              addressPointerFocusRef.current = false;
              addressPointerSelectionRef.current = null;
            }}
            onClick={(event) => {
              const gesture = addressPointerSelectionRef.current;
              addressPointerSelectionRef.current = null;
              // click 在原生鼠标选区处理之后触发；仅首次单击全选，拖选和已聚焦编辑保持原生行为。
              if (gesture && !gesture.moved && event.detail === 1
                && event.currentTarget.selectionStart === event.currentTarget.selectionEnd) {
                event.currentTarget.select();
              }
            }}
            onFocus={(event) => {
              addressCompletionRef.current = null;
              addressFocusedRef.current = true;
              // 清除内核恢复的上次选区，再由本次按下命中字符，避免把旧选区当成拖拽源。
              if (addressPointerFocusRef.current) event.currentTarget.setSelectionRange(0, 0);
              else event.currentTarget.select();
              addressPointerFocusRef.current = false;
            }}
            onBlur={(event) => {
              // 仅清除选中范围，保留当前网址；从开头显示以便查看协议和域名。
              event.currentTarget.setSelectionRange(0, 0);
              event.currentTarget.scrollLeft = 0;
              addressFocusedRef.current = false;
              addressPointerFocusRef.current = false;
              addressPointerSelectionRef.current = null;
              addressCompletionRef.current = null;
              setAddressDraft(activeTab?.url ?? "");
            }}
            onChange={handleAddressChange}
            onKeyDown={(event) => {
              const input = event.currentTarget;
              const completion = addressCompletionRef.current;
              // 仅普通 Tab 接受仍被选中的候选；Shift+Tab、无候选和输入法期间保持原生行为。
              if (event.key !== "Tab" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey
                || event.nativeEvent.isComposing || !completion || input.value !== completion.value
                || input.selectionStart !== completion.prefixLength || input.selectionEnd !== completion.value.length) return;
              event.preventDefault();
              input.setSelectionRange(input.value.length, input.value.length);
            }}
          />
        </form>
      </>
    );
  }

  /** 收藏夹栏属于完整标题区，使用已有原生收藏面板访问窄窗口内放不下的项目。 */
  function renderBookmarksBar() {
    if (!showBookmarksBar) return null;
    return (
      <nav className="bookmarks-bar" aria-label="收藏夹栏">
        <div className="bookmarks-bar__items">
          {bookmarkFolders.filter(folder => !folder.parentId).map(folder => (
            <Dropdown key={folder.id} trigger={["click"]} showTriggerIcon={false} placement="bottomLeft"
              open={openBookmarkFolder === folder.id}
              menu={{ items: bookmarkDropdownItems(bookmarkFolderItems(folder.id)), selectable: false,
                onClick: ({ key }) => handleNativeMenuAction(key) }}
              // 桌面版由原生窗口呈现菜单，Dropdown 负责点击/键盘触发与展开状态；不重复绘制 DOM 浮层。
              popupRender={isDesktopRuntime ? () => null : undefined}
              popupStyle={isDesktopRuntime ? { display: "none" } : undefined}
              onOpenChange={next => {
                setOpenBookmarkFolder(next ? folder.id : undefined);
                if (!isDesktopRuntime) return;
                const trigger = bookmarkFolderTriggers.current.get(folder.id);
                if (next && trigger) showBookmarkFolder(folder.id, trigger);
                else if (!next) void invokeNative("close_browser_menu").catch(() => undefined);
              }}>
              <Button ref={element => { if (element) bookmarkFolderTriggers.current.set(folder.id, element); else bookmarkFolderTriggers.current.delete(folder.id); }}
                className="bookmark-link" variant="link" size="small" icon={<Icon name="folder" size={15} />}>{folder.title}</Button>
            </Dropdown>
          ))}
          {bookmarks.filter(bookmark => !bookmark.parentId).map((bookmark) => (
            <Button
              key={bookmark.id ?? bookmark.url}
              className="bookmark-link"
              variant="link"
              size="small"
              title={`${bookmark.title}\n${bookmark.url}`}
              icon={<BrowserFavicon url={bookmark.url} size={15} />}
              // 收藏栏直接链接沿用新建标签入口，不覆盖当前页面。
              onClick={() => openTab(bookmark.url)}
            >
              <span className="bookmark-link__title">{bookmark.title}</span>
            </Button>
          ))}
          {bookmarks.length === 0 ? <span className="bookmarks-bar__empty">收藏的网页会显示在这里</span> : null}
        </div>
        <Button
          className="bookmarks-bar__more"
          variant="text"
          size="small"
          aria-label="更多收藏"
          title="查看全部收藏"
          icon={<Icon name="chevron-right" size={16} />}
          onClick={(event) => {
            // 原生浮层锚定收藏栏按钮下方，标题区增高后仍与触发位置一致。
            const rect = event.currentTarget.getBoundingClientRect();
            showBookmarksPanel(rect.right - 360, rect.bottom, event.currentTarget);
          }}
        />
      </nav>
    );
  }

  return (
    <WindowFrame
      className="browser-shell"
      data-window-active={windowActive}
      data-resize-edges={windowResizeEdges}
      titleBar={(
        // WindowFrame 的标题区组合导航与收藏行；收藏行增高不拉伸地址栏和窗口控制按钮。
        <div className="browser-titlebar-area">
          <WindowTitleBar
            className="browser-titlebar is-vertical"
            // 树形标签固定在左侧，顶部只保留品牌图标、导航及窗口操作。
            leading={(
              <div className="browser-brand" aria-label="西娅浏览器">
                {/* 横向签名保留原比例，保持现有标题栏高度。 */}
                <BrowserBrandGlyph size={28} wordmark />
              </div>
            )}
            actions={renderTitlebarActions()}
            maximized={windowMaximized}
            onWindowAction={runWindowAction}
          >
            <div className="vertical-titlebar-navigation">
              {renderNavigationControls()}
            </div>
          </WindowTitleBar>
          {renderBookmarksBar()}
        </div>
      )}
    >

      <div className="browser-workspace">
        <div
          ref={verticalPanelAnchorRef}
          className={`vertical-tab-panel-main${verticalPanelPinned ? " is-pinned" : " is-collapsed"}`}
          style={{
            width: verticalPanelPinned
              ? verticalPanelWidth
              : COMPACT_VERTICAL_PANEL_WIDTH,
            minWidth: verticalPanelPinned
              ? verticalPanelWidth
              : COMPACT_VERTICAL_PANEL_WIDTH,
          }}
        >
          {/* 桌面固定面板使用原生子 WebView；网页预览直接渲染同一 Sia 组件以保留完整树。 */}
          {!isDesktopRuntime || !verticalPanelPinned ? renderTabContextScope(
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
              onMoveTab={moveTabToGroup}
              onMoveGroup={moveGroup}
              onDetach={detachAfterDrag}
              onClose={closeTab}
              onToggleAudio={toggleTabAudio}
              onNewTab={(groupId, smallGroupId) => openTab(undefined, groupId, smallGroupId)}
              onNewRootTab={() => openTab()}
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
        <div className="browser-content">
          {/* 上边框独立于网页宿主占位，避免流光被原生 WebView 覆盖或加载时挤动网页。 */}
          <div className="browser-page-top-border" aria-hidden="true">
            {activeTab?.loading ? <span className="browser-loading-line" /> : null}
          </div>
          <BrowserDevtoolsWorkspace tabId={activeId} onLayout={syncBrowserBounds} onSessionsChange={setDevtoolsTabIds}
            onMenu={(event, items) => showBrowserPanel({ darkMode, items }, { x: event.clientX, y: event.clientY }, { width: 220, height: 160 })}>
          <main ref={pageHostRef} className="browser-page-host">
        {activeTab?.url === SETTINGS_URL ? (
          <BrowserSettingsPage
            tabSleep={tabSleep}
            onTabSleepChange={value => setTabSleep(normalizeTabSleep(value))}
            groups={profileScopeGroups(groups)}
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
              // 返回值只表示系统能否定位应用详情，不将打开设置误报为已经设为默认。
              void invokeNative<boolean>("open_default_browser_settings").then((direct) => {
                if (!direct) message.info("当前 Windows 版本不支持直接定位，请在默认应用的 Web 浏览器选项中选择西娅浏览器。");
              }).catch((error) => {
                message.error(error instanceof Error ? error.message : String(error));
              });
            }}
            onOpenDownloads={() => {
              showDownloadsPanel(Math.max(12, window.innerWidth - 460), 76);
            }}
            onOpenExtensionOptions={openExtensionOptionsTab}
          />
        ) : isDesktopRuntime && activeTab?.url && !activeTab.hasWebview && !activeTab.loading ? (
          // 恢复失败后保留原网址和隔离范围，明确提示连接失败，不将已有网页伪装成新标签页。
          <div className="native-webview-placeholder" role="status">
            <Icon name="warning" size={24} />
            <strong>网页视图连接失败</strong>
            <span>网页尚未成功恢复，可以重新连接当前标签页。</span>
            <Button variant="primary" onClick={() => navigate(activeTab.url, activeTab.id)}>
              重新连接
            </Button>
          </div>
        ) : !activeTab?.url ? (
          <section className="new-tab-page">
            <div className="new-tab-page__ambient new-tab-page__ambient--one" />
            <div className="new-tab-page__ambient new-tab-page__ambient--two" />
            <div className="new-tab-content">
              <div className="new-tab-logo" aria-hidden="true">
                {/* 新标签页显示已确认的完整 S1-E 签名与收笔线。 */}
                <BrowserBrandGlyph size={72} wordmark />
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
              <span>西娅浏览器 0.1</span>
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
          </BrowserDevtoolsWorkspace>
        </div>
      </div>
    </WindowFrame>
  );
}

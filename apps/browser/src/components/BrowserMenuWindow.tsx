import { useDownloadReconciliation } from "../useDownloadReconciliation";
import { listenNative } from "../nativeEvents";
import { extensionMatchesScope, type ExtensionScope } from "../extensionScopes";
import { browserShortcut } from "../browserShortcuts";
import { newestDownloadsFirst, nextDownloadStartedAt } from "../downloadOrder";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon, Input, Menu, Progress, Tag, Tree } from "@sia.soul/sia-react-ui";
import type { MenuItem, TagStatus, TreeNode } from "@sia.soul/sia-react-ui";
import type { BrowserExtensionRecord } from "./BrowserSettingsPage";
import BrowserFavicon from "./BrowserFavicon";
import BrowserFloatingHost, { BrowserFloatingSubmenu, type BrowserFloatingAnchor } from "./BrowserFloatingHost";

export interface BrowserMenuItem {
  /** 内核已提供的 PNG 数据地址，仅用于网页菜单的扩展图标。 */
  iconDataUrl?: string;
  /** 收藏链接地址，用于显示网站图标；不指定时不显示网站图标。 */
  faviconUrl?: string;
  /** 收藏目录使用文件夹图标，子项由悬停级联菜单展示。 */
  folder?: boolean;
  type?: "divider";
  key?: string;
  label?: string;
  subtitle?: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  danger?: boolean;
  variant?: "theme";
  children?: BrowserMenuItem[];
}

export interface BrowserPanelEntry {
  /** 已关闭分组包含的标签；普通访问记录不使用此字段。 */
  children?: BrowserPanelEntry[];
  /** 记录关闭时的原生站点图标。 */
  faviconUrl?: string;
  /** 下载首次触发时间，毫秒；下载列表倒序排列时使用，进度更新不能重置。 */
  startedAt?: number;
  /** 收藏夹目录标记；目录点击时在面板内展开。 */
  folder?: boolean;
  /** 上级收藏夹目录，省略表示根目录。 */
  parentId?: string;
  /** 同级显示顺序。 */
  order?: number;
  id: string;
  title: string;
  url?: string;
  subtitle?: string;
  timeLabel?: string;
  timestamp?: number;
  fileName?: string;
  filePath?: string;
  state?: "waiting" | "started" | "progress" | "finished";
  receivedBytes?: number;
  /** 暂停时保留进度，显示继续操作。 */
  paused?: boolean;
  /** 主动取消时显示重试，不显示下载失败。 */
  cancelled?: boolean;
  totalBytes?: number;
  success?: boolean;
  active?: boolean;
  alwaysOpen?: boolean;
  unsafe?: boolean;
  fileDeleted?: boolean;
  /** 本次下载首次触发的时间戳，毫秒；仅用于 1.5 秒提示，不随进度更新或历史记录重开而重置。 */
  highlightStartedAt?: number;
}

export interface BrowserMenuPayload {
  /** 原生面板显示批次；命中范围回传时用于拒绝旧面板的异步结果。 */
  hitRegionRevision?: number;
  /** 所有浮层的根布局，独立于子层画布；省略时使用窗口内默认边距，单位为 CSS 像素。 */
  menuLayout?: {
    /** 根面板相对浮层窗口左边的位置。 */
    left: number;
    /** 根面板相对浮层窗口顶部的位置。 */
    top: number;
    /** 根面板宽度，不随子菜单画布增加而变化。 */
    width: number;
    /** 根面板允许的最大高度；实际内容较少时自然收缩。 */
    height: number;
  };
  darkMode: boolean;
  kind?: "web-context" | "menu" | "back-history" | "downloads" | "history" | "bookmarks" | "bookmark-folder" | "extensions";
  /** 面板入口标识；自动显示和用户切换共享此身份。 */
  panelKey?: string;
  /** 仅用户点击时设置，相同入口再次点击关闭面板。 */
  toggleKey?: string;
  /** 主窗口客户区内的触发按钮范围，单位为逻辑像素。 */
  triggerBounds?: { x: number; y: number; width: number; height: number };
  heading?: string;
  items: BrowserMenuItem[];
  entries?: BrowserPanelEntry[];
  /** 按关闭时间倒序的独立会话记录，与访问历史分开。 */
  closedEntries?: BrowserPanelEntry[];
  currentTitle?: string;
  currentUrl?: string;
  /** 预加载的受管扩展列表，打开后在后台刷新。 */
  extensions?: BrowserExtensionRecord[];
  /** 当前标签的隔离范围，用于过滤列表和固定入口。 */
  extensionScope?: ExtensionScope;
}

interface BrowserMenuAction {
  action: string;
  value?: string;
}

interface DownloadContextMenuState {
  entry: BrowserPanelEntry;
  /** 原始右键位置，实际子菜单尺寸由统一宿主测量。 */
  anchor: BrowserFloatingAnchor;
}

async function invokeNative<T>(command: string, args?: Record<string, unknown>) {
  if (!window.__TAURI__) throw new Error("浏览器菜单仅在桌面版中可用");
  return window.__TAURI__.core.invoke<T>(command, args);
}

function formatBytes(value = 0) {
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const normalized = value / 1024 ** index;
  return `${normalized >= 10 || index === 0 ? normalized.toFixed(0) : normalized.toFixed(1)} ${units[index]}`;
}

function historyGroupLabel(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (entryDay === dayStart) {
    return `今天 · ${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
  if (entryDay === dayStart - 86_400_000) {
    return `昨天 · ${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

// 同一文件图标在进度更新时复用；限制缓存数量，避免长期下载会话积累图片数据。
const downloadIconCache = new Map<string, Promise<string | null>>();

/** 用原生文件关联图标展示下载类型；未完成文件查询类型图标，读取失败保留框架通用文件图标。 */
function DownloadFileIcon({ entry }: { entry: BrowserPanelEntry }) {
  const fileName = entry.fileName || entry.title;
  const filePath = entry.state === "finished" && entry.success !== false && !entry.fileDeleted ? entry.filePath : undefined;
  const key = JSON.stringify([fileName, filePath]);
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // 查询失败不永久缓存；下载刚完成或 Shell 暂忙时允许两次退避重试。
    const read = async (attempt = 0) => {
      let request = downloadIconCache.get(key);
      if (!request) {
        request = invokeNative<string | null>("get_download_file_icon", { fileName, filePath: filePath ?? null }).catch(() => null);
        if (downloadIconCache.size >= 256) downloadIconCache.delete(downloadIconCache.keys().next().value!);
        downloadIconCache.set(key, request);
      }
      const url = await request;
      if (!url && downloadIconCache.get(key) === request) downloadIconCache.delete(key);
      if (disposed) return;
      if (url) setLoaded({ key, url });
      else if (attempt < 2) timer = setTimeout(() => void read(attempt + 1), 350 * (attempt + 1));
    };
    void read();
    return () => { disposed = true; clearTimeout(timer); };
  }, [key, fileName, filePath]);
  return loaded?.key === key
    ? <img src={loaded.url} width={24} height={24} alt="" draggable={false} onError={() => setLoaded(null)} />
    : <Icon name="file" size={22} />;
}

/** 按实际接收字节每秒采样；停流时自然归零，暂停或面板关闭后释放定时器。 */
function DownloadSpeed({ receivedBytes = 0 }: { receivedBytes?: number }) {
  const latest = useRef(receivedBytes);
  const [speed, setSpeed] = useState(0);
  useEffect(() => { latest.current = receivedBytes; }, [receivedBytes]);
  useEffect(() => {
    let bytes = latest.current;
    let time = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - time;
      if (elapsed > 0) setSpeed(Math.max(0, latest.current - bytes) * 1000 / elapsed);
      bytes = latest.current;
      time = now;
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="browser-download-speed"> · {formatBytes(speed)}/s</span>;
}

/** 同一下载只播放一次；面板打开稍晚时从已流逝的位置继续，进度刷新不重新计时。 */
function DownloadHighlight({ startedAt }: { startedAt?: number }) {
  const elapsed = useMemo(() => startedAt ? Math.max(0, Date.now() - startedAt) : 1500, [startedAt]);
  if (elapsed >= 1500) return null;
  return <span className="browser-download-entry__highlight" aria-hidden="true" style={{ animationDelay: `-${elapsed}ms` }} />;
}

export default function BrowserMenuWindow() {
  // 所有业务面板使用同一宿主，原生承载与业务状态分开管理。
  return <BrowserMenuContent />;
}

/** 渲染当前原生菜单载荷，滚动条接入层在载荷切换时保持挂载。 */
function BrowserMenuContent() {
  const [payload, setPayload] = useState<BrowserMenuPayload | null>(null);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [historyTab, setHistoryTab] = useState<"all" | "recent">("all");
  const [expandedBookmarkFolders, setExpandedBookmarkFolders] = useState<Set<string>>(new Set(["bookmark-root"]));
  useEffect(() => {
    // 完整收藏面板每次打开从根目录开始；收藏夹栏使用独立级联菜单，不共享展开记录。
    if (payload?.kind === "bookmarks") setExpandedBookmarkFolders(new Set(["bookmark-root"]));
  }, [payload]);
  const [downloadContextMenu, setDownloadContextMenu] = useState<DownloadContextMenuState | null>(null);
  const [extensions, setExtensions] = useState<BrowserExtensionRecord[]>([]);
  const [extensionMenu, setExtensionMenu] = useState<{ id: string; anchor: BrowserFloatingAnchor } | null>(null);
  const [extensionBusy, setExtensionBusy] = useState(false);
  const [extensionError, setExtensionError] = useState("");
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState(false);
  // 面板重新打开或切换后，旧异步操作不能覆盖新一轮列表和错误状态。
  const payloadRevision = useRef(0);

  useEffect(() => {
    let disposed = false;
    const cleanups: Array<() => void> = [];
    let receivedEvent = false;
    let latestRevision = -1;
    const acceptPayload = (nextPayload: BrowserMenuPayload) => {
      if (disposed) return;
      const revision = nextPayload.hitRegionRevision;
      if (revision !== undefined && revision <= latestRevision) return;
      if (revision !== undefined) latestRevision = revision;
      payloadRevision.current += 1;
      setOpenKeys([]);
      setQuery("");
      setSearchVisible(false);
      setHistoryTab("all");
      setDownloadContextMenu(null);
      setExtensionMenu(null);
      setRemoveConfirmation(false);
      setExtensionError("");
      setExtensionBusy(false);
      setExtensionLoading(nextPayload.kind === "extensions");
      setExtensions(nextPayload.extensions ?? []);
      // 主窗口重开面板和原生实时事件共用时间排序，不能依赖传入数组的位置。
      setPayload(nextPayload.kind === "downloads" ? { ...nextPayload, entries: newestDownloadsFirst(nextPayload.entries ?? []) } : nextPayload);
    };
    // 先注册事件再读首屏快照；迟到快照不能覆盖已切换或已关闭的面板。
    const retain = (cleanup: () => void) => { if (disposed) cleanup(); else cleanups.push(cleanup); };
    void (async () => {
      if (!window.__TAURI__) return;
      retain(await listenNative<BrowserMenuPayload>('sia://browser-menu-state', ({ payload: next }) => {
        receivedEvent = true;
        acceptPayload(next);
      }));
      retain(await listenNative<{ revision: number }>('sia://browser-menu-closed', ({ payload: closed }) => {
        if (disposed || closed.revision < latestRevision) return;
        receivedEvent = true;
        latestRevision = closed.revision;
        payloadRevision.current += 1;
        setPayload(null);
        setOpenKeys([]);
        setDownloadContextMenu(null);
        setExtensionMenu(null);
      }));
      if (disposed) return;
      const state = await invokeNative<BrowserMenuPayload | null>('get_browser_menu_state');
      if (state && !receivedEvent) acceptPayload(state);
    })().catch(() => undefined);
    return () => {
      disposed = true;
      cleanups.forEach(cleanup => cleanup());
    };
  }, []);

  // 主窗口和下载浮层独立校准，避免一个窗口漏掉完成通知后长期停留在 100%。
  const receiveDownloadRef = useRef<((event: { payload: BrowserPanelEntry & { sourceUrl?: string } }) => void) | undefined>();
  useDownloadReconciliation(payload?.kind === "downloads" ? (payload.entries ?? []).filter(entry => entry.state !== "finished").map(entry => entry.id) : [], receiveDownloadRef);

  useEffect(() => {
    if (!window.__TAURI__) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    receiveDownloadRef.current = ({ payload: task }) => {
        setPayload(current => {
          if (current?.kind !== "downloads") return current;
          const entries = current.entries ?? [];
          const previous = entries.find(entry => entry.id === task.id);
          if (previous?.state === "finished" && task.state === "progress") return current;
          const next = { ...previous, ...task, title: task.fileName || previous?.title || "未命名下载", url: task.sourceUrl || previous?.url,
            // 与主窗口使用同一源头时间，面板是否已打开、事件到达顺序均不影响排序。
            startedAt: task.startedAt ?? previous?.startedAt ?? nextDownloadStartedAt(entries),
            // 原生事件早于自动打开面板时由主窗口传递时间；面板已开时只为首次出现的下载记录时间。
            highlightStartedAt: previous?.highlightStartedAt ?? task.highlightStartedAt
              ?? (!previous && (task.state === "waiting" || task.state === "started") ? Date.now() : undefined) };
          return { ...current, entries: newestDownloadsFirst(previous ? entries.map(entry => entry.id === task.id ? next : entry) : [next, ...entries]) };
        });
      };
    void listenNative("sia://browser-download", receiveDownloadRef.current).then(dispose => { if (disposed) dispose(); else unlisten = dispose; });
    return () => { disposed = true; unlisten?.(); };
  }, []);

  useEffect(() => {
    if (!window.__TAURI__) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenNative<Pick<BrowserMenuPayload, "extensionScope" | "heading">>("sia://extension-context-changed", ({ payload: context }) => {
      payloadRevision.current += 1;
      setExtensionBusy(false);
      setExtensionError("");
      setRemoveConfirmation(false);
      setExtensionMenu(null);
      setPayload((current) => current?.kind === "extensions" ? { ...current, ...context } : current);
    }).then((dispose) => { if (disposed) dispose(); else unlisten = dispose; });
    return () => { disposed = true; unlisten?.(); };
  }, []);

  useEffect(() => {
    if (payload?.kind !== "extensions") return;
    let disposed = false;
    setExtensionLoading(true);
    // 首帧使用缓存，刷新失败时保留已有列表并展示错误，避免空白闪烁。
    void invokeNative<BrowserExtensionRecord[]>("list_browser_extensions").then((records) => {
      if (!disposed) setExtensions(records);
    }).catch((error) => {
      if (!disposed) setExtensionError(String(error));
    }).finally(() => { if (!disposed) setExtensionLoading(false); });
    return () => { disposed = true; };
  }, [payload]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // 菜单持有焦点时同样转发外壳动作，当前面板的打开快捷键保持原样。
      const command = browserShortcut(event);
      if (command) {
        event.preventDefault();
        if (!event.repeat && payload?.kind !== command) void dispatchAction(`shortcut|${command}`);
        return;
      }
      if (event.key !== "Escape") return;
      if (extensionMenu) {
        setExtensionMenu(null);
        setRemoveConfirmation(false);
        return;
      }
      if (downloadContextMenu) {
        setDownloadContextMenu(null);
        return;
      }
      if (openKeys.length) {
        setOpenKeys([]);
        return;
      }
      void invokeNative("close_browser_menu").catch(() => undefined);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [downloadContextMenu, openKeys, extensionMenu, payload?.kind]);

  useEffect(() => {
    // 原生菜单展示后以根菜单作为键盘起点，方向键由框架 Menu 统一处理。
    if (payload?.kind === "web-context") document.querySelector<HTMLElement>('.browser-window-menu > .sia-menu')?.focus();
  }, [payload?.hitRegionRevision, payload?.kind]);

  const items = useMemo(
    () => payload?.items ?? [],
    [payload],
  );
  const entries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const source = payload?.entries ?? [];
    if (!normalizedQuery) return source;
    return source.filter((entry) => (
      `${entry.title} ${entry.url ?? ""} ${entry.subtitle ?? ""} ${entry.fileName ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    ));
  }, [payload?.entries, query]);

  async function dispatchAction(action: string) {
    // 原地更新下载状态；其余菜单动作仍沿用执行后关闭的行为。
    const keepDownloadPanel = /^panel\|downloads\|(pause|resume|cancel)\|/.test(action);
    if (!keepDownloadPanel) payloadRevision.current += 1;
    setDownloadContextMenu(null);
    if (!keepDownloadPanel) setPayload(null);
    await invokeNative("browser_menu_action", {
      action: {
        action,
      } satisfies BrowserMenuAction,
    });
  }

  function openDownloadContextMenu(event: React.MouseEvent, entry: BrowserPanelEntry) {
    event.preventDefault();
    event.stopPropagation();
    setDownloadContextMenu({
      entry,
      anchor: { x: event.clientX, y: event.clientY, width: 0, height: 0 },
    });
  }

  function downloadContextItems(entry: BrowserPanelEntry): MenuItem[] {
    const hasFile = Boolean(
      entry.state === "finished"
      && entry.success !== false
      && entry.filePath
      && !entry.fileDeleted,
    );
    return [
      {
        key: `panel|downloads|open|${entry.id}`,
        label: "打开文件",
        icon: <Icon name="file" size={17} />,
        disabled: !hasFile,
      },
      {
        key: `panel|downloads|always-open|${entry.id}`,
        label: "始终打开这种类型的文件",
        icon: <Icon name="check" size={17} />,
        extra: entry.alwaysOpen ? "✓" : undefined,
        disabled: !entry.fileName && !entry.filePath,
      },
      { key: "download-divider-1", type: "divider" },
      {
        key: `panel|downloads|folder|${entry.id}`,
        label: "在文件夹中显示",
        icon: <Icon name="folder" size={17} />,
        disabled: !hasFile,
      },
      {
        key: `panel|downloads|copy-link|${entry.id}`,
        label: "复制下载链接",
        icon: <Icon name="link" size={17} />,
        disabled: !entry.url,
      },
      {
        key: `panel|downloads|report-unsafe|${entry.id}`,
        label: "将此文件报告为不安全",
        icon: <Icon name="warning" size={17} />,
        disabled: entry.unsafe,
      },
      { key: "download-divider-2", type: "divider" },
      {
        key: `panel|downloads|delete-file|${entry.id}`,
        label: "删除文件",
        icon: <Icon name="trash" size={17} />,
        danger: true,
        disabled: !hasFile,
      },
      {
        key: `panel|downloads|remove|${entry.id}`,
        label: "从列表中删除",
        icon: <Icon name="close" size={17} />,
      },
    ];
  }

  async function selectItem(item: BrowserMenuItem) {
    if (item.disabled) return;
    if (item.children?.length) return;
    if (!item.key) return;
    await dispatchAction(item.key);
  }

  function renderToolbarButton(
    icon: "folder" | "search" | "more-horizontal" | "trash" | "star" | "plus" | "edit" | "download",
    label: string,
    action?: string,
    onClick?: () => void,
  ) {
    return (
      <Button
        className="browser-panel__toolbar-button"
        variant="text"
        size="small"
        icon={<Icon name={icon} size={18} />}
        aria-label={label}
        title={label}
        onClick={() => {
          if (onClick) onClick();
          else if (action) void dispatchAction(action);
        }}
      />
    );
  }

  function renderDownloads() {
    return (
      <div className="browser-panel browser-panel--downloads">
        <header className="browser-panel__header">
          <strong>下载</strong>
          <div className="browser-panel__toolbar">
            {renderToolbarButton("folder", "打开下载文件夹", "panel|downloads|folder")}
            {renderToolbarButton("search", "搜索下载", undefined, () => setSearchVisible((value) => !value))}
            {renderToolbarButton("more-horizontal", "更多下载操作", "panel|downloads|more")}
          </div>
        </header>
        {searchVisible ? (
          <div className="browser-panel__search">
            <Input
              value={query}
              prefix={<Icon name="search" size={15} />}
              placeholder="搜索下载"
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        ) : null}
        <div className="browser-panel__scroll">
          {entries.length ? entries.map((entry) => {
            const inProgress = entry.state === "started" || entry.state === "progress";
            const controllable = inProgress || entry.state === "waiting";
            const progress = entry.totalBytes && entry.totalBytes > 0
              ? Math.max(0, Math.min(100, Math.round((entry.receivedBytes ?? 0) / entry.totalBytes * 100)))
              : undefined;
            // 各生命周期状态使用小尺寸语义标签，进度和速率作为独立信息保留。
            const status = entry.cancelled ? "已取消" : entry.paused ? "已暂停"
              : entry.state === "waiting" ? "准备下载" : entry.fileDeleted ? "文件已删除"
              : entry.unsafe ? "已标记为不安全" : entry.state === "finished"
              ? (entry.success === false ? "下载失败" : "已完成") : "正在下载";
            const statusTone: TagStatus = entry.cancelled ? "default" : entry.paused ? "warning"
              : entry.fileDeleted ? "warning" : entry.unsafe || (entry.state === "finished" && entry.success === false) ? "error"
              : entry.state === "finished" ? "success" : "processing";
            const details = entry.cancelled || entry.fileDeleted || entry.unsafe || entry.state === "finished" ? undefined
              : entry.paused ? `${formatBytes(entry.receivedBytes)} · 0 B/s`
              : entry.state === "waiting" ? "执行什么操作？"
              : progress === undefined ? `已下载 ${formatBytes(entry.receivedBytes)}`
              : `${progress}% · ${formatBytes(entry.receivedBytes)} / ${formatBytes(entry.totalBytes)}`;
            return (
              <article
                className={`browser-download-entry${entry.state === "waiting" ? " is-waiting" : ""}`}
                key={entry.id}
                data-download-id={entry.id}
                tabIndex={0}
                onContextMenu={(event) => openDownloadContextMenu(event, entry)}
              >
                {/* 使用框架 Progress 铺满行背景；未知总量不绘制虚假的百分比。 */}
                {inProgress && progress !== undefined ? <Progress className="browser-download-entry__progress" percent={progress} showInfo={false}
                  strokeColor="rgba(82, 196, 110, 0.22)" trailColor="transparent" status="normal"
                  role="progressbar" aria-label="下载进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} /> : null}
                <DownloadHighlight startedAt={entry.highlightStartedAt} />
                <span className="browser-download-entry__icon">
                  <DownloadFileIcon entry={entry} />
                </span>
                <div className="browser-download-entry__body">
                  <strong title={entry.fileName ?? entry.title}>
                    {entry.state === "waiting"
                      ? `要对 ${entry.fileName ?? entry.title}`
                      : entry.fileName ?? entry.title}
                  </strong>
                  {/* 完成项将状态与操作并排，保持两行紧凑布局。 */}
                  {!(entry.state === "finished" && entry.success !== false && entry.filePath && !entry.fileDeleted && !entry.unsafe) ? (
                    <span className="browser-download-entry__status">
                      <Tag size="small" status={statusTone}>{status}</Tag>
                      {details ? <span>{details}{inProgress && !entry.paused ? <DownloadSpeed receivedBytes={entry.receivedBytes} /> : null}</span> : null}
                    </span>
                  ) : null}
                  {entry.state === "waiting" && !entry.paused ? (
                    <div className="browser-download-entry__choice-actions">
                      <Button
                        size="small"
                        onClick={() => void dispatchAction(`panel|downloads|confirm-open|${entry.id}`)}
                      >
                        打开
                      </Button>
                      <Button
                        size="small"
                        onClick={() => void dispatchAction(`panel|downloads|confirm-save-as|${entry.id}`)}
                      >
                        另存为
                      </Button>
                      <Button
                        size="small"
                        onClick={() => void dispatchAction(`panel|downloads|confirm-save|${entry.id}`)}
                      >
                        保存
                      </Button>
                    </div>
                  ) : null}
                  {entry.state === "finished" && entry.success !== false && entry.filePath && !entry.fileDeleted ? (
                    <div className="browser-download-entry__completed">
                    {/* 使用紧凑成功标签，与打开文件入口在同一行对齐。 */}
                    {!entry.unsafe ? <Tag size="small" status="success">已完成</Tag> : null}
                    <Button
                      className="browser-download-entry__open"
                      variant="text"
                      size="small"
                      onClick={() => void dispatchAction(`panel|downloads|open|${entry.id}`)}
                    >
                      打开文件
                    </Button>
                    </div>
                  ) : null}
                </div>
                {controllable ? (
                  <div className="browser-download-entry__controls" aria-label="下载控制">
                    <Button variant="text" size="small" icon={<Icon name={entry.paused ? "play" : "pause"} size={17} />}
                      aria-label={entry.paused ? "继续下载" : "暂停下载"} title={entry.paused ? "继续下载" : "暂停下载"}
                      onClick={() => void dispatchAction(`panel|downloads|${entry.paused ? "resume" : "pause"}|${entry.id}`)} />
                    <Button variant="text" size="small" icon={<Icon name="close" size={17} />} aria-label="取消下载" title="取消下载"
                      onClick={() => void dispatchAction(`panel|downloads|cancel|${entry.id}`)} />
                  </div>
                ) : entry.cancelled ? (
                  <Button variant="link" size="small" disabled={!entry.url} onClick={() => void dispatchAction(`panel|downloads|retry|${entry.id}`)}>重试</Button>
                ) : entry.state !== "waiting" ? (
                  <div className="browser-download-entry__actions" aria-label="下载项操作">
                    <Button
                      variant="text"
                      size="small"
                      icon={<Icon name="folder" size={17} />}
                      aria-label="在文件夹中显示"
                      title="在文件夹中显示"
                      disabled={!entry.filePath || entry.fileDeleted}
                      onClick={() => void dispatchAction(`panel|downloads|folder|${entry.id}`)}
                    />
                    <Button
                      variant="text"
                      size="small"
                      icon={<Icon name="trash" size={17} />}
                      aria-label="从列表中删除"
                      title="从列表中删除"
                      onClick={() => void dispatchAction(`panel|downloads|remove|${entry.id}`)}
                    />
                  </div>
                ) : null}
              </article>
            );
          }) : (
            <div className="browser-panel__empty">暂无下载记录</div>
          )}
        </div>
        <footer className="browser-panel__footer">
          <Button variant="default" size="small" onClick={() => void dispatchAction("panel|downloads|more")}>
            查看更多
          </Button>
        </footer>
        {downloadContextMenu ? (
          <BrowserFloatingSubmenu anchor={downloadContextMenu.anchor} placement="point" onClose={() => setDownloadContextMenu(null)}>
            <Menu
              className="browser-download-context-menu"
              items={downloadContextItems(downloadContextMenu.entry)}
              mode="vertical"
              theme={payload?.darkMode ? "dark" : "light"}
              selectable={false}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
              onClick={({ key }) => void dispatchAction(key)}
            />
          </BrowserFloatingSubmenu>
        ) : null}
      </div>
    );
  }

  function renderHistory() {
    const visibleEntries = [...entries].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    const keyword = query.trim().toLocaleLowerCase();
    const closed = (payload?.closedEntries ?? []).filter(entry => !keyword || [entry, ...(entry.children ?? [])].some(item => `${item.title} ${item.url ?? ""}`.toLocaleLowerCase().includes(keyword)));
    // 分组标题展开查看，恢复按钮整组恢复；子节点单独恢复对应标签。
    const recentTree: TreeNode[] = closed.map(entry => ({ key: entry.id,
      title: entry.children?.length ? `${entry.title} · ${entry.children.length} 个标签页` : entry.title,
      icon: entry.children?.length ? <Icon name="folder" size={16} /> : <BrowserFavicon url={entry.url ?? ""} faviconUrl={entry.faviconUrl} size={16} />,
      selectable: !entry.children?.length,
      extra: entry.children?.length ? <Button variant="link" size="small" onClick={() => void dispatchAction(`panel|history|restore|${entry.id}`)}>恢复分组</Button> : undefined,
      action: `panel|history|restore|${entry.id}`,
      children: entry.children?.map(child => ({ key: `${entry.id}/${child.id}`, title: child.title,
        icon: <BrowserFavicon url={child.url ?? ""} faviconUrl={child.faviconUrl} size={16} />,
        action: `panel|history|restore|${entry.id}|${child.id}` })),
    }));
    const groups = visibleEntries.reduce<Array<{ label: string; entries: BrowserPanelEntry[] }>>(
      (result, entry) => {
        const label = historyGroupLabel(entry.timestamp);
        const existing = result.at(-1);
        if (existing?.label === label) existing.entries.push(entry);
        else result.push({ label, entries: [entry] });
        return result;
      },
      [],
    );
    return (
      <div className="browser-panel browser-panel--history">
        <header className="browser-panel__header">
          <strong>历史记录</strong>
          <div className="browser-panel__toolbar">
            {renderToolbarButton("trash", "清除浏览数据", "panel|history|clear")}
            {renderToolbarButton("more-horizontal", "更多历史记录操作", "panel|history|more")}
            {renderToolbarButton("star", "固定历史记录面板")}
          </div>
        </header>
        <div className="browser-panel__search is-always-visible">
          <Input
            value={query}
            prefix={<Icon name="search" size={15} />}
            placeholder="搜索历史记录"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <nav className="browser-history-tabs" aria-label="历史记录范围">
          <Button
            className={historyTab === "all" ? "is-active" : ""}
            variant="text"
            size="small"
            onClick={() => setHistoryTab("all")}
          >
            全部
          </Button>
          <Button
            className={historyTab === "recent" ? "is-active" : ""}
            variant="text"
            size="small"
            onClick={() => setHistoryTab("recent")}
          >
            最近关闭
          </Button>
          <span>来自其他设备的标签页</span>
        </nav>
        <div className="browser-panel__scroll">
          {historyTab === "recent" ? (recentTree.length ? <Tree className="browser-history-tree" treeData={recentTree} showIcon
            onSelect={(_, info) => { if (typeof info.node.action === "string") void dispatchAction(info.node.action); }} />
            : <div className="browser-panel__empty">没有最近关闭的标签页</div>) : groups.length ? groups.map((group) => (
            <section className="browser-history-group" key={group.label}>
              <h3>{group.label}</h3>
              {group.entries.map((entry) => (
                <Button
                  className="browser-history-entry"
                  variant="text"
                  size="small"
                  key={entry.id}
                  onClick={() => void dispatchAction(`panel|history|open|${entry.id}`)}
                >
                  <span className="browser-history-entry__icon">
                    <Icon name="clock" size={16} />
                  </span>
                  <span className="browser-history-entry__title" title={entry.title}>{entry.title}</span>
                  <time>{entry.timeLabel}</time>
                </Button>
              ))}
            </section>
          )) : (
            <div className="browser-panel__empty">没有匹配的历史记录</div>
          )}
        </div>
      </div>
    );
  }

  function renderBookmarks() {
    // 使用框架 Tree 保留祖先路径，带子项的目录由组件统一显示展开开关。
    const source = payload?.entries ?? [];
    const keyword = query.trim().toLocaleLowerCase();
    function nodes(parentId?: string, seen = new Set<string>()): TreeNode[] {
      if (seen.size > 64) return [];
      return source.filter(entry => entry.parentId === parentId && !seen.has(entry.id))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).flatMap(entry => {
          const children = entry.folder ? nodes(entry.id, new Set([...seen, entry.id])) : [];
          if (keyword && !`${entry.title} ${entry.url ?? ""}`.toLocaleLowerCase().includes(keyword) && !children.length) return [];
          return [{ key: entry.id, title: entry.title, folder: entry.folder, selectable: !entry.folder,
            icon: entry.folder ? <Icon name="folder" size={16} /> : <BrowserFavicon url={entry.url ?? ""} size={16} />,
            children, isLeaf: !children.length }];
        });
    }
    const children = nodes();
    const tree: TreeNode[] = [{ key: "bookmark-root", title: "收藏夹", selectable: false, icon: <Icon name="star" size={18} />, children }];
    const searchExpanded: string[] = ["bookmark-root"];
    const collect = (items: readonly TreeNode[]) => items.forEach(item => { if (item.children?.length) { searchExpanded.push(String(item.key)); collect(item.children); } });
    if (keyword) collect(children);
    return (
      <div className="browser-panel browser-panel--bookmarks">
        <header className="browser-panel__header">
          <strong>收藏夹</strong>
          <div className="browser-panel__toolbar">
            {renderToolbarButton("star", "添加当前页面", "panel|bookmarks|add-current")}
            {renderToolbarButton("folder", "新建收藏夹文件夹", "panel|bookmarks|new-folder")}
            {renderToolbarButton("search", "搜索收藏夹", undefined, () => setSearchVisible((value) => !value))}
            {renderToolbarButton("download", "导入收藏夹", "panel|bookmarks|import")}
          </div>
        </header>
        {searchVisible ? (
          <div className="browser-panel__search">
            <Input
              value={query}
              prefix={<Icon name="search" size={15} />}
              placeholder="搜索收藏夹"
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        ) : null}
        <div className="browser-panel__scroll">
          <Tree className="browser-bookmark-tree" treeData={tree} showIcon
            expandedKeys={keyword ? searchExpanded : [...expandedBookmarkFolders]}
            onExpand={keys => setExpandedBookmarkFolders(new Set(keys.map(String)))}
            onSelect={(_, info) => { if (!info.node.folder && info.node.key !== "bookmark-root") void dispatchAction(`panel|bookmarks|open|${info.node.key}`); }} />
          {!children.length ? <div className="browser-panel__empty">没有匹配的收藏</div> : null}
        </div>
      </div>
    );
  }

  /** 扩展写操作完成后更新当前列表；失败保留原状态，允许用户重试。 */
  async function changeExtension(extension: BrowserExtensionRecord, action: "pin" | "enabled" | "remove") {
    // 刷新期间不提交写操作，避免旧列表响应覆盖刚保存的固定或启停状态。
    if (extensionBusy || extensionLoading) return;
    const revision = payloadRevision.current;
    setExtensionBusy(true);
    setExtensionError("");
    try {
      if (action === "pin") {
        await invokeNative("set_browser_extension_pinned", { id: extension.id, pinned: !extension.pinned });
        if (revision !== payloadRevision.current) return;
        setExtensions((records) => records.map((record) => record.id === extension.id ? { ...record, pinned: !extension.pinned } : record));
      } else if (action === "enabled") {
        await invokeNative("set_browser_extension_enabled", { id: extension.id, enabled: !extension.enabled });
        if (revision !== payloadRevision.current) return;
        setExtensions((records) => records.map((record) => record.id === extension.id ? { ...record, enabled: !extension.enabled } : record));
      } else {
        await invokeNative("remove_browser_extension", { id: extension.id });
        if (revision !== payloadRevision.current) return;
        setExtensions((records) => records.filter((record) => record.id !== extension.id));
      }
      setExtensionMenu(null);
      setRemoveConfirmation(false);
    } catch (error) { if (revision === payloadRevision.current) setExtensionError(String(error)); }
    finally { if (revision === payloadRevision.current) setExtensionBusy(false); }
  }

  /** 紧凑扩展面板：名称与状态分两行，固定和更多操作始终占用独立列。 */
  function renderExtensions() {
    // 缺少上下文时仅显示全局扩展，避免旧窗口消息泄漏其他分组入口。
    const visibleExtensions = extensions.filter((extension) => extensionMatchesScope(extension.scopes, payload?.extensionScope?.groupId ?? "", payload?.extensionScope?.smallGroupId));
    const selected = visibleExtensions.find((extension) => extension.id === extensionMenu?.id);
    const contextItems: MenuItem[] = selected ? [
      { key: "name", label: selected.name, disabled: true },
      { key: "enabled", label: selected.enabled ? "停用扩展" : "启用扩展", disabled: extensionBusy || extensionLoading },
      { key: "options", label: "扩展选项", disabled: !selected.enabled || !selected.optionsPage },
      { key: "pin", label: selected.pinned ? "从工具栏取消固定" : "固定到工具栏", disabled: extensionBusy || extensionLoading },
      { key: "divider", type: "divider" },
      { key: "manage", label: "管理扩展" },
      { key: "remove", label: removeConfirmation ? "确认移除此扩展" : "从浏览器中移除", danger: true, disabled: extensionBusy || extensionLoading },
    ] : [];
    return (
      <section className="browser-panel browser-panel--extensions" aria-label="扩展面板">
        <header className="browser-panel__header"><strong>扩展</strong></header>
        {/* 当前引擎只提供全局启停，不把它误标成单个网站的访问权限。 */}
        <div className="browser-extensions-summary">{payload?.heading ? `${payload.heading} · ` : ""}已启用 {visibleExtensions.filter((extension) => extension.enabled).length} 个扩展</div>
        {extensionError ? <div className="browser-extensions-error" role="alert">{extensionError}</div> : null}
        <div className="browser-panel__scroll">
          {visibleExtensions.length ? visibleExtensions.map((extension) => (
            <article className={`browser-extension-row${extension.enabled ? "" : " is-disabled"}`} key={extension.id}>
              {extension.iconUrl ? <img className="browser-extension-icon" src={extension.iconUrl} alt="" /> : <Icon name="puzzle" size={22} />}
              <div className="browser-extension-copy">
                <span className="browser-extension-name" title={extension.name}>{extension.name}</span>
                <span className="browser-extension-status">{extension.enabled ? "已启用" : "已停用"}</span>
              </div>
              <Button className="browser-panel__toolbar-button" variant="text" size="small"
                icon={<Icon name={extension.pinned ? "pin-off" : "pin"} size={17} />}
                aria-label={`${extension.pinned ? "取消固定" : "固定"} ${extension.name}`} aria-pressed={Boolean(extension.pinned)}
                title={extension.pinned ? "从工具栏取消固定" : "固定到工具栏"} disabled={extensionBusy || extensionLoading}
                onClick={() => void changeExtension(extension, "pin")} />
              <Button className="browser-panel__toolbar-button" variant="text" size="small"
                icon={<Icon name="more-horizontal" size={18} />} aria-label={`${extension.name} 更多操作`}
                aria-expanded={extensionMenu?.id === extension.id}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setRemoveConfirmation(false);
                  setExtensionMenu(extensionMenu?.id === extension.id ? null : { id: extension.id, anchor: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
                }} />
            </article>
          )) : <div className="browser-panel__empty">{extensionLoading ? "正在读取扩展…" : "当前分组没有可用扩展"}</div>}
        </div>
        <footer className="browser-extensions-footer">
          <Button variant="text" icon={<Icon name="puzzle" size={18} />} onClick={() => void dispatchAction("panel|extensions|manage")}>管理扩展</Button>
          <Button variant="text" icon={<Icon name="external-link" size={18} />} onClick={() => void dispatchAction("panel|extensions|store")}>获取 Microsoft Edge 扩展</Button>
        </footer>
        {extensionMenu && selected ? (
          <BrowserFloatingSubmenu anchor={extensionMenu.anchor} placement="beside" onClose={() => { setExtensionMenu(null); setRemoveConfirmation(false); }}>
            <Menu className="browser-extension-context-menu" items={contextItems}
              mode="vertical" theme={payload?.darkMode ? "dark" : "light"} selectable={false}
              onPointerDown={(event) => event.stopPropagation()} onClick={({ key }) => {
                if (key === "remove" && !removeConfirmation) { setRemoveConfirmation(true); return; }
                if (key === "pin" || key === "enabled" || key === "remove") void changeExtension(selected, key);
                else void dispatchAction(`panel|extensions|${key}|${selected.id}`);
              }} />
          </BrowserFloatingSubmenu>
        ) : null}
      </section>
    );
  }

  /** 业务内容保留原有动作，由统一宿主补齐窗口交互和定位。 */
  function renderSurface() {
    if (!payload) return null;
    if (payload.kind === "extensions") return renderExtensions();
    if (payload.kind === "downloads") return renderDownloads();
    if (payload.kind === "history") return renderHistory();
    if (payload.kind === "bookmarks") return renderBookmarks();

    if (payload.kind === "web-context" || payload.kind === "bookmark-folder" || items.some((item) => item.children?.length)) {
      // 框架 Menu 负责悬停延迟、跨面板保持和边缘翻转；主菜单不因展开子项而被替换。
      const convertItems = (source: BrowserMenuItem[], prefix = "root"): MenuItem[] => source.map((item, index) => ({
        key: item.key ?? `${prefix}-${index}`,
        type: item.type,
        disabled: item.disabled,
        danger: item.danger,
        icon: item.iconDataUrl ? <img src={item.iconDataUrl} width={16} height={16} alt="" /> : item.folder ? <Icon name="folder" size={16} /> : item.faviconUrl ? <BrowserFavicon url={item.faviconUrl} size={16} /> : undefined,
        label: <span className="browser-window-menu__copy">
          <span className="browser-window-menu__label">{item.label}</span>
          {item.subtitle ? <span className="browser-window-menu__subtitle">{item.subtitle}</span> : null}
        </span>,
        extra: item.variant === "theme" ? (
          <span className={`browser-window-menu__theme${item.checked ? " is-dark" : ""}`}>
            <span className={!item.checked ? "is-active" : ""}><Icon name="sun" size={13} /></span>
            <span className={item.checked ? "is-active" : ""}><Icon name="moon" size={13} /></span>
          </span>
        ) : <>
          {/* 勾选状态与快捷键同时保留，不能因为菜单项可勾选而丢失快捷键说明。 */}
          {item.checked ? <Icon name="check" size={14} /> : null}
          {item.shortcut ? <span className="browser-window-menu__shortcut">{item.shortcut}</span> : null}
        </>,
        children: item.children ? convertItems(item.children, item.key ?? `${prefix}-${index}`) : undefined,
      }));
      return <div className="browser-window-menu browser-window-menu--cascade">
        {payload.heading ? <div className="browser-window-menu__heading">{payload.heading}</div> : null}
        <Menu items={convertItems(items)} tabIndex={payload.kind === "web-context" ? -1 : undefined} mode="vertical" theme={payload.darkMode ? 'dark' : 'light'}
          interactionCursor="default" selectable={false} triggerSubMenuAction="hover"
          openKeys={openKeys} onOpenChange={setOpenKeys}
          onClick={({ key }) => void dispatchAction(key)} />
      </div>;
    }

    return (
      <div
        className={`browser-window-menu${payload.kind === "back-history" ? " is-navigation-history" : ""}`}
        role="menu"
        onContextMenu={(event) => event.preventDefault()}
      >
        {payload.heading ? (
          <div className="browser-window-menu__heading">{payload.heading}</div>
        ) : null}
        {items.map((item, index) => {
          if (item.type === "divider") {
            return (
              <div
                key={`divider-${index}`}
                className="browser-window-menu__divider"
                role="separator"
              />
            );
          }
          return (
            <Button
              key={item.key ?? `item-${index}`}
              className={`browser-window-menu__item${item.danger ? " is-danger" : ""}${item.subtitle ? " has-subtitle" : ""}`}
              variant="text"
              size="small"
              disabled={item.disabled}
              onClick={() => void selectItem(item)}
            >
              <span className="browser-window-menu__copy">
                <span className="browser-window-menu__label">{item.label}</span>
                {item.subtitle ? (
                  <span className="browser-window-menu__subtitle">{item.subtitle}</span>
                ) : null}
              </span>
              {item.variant === "theme" ? (
                <span
                  className={`browser-window-menu__theme${item.checked ? " is-dark" : ""}`}
                  aria-label={item.checked ? "当前为深色主题" : "当前为浅色主题"}
                >
                  <span className={!item.checked ? "is-active" : ""}>
                    <Icon name="sun" size={13} />
                  </span>
                  <span className={item.checked ? "is-active" : ""}>
                    <Icon name="moon" size={13} />
                  </span>
                </span>
              ) : item.children?.length ? (
                <Icon name="chevron-right" size={13} />
              ) : item.checked !== undefined ? (
                <span className={`browser-window-menu__check${item.checked ? " is-checked" : ""}`}>
                  {item.checked ? "✓" : ""}
                </span>
              ) : item.shortcut ? (
                <span className="browser-window-menu__shortcut">{item.shortcut}</span>
              ) : null}
            </Button>
          );
        })}
      </div>
    );
  }
  if (!payload) return null;
  return <BrowserFloatingHost payload={payload}>{renderSurface()!}</BrowserFloatingHost>;
}

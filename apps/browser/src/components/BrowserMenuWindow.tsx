import { extensionMatchesScope, type ExtensionScope } from "../extensionScopes";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon, Input, Menu, applySiaTheme } from "@sia.soul/sia-react-ui";
import type { MenuItem } from "@sia.soul/sia-react-ui";
import type { BrowserExtensionRecord } from "./BrowserSettingsPage";

export interface BrowserMenuItem {
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
  totalBytes?: number;
  success?: boolean;
  active?: boolean;
  alwaysOpen?: boolean;
  unsafe?: boolean;
  fileDeleted?: boolean;
}

export interface BrowserMenuPayload {
  /** 原生面板显示批次；命中范围回传时用于拒绝旧面板的异步结果。 */
  hitRegionRevision?: number;
  /** 原生窗口为级联菜单预留空间后，主菜单在窗口内的位置与尺寸，单位为 CSS 像素。 */
  menuLayout?: { left: number; top: number; width: number; height: number };
  darkMode: boolean;
  kind?: "menu" | "back-history" | "downloads" | "history" | "bookmarks" | "extensions";
  /** 面板入口标识；自动显示和用户切换共享此身份。 */
  panelKey?: string;
  /** 仅用户点击时设置，相同入口再次点击关闭面板。 */
  toggleKey?: string;
  /** 主窗口客户区内的触发按钮范围，单位为逻辑像素。 */
  triggerBounds?: { x: number; y: number; width: number; height: number };
  heading?: string;
  items: BrowserMenuItem[];
  entries?: BrowserPanelEntry[];
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
  x: number;
  y: number;
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

export default function BrowserMenuWindow() {
  const [payload, setPayload] = useState<BrowserMenuPayload | null>(null);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [historyTab, setHistoryTab] = useState<"all" | "recent">("all");
  const [expandedFavorites, setExpandedFavorites] = useState(true);
  const [downloadContextMenu, setDownloadContextMenu] = useState<DownloadContextMenuState | null>(null);
  const [extensions, setExtensions] = useState<BrowserExtensionRecord[]>([]);
  const [extensionMenu, setExtensionMenu] = useState<{ id: string; y: number } | null>(null);
  const [extensionBusy, setExtensionBusy] = useState(false);
  const [extensionError, setExtensionError] = useState("");
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState(false);
  // 面板重新打开或切换后，旧异步操作不能覆盖新一轮列表和错误状态。
  const payloadRevision = useRef(0);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let pollTimer: number | undefined;
    const acceptPayload = (nextPayload: BrowserMenuPayload) => {
      if (disposed) return;
      payloadRevision.current += 1;
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
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
      setPayload(nextPayload);
    };
    const readCurrentState = () => {
      void invokeNative<BrowserMenuPayload | null>("get_browser_menu_state")
        .then((state) => {
          if (state) acceptPayload(state);
        })
        .catch(() => undefined);
    };
    readCurrentState();
    pollTimer = window.setInterval(readCurrentState, 200);
    if (window.__TAURI__) {
      void window.__TAURI__.event.listen<BrowserMenuPayload>(
        "sia://browser-menu-state",
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
    if (!window.__TAURI__) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void window.__TAURI__.event.listen<Pick<BrowserMenuPayload, "extensionScope" | "heading">>("sia://extension-context-changed", ({ payload: context }) => {
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
  }, [downloadContextMenu, openKeys, extensionMenu]);

  useEffect(() => {
    if (!payload?.menuLayout) return;
    // 扩展的透明画布只承载子菜单；点击菜单之外的留白时正常关闭。
    const dismissOnBlank = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('.browser-window-menu, .sia-menu__popup')) {
        void invokeNative('close_browser_menu').catch(() => undefined);
      }
    };
    document.addEventListener('pointerdown', dismissOnBlank);
    return () => document.removeEventListener('pointerdown', dismissOnBlank);
  }, [payload?.menuLayout]);

  useEffect(() => {
    if (payload?.hitRegionRevision === undefined) return;
    const revision = payload.hitRegionRevision;
    let frame = 0;
    let previous = "";
    // 只报告可见表面，不把全屏遮罩、阴影留白或预留的子菜单画布交给原生命中。
    const selector = '.browser-panel, .browser-window-menu, .sia-menu__popup.is-open, .browser-download-context-menu, .browser-extension-context-menu';
    const resize = new ResizeObserver(() => schedule());
    const report = () => {
      frame = 0;
      const regions = [...document.querySelectorAll<HTMLElement>(selector)].flatMap(element => {
        resize.observe(element);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return [];
        return [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          radius: parseFloat(style.borderTopLeftRadius) || 0 }];
      });
      const serialized = JSON.stringify(regions);
      if (serialized === previous) return;
      previous = serialized;
      void invokeNative('update_browser_menu_regions', { revision, regions }).catch(() => undefined);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(report); };
    // Portal 插入、开关及定位变化都需更新；每帧合并，避免列表渲染产生大量原生调用。
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['style', 'class', 'hidden'] });
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, true);
    };
  }, [payload]);

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
    payloadRevision.current += 1;
    setDownloadContextMenu(null);
    setPayload(null);
    await invokeNative("browser_menu_action", {
      action: {
        action,
      } satisfies BrowserMenuAction,
    });
  }

  function openDownloadContextMenu(event: React.MouseEvent, entry: BrowserPanelEntry) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 280;
    const menuHeight = 350;
    setDownloadContextMenu({
      entry,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
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
    icon: "folder" | "search" | "more-horizontal" | "trash" | "star" | "plus" | "edit",
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
            const progress = entry.totalBytes
              ? Math.min(100, Math.round((entry.receivedBytes ?? 0) / entry.totalBytes * 100))
              : undefined;
            const status = entry.state === "waiting"
              ? "执行什么操作？"
              : entry.fileDeleted
              ? "文件已删除"
              : entry.unsafe
                ? "已标记为不安全"
                : entry.state === "finished"
              ? (entry.success === false ? "下载失败" : "下载完成")
              : progress === undefined
                ? `已下载 ${formatBytes(entry.receivedBytes)}`
                : `${progress}% · ${formatBytes(entry.receivedBytes)} / ${formatBytes(entry.totalBytes)}`;
            return (
              <article
                className={`browser-download-entry${entry.state === "waiting" ? " is-waiting" : ""}`}
                key={entry.id}
                tabIndex={0}
                onContextMenu={(event) => openDownloadContextMenu(event, entry)}
              >
                <span className="browser-download-entry__icon">
                  <Icon name="file" size={19} />
                </span>
                <div className="browser-download-entry__body">
                  <strong title={entry.fileName ?? entry.title}>
                    {entry.state === "waiting"
                      ? `要对 ${entry.fileName ?? entry.title}`
                      : entry.fileName ?? entry.title}
                  </strong>
                  <span className={entry.success === false || entry.unsafe || entry.fileDeleted ? "is-error" : ""}>{status}</span>
                  {entry.state === "waiting" ? (
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
                    <Button
                      className="browser-download-entry__open"
                      variant="text"
                      size="small"
                      onClick={() => void dispatchAction(`panel|downloads|open|${entry.id}`)}
                    >
                      打开文件
                    </Button>
                  ) : null}
                </div>
                {entry.state !== "waiting" ? (
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
          <div
            className="browser-download-context-layer"
            onPointerDown={() => setDownloadContextMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setDownloadContextMenu(null);
            }}
          >
            <Menu
              className="browser-download-context-menu"
              style={{ left: downloadContextMenu.x, top: downloadContextMenu.y }}
              items={downloadContextItems(downloadContextMenu.entry)}
              mode="vertical"
              theme={payload?.darkMode ? "dark" : "light"}
              selectable={false}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
              onClick={({ key }) => void dispatchAction(key)}
            />
          </div>
        ) : null}
      </div>
    );
  }

  function renderHistory() {
    const now = Date.now();
    const visibleEntries = historyTab === "recent"
      ? entries.filter((entry) => now - (entry.timestamp ?? 0) <= 86_400_000)
      : entries;
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
          {groups.length ? groups.map((group) => (
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
    return (
      <div className="browser-panel browser-panel--bookmarks">
        <header className="browser-panel__header">
          <strong>收藏夹</strong>
          <div className="browser-panel__toolbar">
            {renderToolbarButton("star", "添加当前页面", "panel|bookmarks|add-current")}
            {renderToolbarButton("folder", "新建收藏夹文件夹", "panel|bookmarks|new-folder")}
            {renderToolbarButton("search", "搜索收藏夹", undefined, () => setSearchVisible((value) => !value))}
            {renderToolbarButton("more-horizontal", "更多收藏夹操作", "panel|bookmarks|more")}
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
          <Button
            className="browser-bookmark-root"
            variant="text"
            size="small"
            onClick={() => setExpandedFavorites((value) => !value)}
          >
            <Icon name={expandedFavorites ? "chevron-down" : "chevron-right"} size={14} />
            <Icon name="star" size={18} />
            <strong>收藏夹栏</strong>
          </Button>
          {expandedFavorites ? (
            <div className="browser-bookmark-list">
              {entries.length ? entries.map((entry) => (
                <Button
                  className="browser-bookmark-entry"
                  variant="text"
                  size="small"
                  key={entry.id}
                  onClick={() => void dispatchAction(`panel|bookmarks|open|${entry.id}`)}
                >
                  <span className="browser-bookmark-entry__icon">
                    <Icon name="star" size={15} />
                  </span>
                  <span title={entry.title}>{entry.title}</span>
                </Button>
              )) : (
                <div className="browser-panel__empty">收藏夹栏中暂无项目</div>
              )}
            </div>
          ) : null}
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
                  setExtensionMenu(extensionMenu?.id === extension.id ? null : { id: extension.id, y: Math.max(24, Math.min(rect.bottom, window.innerHeight - 290)) });
                }} />
            </article>
          )) : <div className="browser-panel__empty">{extensionLoading ? "正在读取扩展…" : "当前分组没有可用扩展"}</div>}
        </div>
        <footer className="browser-extensions-footer">
          <Button variant="text" icon={<Icon name="puzzle" size={18} />} onClick={() => void dispatchAction("panel|extensions|manage")}>管理扩展</Button>
          <Button variant="text" icon={<Icon name="external-link" size={18} />} onClick={() => void dispatchAction("panel|extensions|store")}>获取 Microsoft Edge 扩展</Button>
        </footer>
        {extensionMenu && selected ? (
          <div className="browser-download-context-layer" onPointerDown={() => { setExtensionMenu(null); setRemoveConfirmation(false); }}>
            <Menu className="browser-extension-context-menu" style={{ right: 24, top: extensionMenu.y }} items={contextItems}
              mode="vertical" theme={payload?.darkMode ? "dark" : "light"} selectable={false}
              onPointerDown={(event) => event.stopPropagation()} onClick={({ key }) => {
                if (key === "remove" && !removeConfirmation) { setRemoveConfirmation(true); return; }
                if (key === "pin" || key === "enabled" || key === "remove") void changeExtension(selected, key);
                else void dispatchAction(`panel|extensions|${key}|${selected.id}`);
              }} />
          </div>
        ) : null}
      </section>
    );
  }

  if (!payload) return null;
  if (payload.kind === "extensions") return renderExtensions();
  if (payload.kind === "downloads") return renderDownloads();
  if (payload.kind === "history") return renderHistory();
  if (payload.kind === "bookmarks") return renderBookmarks();

  if (items.some((item) => item.children?.length)) {
    // 框架 Menu 负责悬停延迟、跨面板保持和边缘翻转；主菜单不因展开子项而被替换。
    const convertItems = (source: BrowserMenuItem[], prefix = "root"): MenuItem[] => source.map((item, index) => ({
      key: item.key ?? `${prefix}-${index}`,
      type: item.type,
      disabled: item.disabled,
      danger: item.danger,
      label: <span className="browser-window-menu__copy">
        <span className="browser-window-menu__label">{item.label}</span>
        {item.subtitle ? <span className="browser-window-menu__subtitle">{item.subtitle}</span> : null}
      </span>,
      extra: item.variant === "theme" ? (
        <span className={`browser-window-menu__theme${item.checked ? " is-dark" : ""}`}>
          <span className={!item.checked ? "is-active" : ""}><Icon name="sun" size={13} /></span>
          <span className={item.checked ? "is-active" : ""}><Icon name="moon" size={13} /></span>
        </span>
      ) : item.checked !== undefined ? (item.checked ? "✓" : undefined)
        : item.shortcut ? <span className="browser-window-menu__shortcut">{item.shortcut}</span> : undefined,
      children: item.children ? convertItems(item.children, item.key ?? `${prefix}-${index}`) : undefined,
    }));
    const layout = payload.menuLayout;
    return <div className="browser-window-menu browser-window-menu--cascade"
      style={layout ? { position: 'absolute', left: layout.left, top: layout.top, width: layout.width, height: layout.height, margin: 0 } : undefined}>
      {payload.heading ? <div className="browser-window-menu__heading">{payload.heading}</div> : null}
      <Menu items={convertItems(items)} mode="vertical" theme={payload.darkMode ? 'dark' : 'light'}
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

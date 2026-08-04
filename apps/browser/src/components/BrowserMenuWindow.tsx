import { useEffect, useMemo, useState } from "react";
import { Button, Icon, Input, Menu, applySiaTheme } from "@sia-ui/react";
import type { MenuItem } from "@sia-ui/react";

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
  darkMode: boolean;
  kind?: "menu" | "back-history" | "downloads" | "history" | "bookmarks";
  heading?: string;
  items: BrowserMenuItem[];
  entries?: BrowserPanelEntry[];
  currentTitle?: string;
  currentUrl?: string;
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
  const [submenu, setSubmenu] = useState<BrowserMenuItem | null>(null);
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [historyTab, setHistoryTab] = useState<"all" | "recent">("all");
  const [expandedFavorites, setExpandedFavorites] = useState(true);
  const [downloadContextMenu, setDownloadContextMenu] = useState<DownloadContextMenuState | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let pollTimer: number | undefined;
    const acceptPayload = (nextPayload: BrowserMenuPayload) => {
      if (disposed) return;
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
      setSubmenu(null);
      setQuery("");
      setSearchVisible(false);
      setHistoryTab("all");
      setDownloadContextMenu(null);
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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (downloadContextMenu) {
        setDownloadContextMenu(null);
        return;
      }
      if (submenu) {
        setSubmenu(null);
        return;
      }
      void invokeNative("close_browser_menu").catch(() => undefined);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [downloadContextMenu, submenu]);

  const items = useMemo(
    () => submenu?.children ?? payload?.items ?? [],
    [payload, submenu],
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
    const menuWidth = 320;
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
    if (item.children?.length) {
      setSubmenu(item);
      return;
    }
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

  if (!payload) return null;
  if (payload.kind === "downloads") return renderDownloads();
  if (payload.kind === "history") return renderHistory();
  if (payload.kind === "bookmarks") return renderBookmarks();

  return (
    <div
      className={`browser-window-menu${payload.kind === "back-history" ? " is-navigation-history" : ""}`}
      role="menu"
      onContextMenu={(event) => event.preventDefault()}
    >
      {!submenu && payload.heading ? (
        <div className="browser-window-menu__heading">{payload.heading}</div>
      ) : null}
      {submenu ? (
        <>
          <Button
            className="browser-window-menu__item browser-window-menu__back"
            variant="text"
            size="small"
            icon={<Icon name="chevron-left" size={14} />}
            onClick={() => setSubmenu(null)}
          >
            {submenu.label}
          </Button>
          <div className="browser-window-menu__divider" role="separator" />
        </>
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

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  Button,
  Card,
  Drawer,
  Dropdown,
  Icon,
  Input,
  Progress,
  Radio,
  Spin,
  Tag,
  Table,
  ThemeSwitch,
  Tooltip,
  Treemap,
  WindowFrame,
  WindowTitleBar,
  applySiaTheme,
  createResizePlugin,
  message,
  type MenuItem,
  type RadioValue,
  type TableColumn,
  type TreemapNode,
  type WindowAction,
} from "@sia.soul/sia-react-ui";
import {
  cancelNativeScan,
  chooseDirectory,
  isDesktopRuntime,
  listVolumes,
  listenToScan,
  runDiskEntryAction,
  startDemoScan,
  startNativeScan,
} from "./diskGateway";
import type { DiskVolume, ScanBatch, ScanNodeRecord, ScanPhase, SkippedEntry } from "./types";

const FILE_COLORS = [
  "#88bde6",
  "#7bc8c9",
  "#a7c88a",
  "#e7b778",
  "#d79bb6",
  "#a79ad8",
  "#81b7a0",
  "#dd9b80",
];

const SCAN_VIEW_INTERVAL_MS = 64;
const BLOCKED_WEB_SHORTCUT_KEYS = new Set([
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "+", "-", "=", "b", "d", "e", "f", "g", "h", "j", "k", "l", "m",
  "n", "o", "p", "r", "s", "t", "u", "w", "pageup", "pagedown", "tab",
]);

const DISK_ENTRY_MENU_ITEMS: readonly MenuItem[] = [
  { key: "open", label: "打开", icon: <Icon name="external-link" size={15} /> },
  { key: "reveal", label: "在资源管理器中显示", icon: <Icon name="folder" size={15} /> },
  { key: "file-divider", type: "divider" },
  { key: "copy-path", label: "复制完整路径", icon: <Icon name="copy" size={15} /> },
  { key: "properties-divider", type: "divider" },
  { key: "properties", label: "属性", icon: <Icon name="info" size={15} /> },
];

const SKIPPED_COLUMNS: readonly TableColumn<SkippedEntry>[] = [
  {
    key: "kind",
    title: "类型",
    dataIndex: "kind",
    width: 132,
    minWidth: 96,
    maxWidth: 220,
    render: (_, record) => (
      <span className="skipped-kind">
        <Icon name={record.kind === "directory" ? "folder" : "file"} size={14} />
        {record.kind === "directory" ? "文件夹" : record.kind === "file" ? "文件" : "未知"}
      </span>
    ),
  },
  {
    key: "path",
    title: "路径",
    dataIndex: "path",
    width: 420,
    minWidth: 220,
    maxWidth: 1200,
    ellipsis: true,
    render: (_, record) => <span className="skipped-path" title={record.path}>{record.path}</span>,
  },
  {
    key: "reason",
    title: "跳过原因",
    dataIndex: "reason",
    width: 520,
    minWidth: 260,
    maxWidth: 1600,
    ellipsis: true,
    render: (_, record) => <span className="skipped-reason" title={record.reason}>{record.reason}</span>,
  },
];

const SKIPPED_TABLE_PLUGINS = [createResizePlugin<SkippedEntry>()] as const;

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** power;
  const maximumFractionDigits = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toLocaleString("zh-CN", { maximumFractionDigits })} ${units[power]}`;
}

function colorForNode(record: ScanNodeRecord) {
  if (record.kind === "directory") return "#d7b184";
  const extension = record.name.includes(".") ? record.name.split(".").at(-1)!.toLowerCase() : record.name;
  let hash = 0;
  for (let index = 0; index < extension.length; index += 1) {
    hash = ((hash << 5) - hash + extension.charCodeAt(index)) | 0;
  }
  return FILE_COLORS[Math.abs(hash) % FILE_COLORS.length]!;
}

function buildTreemap(
  records: ReadonlyMap<number, ScanNodeRecord>,
  childIdsByParent: ReadonlyMap<number | null, ReadonlySet<number>>,
  expandedKeys: ReadonlySet<string>,
) {
  const rootId = childIdsByParent.get(null)?.values().next().value as number | undefined;
  const root = rootId === undefined ? undefined : records.get(rootId);
  if (!root) return { root: null, data: [] as TreemapNode[] };
  const visited = new Set<number>();

  function toNode(record: ScanNodeRecord): TreemapNode {
    if (visited.has(record.id)) {
      return { key: String(record.id), label: record.name, value: record.size, kind: record.kind };
    }
    visited.add(record.id);
    const childIds = childIdsByParent.get(record.id);
    const hasChildren = record.kind === "directory"
      && (Boolean(childIds?.size) || !record.completed);
    const children = expandedKeys.has(String(record.id))
      ? [...(childIds ?? [])]
        .map((id) => records.get(id))
        .filter((child): child is ScanNodeRecord => Boolean(child))
        .map(toNode)
      : undefined;
    return {
      key: String(record.id),
      label: record.name,
      value: record.size,
      kind: record.kind,
      color: colorForNode(record),
      hasChildren,
      children,
      disabled: record.kind === "directory" && record.unreadable && !childIds?.size,
    };
  }

  return {
    root,
    data: [...(childIdsByParent.get(root.id) ?? [])]
      .map((id) => records.get(id))
      .filter((record): record is ScanNodeRecord => Boolean(record))
      .map(toNode),
  };
}

function normalizedScanPath(path: string) {
  return path.replaceAll("/", "\\").replace(/\\+$/, "").toLowerCase();
}

function findBatchActiveNodeId(batch: ScanBatch) {
  if (!batch.currentPath) return null;
  const currentPath = normalizedScanPath(batch.currentPath);
  let closestDirectory: ScanNodeRecord | null = null;
  let closestPathLength = -1;

  for (const record of batch.nodes) {
    const recordPath = normalizedScanPath(record.path);
    if (recordPath === currentPath) return record.id;
    if (
      record.kind === "directory"
      && currentPath.startsWith(`${recordPath}\\`)
      && recordPath.length > closestPathLength
    ) {
      closestDirectory = record;
      closestPathLength = recordPath.length;
    }
  }
  return closestDirectory?.id ?? null;
}

function resolveVisibleActiveKey(
  records: ReadonlyMap<number, ScanNodeRecord>,
  activeNodeId: number | null,
  expandedKeys: ReadonlySet<string>,
) {
  if (activeNodeId === null) return null;
  const ancestors: ScanNodeRecord[] = [];
  const visited = new Set<number>();
  let current = records.get(activeNodeId);
  while (current && !visited.has(current.id)) {
    ancestors.push(current);
    visited.add(current.id);
    current = current.parentId === null ? undefined : records.get(current.parentId);
  }
  ancestors.reverse();
  if (ancestors.length <= 1) return null;

  for (let index = 1; index < ancestors.length - 1; index += 1) {
    const node = ancestors[index]!;
    if (node.kind !== "directory" || !expandedKeys.has(String(node.id))) return String(node.id);
  }
  return String(ancestors.at(-1)!.id);
}

function volumeLabel(volume: DiskVolume) {
  const usedBytes = Math.max(0, volume.totalBytes - volume.freeBytes);
  const percent = volume.totalBytes > 0 ? (usedBytes / volume.totalBytes) * 100 : 0;
  return (
    <span className="volume-option">
      <span className="volume-option__icon"><Icon name="folder" size={21} /></span>
      <span className="volume-option__main">
        <span className="volume-option__title">
          <strong>{volume.name || "本地磁盘"} ({volume.path.replace("\\", "")})</strong>
          <small>{volume.driveType} · {volume.fileSystem || "未知格式"}</small>
        </span>
        <Progress
          percent={percent}
          showInfo={false}
          size="small"
          strokeColor={{ from: "#62a7ff", to: "#1677ff" }}
        />
        <span className="volume-option__space">可用 {formatBytes(volume.freeBytes)}，共 {formatBytes(volume.totalBytes)}</span>
      </span>
    </span>
  );
}

function SelectionView({
  volumes,
  loading,
  selectedPath,
  onSelectedPathChange,
  onBrowse,
  onStart,
}: {
  volumes: DiskVolume[];
  loading: boolean;
  selectedPath: string;
  onSelectedPathChange: (path: string) => void;
  onBrowse: () => void;
  onStart: () => void;
}) {
  return (
    <main className="selection-view">
      <div className="selection-view__backdrop" aria-hidden="true">
        <i /><i /><i />
      </div>
      <section className="selection-hero">
        <div className="selection-hero__copy">
          <Tag status="processing">实时扫描 · 交互式矩形树图</Tag>
          <h1>看见每一寸<br /><span>磁盘空间</span></h1>
          <p>从全盘到任意目录，边扫描边呈现空间占用。点击文件夹方块，即可在原位置展开它的下一层内容。</p>
        </div>
        <div className="selection-hero__features" aria-label="产品特性">
          <span><Icon name="loader" size={17} /> 增量探测</span>
          <span><Icon name="component" size={17} /> 动态布局</span>
          <span><Icon name="folder" size={17} /> 原位下钻</span>
        </div>
      </section>

      <Card
        className="selection-card"
        title="选择扫描位置"
        description="选择一个磁盘，或手动指定需要分析的目录。"
        extra={!isDesktopRuntime ? <Tag status="warning">浏览器演示模式</Tag> : null}
      >
        <div className="selection-card__section-title">
          <span>系统磁盘</span>
          <small>{loading ? "正在读取…" : `已发现 ${volumes.length} 个磁盘`}</small>
        </div>
        {loading ? (
          <div className="volume-loading"><Spin tip="正在读取磁盘信息" /></div>
        ) : (
          <Radio.Group
            className="volume-list"
            value={selectedPath}
            options={volumes.map((volume) => ({ value: volume.path, label: volumeLabel(volume) }))}
            onChange={(value: RadioValue) => onSelectedPathChange(String(value))}
          />
        )}

        <div className="selection-divider"><span>或者</span></div>

        <div className="directory-picker">
          <Input
            value={volumes.some((volume) => volume.path === selectedPath) ? "" : selectedPath}
            readOnly
            placeholder="尚未选择自定义目录"
            prefix={<Icon name="folder" size={17} />}
            aria-label="自定义扫描目录"
          />
          <Button icon={<Icon name="folder" size={16} />} onClick={onBrowse}>浏览目录</Button>
        </div>

        <Button
          className="start-scan-button"
          variant="primary"
          size="large"
          block
          disabled={!selectedPath}
          icon={<Icon name="search" size={18} />}
          onClick={onStart}
        >
          开始探测
        </Button>
        <p className="selection-card__hint"><Icon name="info" size={14} /> 扫描过程只读取文件大小，不会修改或上传任何文件。</p>
      </Card>
    </main>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [volumes, setVolumes] = useState<DiskVolume[]>([]);
  const [loadingVolumes, setLoadingVolumes] = useState(true);
  const [selectedPath, setSelectedPath] = useState("");
  const [view, setView] = useState<"selection" | "scanner">("selection");
  const [phase, setPhase] = useState<ScanPhase>("started");
  const [activeScanId, setActiveScanId] = useState<number | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const [recordVersion, setRecordVersion] = useState(0);
  const [progress, setProgress] = useState<Omit<ScanBatch, "nodes" | "skipped" | "phase" | "scanId">>({
    rootPath: "",
    processedFiles: 0,
    processedDirectories: 0,
    scannedBytes: 0,
    errors: 0,
  });
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ScanNodeRecord | null>(null);
  const [contextNode, setContextNode] = useState<ScanNodeRecord | null>(null);
  const [skippedOpen, setSkippedOpen] = useState(false);
  const activeScanRef = useRef<number | null>(null);
  const demoCancelRef = useRef<(() => void) | null>(null);
  const recordsRef = useRef<Map<number, ScanNodeRecord>>(new Map());
  const childIdsByParentRef = useRef<Map<number | null, Set<number>>>(new Map());
  const latestBatchRef = useRef<ScanBatch | null>(null);
  const latestActiveNodeIdRef = useRef<number | null>(null);
  const skippedRef = useRef<Map<number, SkippedEntry>>(new Map());
  const renderTimerRef = useRef<number | null>(null);
  const expandedKeySet = useMemo(() => new Set(expandedKeys), [expandedKeys]);
  const { root, data } = useMemo(
    () => buildTreemap(recordsRef.current, childIdsByParentRef.current, expandedKeySet),
    [expandedKeySet, recordVersion],
  );
  const skippedEntries = useMemo(
    () => [...skippedRef.current.values()],
    [recordVersion],
  );
  const activeTreemapKey = useMemo(
    () => phase === "scanning" || phase === "started"
      ? resolveVisibleActiveKey(recordsRef.current, activeNodeId, expandedKeySet)
      : null,
    [activeNodeId, expandedKeySet, phase, recordVersion],
  );

  useEffect(() => {
    const preventDefaultContextMenu = (event: globalThis.MouseEvent) => event.preventDefault();
    document.addEventListener("contextmenu", preventDefaultContextMenu);
    return () => document.removeEventListener("contextmenu", preventDefaultContextMenu);
  }, []);

  useEffect(() => {
    const preventWebShortcuts = (event: globalThis.KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const commandKey = event.ctrlKey || event.metaKey;
      const browserFunctionKey = key === "f5" || key === "f11" || key === "f12";
      const browserNavigation = event.altKey && (key === "arrowleft" || key === "arrowright" || key === "home");
      const developerShortcut = commandKey && event.shiftKey && (key === "c" || key === "delete" || key === "i");
      if (
        browserFunctionKey
        || browserNavigation
        || developerShortcut
        || commandKey && BLOCKED_WEB_SHORTCUT_KEYS.has(key)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", preventWebShortcuts, true);
    return () => window.removeEventListener("keydown", preventWebShortcuts, true);
  }, []);

  useEffect(() => {
    let mounted = true;
    listVolumes()
      .then((nextVolumes) => {
        if (!mounted) return;
        setVolumes(nextVolumes);
        setSelectedPath((current) => current || nextVolumes[0]?.path || "");
      })
      .catch((error) => {
        message.error(`读取磁盘失败：${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        if (mounted) setLoadingVolumes(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isDesktopRuntime) return undefined;
    let unlisten: (() => void) | undefined;
    void listenToScan(handleBatch)
      .then((cleanup) => { unlisten = cleanup; })
      .catch((error) => {
        message.error(`初始化扫描监听失败：${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      unlisten?.();
      if (renderTimerRef.current !== null) window.clearTimeout(renderTimerRef.current);
    };
  }, []);

  function flushScanView() {
    renderTimerRef.current = null;
    const batch = latestBatchRef.current;
    if (!batch) return;
    setPhase(batch.phase);
    setProgress({
      rootPath: batch.rootPath,
      processedFiles: batch.processedFiles,
      processedDirectories: batch.processedDirectories,
      scannedBytes: batch.scannedBytes,
      errors: batch.errors,
      currentPath: batch.currentPath,
      message: batch.message,
    });
    setActiveNodeId(batch.phase === "scanning" || batch.phase === "started"
      ? latestActiveNodeIdRef.current
      : null);
    setRecordVersion((version) => version + 1);
  }

  function scheduleScanView(phase: ScanPhase) {
    const terminal = phase === "completed" || phase === "cancelled" || phase === "failed";
    if (terminal) {
      if (renderTimerRef.current !== null) {
        window.clearTimeout(renderTimerRef.current);
        renderTimerRef.current = null;
      }
      flushScanView();
      return;
    }
    if (renderTimerRef.current !== null) return;
    renderTimerRef.current = window.setTimeout(flushScanView, SCAN_VIEW_INTERVAL_MS);
  }

  function handleBatch(batch: ScanBatch) {
    if (activeScanRef.current !== null && batch.scanId !== activeScanRef.current) return;
    if (activeScanRef.current === null) {
      activeScanRef.current = batch.scanId;
      setActiveScanId(batch.scanId);
    }
    const records = recordsRef.current;
    const childIdsByParent = childIdsByParentRef.current;
    batch.nodes.forEach((record) => {
      const previous = records.get(record.id);
      if (!previous || previous.parentId !== record.parentId) {
        if (previous) childIdsByParent.get(previous.parentId)?.delete(previous.id);
        const childIds = childIdsByParent.get(record.parentId) ?? new Set<number>();
        childIds.add(record.id);
        childIdsByParent.set(record.parentId, childIds);
      }
      records.set(record.id, record);
    });
    batch.skipped.forEach((entry) => skippedRef.current.set(entry.id, entry));
    if (batch.currentPath) latestActiveNodeIdRef.current = findBatchActiveNodeId(batch);
    if (batch.phase === "completed" || batch.phase === "cancelled" || batch.phase === "failed") {
      latestActiveNodeIdRef.current = null;
    }
    latestBatchRef.current = batch;
    scheduleScanView(batch.phase);
    if (batch.phase === "failed") {
      message.error(batch.message ?? "扫描失败");
    }
  }

  async function browseDirectory() {
    try {
      const path = await chooseDirectory(selectedPath || undefined);
      if (path) setSelectedPath(path);
    } catch (error) {
      message.error(`打开目录选择器失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function beginScan() {
    if (!selectedPath) return;
    demoCancelRef.current?.();
    activeScanRef.current = null;
    setActiveScanId(null);
    recordsRef.current = new Map();
    childIdsByParentRef.current = new Map();
    skippedRef.current = new Map();
    latestBatchRef.current = null;
    latestActiveNodeIdRef.current = null;
    if (renderTimerRef.current !== null) {
      window.clearTimeout(renderTimerRef.current);
      renderTimerRef.current = null;
    }
    setRecordVersion((version) => version + 1);
    setActiveNodeId(null);
    setExpandedKeys([]);
    setFocusedKey(null);
    setSelectedNode(null);
    setContextNode(null);
    setSkippedOpen(false);
    setPhase("started");
    setView("scanner");
    setProgress({
      rootPath: selectedPath,
      processedFiles: 0,
      processedDirectories: 0,
      scannedBytes: 0,
      errors: 0,
      currentPath: selectedPath,
    });
    try {
      if (isDesktopRuntime) {
        const scanId = await startNativeScan(selectedPath);
        activeScanRef.current = scanId;
        setActiveScanId(scanId);
      } else {
        const demo = startDemoScan(selectedPath, handleBatch);
        activeScanRef.current = demo.scanId;
        setActiveScanId(demo.scanId);
        demoCancelRef.current = demo.cancel;
      }
    } catch (error) {
      setPhase("failed");
      message.error(`无法开始扫描：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function stopScan() {
    if (activeScanId === null || phase !== "scanning" && phase !== "started") return;
    if (isDesktopRuntime) await cancelNativeScan(activeScanId);
    else demoCancelRef.current?.();
  }

  function returnToSelection() {
    if (phase === "scanning" || phase === "started") void stopScan();
    activeScanRef.current = null;
    setActiveScanId(null);
    setView("selection");
  }

  function changeTheme(checked: boolean) {
    setDarkMode(checked);
    applySiaTheme(checked ? "dark" : "light");
  }

  function findRecord(key: string) {
    return recordsRef.current.get(Number(key)) ?? null;
  }

  function prepareTreemapContextMenu(event: ReactMouseEvent<HTMLSpanElement>) {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-treemap-key]")
      : null;
    const record = target?.dataset.treemapKey ? findRecord(target.dataset.treemapKey) : null;
    if (!record) {
      event.preventDefault();
      setContextNode(null);
      return;
    }
    setContextNode(record);
  }

  async function handleDiskEntryMenu(key: string) {
    const record = contextNode;
    if (!record) return;
    try {
      if (key === "copy-path") {
        await navigator.clipboard.writeText(record.path);
        message.success("完整路径已复制");
        return;
      }
      if (key === "open" || key === "reveal" || key === "properties") {
        await runDiskEntryAction(key, record.path);
      }
    } catch (error) {
      message.error(`文件操作失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function runWindowAction(action: WindowAction) {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!isDesktopRuntime || !invoke) return;
    if (action === "toggle-maximize") setWindowMaximized((value) => !value);
    void invoke("disk_space_window_action", { action }).catch((error) => {
      if (action === "toggle-maximize") setWindowMaximized((value) => !value);
      message.error(`窗口操作失败：${error instanceof Error ? error.message : String(error)}`);
    });
  }

  const isScanning = phase === "scanning" || phase === "started";
  const windowTitleBar = (
    <WindowTitleBar
      className="disk-window-titlebar"
      leading={(
        <div className="disk-window-titlebar__brand" aria-label="Sia 磁盘空间探测器">
          <span><img src="/app-icon.svg" alt="" /></span>
          <strong>Sia 磁盘空间探测器</strong>
        </div>
      )}
      actions={(
        <>
          {view === "scanner" ? (
            <>
              <Button
                className="titlebar-action-button"
                size="small"
                variant="text"
                icon={<Icon name="folder" size={14} />}
                disabled={isScanning}
                onClick={returnToSelection}
              >
                重新选择
              </Button>
              <Button
                className="titlebar-action-button"
                size="small"
                variant="text"
                icon={<Icon name="refresh" size={14} />}
                disabled={isScanning}
                onClick={() => void beginScan()}
              >
                重新扫描
              </Button>
            </>
          ) : null}
          <Tooltip title="切换明暗主题"><ThemeSwitch checked={darkMode} onCheckedChange={changeTheme} /></Tooltip>
        </>
      )}
      maximized={windowMaximized}
      onWindowAction={runWindowAction}
    />
  );

  if (view === "selection") {
    return (
      <WindowFrame className="disk-window-frame" titleBar={windowTitleBar}>
        <div className="disk-space-app">
          <SelectionView
            volumes={volumes}
            loading={loadingVolumes}
            selectedPath={selectedPath}
            onSelectedPathChange={setSelectedPath}
            onBrowse={browseDirectory}
            onStart={() => void beginScan()}
          />
        </div>
      </WindowFrame>
    );
  }

  const phaseLabel = phase === "completed"
    ? "探测完成"
    : phase === "cancelled"
      ? "已停止"
      : phase === "failed"
        ? "探测失败"
        : "正在探测";

  return (
    <WindowFrame className="disk-window-frame" titleBar={windowTitleBar}>
      <div className="disk-space-app scanner-view">
      <section className="scanner-toolbar" aria-label="扫描状态">
        <div className="scan-status">
          {isScanning ? <Spin size="small" /> : <span className={`scan-status__dot scan-status__dot--${phase}`} />}
          <div>
            <strong>{phaseLabel}</strong>
            <span title={progress.currentPath}>{isScanning ? progress.currentPath || "正在建立目录索引…" : root ? `${root.name} · ${formatBytes(root.size)}` : progress.message}</span>
          </div>
        </div>

        <div className="scan-stats">
          <span><small>已统计空间</small><strong>{formatBytes(progress.scannedBytes)}</strong></span>
          <i />
          <span><small>文件</small><strong>{progress.processedFiles.toLocaleString("zh-CN")}</strong></span>
          <i />
          <span><small>文件夹</small><strong>{progress.processedDirectories.toLocaleString("zh-CN")}</strong></span>
          <i />
          <Button
            className="scan-stat-button"
            size="small"
            variant="text"
            disabled={progress.errors === 0}
            title={progress.errors > 0 ? "查看所有跳过的文件和文件夹" : "当前没有跳过项"}
            onClick={() => setSkippedOpen(true)}
          >
            <small>跳过</small>
            <strong>{progress.errors.toLocaleString("zh-CN")}</strong>
          </Button>
        </div>

        <div className="scanner-toolbar__actions">
          {expandedKeys.length > 0 ? (
            <Button
              size="small"
              variant="text"
              icon={<Icon name="shrink" size={15} />}
              onClick={() => {
                setExpandedKeys([]);
                setFocusedKey(null);
              }}
            >
              全部收起
            </Button>
          ) : null}
          <div className="scanner-toolbar__path">
            <span>探测位置</span>
            <strong title={progress.rootPath}>{progress.rootPath}</strong>
          </div>
          {isScanning ? (
            <Button size="small" danger icon={<Icon name="pause" size={15} />} onClick={stopScan}>停止探测</Button>
          ) : null}
        </div>
      </section>

      <main className="treemap-workspace">
        <Dropdown
          className="treemap-context-menu"
          trigger={["contextMenu"]}
          menu={{
            items: DISK_ENTRY_MENU_ITEMS,
            theme: darkMode ? "dark" : "light",
            onClick: ({ key }) => void handleDiskEntryMenu(key),
          }}
          popupStyle={{ minWidth: 214 }}
          onContextMenu={prepareTreemapContextMenu}
        >
          <Treemap
            className="space-treemap"
            data={data}
            activeKey={activeTreemapKey}
            expandedKeys={expandedKeys}
            focusedKey={focusedKey}
            emptyContent={isScanning ? <Spin tip="正在发现文件和文件夹" /> : "没有可显示的内容"}
            valueFormatter={(value) => formatBytes(value)}
            onExpandedChange={setExpandedKeys}
            onFocusedChange={setFocusedKey}
            onNodeClick={({ node }) => setSelectedNode(node.kind === "file" ? findRecord(node.key) : null)}
          />
        </Dropdown>
        <div className="treemap-legend">
          <span><i className="legend-swatch legend-swatch--folder" />文件夹</span>
          <span><i className="legend-swatch legend-swatch--file" />文件</span>
          <span className="treemap-legend__hint"><Icon name="info" size={13} /> 点击文件夹可在原位置展开 / 收起</span>
        </div>
        {selectedNode ? (
          <aside className="node-inspector">
            <span className={`node-inspector__icon node-inspector__icon--${selectedNode.kind}`}>
              <Icon name={selectedNode.kind === "directory" ? "folder" : "file"} size={18} />
            </span>
            <span className="node-inspector__content">
              <strong>{selectedNode.name}</strong>
              <small title={selectedNode.path}>{selectedNode.path}</small>
            </span>
            <span className="node-inspector__size">{formatBytes(selectedNode.size)}</span>
            <Button
              className="node-inspector__close"
              size="small"
              variant="text"
              icon={<Icon name="close" size={15} />}
              aria-label="关闭详情"
              onClick={() => setSelectedNode(null)}
            />
          </aside>
        ) : null}
      </main>
      <Drawer
        className="skipped-drawer"
        open={skippedOpen}
        title={(
          <span className="skipped-drawer__title">
            <Icon name="warning" size={17} />
            跳过的文件和文件夹
          </span>
        )}
        extra={<Tag>{skippedEntries.length.toLocaleString("zh-CN")} 项</Tag>}
        size="min(780px, 78vw)"
        onOpenChange={setSkippedOpen}
      >
        <Table<SkippedEntry>
          className="skipped-table"
          rowKey="id"
          columns={SKIPPED_COLUMNS}
          dataSource={skippedEntries}
          plugins={SKIPPED_TABLE_PLUGINS}
          height="100%"
          size="small"
          bordered
          striped
          virtual
          stickyHeader
          emptyText="当前没有跳过的文件或文件夹"
        />
      </Drawer>
      </div>
    </WindowFrame>
  );
}

import type { DiskVolume, ScanBatch, ScanNodeRecord } from "./types";

export const isDesktopRuntime = Boolean(window.__TAURI__?.core?.invoke);

const DEMO_VOLUMES: DiskVolume[] = [
  {
    path: "C:\\",
    name: "Windows",
    fileSystem: "NTFS",
    driveType: "本地磁盘",
    totalBytes: 512 * 1024 ** 3,
    freeBytes: 178.4 * 1024 ** 3,
  },
  {
    path: "D:\\",
    name: "Data",
    fileSystem: "NTFS",
    driveType: "本地磁盘",
    totalBytes: 1024 * 1024 ** 3,
    freeBytes: 621.8 * 1024 ** 3,
  },
];

export async function listVolumes() {
  if (!isDesktopRuntime) return DEMO_VOLUMES;
  return window.__TAURI__!.core.invoke<DiskVolume[]>("list_volumes");
}

export async function chooseDirectory(initialPath?: string) {
  if (!isDesktopRuntime) return "C:\\Users\\Demo\\AppData\\Local";
  return window.__TAURI__!.core.invoke<string | null>("choose_directory", { initialPath });
}

export async function startNativeScan(path: string) {
  return window.__TAURI__!.core.invoke<number>("start_scan", { path });
}

export async function cancelNativeScan(scanId: number) {
  return window.__TAURI__!.core.invoke<boolean>("cancel_scan", { scanId });
}

export async function runDiskEntryAction(action: "open" | "reveal" | "properties", path: string) {
  if (!isDesktopRuntime) throw new Error("浏览器演示模式不支持系统文件操作");
  return window.__TAURI__!.core.invoke<void>("disk_entry_action", { action, path });
}

export async function listenToScan(handler: (batch: ScanBatch) => void) {
  if (!window.__TAURI__) return () => undefined;
  return window.__TAURI__.event.listen<ScanBatch>("sia://disk-scan", ({ payload }) => handler(payload));
}

interface DemoSeed {
  path: string;
  size: number;
  children?: DemoSeed[];
}

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

const DEMO_TREE: DemoSeed[] = [
  {
    path: "Program Files",
    size: 0,
    children: [
      {
        path: "dotnet",
        size: 0,
        children: [
          {
            path: "packs",
            size: 0,
            children: [
              { path: "Microsoft.NETCore.App.Ref", size: 1.72 * GIB },
              { path: "Microsoft.NETCore.App.Runtime.win-x64", size: 1.21 * GIB },
              { path: "Microsoft.WindowsDesktop.App.Ref", size: 932 * MIB },
              { path: "Microsoft.AspNetCore.App.Ref", size: 708 * MIB },
              { path: "NETStandard.Library.Ref", size: 354 * MIB },
              { path: "Microsoft.NETCore.App.Host.win-x64", size: 280 * MIB },
              { path: "Microsoft.WindowsDesktop.App.Runtime", size: 1.08 * GIB },
              { path: "Microsoft.AspNetCore.App.Runtime", size: 842 * MIB },
            ],
          },
          { path: "shared", size: 1.7 * GIB },
          { path: "sdk", size: 1.2 * GIB },
          { path: "host", size: 186 * MIB },
        ],
      },
      { path: "Microsoft Office", size: 4.3 * GIB },
      { path: "MySQL", size: 2.6 * GIB },
      { path: "Microsoft Visual Studio", size: 10.1 * GIB },
      { path: "MobileAppEngine", size: 6.8 * GIB },
      { path: "Tencent", size: 2.2 * GIB },
      { path: "Common Files", size: 1.1 * GIB },
      { path: "Google", size: 503 * MIB },
    ],
  },
  {
    path: "Program Files (x86)",
    size: 0,
    children: [
      { path: "Microsoft", size: 4.2 * GIB },
      { path: "dotnet", size: 2.2 * GIB },
      { path: "DingDing", size: 2.8 * GIB },
      { path: "Microsoft SDKs", size: 937 * MIB },
      { path: "Google", size: 532 * MIB },
      { path: "Android", size: 454 * MIB },
    ],
  },
  { path: "hiberfil.sys", size: 12.6 * GIB },
  {
    path: "Users",
    size: 0,
    children: [
      { path: "Downloads", size: 6.4 * GIB },
      { path: "AppData", size: 8.8 * GIB },
      { path: "Documents", size: 2.7 * GIB },
      { path: "Pictures", size: 1.9 * GIB },
    ],
  },
  { path: "$WINDOWS.~BT", size: 604 * MIB },
  { path: "pagefile.sys", size: 4.1 * GIB },
];

function flattenDemoTree(rootPath: string) {
  let nextId = 1;
  const records: ScanNodeRecord[] = [];
  const rootId = nextId++;
  records.push({
    id: rootId,
    parentId: null,
    name: rootPath,
    path: rootPath,
    kind: "directory",
    size: 0,
    completed: false,
    unreadable: false,
  });

  function addSeeds(seeds: DemoSeed[], parentId: number, parentPath: string): number {
    return seeds.reduce((total, seed) => {
      const id = nextId++;
      const path = `${parentPath.replace(/[\\/]$/, "")}\\${seed.path}`;
      const kind = seed.children ? "directory" : seed.path.includes(".") ? "file" : "directory";
      const record: ScanNodeRecord = {
        id,
        parentId,
        name: seed.path,
        path,
        kind,
        size: seed.size,
        completed: !seed.children,
        unreadable: false,
      };
      records.push(record);
      if (seed.children) {
        record.size = addSeeds(seed.children, id, path);
        record.completed = true;
      }
      return total + record.size;
    }, 0);
  }

  records[0]!.size = addSeeds(DEMO_TREE, rootId, rootPath);
  records[0]!.completed = true;
  return records;
}

export function startDemoScan(path: string, handler: (batch: ScanBatch) => void) {
  const scanId = Date.now();
  const records = flattenDemoTree(path);
  const directoryTotals = new Map(records.filter((record) => record.kind === "directory").map((record) => [record.id, record.size]));
  const visible = new Map<number, ScanNodeRecord>();
  let index = 0;
  let scannedBytes = 0;
  let processedFiles = 0;
  let processedDirectories = 0;
  let cancelled = false;

  handler({
    scanId,
    phase: "started",
    rootPath: path,
    nodes: [],
    processedFiles: 0,
    processedDirectories: 0,
    scannedBytes: 0,
    errors: 0,
    skipped: [],
    currentPath: path,
  });

  const timer = window.setInterval(() => {
    if (cancelled) return;
    const discovered = records.slice(index, index + 4).map((record) => {
      const next = { ...record };
      if (next.kind === "directory") {
        next.size = Math.max(0, (directoryTotals.get(next.id) ?? 0) * Math.min(1, (index + 4) / records.length));
        next.completed = index + 4 >= records.length;
        processedDirectories += 1;
      } else {
        scannedBytes += next.size;
        processedFiles += 1;
      }
      visible.set(next.id, next);
      return next;
    });
    index += discovered.length;
    const directoryUpdates = [...visible.values()]
      .filter((record) => record.kind === "directory")
      .map((record) => ({
        ...record,
        size: (directoryTotals.get(record.id) ?? 0) * Math.min(1, index / records.length),
        completed: index >= records.length,
      }));
    handler({
      scanId,
      phase: index >= records.length ? "completed" : "scanning",
      rootPath: path,
      nodes: [...discovered, ...directoryUpdates],
      processedFiles,
      processedDirectories,
      scannedBytes: index >= records.length ? records[0]!.size : scannedBytes,
      errors: 0,
      skipped: [],
      currentPath: discovered.at(-1)?.path ?? path,
    });
    if (index >= records.length) window.clearInterval(timer);
  }, 80);

  return {
    scanId,
    cancel() {
      cancelled = true;
      window.clearInterval(timer);
      handler({
        scanId,
        phase: "cancelled",
        rootPath: path,
        nodes: [],
        processedFiles,
        processedDirectories,
        scannedBytes,
        errors: 0,
        skipped: [],
      });
    },
  };
}

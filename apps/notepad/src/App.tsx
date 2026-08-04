import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Editor,
  Icon,
  Input,
  Markdown,
  Modal,
  Segmented,
  Splitter,
  ThemeSwitch,
  Tooltip,
  Tree,
  WindowFrame,
  WindowTitleBar,
  applySiaTheme,
  message,
  type EditorContextMenuItem,
  type MenuItem,
  type TreeDropPosition,
  type TreeKey,
  type TreeNode,
  type WindowAction,
} from "@sia-ui/react";
import { readText as readClipboardText } from "@tauri-apps/plugin-clipboard-manager";
import {
  createWelcomeSnapshot,
  loadNotebook,
  saveNotebook,
  type Note,
  type NoteLanguage,
  type NotebookSnapshot,
  type TextFileEncoding,
  type VirtualTreeFolder,
} from "./notebookStorage";
import {
  LANGUAGE_LABELS,
  LANGUAGE_OPTIONS,
  defaultExtensionForLanguage,
  isNoteLanguage,
  languageFromFilename,
  monacoLanguageForNoteLanguage,
} from "./languages";
import { FORMATTABLE_LANGUAGES, formatText } from "./textFormatter";

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const ROOT_TREE_PARENT_KEY = "tree:root";
const MemoizedTree = memo(Tree);

interface DecodedText {
  content: string;
  encoding: TextFileEncoding;
}

interface ExternalFileReadResult {
  bytes: number[];
  modifiedAt: number | null;
}

interface ExternalFileWriteResult {
  path: string;
  modifiedAt: number;
}

interface FolderEntryResult {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface FolderTreeItem extends FolderEntryResult {
  loaded: boolean;
  children?: FolderTreeItem[];
}

const NOTE_ACTIONS: readonly MenuItem[] = [
  { key: "pin", icon: <Icon name="pin" size={15} />, label: "固定 / 取消固定" },
  { key: "duplicate", icon: <Icon name="copy" size={15} />, label: "创建副本" },
  { key: "export", icon: <Icon name="download" size={15} />, label: "导出为 TXT" },
  { key: "divider", type: "divider" },
  { key: "delete", icon: <Icon name="trash" size={15} />, label: "删除笔记", danger: true },
];

const NEW_NOTE_MENU_ITEMS: readonly MenuItem[] = [
  { key: "open-file", icon: <Icon name="notepad-file" size={15} />, label: "打开文件" },
  { key: "open-folder", icon: <Icon name="notepad-folder" size={15} />, label: "打开文件夹" },
];

const NOTE_CONTEXT_ACTIONS: readonly MenuItem[] = [
  { key: "save", label: "保存", extra: "Ctrl+S" },
  { key: "restore", label: "还原为源数据" },
  { key: "close", label: "关闭当前文档", extra: "Ctrl+W" },
  { key: "close-others", label: "除此之外全部关闭" },
  { key: "open-folder", label: "打开所在文件夹" },
  { key: "context-divider", type: "divider" },
  { key: "copy-path", label: "拷贝文件路径到剪贴板", extra: "Ctrl+Shift+C" },
  { key: "rename", label: "重命名当前文件" },
  { key: "save-as", label: "当前文件另存为" },
];

const FOLDER_CONTEXT_ACTIONS: readonly MenuItem[] = [
  { key: "close-files", label: "关闭其下所有文件" },
  { key: "folder-files-divider", type: "divider" },
  { key: "close", label: "关闭" },
  { key: "close-others", label: "除此之外全关闭" },
  { key: "open-folder", label: "打开所在文件夹" },
  { key: "folder-context-divider", type: "divider" },
  { key: "copy-path", label: "拷贝文件夹路径到剪贴板" },
  { key: "rename", label: "重命名当前文件夹" },
];

const VIRTUAL_FOLDER_CONTEXT_ACTIONS: readonly MenuItem[] = [
  { key: "close-files", label: "关闭其下所有文件" },
  { key: "virtual-folder-files-divider", type: "divider" },
  { key: "rename", label: "重命名虚拟文件夹" },
  { key: "dissolve", label: "解散虚拟文件夹" },
];

const EDITOR_CONTEXT_MENU: readonly EditorContextMenuItem[] = [
  { key: "cut", label: "剪切", command: "cut", disabled: (editor) => !editor?.getSelectedText() },
  { key: "copy", label: "复制", command: "copy", disabled: (editor) => !editor?.getSelectedText() },
  {
    key: "paste",
    label: "粘贴",
    shortcut: "Ctrl+V",
    disabled: (editor) => !editor || !window.__TAURI__?.core?.invoke,
    onClick: async (editor) => {
      try {
        editor.insertBlock(await readClipboardText());
      } catch (error) {
        message.error(`读取系统剪贴板失败：${error instanceof Error ? error.message : String(error)}`);
      }
    },
  },
  { key: "selectAll", label: "全选", command: "selectAll", disabled: (editor) => !editor?.getValue() },
];

const LANGUAGE_MENU_ITEMS: readonly MenuItem[] = LANGUAGE_OPTIONS.map(({ key, label }) => ({ key, label }));
const MARKDOWN_VIEW_OPTIONS = [
  { label: "编辑", value: "edit" },
  { label: "预览", value: "preview" },
] as const;

function decodeTextBytes(bytes: Uint8Array): DecodedText {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { content: new TextDecoder("utf-8").decode(bytes), encoding: "utf-8-bom" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { content: new TextDecoder("utf-16le").decode(bytes), encoding: "utf-16le" };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { content: new TextDecoder("utf-16be").decode(bytes), encoding: "utf-16be" };
  }
  try {
    return { content: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { content: new TextDecoder("gb18030").decode(bytes), encoding: "gb18030" };
  }
}

async function readTextFile(file: File): Promise<DecodedText> {
  return decodeTextBytes(new Uint8Array(await file.arrayBuffer()));
}

function filenameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function normalizedSourcePath(path: string): string {
  return path.replace(/\//g, "\\").toLocaleLowerCase("en-US");
}

function folderTreeKey(path: string): string {
  return `folder:${normalizedSourcePath(path)}`;
}

function noteTreeKey(id: string): string {
  return `note:${id}`;
}

function virtualFolderTreeKey(id: string): string {
  return `virtual-folder:${id}`;
}

function isPathInsideFolder(path: string, folderPath: string): boolean {
  const normalizedPath = normalizedSourcePath(path);
  const normalizedFolder = normalizedSourcePath(folderPath).replace(/\\+$/u, "");
  return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}\\`);
}

function createFolderTreeItems(entries: FolderEntryResult[]): FolderTreeItem[] {
  return entries.map((entry) => ({ ...entry, loaded: !entry.isDirectory }));
}

function replaceFolderTreeItem(
  item: FolderTreeItem,
  path: string,
  children: FolderTreeItem[],
): FolderTreeItem {
  if (normalizedSourcePath(item.path) === normalizedSourcePath(path)) {
    return { ...item, loaded: true, children };
  }
  if (!item.children?.length) return item;
  return { ...item, children: item.children.map((child) => replaceFolderTreeItem(child, path, children)) };
}

function renameFolderTreeItem(item: FolderTreeItem, previousPath: string, nextPath: string): FolderTreeItem {
  if (normalizedSourcePath(item.path) === normalizedSourcePath(previousPath)) {
    return { ...item, name: filenameFromPath(nextPath), path: nextPath };
  }
  if (!item.children?.length) return item;
  return {
    ...item,
    children: item.children.map((child) => renameFolderTreeItem(child, previousPath, nextPath)),
  };
}

function replacePathPrefix(path: string, previousPath: string, nextPath: string): string {
  if (!isPathInsideFolder(path, previousPath)) return path;
  return `${nextPath}${path.slice(previousPath.length)}`;
}

function renameFolderTreeBranch(item: FolderTreeItem, previousPath: string, nextPath: string): FolderTreeItem {
  const path = replacePathPrefix(item.path, previousPath, nextPath);
  return {
    ...item,
    name: normalizedSourcePath(item.path) === normalizedSourcePath(previousPath)
      ? filenameFromPath(nextPath)
      : item.name,
    path,
    children: item.children?.map((child) => renameFolderTreeBranch(child, previousPath, nextPath)),
  };
}

function removeFolderTreeItem(item: FolderTreeItem, path: string): FolderTreeItem | null {
  if (normalizedSourcePath(item.path) === normalizedSourcePath(path)) return null;
  return {
    ...item,
    children: item.children
      ?.map((child) => removeFolderTreeItem(child, path))
      .filter((child): child is FolderTreeItem => child !== null),
  };
}

function contentHash(content: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < content.length; index += 1) {
    const code = content.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${content.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

const EDITOR_OPTIONS = {
  lineNumbers: "on" as const,
  selectOnLineNumbers: true,
  glyphMargin: false,
  folding: false,
  lineDecorationsWidth: 8,
  lineNumbersMinChars: 3,
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: "none" as const,
  minimap: {
    enabled: true,
    side: "right" as const,
    size: "fit" as const,
    showSlider: "always" as const,
    renderCharacters: true,
    maxColumn: 100,
    scale: 1,
  },
  stickyScroll: { enabled: false },
  wordWrap: "on" as const,
  scrollBeyondLastLine: false,
  fontFamily: '"Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
  fontSize: 14,
  lineHeight: 28,
  tabSize: 2,
  insertSpaces: true,
  padding: { top: 0, bottom: 28 },
  scrollbar: { verticalScrollbarSize: 7, horizontalScrollbarSize: 7 },
};

function noteDisplayTitle(note: Note): string {
  return note.title.trim() || "无标题笔记";
}

function safeFilename(title: string): string {
  const result = title.replace(/[\\/:*?"<>|]/g, "-").trim();
  return result || "无标题笔记";
}

function downloadNote(note: Note, extension = "txt") {
  const blob = new Blob(["\uFEFF", note.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(noteDisplayTitle(note))}.${extension}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function noteFileExtension(note: Note): string {
  return defaultExtensionForLanguage(note.language ?? "plaintext");
}

export default function App() {
  const initialSnapshot = useRef(createWelcomeSnapshot()).current;
  const initialWorkspaceFolderPaths = initialSnapshot.workspaceFolderPaths
    ?? (initialSnapshot.workspaceFolderPath ? [initialSnapshot.workspaceFolderPath] : []);
  const [notes, setNotes] = useState<Note[]>(initialSnapshot.notes);
  const [openNoteIds, setOpenNoteIds] = useState<string[]>(initialSnapshot.openNoteIds);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(initialSnapshot.activeNoteId);
  const [darkMode, setDarkMode] = useState(initialSnapshot.darkMode);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSnapshot.sidebarCollapsed);
  const [sidebarWidthPercent, setSidebarWidthPercent] = useState(initialSnapshot.sidebarWidthPercent ?? 22);
  const [workspaceFolderPaths, setWorkspaceFolderPaths] = useState<string[]>(initialWorkspaceFolderPaths);
  const [closedFolderPaths, setClosedFolderPaths] = useState<string[]>(initialSnapshot.closedFolderPaths ?? []);
  const [folderRoots, setFolderRoots] = useState<FolderTreeItem[]>([]);
  const [virtualFolders, setVirtualFolders] = useState<VirtualTreeFolder[]>(initialSnapshot.virtualFolders ?? []);
  const [treeOrderByParent, setTreeOrderByParent] = useState<Record<string, string[]>>(initialSnapshot.treeOrderByParent ?? {});
  const [expandedTreeKeys, setExpandedTreeKeys] = useState<TreeKey[]>([]);
  const [searchText, setSearchText] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [formattingNoteId, setFormattingNoteId] = useState<string | null>(null);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const notesRef = useRef(notes);
  const saveGeneration = useRef(0);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startupFilesHandledRef = useRef(false);
  const sourceDifferencesCheckedRef = useRef(false);
  const markdownImageCacheRef = useRef(new Map<string, Promise<string>>());
  const folderLoadInFlightRef = useRef(new Set<string>());

  notesRef.current = notes;

  useEffect(() => {
    const preventDefaultContextMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("contextmenu", preventDefaultContextMenu);
    return () => document.removeEventListener("contextmenu", preventDefaultContextMenu);
  }, []);

  const noteMap = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const sidebarNotesRef = useRef(notes);
  const sidebarSearchTextRef = useRef(searchText);
  const sidebarNotesChanged = sidebarSearchTextRef.current !== searchText
    || sidebarNotesRef.current.length !== notes.length
    || notes.some((note, index) => {
      const previous = sidebarNotesRef.current[index];
      return !previous
        || previous.id !== note.id
        || previous.title !== note.title
        || previous.pinned !== note.pinned
        || previous.sourcePath !== note.sourcePath
        || previous.sourceDirty !== note.sourceDirty
        || (searchText.trim() !== "" && previous.content !== note.content);
    });
  if (sidebarNotesChanged) {
    sidebarNotesRef.current = notes;
    sidebarSearchTextRef.current = searchText;
  }
  const sidebarNotes = sidebarNotesRef.current;
  const noteBySourcePath = useMemo(() => new Map(
    sidebarNotes
      .filter((note) => note.sourcePath)
      .map((note) => [normalizedSourcePath(note.sourcePath!), note]),
  ), [sidebarNotes]);
  const openNoteIdSet = useMemo(() => new Set(openNoteIds), [openNoteIds]);
  const activeNote = activeNoteId ? noteMap.get(activeNoteId) ?? null : null;
  const visibleNotes = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase("zh-CN");
    return sidebarNotes
      .filter((note) => openNoteIdSet.has(note.id)
        && (!query
          || note.title.toLocaleLowerCase("zh-CN").includes(query)
          || note.content.toLocaleLowerCase("zh-CN").includes(query)))
      .sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.updatedAt - left.updatedAt);
  }, [openNoteIdSet, searchText, sidebarNotes]);

  useEffect(() => {
    let cancelled = false;
    void loadNotebook()
      .then((stored) => {
        if (cancelled) return;
        const snapshot = stored ?? initialSnapshot;
        const validIds = new Set(snapshot.notes.map((note) => note.id));
        const restoredOpenIds = snapshot.openNoteIds.filter((id) => validIds.has(id));
        const restoredActiveId = snapshot.activeNoteId && restoredOpenIds.includes(snapshot.activeNoteId)
          ? snapshot.activeNoteId
          : restoredOpenIds[0] ?? null;
        setNotes(snapshot.notes);
        setOpenNoteIds(restoredOpenIds);
        setActiveNoteId(restoredActiveId);
        setDarkMode(snapshot.darkMode);
        setSidebarCollapsed(snapshot.sidebarCollapsed);
        setSidebarWidthPercent(snapshot.sidebarWidthPercent ?? 22);
        setWorkspaceFolderPaths(snapshot.workspaceFolderPaths
          ?? (snapshot.workspaceFolderPath ? [snapshot.workspaceFolderPath] : []));
        setClosedFolderPaths(snapshot.closedFolderPaths ?? []);
        setVirtualFolders(snapshot.virtualFolders ?? []);
        setTreeOrderByParent(snapshot.treeOrderByParent ?? {});
        applySiaTheme(snapshot.darkMode ? "dark" : "light");
        setHydrated(true);
        setSaveState("saved");
      })
      .catch((error) => {
        if (cancelled) return;
        setHydrated(true);
        setSaveState("error");
        message.error(`读取笔记失败：${error instanceof Error ? error.message : String(error)}`);
      });
    return () => { cancelled = true; };
  }, [initialSnapshot]);

  useEffect(() => {
    if (!hydrated) return undefined;
    const generation = ++saveGeneration.current;
    setSaveState("pending");
    const snapshot: NotebookSnapshot = {
      version: 1,
      notes,
      openNoteIds,
      activeNoteId,
      darkMode,
      sidebarCollapsed,
      sidebarWidthPercent,
      workspaceFolderPath: workspaceFolderPaths[0],
      workspaceFolderPaths,
      closedFolderPaths,
      virtualFolders,
      treeOrderByParent,
    };
    let cancelIdleSave: () => void = () => undefined;
    const saveWhenIdle = () => {
      if (saveGeneration.current !== generation) return;
      setSaveState("saving");
      void saveNotebook(snapshot)
        .then(() => {
          if (saveGeneration.current === generation) setSaveState("saved");
        })
        .catch((error) => {
          if (saveGeneration.current !== generation) return;
          setSaveState("error");
          message.error(`自动保存失败：${error instanceof Error ? error.message : String(error)}`);
        });
    };
    const timer = window.setTimeout(() => {
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
      };
      if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
        const handle = idleWindow.requestIdleCallback(saveWhenIdle, { timeout: 1200 });
        cancelIdleSave = () => idleWindow.cancelIdleCallback?.(handle);
        return;
      }
      const handle = window.setTimeout(saveWhenIdle, 0);
      cancelIdleSave = () => window.clearTimeout(handle);
    }, 900);
    return () => {
      window.clearTimeout(timer);
      cancelIdleSave();
    };
  }, [activeNoteId, closedFolderPaths, darkMode, hydrated, notes, openNoteIds, sidebarCollapsed, sidebarWidthPercent, treeOrderByParent, virtualFolders, workspaceFolderPaths]);

  useEffect(() => {
    applySiaTheme(darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!hydrated || sourceDifferencesCheckedRef.current || !window.__TAURI__?.core?.invoke) return;
    sourceDifferencesCheckedRef.current = true;
    let cancelled = false;
    const sourceNotes = notes.filter((note) => note.sourcePath);

    void Promise.all(sourceNotes.map(async (note) => {
      try {
        const result = await window.__TAURI__!.core.invoke<ExternalFileReadResult>("read_external_file", {
          path: note.sourcePath,
        });
        const sourceContent = decodeTextBytes(new Uint8Array(result.bytes)).content;
        return {
          id: note.id,
          sourceContent,
          sourceContentHash: contentHash(sourceContent),
          sourceModifiedAt: result.modifiedAt ?? undefined,
        };
      } catch {
        return null;
      }
    })).then((comparisons) => {
      if (cancelled) return;
      const comparisonMap = new Map(comparisons.filter((item) => item !== null).map((item) => [item.id, item]));
      if (!comparisonMap.size) return;
      setNotes((current) => current.map((note) => {
        const comparison = comparisonMap.get(note.id);
        if (!comparison) return note;
        const sourceDirty = note.content !== comparison.sourceContent;
        return {
          ...note,
          sourceContentHash: comparison.sourceContentHash,
          sourceDirty,
          sourceModifiedAt: sourceDirty ? note.sourceModifiedAt : comparison.sourceModifiedAt,
        };
      }));
    });

    return () => { cancelled = true; };
  }, [hydrated, notes]);

  const openNote = useCallback((id: string) => {
    setOpenNoteIds((current) => current.includes(id) ? current : [...current, id]);
    setActiveNoteId(id);
  }, []);

  const createNote = useCallback(() => {
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      content: "",
      pinned: false,
      language: "plaintext",
      wordWrap: true,
      markdownView: "edit",
      createdAt: now,
      updatedAt: now,
    };
    setNotes((current) => [note, ...current]);
    setOpenNoteIds((current) => [...current, note.id]);
    setActiveNoteId(note.id);
    window.setTimeout(() => titleInputRef.current?.focus(), 0);
  }, []);

  const importTextFile = useCallback((filename: string, content: string) => {
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      title: filename,
      content,
      pinned: false,
      language: languageFromFilename(filename),
      wordWrap: true,
      markdownView: "edit",
      createdAt: now,
      updatedAt: now,
    };
    setNotes((current) => [note, ...current]);
    setOpenNoteIds((current) => [...current, note.id]);
    setActiveNoteId(note.id);
    message.success(`已打开 ${filename}`);
  }, []);

  const openFile = useCallback(async (file: File) => {
    try {
      const decoded = await readTextFile(file);
      importTextFile(file.name, decoded.content);
    } catch (error) {
      message.error(`打开文件失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }, [importTextFile]);

  const openExternalPaths = useCallback(async (paths: string[], announce = true) => {
    const uniquePaths = [...new Map(paths.map((path) => [normalizedSourcePath(path), path])).values()];
    for (const path of uniquePaths) {
      const filename = filenameFromPath(path);
      try {
        const result = await window.__TAURI__!.core.invoke<ExternalFileReadResult>("read_external_file", { path });
        const decoded = decodeTextBytes(new Uint8Array(result.bytes));
        const cachedNote = notes.find((note) => note.sourcePath
          && normalizedSourcePath(note.sourcePath) === normalizedSourcePath(path));

        if (cachedNote) {
          if (!cachedNote.sourceDirty) {
            setNotes((current) => current.map((note) => note.id === cachedNote.id ? {
              ...note,
              title: filename,
              content: decoded.content,
              language: languageFromFilename(filename),
              sourceEncoding: decoded.encoding,
              sourceModifiedAt: result.modifiedAt ?? undefined,
              sourceContentHash: contentHash(decoded.content),
              sourceDirty: false,
              updatedAt: note.content !== decoded.content ? Date.now() : note.updatedAt,
            } : note));
          } else {
            const sourceDirty = cachedNote.content !== decoded.content;
            setNotes((current) => current.map((note) => note.id === cachedNote.id ? {
              ...note,
              sourceContentHash: contentHash(decoded.content),
              sourceDirty,
              sourceModifiedAt: sourceDirty ? note.sourceModifiedAt : result.modifiedAt ?? undefined,
            } : note));
          }
          openNote(cachedNote.id);
        } else {
          const now = Date.now();
          const note: Note = {
            id: crypto.randomUUID(),
            title: filename,
            content: decoded.content,
            pinned: false,
            language: languageFromFilename(filename),
            wordWrap: true,
            markdownView: "edit",
            sourcePath: path,
            sourceEncoding: decoded.encoding,
            sourceModifiedAt: result.modifiedAt ?? undefined,
            sourceContentHash: contentHash(decoded.content),
            sourceDirty: false,
            createdAt: now,
            updatedAt: now,
          };
          setNotes((current) => [note, ...current]);
          setOpenNoteIds((current) => current.includes(note.id) ? current : [...current, note.id]);
          setActiveNoteId(note.id);
        }
        if (announce) message.success(`已打开 ${filename}`);
      } catch (error) {
        message.error(`打开 ${filename} 失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }, [notes, openNote]);

  const openExternalPathsRef = useRef(openExternalPaths);
  useEffect(() => { openExternalPathsRef.current = openExternalPaths; }, [openExternalPaths]);

  useEffect(() => {
    if (!hydrated || startupFilesHandledRef.current || !window.__TAURI__?.core?.invoke) return undefined;
    startupFilesHandledRef.current = true;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const openPendingFiles = async () => {
      try {
        const paths = await window.__TAURI__!.core.invoke<string[]>("take_pending_open_files");
        if (!cancelled && paths.length) await openExternalPathsRef.current(paths);
      } catch (error) {
        if (!cancelled) {
          message.error(`读取启动文件失败：${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };

    const eventApi = window.__TAURI__.event;
    if (eventApi) {
      void eventApi.listen("open-files-pending", () => { void openPendingFiles(); })
        .then((stopListening) => {
          if (cancelled) {
            stopListening();
            return;
          }
          unlisten = stopListening;
          void openPendingFiles();
        });
    } else {
      void openPendingFiles();
    }

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [hydrated]);

  const chooseExternalFiles = useCallback(async () => {
    if (!window.__TAURI__?.core?.invoke) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const paths = await window.__TAURI__.core.invoke<string[]>("pick_text_files");
      if (paths.length) await openExternalPathsRef.current(paths);
    } catch (error) {
      message.error(`打开文件失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  const loadWorkspaceFolder = useCallback(async (path: string, announce = false) => {
    if (!window.__TAURI__?.core?.invoke) return;
    const normalizedPath = normalizedSourcePath(path);
    if (folderLoadInFlightRef.current.has(normalizedPath)) return;
    folderLoadInFlightRef.current.add(normalizedPath);
    try {
      const entries = await window.__TAURI__.core.invoke<FolderEntryResult[]>("list_directory", { path });
      const root: FolderTreeItem = {
        name: filenameFromPath(path),
        path,
        isDirectory: true,
        loaded: true,
        children: createFolderTreeItems(entries),
      };
      setWorkspaceFolderPaths((current) => current.some((item) => normalizedSourcePath(item) === normalizedSourcePath(path))
        ? current
        : [...current, path]);
      setClosedFolderPaths((current) => current.filter((item) => normalizedSourcePath(item) !== normalizedSourcePath(path)));
      setFolderRoots((current) => {
        const existingIndex = current.findIndex((item) => normalizedSourcePath(item.path) === normalizedSourcePath(path));
        if (existingIndex < 0) return [...current, root];
        return current.map((item, index) => index === existingIndex ? root : item);
      });
      setExpandedTreeKeys((current) => [...new Set([
        ...current,
        folderTreeKey(path),
      ])]);
      if (announce) message.success(`已打开文件夹 ${root.name}`);
    } catch (error) {
      message.error(`打开文件夹失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      folderLoadInFlightRef.current.delete(normalizedPath);
    }
  }, []);

  const chooseWorkspaceFolder = useCallback(async () => {
    if (!window.__TAURI__?.core?.invoke) {
      message.warning("浏览器预览模式无法打开本地文件夹");
      return;
    }
    try {
      const path = await window.__TAURI__.core.invoke<string | null>("pick_folder");
      if (path) await loadWorkspaceFolder(path, true);
    } catch (error) {
      message.error(`选择文件夹失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }, [loadWorkspaceFolder]);

  const loadFolderTreeNode = useCallback(async (node: TreeNode) => {
    if (!window.__TAURI__?.core?.invoke || typeof node.path !== "string") return;
    try {
      const entries = await window.__TAURI__.core.invoke<FolderEntryResult[]>("list_directory", { path: node.path });
      const children = createFolderTreeItems(entries);
      setFolderRoots((current) => current.map((root) => replaceFolderTreeItem(root, node.path as string, children)));
    } catch (error) {
      message.error(`读取文件夹失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const loadedPaths = new Set(folderRoots.map((root) => normalizedSourcePath(root.path)));
    workspaceFolderPaths.forEach((path) => {
      if (!loadedPaths.has(normalizedSourcePath(path))) void loadWorkspaceFolder(path);
    });
  }, [folderRoots, hydrated, loadWorkspaceFolder, workspaceFolderPaths]);

  const closeTab = useCallback((id: string) => {
    setOpenNoteIds((current) => {
      const closingIndex = current.indexOf(id);
      if (closingIndex < 0) return current;
      const next = current.filter((noteId) => noteId !== id);
      setActiveNoteId((activeId) => {
        if (activeId !== id) return activeId;
        return current[closingIndex - 1] ?? current[closingIndex + 1] ?? null;
      });
      return next;
    });
  }, []);

  const closeOpenNotes = useCallback((ids: readonly string[]) => {
    const closingIds = new Set(ids);
    if (!closingIds.size) return;
    setOpenNoteIds((current) => {
      const next = current.filter((id) => !closingIds.has(id));
      setActiveNoteId((activeId) => activeId && closingIds.has(activeId) ? next[0] ?? null : activeId);
      return next;
    });
  }, []);

  const requestCloseNoteGroup = useCallback((label: string, ids: readonly string[]) => {
    const idSet = new Set(ids);
    const affectedNotes = notes.filter((note) => openNoteIdSet.has(note.id) && idSet.has(note.id));
    if (!affectedNotes.length) return;
    const closeFiles = () => closeOpenNotes(affectedNotes.map((note) => note.id));
    const dirtyNotes = affectedNotes.filter((note) => note.sourcePath && note.sourceDirty);
    if (!dirtyNotes.length) {
      closeFiles();
      return;
    }
    Modal.confirm({
      title: "关闭其下所有文件",
      children: `“${label}”中有 ${dirtyNotes.length} 个文件与源文件存在差异。关闭后更改仍会保留在本地缓存中，确定关闭吗？`,
      okText: "仍然关闭",
      onOk: closeFiles,
    });
  }, [closeOpenNotes, notes, openNoteIdSet]);

  const requestCloseTab = useCallback((id: string) => {
    const note = noteMap.get(id);
    if (!note) return;
    if (!note.sourcePath || !note.sourceDirty) {
      closeTab(id);
      return;
    }
    Modal.confirm({
      title: "关闭当前文档",
      children: `“${noteDisplayTitle(note)}”与源文件存在差异。关闭后更改仍会保留在本地缓存中，确定关闭吗？`,
      okText: "仍然关闭",
      onOk: () => closeTab(id),
    });
  }, [closeTab, noteMap]);

  const updateActiveNote = useCallback((patch: Partial<Pick<Note, "title" | "content" | "language" | "wordWrap" | "markdownView">>) => {
    if (!activeNoteId) return;
    setNotes((current) => current.map((note) => {
      if (note.id !== activeNoteId) return note;
      const contentChanged = patch.content !== undefined && patch.content !== note.content;
      return {
        ...note,
        ...patch,
        sourceDirty: note.sourcePath && contentChanged
          ? note.sourceContentHash
            ? contentHash(patch.content!) !== note.sourceContentHash
            : true
          : note.sourceDirty,
        updatedAt: contentChanged ? Date.now() : note.updatedAt,
      };
    }));
  }, [activeNoteId]);

  const togglePin = useCallback((id: string) => {
    setNotes((current) => current.map((note) => note.id === id ? { ...note, pinned: !note.pinned } : note));
  }, []);

  const duplicateNote = useCallback((id: string) => {
    const source = noteMap.get(id);
    if (!source) return;
    const now = Date.now();
    const copy: Note = {
      ...source,
      id: crypto.randomUUID(),
      title: `${noteDisplayTitle(source)} - 副本`,
      pinned: false,
      sourcePath: undefined,
      sourceEncoding: undefined,
      sourceModifiedAt: undefined,
      sourceContentHash: undefined,
      sourceDirty: undefined,
      createdAt: now,
      updatedAt: now,
    };
    setNotes((current) => [copy, ...current]);
    setOpenNoteIds((current) => [...current, copy.id]);
    setActiveNoteId(copy.id);
  }, [noteMap]);

  const deleteNote = useCallback((id: string) => {
    const note = noteMap.get(id);
    if (!note) return;
    Modal.confirm({
      title: "删除笔记",
      children: `确定删除“${noteDisplayTitle(note)}”吗？此操作无法撤销。`,
      okText: "删除",
      okButtonProps: { danger: true },
      onOk: () => {
        setNotes((current) => current.filter((item) => item.id !== id));
        const treeKey = noteTreeKey(id);
        setVirtualFolders((current) => current
          .map((folder) => ({ ...folder, childKeys: folder.childKeys.filter((key) => key !== treeKey) }))
          .filter((folder) => folder.childKeys.length >= 2));
        closeTab(id);
        message.success("笔记已删除");
      },
    });
  }, [closeTab, noteMap]);

  const handleNoteAction = useCallback((key: string, id: string) => {
    const note = noteMap.get(id);
    if (!note) return;
    if (key === "pin") togglePin(id);
    if (key === "duplicate") duplicateNote(id);
    if (key === "export") {
      downloadNote(note);
      message.success("已导出 TXT 文件");
    }
    if (key === "delete") deleteNote(id);
  }, [deleteNote, duplicateNote, noteMap, togglePin]);

  const saveNow = useCallback(async () => {
    const generation = ++saveGeneration.current;
    setSaveState("saving");
    const snapshot: NotebookSnapshot = {
      version: 1,
      notes,
      openNoteIds,
      activeNoteId,
      darkMode,
      sidebarCollapsed,
      sidebarWidthPercent,
      workspaceFolderPath: workspaceFolderPaths[0],
      workspaceFolderPaths,
      closedFolderPaths,
      virtualFolders,
      treeOrderByParent,
    };
    try {
      await saveNotebook(snapshot);
      if (saveGeneration.current === generation) setSaveState("saved");
      return true;
    } catch (error) {
      if (saveGeneration.current === generation) setSaveState("error");
      message.error(`保存失败：${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, [activeNoteId, closedFolderPaths, darkMode, notes, openNoteIds, sidebarCollapsed, sidebarWidthPercent, treeOrderByParent, virtualFolders, workspaceFolderPaths]);

  const saveDocument = useCallback(async (id: string) => {
    const note = noteMap.get(id);
    if (!note) return false;
    if (!note.sourcePath) return saveNow();
    if (!window.__TAURI__?.core?.invoke) {
      message.error("浏览器预览模式无法写入源文件");
      return false;
    }

    setSaveState("saving");
    try {
      const result = await window.__TAURI__.core.invoke<ExternalFileWriteResult>("write_external_file", {
        path: note.sourcePath,
        fileName: note.title.trim() || filenameFromPath(note.sourcePath),
        content: note.content,
        encoding: note.sourceEncoding ?? "utf-8",
        expectedModifiedAt: note.sourceModifiedAt ?? null,
      });
      setNotes((current) => current.map((item) => item.id === id ? {
        ...item,
        sourceDirty: item.content !== note.content,
        sourcePath: result.path,
        sourceModifiedAt: result.modifiedAt,
        sourceContentHash: contentHash(note.content),
        title: filenameFromPath(result.path),
        language: languageFromFilename(result.path),
      } : item));
      if (normalizedSourcePath(result.path) !== normalizedSourcePath(note.sourcePath)) {
        setFolderRoots((current) => current.map((root) => renameFolderTreeItem(root, note.sourcePath!, result.path)));
        const previousTreeKey = folderTreeKey(note.sourcePath);
        const nextTreeKey = folderTreeKey(result.path);
        setVirtualFolders((current) => current.map((folder) => ({
          ...folder,
          childKeys: folder.childKeys.map((key) => key === previousTreeKey ? nextTreeKey : key),
        })));
      }
      setSaveState("saved");
      return true;
    } catch (error) {
      setSaveState("error");
      message.error(`保存源文件失败：${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, [noteMap, saveNow]);

  const handleNoteContextAction = useCallback(async (key: string, id: string) => {
    const note = noteMap.get(id);
    if (!note) return;

    if (key === "save") {
      if (await saveDocument(id)) message.success(note.sourcePath ? "源文件已保存" : "笔记缓存已保存");
      return;
    }
    if (key === "restore") {
      Modal.confirm({
        title: "还原为源数据",
        children: `确定将“${noteDisplayTitle(note)}”还原为源数据吗？当前缓存中的更改将被覆盖。`,
        okText: "确认还原",
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            if (note.sourcePath) {
              const result = await window.__TAURI__!.core.invoke<ExternalFileReadResult>("read_external_file", {
                path: note.sourcePath,
              });
              const decoded = decodeTextBytes(new Uint8Array(result.bytes));
              setNotes((current) => current.map((item) => item.id === id ? {
                ...item,
                title: filenameFromPath(note.sourcePath!),
                content: decoded.content,
                language: languageFromFilename(note.sourcePath!),
                sourceEncoding: decoded.encoding,
                sourceModifiedAt: result.modifiedAt ?? undefined,
                sourceContentHash: contentHash(decoded.content),
                sourceDirty: false,
                updatedAt: item.content !== decoded.content ? Date.now() : item.updatedAt,
              } : item));
              openNote(id);
              message.success("已从源文件还原");
              return;
            }
            const stored = await loadNotebook();
            const sourceNote = stored?.notes.find((item) => item.id === id);
            if (!sourceNote) {
              message.warning("没有找到可还原的源数据");
              return false;
            }
            setNotes((current) => current.map((item) => item.id === id ? sourceNote : item));
            openNote(id);
            message.success("已还原为磁盘中的源数据");
          } catch (error) {
            message.error(`还原失败：${error instanceof Error ? error.message : String(error)}`);
            return false;
          }
        },
      });
      return;
    }
    if (key === "close") {
      requestCloseTab(id);
      return;
    }
    if (key === "close-others") {
      setOpenNoteIds([id]);
      setActiveNoteId(id);
      return;
    }
    if (key === "open-folder") {
      if (!window.__TAURI__?.core?.invoke) {
        message.warning("浏览器预览模式下没有本地笔记文件夹");
        return;
      }
      try {
        if (note.sourcePath) {
          await window.__TAURI__.core.invoke<void>("open_file_directory", { path: note.sourcePath });
        } else {
          await window.__TAURI__.core.invoke<void>("open_notebook_directory");
        }
      } catch (error) {
        message.error(`打开所在文件夹失败：${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (key === "copy-path") {
      if (!window.__TAURI__?.core?.invoke) {
        message.warning("浏览器预览模式下没有本地笔记文件路径");
        return;
      }
      try {
        const path = note.sourcePath
          ?? await window.__TAURI__.core.invoke<string>("notebook_storage_path");
        await navigator.clipboard.writeText(path);
        message.success("文件路径已复制");
      } catch (error) {
        message.error(`复制路径失败：${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (key === "rename") {
      openNote(id);
      window.setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 0);
      return;
    }
    if (key === "save-as") {
      downloadNote(note, noteFileExtension(note));
      message.success("已导出当前笔记");
    }
  }, [noteMap, openNote, requestCloseTab, saveDocument]);
  const handleNoteContextActionRef = useRef(handleNoteContextAction);
  handleNoteContextActionRef.current = handleNoteContextAction;

  const closeWorkspaceFolder = useCallback((folder: FolderTreeItem, openNoteIdsToClose: readonly string[]) => {
    closeOpenNotes(openNoteIdsToClose);
    const normalizedPath = normalizedSourcePath(folder.path);
    const isRoot = workspaceFolderPaths.some((path) => normalizedSourcePath(path) === normalizedPath);
    if (isRoot) {
      setWorkspaceFolderPaths((current) => current.filter((path) => normalizedSourcePath(path) !== normalizedPath));
      setFolderRoots((current) => current.filter((root) => normalizedSourcePath(root.path) !== normalizedPath));
    } else {
      setFolderRoots((current) => current
        .map((root) => removeFolderTreeItem(root, folder.path))
        .filter((root): root is FolderTreeItem => root !== null));
      setClosedFolderPaths((current) => current.some((path) => normalizedSourcePath(path) === normalizedPath)
        ? current
        : [...current, folder.path]);
    }
    const treeKey = folderTreeKey(folder.path);
    setVirtualFolders((current) => current
      .map((virtualFolder) => ({
        ...virtualFolder,
        childKeys: virtualFolder.childKeys.filter((key) => key !== treeKey && !key.startsWith(`${treeKey}\\`)),
      }))
      .filter((virtualFolder) => virtualFolder.childKeys.length >= 2));
    setExpandedTreeKeys((current) => current.filter((key) => typeof key !== "string"
      || (key !== treeKey && !key.startsWith(`${treeKey}\\`))));
  }, [closeOpenNotes, workspaceFolderPaths]);

  const requestCloseWorkspaceFolder = useCallback((folder: FolderTreeItem) => {
    const affectedNotes = notes.filter((note) => openNoteIdSet.has(note.id)
      && note.sourcePath
      && isPathInsideFolder(note.sourcePath, folder.path));
    const closeFolder = () => closeWorkspaceFolder(folder, affectedNotes.map((note) => note.id));
    const dirtyNotes = affectedNotes.filter((note) => note.sourceDirty);
    if (!dirtyNotes.length) {
      closeFolder();
      return;
    }
    Modal.confirm({
      title: "关闭文件夹",
      children: `“${folder.name}”中有 ${dirtyNotes.length} 个文件与源文件存在差异。关闭后更改仍会保留在本地缓存中，确定关闭吗？`,
      okText: "仍然关闭",
      onOk: closeFolder,
    });
  }, [closeWorkspaceFolder, notes, openNoteIdSet]);

  const handleFolderContextAction = useCallback(async (key: string, folder: FolderTreeItem) => {
    if (key === "close-files") {
      requestCloseNoteGroup(folder.name, notes
        .filter((note) => note.sourcePath && isPathInsideFolder(note.sourcePath, folder.path))
        .map((note) => note.id));
      return;
    }
    if (key === "close") {
      requestCloseWorkspaceFolder(folder);
      return;
    }
    if (key === "close-others") {
      const affectedNotes = notes.filter((note) => openNoteIdSet.has(note.id)
        && note.sourcePath
        && !isPathInsideFolder(note.sourcePath, folder.path)
        && workspaceFolderPaths.some((path) => isPathInsideFolder(note.sourcePath!, path)));
      const closeOtherFolders = () => {
        closeOpenNotes(affectedNotes.map((note) => note.id));
        const pathsToClose = workspaceFolderPaths.filter((path) => normalizedSourcePath(path) !== normalizedSourcePath(folder.path));
        setVirtualFolders((current) => current
          .map((virtualFolder) => ({
            ...virtualFolder,
            childKeys: virtualFolder.childKeys.filter((key) => {
              if (!key.startsWith("folder:")) return true;
              const path = key.slice("folder:".length);
              return isPathInsideFolder(path, folder.path)
                || !pathsToClose.some((folderPath) => isPathInsideFolder(path, folderPath));
            }),
          }))
          .filter((virtualFolder) => virtualFolder.childKeys.length >= 2));
        setWorkspaceFolderPaths([folder.path]);
        setClosedFolderPaths([]);
        setFolderRoots([folder]);
        setExpandedTreeKeys([folderTreeKey(folder.path)]);
        if (!folder.loaded) void loadWorkspaceFolder(folder.path);
      };
      const dirtyNotes = affectedNotes.filter((note) => note.sourceDirty);
      if (dirtyNotes.length) {
        Modal.confirm({
          title: "关闭其他文件夹",
          children: `其他文件夹中有 ${dirtyNotes.length} 个文件与源文件存在差异。关闭后更改仍会保留在本地缓存中，确定关闭吗？`,
          okText: "仍然关闭",
          onOk: closeOtherFolders,
        });
      } else {
        closeOtherFolders();
      }
      return;
    }
    if (key === "open-folder") {
      if (!window.__TAURI__?.core?.invoke) {
        message.warning("浏览器预览模式无法打开本地文件夹");
        return;
      }
      try {
        await window.__TAURI__.core.invoke<void>("open_file_directory", { path: folder.path });
      } catch (error) {
        message.error(`打开所在文件夹失败：${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (key === "copy-path") {
      try {
        await navigator.clipboard.writeText(folder.path);
        message.success("文件夹路径已复制");
      } catch (error) {
        message.error(`复制文件夹路径失败：${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (key !== "rename") return;
    if (!window.__TAURI__?.core?.invoke) {
      message.warning("浏览器预览模式无法重命名本地文件夹");
      return;
    }

    let nextName = folder.name;
    Modal.confirm({
      title: "重命名当前文件夹",
      children: (
        <Input
          autoFocus
          defaultValue={folder.name}
          aria-label="新的文件夹名称"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => { nextName = event.currentTarget.value; }}
        />
      ),
      okText: "重命名",
      onOk: async () => {
        const trimmedName = nextName.trim();
        if (!trimmedName) {
          message.warning("文件夹名称不能为空");
          return false;
        }
        try {
          const nextPath = await window.__TAURI__!.core.invoke<string>("rename_directory", {
            path: folder.path,
            newName: trimmedName,
          });
          setFolderRoots((current) => current.map((root) => renameFolderTreeBranch(root, folder.path, nextPath)));
          setWorkspaceFolderPaths((current) => current.map((path) => replacePathPrefix(path, folder.path, nextPath)));
          setClosedFolderPaths((current) => current.map((path) => replacePathPrefix(path, folder.path, nextPath)));
          setNotes((current) => current.map((note) => note.sourcePath && isPathInsideFolder(note.sourcePath, folder.path)
            ? { ...note, sourcePath: replacePathPrefix(note.sourcePath, folder.path, nextPath) }
            : note));
          const previousTreeKey = folderTreeKey(folder.path);
          const nextTreeKey = folderTreeKey(nextPath);
          setVirtualFolders((current) => current.map((virtualFolder) => ({
            ...virtualFolder,
            childKeys: virtualFolder.childKeys.map((childKey) => childKey === previousTreeKey
              || childKey.startsWith(`${previousTreeKey}\\`)
              ? `${nextTreeKey}${childKey.slice(previousTreeKey.length)}`
              : childKey),
          })));
          setExpandedTreeKeys((current) => current.map((treeKey) => typeof treeKey === "string"
            && (treeKey === previousTreeKey || treeKey.startsWith(`${previousTreeKey}\\`))
            ? `${nextTreeKey}${treeKey.slice(previousTreeKey.length)}`
            : treeKey));
          message.success("文件夹已重命名");
        } catch (error) {
          message.error(`重命名文件夹失败：${error instanceof Error ? error.message : String(error)}`);
          return false;
        }
      },
    });
  }, [closeOpenNotes, loadWorkspaceFolder, notes, openNoteIdSet, requestCloseNoteGroup, requestCloseWorkspaceFolder, workspaceFolderPaths]);

  const handleVirtualFolderContextAction = useCallback((key: string, folder: VirtualTreeFolder) => {
    if (key === "close-files") {
      requestCloseNoteGroup(folder.name, notes
        .filter((note) => folder.childKeys.some((childKey) => childKey === noteTreeKey(note.id)
          || (note.sourcePath && childKey.startsWith("folder:")
            && isPathInsideFolder(note.sourcePath, childKey.slice("folder:".length)))))
        .map((note) => note.id));
      return;
    }
    if (key === "dissolve") {
      setVirtualFolders((current) => current.filter((item) => item.id !== folder.id));
      setExpandedTreeKeys((current) => current.filter((treeKey) => treeKey !== virtualFolderTreeKey(folder.id)));
      return;
    }
    if (key !== "rename") return;
    let nextName = folder.name;
    Modal.confirm({
      title: "重命名虚拟文件夹",
      children: (
        <Input
          autoFocus
          defaultValue={folder.name}
          aria-label="新的虚拟文件夹名称"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => { nextName = event.currentTarget.value; }}
        />
      ),
      okText: "重命名",
      onOk: () => {
        const trimmedName = nextName.trim();
        if (!trimmedName) {
          message.warning("虚拟文件夹名称不能为空");
          return false;
        }
        setVirtualFolders((current) => current.map((item) => item.id === folder.id
          ? { ...item, name: trimmedName }
          : item));
      },
    });
  }, [notes, requestCloseNoteGroup]);

  const handleFileContextAction = useCallback(async (key: string, path: string) => {
    const findOpenedNote = () => notesRef.current.find((item) => item.sourcePath
      && normalizedSourcePath(item.sourcePath) === normalizedSourcePath(path));
    let note = findOpenedNote();
    // 右键一个尚未打开的文件时，Tree 会先异步打开文件；菜单点击需要等待该文件进入笔记状态。
    for (let attempt = 0; !note && attempt < 90; attempt += 1) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      note = findOpenedNote();
    }
    if (!note) {
      message.warning("文件仍在打开，请稍后重试");
      return;
    }
    void handleNoteContextActionRef.current(key, note.id);
  }, []);

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        createNote();
        return;
      }
      if (key === "w") {
        event.preventDefault();
        event.stopPropagation();
        if (activeNoteId) requestCloseTab(activeNoteId);
        return;
      }
      if (key === "s") {
        event.preventDefault();
        if (activeNoteId) void saveDocument(activeNoteId);
        return;
      }
      if (key === "c" && event.shiftKey && activeNoteId) {
        event.preventDefault();
        void handleNoteContextAction("copy-path", activeNoteId);
      }
    }
    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [activeNoteId, createNote, handleNoteContextAction, requestCloseTab, saveDocument]);

  async function runWindowAction(action: WindowAction) {
    if (!window.__TAURI__?.core?.invoke) {
      if (action === "toggle-maximize") setWindowMaximized((current) => !current);
      return;
    }
    try {
      await window.__TAURI__.core.invoke<void>("notepad_window_action", { action });
      if (action === "toggle-maximize") setWindowMaximized((current) => !current);
    } catch (error) {
      message.error(`窗口操作失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const characterCount = activeNote?.content.length ?? 0;
  const wordCount = activeNote?.content.trim()
    ? activeNote.content.trim().split(/\s+/u).filter(Boolean).length
    : 0;
  const saveLabel = saveState === "saving"
    ? activeNote?.sourcePath && activeNote.sourceDirty ? "正在缓存更改…" : "正在保存…"
    : saveState === "pending"
      ? activeNote?.sourcePath && activeNote.sourceDirty ? "等待缓存更改…" : "等待自动保存…"
    : saveState === "error"
      ? "保存失败"
      : activeNote?.sourcePath
        ? activeNote.sourceDirty ? "更改已缓存" : "已保存到源文件"
        : "已自动保存";
  const editorLanguage = activeNote?.language ?? "plaintext";
  const editorWordWrap = activeNote?.wordWrap ?? true;
  const markdownView = activeNote?.markdownView ?? "edit";
  const editorOptions = useMemo(() => ({
    ...EDITOR_OPTIONS,
    wordWrap: editorWordWrap ? "on" as const : "off" as const,
  }), [editorWordWrap]);
  const viewportWidth = Math.max(window.innerWidth, 720);
  const sidebarMinPercent = Math.min(45, 210 / viewportWidth * 100);
  const sidebarMaxPercent = Math.max(sidebarMinPercent, Math.min(48, 480 / viewportWidth * 100));

  const formatCurrentText = useCallback(async () => {
    if (!activeNote || !FORMATTABLE_LANGUAGES.has(editorLanguage) || formattingNoteId) return;
    const noteId = activeNote.id;
    const source = activeNote.content;
    const languageLabel = LANGUAGE_LABELS.get(editorLanguage) ?? editorLanguage;
    setFormattingNoteId(noteId);
    try {
      const formatted = await formatText(editorLanguage, source, activeNote.sourcePath ?? activeNote.title);
      const latestNote = notesRef.current.find((note) => note.id === noteId);
      if (!latestNote || latestNote.content !== source) {
        message.warning("格式化期间内容已经改变，已保留当前文本");
        return;
      }
      if (formatted === source) {
        message.info(`${languageLabel} 内容已经是格式化状态`);
        return;
      }
      setNotes((current) => current.map((note) => note.id === noteId ? {
        ...note,
        content: formatted,
        sourceDirty: note.sourcePath
          ? note.sourceContentHash
            ? contentHash(formatted) !== note.sourceContentHash
            : true
          : note.sourceDirty,
        updatedAt: Date.now(),
      } : note));
      message.success(`${languageLabel} 已格式化`);
    } catch (error) {
      const detail = (error instanceof Error ? error.message : String(error))
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, 180);
      message.error(`${languageLabel} 格式化失败${detail ? `：${detail}` : "，请检查内容"}`);
    } finally {
      setFormattingNoteId((current) => current === noteId ? null : current);
    }
  }, [activeNote, editorLanguage, formattingNoteId]);

  const resolveMarkdownImageSrc = useCallback((src: string) => {
    if (!/^https?:\/\//iu.test(src) || !window.__TAURI__?.core?.invoke) return src;
    const cached = markdownImageCacheRef.current.get(src);
    if (cached) return cached;
    const request = window.__TAURI__.core.invoke<string>("fetch_remote_image", { url: src })
      .catch(() => {
        markdownImageCacheRef.current.delete(src);
        return src;
      });
    markdownImageCacheRef.current.set(src, request);
    return request;
  }, []);

  const treeActionHandlersRef = useRef({
    handleNoteContextAction,
    handleFileContextAction,
    handleNoteAction,
    togglePin,
    handleFolderContextAction,
    handleVirtualFolderContextAction,
  });
  treeActionHandlersRef.current = {
    handleNoteContextAction,
    handleFileContextAction,
    handleNoteAction,
    togglePin,
    handleFolderContextAction,
    handleVirtualFolderContextAction,
  };

  const {
    explorerTreeData,
    renderedTreeChildrenByParent,
    renderedTreeParentByKey,
    virtualFolderIdByChildKey,
  } = useMemo(() => {
  const renderNoteTreeTitle = (note: Note, label = noteDisplayTitle(note)) => (
      <span className="note-list-item__identity">
        <strong>{label}</strong>
        {note.sourcePath && note.sourceDirty ? (
          <Tooltip title="当前文件与源文件有差异">
            <Badge
              className="note-source-difference-badge"
              status="warning"
              aria-label="当前文件与源文件有差异"
            />
          </Tooltip>
        ) : null}
      </span>
  );

  const renderNoteTreeActions = (note: Note) => (
    <span className="note-list-item__actions">
      <Tooltip title={note.pinned ? "取消固定" : "固定笔记"}>
        <Button
          className={`note-pin-button${note.pinned ? " is-pinned" : ""}`}
          size="small"
          variant="text"
          icon={<Icon name={note.pinned ? "pin" : "pin-off"} size={14} />}
          aria-label={note.pinned ? `取消固定${noteDisplayTitle(note)}` : `固定${noteDisplayTitle(note)}`}
          onClick={() => treeActionHandlersRef.current.togglePin(note.id)}
        />
      </Tooltip>
      <Dropdown
        placement="bottomRight"
        trigger={["click"]}
        menu={{ items: NOTE_ACTIONS, onClick: ({ key }) => treeActionHandlersRef.current.handleNoteAction(key, note.id) }}
      >
        <Button
          className="note-more-button"
          size="small"
          variant="text"
          icon={<Icon name="more-horizontal" size={15} />}
          aria-label={`打开${noteDisplayTitle(note)}的更多操作`}
        />
      </Dropdown>
    </span>
  );

  const renderFolderTreeTitle = (folder: FolderTreeItem) => (
      <span>{folder.name}</span>
  );

  const renderVirtualFolderTreeTitle = (folder: VirtualTreeFolder) => (
      <span>{folder.name}</span>
  );

  const createNoteTreeNode = (note: Note, key = noteTreeKey(note.id), label = noteDisplayTitle(note)): TreeNode => ({
    key,
    title: renderNoteTreeTitle(note, label),
    extra: renderNoteTreeActions(note),
    icon: <Icon name="notepad-file" size={14} />,
    contextMenu: { items: NOTE_CONTEXT_ACTIONS, onClick: ({ key }) => { void treeActionHandlersRef.current.handleNoteContextAction(key, note.id); } },
    contextMenuPopupClassName: "note-context-dropdown",
    isLeaf: true,
    nodeType: "note",
    noteId: note.id,
    rowProps: { className: "notepad-tree__document-row" },
  });

  const createFolderTreeNode = (item: FolderTreeItem): TreeNode => {
    if (item.isDirectory) {
      return {
        key: folderTreeKey(item.path),
        title: renderFolderTreeTitle(item),
        icon: <Icon name="notepad-folder" size={14} />,
        contextMenu: { items: FOLDER_CONTEXT_ACTIONS, onClick: ({ key }) => { void treeActionHandlersRef.current.handleFolderContextAction(key, item); } },
        contextMenuPopupClassName: "note-context-dropdown",
        isLeaf: false,
        loaded: item.loaded,
        selectable: false,
        nodeType: "directory",
        path: item.path,
        rowProps: { className: "notepad-tree__directory-row" },
        children: item.children
          ?.filter((child) => !closedFolderPaths.some((path) => normalizedSourcePath(path) === normalizedSourcePath(child.path)))
          .map(createFolderTreeNode),
      };
    }
    const openedNote = noteBySourcePath.get(normalizedSourcePath(item.path));
    return {
      key: folderTreeKey(item.path),
      title: openedNote ? renderNoteTreeTitle(openedNote, item.name) : item.name,
      extra: openedNote ? renderNoteTreeActions(openedNote) : undefined,
      icon: <Icon name="notepad-file" size={14} />,
      contextMenu: { items: NOTE_CONTEXT_ACTIONS, onClick: ({ key }) => treeActionHandlersRef.current.handleFileContextAction(key, item.path) },
      contextMenuPopupClassName: "note-context-dropdown",
      isLeaf: true,
      nodeType: "file",
      path: item.path,
      noteId: openedNote?.id,
      rowProps: { className: "notepad-tree__document-row" },
    };
  };

  const internalNoteNodes = visibleNotes
    .filter((note) => !note.sourcePath)
    .map((note) => createNoteTreeNode(note));
  const outsideFileNodes = visibleNotes
    .filter((note) => note.sourcePath
      && !workspaceFolderPaths.some((folderPath) => isPathInsideFolder(note.sourcePath!, folderPath)))
    .map((note) => createNoteTreeNode(note));
  const baseExplorerTreeData: TreeNode[] = [
    ...internalNoteNodes,
    ...folderRoots.map(createFolderTreeNode),
    ...outsideFileNodes,
  ];
  const indexedTreeNodes = new Map<string, TreeNode>();
  const baseTreeParentByKey = new Map<string, string>();
  const indexTreeNodes = (nodes: readonly TreeNode[], parentKey = ROOT_TREE_PARENT_KEY) => {
    nodes.forEach((node) => {
      if (typeof node.key !== "string") return;
      indexedTreeNodes.set(node.key, node);
      baseTreeParentByKey.set(node.key, parentKey);
      if (node.children?.length) indexTreeNodes(node.children, node.key);
    });
  };
  indexTreeNodes(baseExplorerTreeData);

  const virtualFolderById = new Map(virtualFolders.map((folder) => [folder.id, folder]));
  const virtualFolderIdByChildKey = new Map<string, string>();
  virtualFolders.forEach((folder) => folder.childKeys.forEach((childKey) => {
    if (!virtualFolderIdByChildKey.has(childKey)) virtualFolderIdByChildKey.set(childKey, folder.id);
  }));
  const resolvedVirtualParentById = new Map(virtualFolders.map((folder) => [
    folder.id,
    folder.parentKey && (folder.parentKey === ROOT_TREE_PARENT_KEY || indexedTreeNodes.has(folder.parentKey))
      ? folder.parentKey
      : baseTreeParentByKey.get(folder.childKeys[0]) ?? ROOT_TREE_PARENT_KEY,
  ]));

  const orderTreeLevel = (nodes: TreeNode[], parentKey: string): TreeNode[] => {
    const order = treeOrderByParent[parentKey];
    if (!order?.length) return nodes;
    const rank = new Map(order.map((key, index) => [key, index]));
    return nodes
      .map((node, index) => ({ node, index, rank: typeof node.key === "string" ? rank.get(node.key) : undefined }))
      .sort((left, right) => (left.rank ?? order.length + left.index) - (right.rank ?? order.length + right.index))
      .map(({ node }) => node);
  };

  function materializeTreeNode(node: TreeNode): TreeNode {
    const key = typeof node.key === "string" ? node.key : String(node.key);
    return {
      ...node,
      children: node.children ? materializeTreeLevel(node.children, key) : undefined,
    };
  }

  function createVirtualFolderNode(folder: VirtualTreeFolder): TreeNode | null {
    const children = folder.childKeys
      .map((key) => indexedTreeNodes.get(key))
      .filter((node): node is TreeNode => Boolean(node))
      .map(materializeTreeNode);
    if (!children.length) return null;
    return {
      key: virtualFolderTreeKey(folder.id),
      title: renderVirtualFolderTreeTitle(folder),
      icon: <Icon name="notepad-virtual-folder" size={14} />,
      contextMenu: { items: VIRTUAL_FOLDER_CONTEXT_ACTIONS, onClick: ({ key }) => treeActionHandlersRef.current.handleVirtualFolderContextAction(key, folder) },
      contextMenuPopupClassName: "note-context-dropdown",
      isLeaf: false,
      loaded: true,
      selectable: false,
      draggable: false,
      nodeType: "virtual-folder",
      virtualFolderId: folder.id,
      rowProps: { className: "notepad-tree__virtual-folder-row" },
      children: orderTreeLevel(children, virtualFolderTreeKey(folder.id)),
    };
  }

  function materializeTreeLevel(nodes: readonly TreeNode[], parentKey: string): TreeNode[] {
    const result: TreeNode[] = [];
    const emittedFolderIds = new Set<string>();
    nodes.forEach((node) => {
      const key = typeof node.key === "string" ? node.key : null;
      const ownerId = key ? virtualFolderIdByChildKey.get(key) : undefined;
      if (ownerId) {
        const folder = virtualFolderById.get(ownerId);
        const folderParentKey = resolvedVirtualParentById.get(ownerId);
        if (folder && folderParentKey === parentKey && folder.childKeys[0] === key && !emittedFolderIds.has(ownerId)) {
          const virtualNode = createVirtualFolderNode(folder);
          if (virtualNode) result.push(virtualNode);
          emittedFolderIds.add(ownerId);
        }
        return;
      }
      const materialized = materializeTreeNode(node);
      if (materialized.nodeType === "system-group" && !materialized.children?.length) return;
      result.push(materialized);
    });
    return orderTreeLevel(result, parentKey);
  }

  const explorerTreeData = materializeTreeLevel(baseExplorerTreeData, ROOT_TREE_PARENT_KEY);
  const renderedTreeParentByKey = new Map<string, string>();
  const renderedTreeChildrenByParent = new Map<string, string[]>();
  const indexRenderedTree = (nodes: readonly TreeNode[], parentKey = ROOT_TREE_PARENT_KEY) => {
    const childKeys = nodes.flatMap((node) => typeof node.key === "string" ? [node.key] : []);
    renderedTreeChildrenByParent.set(parentKey, childKeys);
    nodes.forEach((node) => {
      if (typeof node.key !== "string") return;
      renderedTreeParentByKey.set(node.key, parentKey);
      if (node.children?.length) indexRenderedTree(node.children, node.key);
    });
  };
  indexRenderedTree(explorerTreeData);
  return {
    explorerTreeData,
    renderedTreeChildrenByParent,
    renderedTreeParentByKey,
    virtualFolderIdByChildKey,
  };
  }, [closedFolderPaths, folderRoots, noteBySourcePath, treeOrderByParent, virtualFolders, visibleNotes, workspaceFolderPaths]);
  const activeTreeKey = activeNote
    ? activeNote.sourcePath && workspaceFolderPaths.some((folderPath) => isPathInsideFolder(activeNote.sourcePath!, folderPath))
      ? folderTreeKey(activeNote.sourcePath)
      : noteTreeKey(activeNote.id)
    : null;
  const activeTreeKeys = useMemo(() => activeTreeKey ? [activeTreeKey] : [], [activeTreeKey]);

  const handleTreeSelect = useCallback((_keys: TreeKey[], info: { node: TreeNode }) => {
    if (info.node.nodeType === "note" && typeof info.node.noteId === "string") {
      openNote(info.node.noteId);
      return;
    }
    if (info.node.nodeType !== "file" || typeof info.node.path !== "string") return;
    if (typeof info.node.noteId === "string") {
      openNote(info.node.noteId);
      return;
    }
    void openExternalPathsRef.current([info.node.path], false);
  }, [openNote]);

  const handleTreeDrop = useCallback((info: { dragNode: TreeNode; node: TreeNode; dropPosition: TreeDropPosition }) => {
    const dragKey = typeof info.dragNode.key === "string" ? info.dragNode.key : null;
    const targetKey = typeof info.node.key === "string" ? info.node.key : null;
    if (!dragKey || !targetKey || info.dragNode.nodeType === "system-group" || info.node.nodeType === "system-group") return;

    if (info.dropPosition !== "inside") {
      const dragParentKey = renderedTreeParentByKey.get(dragKey);
      const targetParentKey = renderedTreeParentByKey.get(targetKey);
      if (!dragParentKey || dragParentKey !== targetParentKey) {
        message.warning("只能调整同一层级项目的顺序");
        return;
      }
      const siblingKeys = renderedTreeChildrenByParent.get(targetParentKey) ?? [];
      const nextOrder = siblingKeys.filter((key) => key !== dragKey);
      const targetIndex = nextOrder.indexOf(targetKey);
      if (targetIndex < 0) return;
      nextOrder.splice(targetIndex + (info.dropPosition === "after" ? 1 : 0), 0, dragKey);
      setTreeOrderByParent((current) => ({ ...current, [targetParentKey]: nextOrder }));
      return;
    }

    const collectChildKeys = (node: TreeNode, result = new Set<TreeKey>()) => {
      node.children?.forEach((child) => {
        result.add(child.key);
        collectChildKeys(child, result);
      });
      return result;
    };
    if (collectChildKeys(info.dragNode).has(info.node.key) || collectChildKeys(info.node).has(info.dragNode.key)) {
      message.warning("不能将父级与其子级创建为同一个虚拟文件夹");
      return;
    }

    const targetFolderId = info.node.nodeType === "virtual-folder" && typeof info.node.virtualFolderId === "string"
      ? info.node.virtualFolderId
      : virtualFolderIdByChildKey.get(targetKey);
    if (targetFolderId) {
      setVirtualFolders((current) => {
        const targetFolder = current.find((folder) => folder.id === targetFolderId);
        if (!targetFolder || targetFolder.childKeys.includes(dragKey)) return current;
        return current
          .map((folder) => folder.id === targetFolderId
            ? { ...folder, childKeys: [...folder.childKeys, dragKey] }
            : { ...folder, childKeys: folder.childKeys.filter((key) => key !== dragKey) })
          .filter((folder) => folder.id === targetFolderId || folder.childKeys.length >= 2);
      });
      setExpandedTreeKeys((current) => [...new Set([...current, virtualFolderTreeKey(targetFolderId)])]);
      return;
    }

    const targetParentKey = renderedTreeParentByKey.get(targetKey) ?? ROOT_TREE_PARENT_KEY;
    const folderId = crypto.randomUUID();
    const virtualTreeKey = virtualFolderTreeKey(folderId);
    setVirtualFolders((current) => {
      const usedNames = new Set(current.map((folder) => folder.name));
      let name = "新建文件夹";
      let suffix = 2;
      while (usedNames.has(name)) {
        name = `新建文件夹 ${suffix}`;
        suffix += 1;
      }
      const remainingFolders = current
        .map((folder) => ({
          ...folder,
          childKeys: folder.childKeys.filter((key) => key !== dragKey && key !== targetKey),
        }))
        .filter((folder) => folder.childKeys.length >= 2);
      return [{ id: folderId, name, childKeys: [targetKey, dragKey], parentKey: targetParentKey }, ...remainingFolders];
    });
    setTreeOrderByParent((current) => {
      const currentOrder = current[targetParentKey];
      if (!currentOrder?.length) return current;
      const nextOrder = currentOrder.flatMap((key) => key === targetKey
        ? [virtualTreeKey]
        : key === dragKey
          ? []
          : [key]);
      if (!nextOrder.includes(virtualTreeKey)) nextOrder.push(virtualTreeKey);
      return { ...current, [targetParentKey]: nextOrder };
    });
    setExpandedTreeKeys((current) => [...new Set([...current, virtualTreeKey])]);
  }, [renderedTreeChildrenByParent, renderedTreeParentByKey, virtualFolderIdByChildKey]);
  const handleTreeExpand = useCallback((keys: TreeKey[]) => setExpandedTreeKeys(keys), []);

  const titleBar = (
    <WindowTitleBar
      className="notepad-titlebar"
      leading={(
        <div className="notepad-brand" aria-label="Sia 记事本">
          <img src="/app-icon.svg" alt="" />
          <strong>Sia 记事本</strong>
        </div>
      )}
      actions={(
        <>
          <span className={`save-indicator save-indicator--${saveState}`} role="status">
            <Icon name={saveState === "error" ? "warning" : saveState === "saving" ? "loader" : "cloud"} size={14} spin={saveState === "saving"} />
            {saveLabel}
          </span>
          <Tooltip title="切换明暗主题">
            <ThemeSwitch checked={darkMode} onCheckedChange={setDarkMode} />
          </Tooltip>
        </>
      )}
      maximized={windowMaximized}
      onWindowAction={runWindowAction}
    />
  );

  return (
    <WindowFrame className="notepad-window" titleBar={titleBar}>
      <div className="notepad-app">
        <Splitter
          key={`${sidebarWidthPercent.toFixed(3)}-${sidebarCollapsed ? "collapsed" : "expanded"}`}
          className="notepad-splitter"
          orientation="horizontal"
          onResizeEnd={(sizes) => {
            const next = sizes[0];
            if (typeof next === "number" && Number.isFinite(next)) {
              window.setTimeout(() => {
                const collapsed = next <= 0.01;
                setSidebarCollapsed(collapsed);
                if (!collapsed) setSidebarWidthPercent(next);
              }, 0);
            }
          }}
        >
          <Splitter.Panel
            defaultSize={sidebarWidthPercent}
            defaultCollapsed={sidebarCollapsed}
            min={sidebarMinPercent}
            max={sidebarMaxPercent}
            collapsible
            collapsedSize={0}
          >
            <aside className="notes-sidebar" aria-label="笔记列表">
          <div className="sidebar-toolbar">
            <div className="sidebar-heading">
              <div className="sidebar-heading__title">
                <strong>资源管理器</strong>
                <span>{openNoteIds.length} 个文档</span>
              </div>
              <div className="sidebar-heading__actions">
                <Dropdown.Button
                  className="new-note-split-button"
                  placement="bottomRight"
                  trigger={["hover"]}
                  arrow
                  openDelay={100}
                  popupClassName="new-note-dropdown"
                  buttonProps={{
                    className: "new-note-button",
                    variant: "primary",
                    size: "small",
                    icon: <Icon name="plus" size={16} />,
                    "aria-label": "新建笔记",
                  }}
                  onClick={createNote}
                  menu={{
                    items: NEW_NOTE_MENU_ITEMS,
                    onClick: ({ key }) => {
                      if (key === "open-file") void chooseExternalFiles();
                      if (key === "open-folder") void chooseWorkspaceFolder();
                    },
                  }}
                />
                <input
                  ref={fileInputRef}
                  className="open-file-input"
                  type="file"
                  accept=".txt,.json,.md,.markdown,.cs,.js,.jsx,.mjs,.cjs,.ts,.tsx,.html,.htm,.css,.xml,.yaml,.yml,.ini,.sh,.bash,.zsh,.ps1,.bat,.cmd,.py,.sql,.php,.rb,.pl,.lua,text/*"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void openFile(file);
                  }}
                />
              </div>
            </div>
            <Input
              className="notes-search"
              size="small"
              prefix={<Icon name="search" size={15} />}
              placeholder="搜索笔记…"
              value={searchText}
              allowClear
              aria-label="搜索笔记"
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          <div className="note-list">
            {explorerTreeData.length ? (
              <MemoizedTree
                className="notepad-tree"
                treeData={explorerTreeData}
                selectedKeys={activeTreeKeys}
                expandedKeys={expandedTreeKeys}
                onSelect={handleTreeSelect}
                onExpand={handleTreeExpand}
                loadData={loadFolderTreeNode}
                draggable
                onDrop={handleTreeDrop}
                showIcon
                blockNode
                showLine
                stickyAncestors
                indentSize={0}
                switcherWidth={18}
                stickyRowHeight={30}
              />
            ) : (
              <div className="note-list-empty">
                <Icon name="folder-plus" size={22} />
                <strong>尚未打开内容</strong>
                <span>新建笔记或打开文件夹</span>
              </div>
            )}
          </div>
          <div className="sidebar-footer">
            <Icon name="shield-check" size={14} />
            数据仅保存在本机
          </div>
            </aside>
          </Splitter.Panel>

          <Splitter.Panel defaultSize={100 - sidebarWidthPercent} min={52}>
            <main className="editor-workspace">
          {activeNote ? (
            <section className="note-editor" aria-label={`编辑${noteDisplayTitle(activeNote)}`}>
              <div className={`editor-heading${activeNote.title.trim() ? "" : " is-title-empty"}`}>
                <header className="editor-header">
                  <Input
                    ref={titleInputRef}
                    className="note-title-input"
                    value={activeNote.title}
                    placeholder="无标题笔记"
                    maxLength={120}
                    aria-label="笔记标题"
                    onChange={(event) => updateActiveNote({ title: event.target.value })}
                  />
                </header>
                <div className="editor-meta">
                  <span>最后编辑于 {new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(activeNote.updatedAt)}</span>
                </div>
              </div>
              {editorLanguage === "markdown" && markdownView === "preview" ? (
                <div className="note-markdown-preview" aria-label="Markdown 预览">
                  <Markdown
                    content={activeNote.content}
                    emptyText="开始输入 Markdown 后，这里会显示预览。"
                    resolveImageSrc={resolveMarkdownImageSrc}
                  />
                </div>
              ) : (
                <Editor
                  className="note-content-editor"
                  value={activeNote.content}
                  language={monacoLanguageForNoteLanguage(editorLanguage)}
                  path="inmemory://sia-notepad/current-note.txt"
                  theme={darkMode ? "dark" : "light"}
                  options={editorOptions}
                  contextMenuItems={EDITOR_CONTEXT_MENU}
                  ariaLabel="笔记内容编辑器"
                  loadingText="正在准备编辑器…"
                  onChange={(content) => updateActiveNote({ content })}
                />
              )}
              <footer className="editor-statusbar">
                <div>
                  <span>{wordCount} 词</span>
                  <span>{characterCount} 字符</span>
                </div>
                <div>
                  {FORMATTABLE_LANGUAGES.has(editorLanguage) ? (
                    <Button
                      className="json-format-button"
                      size="small"
                      variant="text"
                      disabled={formattingNoteId !== null}
                      icon={<Icon name={formattingNoteId === activeNote.id ? "loader" : "code"} size={12} spin={formattingNoteId === activeNote.id} />}
                      onClick={() => { void formatCurrentText(); }}
                    >
                      {formattingNoteId === activeNote.id ? "格式化中" : "格式化"}
                    </Button>
                  ) : null}
                  {editorLanguage === "markdown" ? (
                    <Segmented
                      className="markdown-view-switch"
                      size="small"
                      aria-label="Markdown 视图"
                      options={MARKDOWN_VIEW_OPTIONS}
                      value={markdownView}
                      onChange={(value) => updateActiveNote({ markdownView: value as "edit" | "preview" })}
                    />
                  ) : null}
                  <Dropdown
                    placement="topRight"
                    trigger={["click"]}
                    popupClassName="language-dropdown"
                    menu={{
                      items: LANGUAGE_MENU_ITEMS,
                      selectable: true,
                      selectedKeys: [editorLanguage],
                      onClick: ({ key }) => {
                        if (isNoteLanguage(key)) updateActiveNote({ language: key });
                      },
                    }}
                  >
                    <Button
                      className="language-selector"
                      size="small"
                      variant="text"
                      icon={<Icon name="chevron-down" size={11} />}
                      iconPosition="end"
                      aria-label={`当前文本类型：${LANGUAGE_LABELS.get(editorLanguage) ?? "纯文本"}，点击切换`}
                    >
                      {LANGUAGE_LABELS.get(editorLanguage) ?? "纯文本"}
                    </Button>
                  </Dropdown>
                  <Checkbox
                    className="word-wrap-checkbox"
                    checked={editorWordWrap}
                    onChange={(checked) => updateActiveNote({ wordWrap: checked })}
                  >
                    自动换行
                  </Checkbox>
                  <span>UTF-8</span>
                </div>
              </footer>
            </section>
          ) : (
            <section className="empty-editor">
              <div className="empty-editor__art" aria-hidden="true">
                <Icon name="edit" size={34} />
              </div>
              <h1>开启一页新想法</h1>
              <p>选择左侧笔记，或者创建一篇新的记录。</p>
              <div className="empty-editor__actions">
                <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={createNote}>新建笔记</Button>
                <Button icon={<Icon name="notepad-file" size={16} />} onClick={() => { void chooseExternalFiles(); }}>打开文件</Button>
                <Button icon={<Icon name="notepad-folder" size={16} />} onClick={() => { void chooseWorkspaceFolder(); }}>打开文件夹</Button>
              </div>
              <span><kbd>Ctrl</kbd><kbd>N</kbd></span>
            </section>
          )}
            </main>
          </Splitter.Panel>
        </Splitter>
      </div>
    </WindowFrame>
  );
}

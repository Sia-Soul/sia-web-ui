import type { NoteLanguage } from "./languages";

export type { NoteLanguage } from "./languages";

export type TextFileEncoding = "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be" | "gb18030";

export interface Note {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  language?: NoteLanguage;
  wordWrap?: boolean;
  markdownView?: "edit" | "preview";
  sourcePath?: string;
  sourceEncoding?: TextFileEncoding;
  sourceModifiedAt?: number;
  sourceContentHash?: string;
  sourceDirty?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface VirtualTreeFolder {
  id: string;
  name: string;
  childKeys: string[];
  parentKey?: string;
}

export interface NotebookSnapshot {
  version: 1;
  notes: Note[];
  openNoteIds: string[];
  activeNoteId: string | null;
  darkMode: boolean;
  sidebarCollapsed: boolean;
  sidebarWidthPercent?: number;
  workspaceFolderPath?: string;
  workspaceFolderPaths?: string[];
  closedFolderPaths?: string[];
  virtualFolders?: VirtualTreeFolder[];
  treeOrderByParent?: Record<string, string[]>;
}

const STORAGE_KEY = "sia-notepad-workspace-v1";

function isSnapshot(value: unknown): value is NotebookSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NotebookSnapshot>;
  return candidate.version === 1
    && Array.isArray(candidate.notes)
    && Array.isArray(candidate.openNoteIds)
    && typeof candidate.darkMode === "boolean"
    && typeof candidate.sidebarCollapsed === "boolean";
}

function parseSnapshot(raw: string | null): NotebookSnapshot | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function loadNotebook(): Promise<NotebookSnapshot | null> {
  if (window.__TAURI__?.core?.invoke) {
    const raw = await window.__TAURI__.core.invoke<string | null>("load_notebook");
    return parseSnapshot(raw);
  }
  return parseSnapshot(window.localStorage.getItem(STORAGE_KEY));
}

export async function saveNotebook(snapshot: NotebookSnapshot): Promise<void> {
  const raw = JSON.stringify(snapshot);
  if (window.__TAURI__?.core?.invoke) {
    await window.__TAURI__.core.invoke<void>("save_notebook", { contents: raw });
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, raw);
}

export function createWelcomeSnapshot(): NotebookSnapshot {
  const now = Date.now();
  const welcome: Note = {
    id: crypto.randomUUID(),
    title: "欢迎使用 Sia 记事本",
    content: "这是一个轻量、安静的写作空间。\n\n• 点击左上角的新建按钮创建笔记\n• 常用笔记可以固定在列表顶部\n• 编辑内容会自动保存，无需手动操作\n• 按 Ctrl + N 新建，Ctrl + W 关闭当前标签\n\n现在，写点什么吧。",
    pinned: true,
    language: "plaintext",
    wordWrap: true,
    markdownView: "edit",
    createdAt: now,
    updatedAt: now,
  };
  return {
    version: 1,
    notes: [welcome],
    openNoteIds: [welcome.id],
    activeNoteId: welcome.id,
    darkMode: false,
    sidebarCollapsed: false,
    sidebarWidthPercent: 22,
  };
}

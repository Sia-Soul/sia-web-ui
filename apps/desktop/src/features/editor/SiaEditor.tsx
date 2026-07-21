import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Button, Editor, Icon, Input, Segmented, Tag } from "@sia-ui/react";
import type { EditorHandle } from "@sia-ui/react";
import {
  DEFAULT_DOCUMENT,
  loadWorkbenchDocument,
  saveWorkbenchDocument,
  type DocumentStorageBackend,
} from "./documentRepository";
import MarkdownPreview from "./MarkdownPreview";
import type { DocumentOutlineItem, EditorViewMode } from "./editorTypes";
import "./editor.css";

interface SiaEditorProps {
  darkMode: boolean;
}

function buildOutline(content: string): DocumentOutlineItem[] {
  return content.split("\n").flatMap((line, index) => {
    const match = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (!match) return [];
    const title = match[2].replace(/[*_`~]/g, "");
    return [{ id: `${index + 1}-${title}`, level: match[1].length, line: index + 1, title }];
  });
}

const toolbarCommands = [
  { key: "heading", label: "标题", action: (api: EditorHandle) => api.prefixLines("## ") },
  { key: "bold", label: "粗体", action: (api: EditorHandle) => api.wrapSelection("**", "**", "粗体文字") },
  { key: "italic", label: "斜体", action: (api: EditorHandle) => api.wrapSelection("_", "_", "斜体文字") },
  { key: "list", label: "列表", action: (api: EditorHandle) => api.prefixLines("- ") },
  { key: "task", label: "待办", action: (api: EditorHandle) => api.prefixLines("- [ ] ") },
  { key: "quote", label: "引用", action: (api: EditorHandle) => api.prefixLines("> ") },
  { key: "code", label: "代码", action: (api: EditorHandle) => api.insertBlock("\n```\n代码内容\n```\n") },
  { key: "link", label: "链接", action: (api: EditorHandle) => api.wrapSelection("[", "](https://)", "链接文字") },
  { key: "table", label: "表格", action: (api: EditorHandle) => api.insertBlock("\n| 字段 | 说明 |\n| --- | --- |\n| 名称 | 内容 |\n") },
] as const;

export default function SiaEditor({ darkMode }: SiaEditorProps) {
  const [title, setTitle] = useState(DEFAULT_DOCUMENT.title);
  const [content, setContent] = useState(DEFAULT_DOCUMENT.content);
  const [viewMode, setViewMode] = useState<EditorViewMode>("split");
  const [saveState, setSaveState] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const [saveError, setSaveError] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [storageBackend, setStorageBackend] = useState<DocumentStorageBackend>(
    window.__TAURI__ ? "sqlite" : "localStorage",
  );
  const editorApiRef = useRef<EditorHandle | null>(null);
  const pendingLineRef = useRef<number | null>(null);
  const lastSavedSignatureRef = useRef("");
  const saveRevisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const deferredContent = useDeferredValue(content);
  const outline = useMemo(() => buildOutline(content), [content]);
  const lineCount = useMemo(() => content.split("\n").length, [content]);

  useEffect(() => {
    let cancelled = false;

    void loadWorkbenchDocument().then(({ document, storageBackend: backend }) => {
      if (cancelled) return;
      setTitle(document.title);
      setContent(document.content);
      setStorageBackend(backend);
      lastSavedSignatureRef.current = JSON.stringify([document.title, document.content]);
      setSaveError("");
      setSaveState("saved");
      setHasHydrated(true);
    }).catch((error: unknown) => {
      if (cancelled) return;
      lastSavedSignatureRef.current = JSON.stringify([DEFAULT_DOCUMENT.title, DEFAULT_DOCUMENT.content]);
      setSaveError(error instanceof Error ? error.message : String(error));
      setSaveState("error");
      setHasHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) return undefined;
    const signature = JSON.stringify([title, content]);
    if (signature === lastSavedSignatureRef.current) return undefined;

    const revision = ++saveRevisionRef.current;
    setSaveState("saving");
    setSaveError("");
    const timer = window.setTimeout(() => {
      const write = saveQueueRef.current.then(() => saveWorkbenchDocument({
        ...DEFAULT_DOCUMENT,
        title,
        content,
      }));
      saveQueueRef.current = write.then(() => undefined, () => undefined);

      void write.then(({ storageBackend: backend }) => {
        lastSavedSignatureRef.current = signature;
        if (saveRevisionRef.current !== revision) return;
        setStorageBackend(backend);
        setSaveState("saved");
      }).catch((error: unknown) => {
        if (saveRevisionRef.current !== revision) return;
        setSaveError(error instanceof Error ? error.message : String(error));
        setSaveState("error");
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [content, hasHydrated, title]);

  function handleEditorReady(api: EditorHandle | null) {
    editorApiRef.current = api;
    if (api && pendingLineRef.current !== null) {
      api.revealLine(pendingLineRef.current);
      pendingLineRef.current = null;
    }
  }

  function goToHeading(line: number) {
    if (viewMode === "preview") {
      pendingLineRef.current = line;
      setViewMode("edit");
      return;
    }
    editorApiRef.current?.revealLine(line);
  }

  const showEditor = viewMode !== "preview";
  const showPreview = viewMode !== "edit";

  return (
    <section className="sia-editor" aria-label="文档编辑器">
      <header className="sia-editor__header">
        <div className="sia-editor__title">
          <Input
            aria-label="文档标题"
            className="sia-editor__title-input"
            value={title}
            maxLength={80}
            disabled={!hasHydrated}
            onChange={(event) => setTitle(event.target.value)}
          />
          <span className="sia-editor__meta">
            Markdown · {storageBackend === "sqlite" ? "SQLite 数据库" : "浏览器预览草稿"}
          </span>
        </div>
        <div className="sia-editor__header-actions">
          <Tag
            status={saveState === "saved" ? "success" : saveState === "error" ? "error" : "processing"}
            title={saveError || undefined}
          >
            {saveState === "loading"
              ? "正在读取…"
              : saveState === "saving"
                ? "正在保存…"
                : saveState === "error"
                  ? "保存失败"
                  : storageBackend === "sqlite" ? "SQLite 已保存" : "浏览器草稿已保存"}
          </Tag>
          <Segmented
            aria-label="编辑器视图"
            options={[
              { label: "编辑", value: "edit", icon: <Icon name="edit" size={14} /> },
              { label: "分栏", value: "split", icon: <Icon name="component" size={14} /> },
              { label: "预览", value: "preview", icon: <Icon name="eye" size={14} /> },
            ]}
            value={viewMode}
            onChange={(value) => setViewMode(value as EditorViewMode)}
          />
        </div>
      </header>

      <div className="sia-editor__toolbar" aria-label="Markdown 格式工具栏">
        {toolbarCommands.map((command) => (
          <Button
            key={command.key}
            className="sia-editor__toolbar-button"
            size="small"
            variant="text"
            disabled={!showEditor || !hasHydrated}
            title={showEditor && hasHydrated ? command.label : "文档读取完成并切换到编辑视图后使用"}
            onClick={() => editorApiRef.current && command.action(editorApiRef.current)}
          >
            {command.label}
          </Button>
        ))}
        {saveError
          ? <span className="sia-editor__storage-error" role="status" title={saveError}>{saveError}</span>
          : <span className="sia-editor__toolbar-hint">支持 Markdown、表格、任务清单与代码块</span>}
      </div>

      <div className="sia-editor__body">
        <aside className="document-outline" aria-label="文档大纲">
          <div className="document-outline__heading">
            <strong>文档大纲</strong>
            <span>{outline.length}</span>
          </div>
          <nav>
            {outline.length ? outline.map((item) => (
              <Button
                variant="text"
                size="small"
                className="document-outline__item"
                key={item.id}
                style={{ paddingInlineStart: 12 + (item.level - 1) * 12 }}
                title={item.title}
                onClick={() => goToHeading(item.line)}
              >
                {item.title}
              </Button>
            )) : <p>添加标题后自动生成大纲</p>}
          </nav>
        </aside>

        <div className={`sia-editor__canvas sia-editor__canvas--${viewMode}`}>
          {showEditor ? (
            <div className="sia-editor__pane sia-editor__pane--source">
              {hasHydrated ? (
                <Editor
                  ariaLabel="Markdown 编辑器"
                  language="markdown"
                  path="inmemory://sia-workbench/current-document.md"
                  theme={darkMode ? "dark" : "light"}
                  value={content}
                  onChange={setContent}
                  onReady={handleEditorReady}
                />
              ) : <div className="editor-loading"><span />正在读取文档…</div>}
            </div>
          ) : null}
          {showPreview ? (
            <div className="sia-editor__pane sia-editor__pane--preview">
              <MarkdownPreview content={deferredContent} />
            </div>
          ) : null}
        </div>
      </div>

      <footer className="sia-editor__statusbar">
        <span><Icon name="file-check" size={14} /> {title || "未命名文档"}</span>
        <span>{storageBackend === "sqlite" ? "SQLite" : "LocalStorage"} · {lineCount} 行 · {content.length} 字符 · UTF-8</span>
      </footer>
    </section>
  );
}

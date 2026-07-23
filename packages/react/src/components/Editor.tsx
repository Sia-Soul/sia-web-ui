/// <reference path="../vite-env.d.ts" />

import { useEffect, useId, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import { Dropdown } from "./Dropdown";
import type { MenuItem } from "./Navigation";
import { registerSqlLanguages, type SqlDialectLanguage } from "./sqlLanguages";

export type EditorTheme = "light" | "dark";
export type EditorLanguage = SqlDialectLanguage | (string & {});

export interface EditorRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface EditorSelectionChange {
  range: EditorRange;
  text: string;
  cursorOffset: number;
}

export type EditorCommand = "cut" | "copy" | "paste" | "selectAll";

export interface EditorContextMenuItem {
  key: string;
  label: string;
  command?: EditorCommand;
  disabled?: boolean | ((api: EditorHandle | null) => boolean);
  onClick?: (api: EditorHandle) => void;
}

export interface EditorHandle {
  focus(): void;
  getValue(): string;
  getSelection(): EditorRange | null;
  getSelectedText(): string;
  insertBlock(content: string): void;
  prefixLines(prefix: string): void;
  revealLine(line: number): void;
  setSelection(range: EditorRange): void;
  wrapSelection(prefix: string, suffix: string, placeholder?: string): void;
}

export interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  onReady?: (api: EditorHandle | null) => void;
  onSelectionChange?: (selection: EditorSelectionChange) => void;
  language?: EditorLanguage;
  path?: string;
  theme?: EditorTheme;
  options?: Monaco.editor.IStandaloneEditorConstructionOptions;
  highlightRange?: EditorRange | null;
  contextMenuItems?: readonly EditorContextMenuItem[];
  className?: string;
  ariaLabel?: string;
  loadingText?: string;
}

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: () => Worker;
  };
};

const monacoGlobal = globalThis as MonacoGlobal;
monacoGlobal.MonacoEnvironment ??= {
  getWorker: () => new EditorWorker(),
};

async function loadMonaco() {
  await Promise.all([
    import("monaco-editor/languages/definitions/markdown/register.js"),
    import("monaco-editor/editor/contrib/clipboard/browser/clipboard.js"),
    import("monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js"),
  ]);
  const monaco = await import("monaco-editor/editor/editor.api.js");
  registerSqlLanguages(monaco);
  return monaco;
}

export function Editor({
  value,
  onChange,
  onReady,
  onSelectionChange,
  language = "plaintext",
  path,
  theme = "light",
  options,
  highlightRange,
  contextMenuItems = [],
  className = "",
  ariaLabel = "代码编辑器",
  loadingText = "正在加载编辑器…",
}: EditorProps) {
  const generatedId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const rangeHighlightRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null);
  const apiRef = useRef<EditorHandle | null>(null);
  const updateHighlightRef = useRef<() => void>(() => undefined);
  const changeHandlerRef = useRef(onChange);
  const readyHandlerRef = useRef(onReady);
  const selectionHandlerRef = useRef(onSelectionChange);
  const highlightRangeRef = useRef(highlightRange);
  const contextMenuItemsRef = useRef(contextMenuItems);
  const initialValueRef = useRef(value);
  const initialLanguageRef = useRef(language);
  const initialPathRef = useRef(path);
  const initialThemeRef = useRef(theme);
  const initialOptionsRef = useRef(options);
  const [loading, setLoading] = useState(true);
  const [, setSelectionVersion] = useState(0);

  changeHandlerRef.current = onChange;
  readyHandlerRef.current = onReady;
  selectionHandlerRef.current = onSelectionChange;
  highlightRangeRef.current = highlightRange;
  contextMenuItemsRef.current = contextMenuItems;

  useEffect(() => {
    let disposed = false;
    const subscriptions: Monaco.IDisposable[] = [];

    async function mountEditor() {
      const monaco = await loadMonaco();
      if (disposed || !containerRef.current) return;

      const modelPath = initialPathRef.current ?? `inmemory://sia-editor/${generatedId.replaceAll(":", "-")}`;
      const model = monaco.editor.createModel(
        initialValueRef.current,
        initialLanguageRef.current,
        monaco.Uri.parse(modelPath),
      );
      const editor = monaco.editor.create(containerRef.current, {
        model,
        theme: initialThemeRef.current === "dark" ? "vs-dark" : "vs",
        automaticLayout: true,
        contextmenu: contextMenuItemsRef.current.length === 0,
        fontFamily: '"Cascadia Code", Consolas, "Microsoft YaHei", monospace',
        fontSize: 14,
        lineHeight: 23,
        minimap: { enabled: false },
        padding: { top: 18, bottom: 18 },
        renderWhitespace: "selection",
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        stickyScroll: { enabled: true },
        tabSize: 2,
        wordWrap: "on",
        ...initialOptionsRef.current,
      });

      editorRef.current = editor;
      modelRef.current = model;
      subscriptions.push(editor.onDidChangeModelContent(() => {
        changeHandlerRef.current?.(model.getValue());
      }));

      const serializeRange = (range: Monaco.IRange): EditorRange => ({
        startLineNumber: range.startLineNumber,
        startColumn: range.startColumn,
        endLineNumber: range.endLineNumber,
        endColumn: range.endColumn,
      });

      const api: EditorHandle = {
        focus: () => editor.focus(),
        getValue: () => model.getValue(),
        getSelection: () => {
          const selection = editor.getSelection();
          return selection ? serializeRange(selection) : null;
        },
        getSelectedText: () => {
          const selection = editor.getSelection();
          return selection ? model.getValueInRange(selection) : "";
        },
        insertBlock(content) {
          const selection = editor.getSelection();
          if (!selection) return;
          editor.executeEdits("sia-editor", [{ range: selection, text: content, forceMoveMarkers: true }]);
          editor.focus();
        },
        prefixLines(prefix) {
          const selection = editor.getSelection();
          if (!selection) return;
          const startLine = selection.startLineNumber;
          const endLine = selection.endColumn === 1 && selection.endLineNumber > startLine
            ? selection.endLineNumber - 1
            : selection.endLineNumber;
          const edits = Array.from({ length: endLine - startLine + 1 }, (_, index) => ({
            range: new monaco.Range(startLine + index, 1, startLine + index, 1),
            text: prefix,
            forceMoveMarkers: true,
          }));
          editor.executeEdits("sia-editor", edits);
          editor.focus();
        },
        revealLine(line) {
          editor.revealLineInCenter(line);
          editor.setPosition({ lineNumber: line, column: 1 });
          editor.focus();
        },
        setSelection(range) {
          editor.setSelection(range);
          editor.revealRangeInCenterIfOutsideViewport(range);
          editor.focus();
        },
        wrapSelection(prefix, suffix, placeholder = "") {
          const selection = editor.getSelection();
          if (!selection) return;
          const selectedText = model.getValueInRange(selection);
          const body = selectedText || placeholder;
          editor.executeEdits("sia-editor", [{
            range: selection,
            text: `${prefix}${body}${suffix}`,
            forceMoveMarkers: true,
          }]);
          const startOffset = model.getOffsetAt(selection.getStartPosition()) + prefix.length;
          const endOffset = startOffset + body.length;
          editor.setSelection(monaco.Selection.fromPositions(model.getPositionAt(startOffset), model.getPositionAt(endOffset)));
          editor.focus();
        },
      };

      apiRef.current = api;
      const emitSelection = () => {
        const selection = editor.getSelection();
        if (!selection) return;
        selectionHandlerRef.current?.({
          range: serializeRange(selection),
          text: model.getValueInRange(selection),
          cursorOffset: model.getOffsetAt(selection.getPosition()),
        });
        setSelectionVersion((version) => version + 1);
      };
      subscriptions.push(editor.onDidChangeCursorSelection(emitSelection));

      function updateHighlight() {
        const element = rangeHighlightRef.current;
        const range = highlightRangeRef.current;
        if (!element || !range) {
          element?.removeAttribute("data-visible");
          return;
        }
        const validRange = model.validateRange(range);
        const layout = editor.getLayoutInfo();
        const scrollTop = editor.getScrollTop();
        const startTop = editor.getTopForLineNumber(validRange.startLineNumber) - scrollTop;
        const endTop = validRange.endLineNumber < model.getLineCount()
          ? editor.getTopForLineNumber(validRange.endLineNumber + 1) - scrollTop
          : editor.getTopForLineNumber(validRange.endLineNumber) - scrollTop + editor.getOption(monaco.editor.EditorOption.lineHeight);
        const visibleTop = Math.max(0, startTop);
        const visibleBottom = Math.min(layout.height, endTop);
        if (visibleBottom <= visibleTop) {
          element.removeAttribute("data-visible");
          return;
        }
        element.style.left = `${layout.contentLeft}px`;
        element.style.top = `${visibleTop}px`;
        element.style.width = `${Math.max(0, layout.contentWidth - 12)}px`;
        element.style.height = `${visibleBottom - visibleTop}px`;
        element.setAttribute("data-visible", "true");
      }

      updateHighlightRef.current = updateHighlight;
      subscriptions.push(editor.onDidScrollChange(updateHighlight));
      subscriptions.push(editor.onDidLayoutChange(updateHighlight));
      subscriptions.push(editor.onDidContentSizeChange(updateHighlight));
      setLoading(false);
      readyHandlerRef.current?.(api);
      emitSelection();
      updateHighlight();
    }

    void mountEditor();

    return () => {
      disposed = true;
      readyHandlerRef.current?.(null);
      subscriptions.forEach((subscription) => subscription.dispose());
      editorRef.current?.dispose();
      modelRef.current?.dispose();
      editorRef.current = null;
      modelRef.current = null;
      apiRef.current = null;
      updateHighlightRef.current = () => undefined;
    };
  }, [generatedId]);

  useEffect(() => {
    const model = modelRef.current;
    if (model && model.getValue() !== value) model.setValue(value);
  }, [value]);

  useEffect(() => {
    void loadMonaco().then((monaco) => {
      const model = modelRef.current;
      if (model) monaco.editor.setModelLanguage(model, language);
    });
  }, [language]);

  useEffect(() => {
    void loadMonaco().then((monaco) => {
      if (editorRef.current) monaco.editor.setTheme(theme === "dark" ? "vs-dark" : "vs");
    });
  }, [theme]);

  useEffect(() => {
    editorRef.current?.updateOptions({
      ...(options ?? {}),
      contextmenu: contextMenuItems.length === 0 ? (options?.contextmenu ?? true) : false,
    });
  }, [contextMenuItems.length, options]);

  useEffect(() => {
    updateHighlightRef.current();
  }, [highlightRange]);

  const editorNode = (
    <div className={`sia-editor-control ${className}`.trim()} data-loading={loading || undefined}>
      <div className="sia-editor-control__surface" ref={containerRef} aria-label={ariaLabel} />
      <div ref={rangeHighlightRef} className="sia-editor-control__range-highlight" aria-hidden="true" />
      {loading ? <div className="sia-editor-control__loading" role="status"><span />{loadingText}</div> : null}
    </div>
  );

  if (contextMenuItems.length === 0) return editorNode;

  const menuItems: MenuItem[] = contextMenuItems.map((item) => ({
    key: item.key,
    label: item.label,
    disabled: typeof item.disabled === "function" ? item.disabled(apiRef.current) : item.disabled,
  }));

  function runContextMenuItem(key: string) {
    const item = contextMenuItemsRef.current.find((candidate) => candidate.key === key);
    const editor = editorRef.current;
    const api = apiRef.current;
    if (!item || !editor || !api) return;
    if (item.command) {
      const commandId: Record<EditorCommand, string> = {
        cut: "editor.action.clipboardCutAction",
        copy: "editor.action.clipboardCopyAction",
        paste: "editor.action.clipboardPasteAction",
        selectAll: "editor.action.selectAll",
      };
      editor.trigger("sia-editor-context-menu", commandId[item.command], null);
    } else {
      item.onClick?.(api);
    }
    editor.focus();
  }

  return (
    <Dropdown
      className="sia-editor-control__context-menu"
      popupClassName="sia-editor-control__context-popup"
      trigger={["contextMenu"]}
      tabIndex={-1}
      menu={{ items: menuItems, onClick: ({ key }) => runContextMenuItem(key) }}
      onOpenChange={(open) => {
        if (open) setSelectionVersion((version) => version + 1);
      }}
    >
      {editorNode}
    </Dropdown>
  );
}

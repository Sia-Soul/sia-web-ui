/// <reference path="../vite-env.d.ts" />

import { useEffect, useId, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";

export type EditorTheme = "light" | "dark";

export interface EditorHandle {
  focus(): void;
  insertBlock(content: string): void;
  prefixLines(prefix: string): void;
  revealLine(line: number): void;
  wrapSelection(prefix: string, suffix: string, placeholder?: string): void;
}

export interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  onReady?: (api: EditorHandle | null) => void;
  language?: string;
  path?: string;
  theme?: EditorTheme;
  options?: Monaco.editor.IStandaloneEditorConstructionOptions;
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
  return import("monaco-editor/editor/editor.api.js");
}

export function Editor({
  value,
  onChange,
  onReady,
  language = "plaintext",
  path,
  theme = "light",
  options,
  className = "",
  ariaLabel = "代码编辑器",
  loadingText = "正在加载编辑器…",
}: EditorProps) {
  const generatedId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null);
  const changeHandlerRef = useRef(onChange);
  const readyHandlerRef = useRef(onReady);
  const initialValueRef = useRef(value);
  const initialLanguageRef = useRef(language);
  const initialPathRef = useRef(path);
  const initialThemeRef = useRef(theme);
  const initialOptionsRef = useRef(options);
  const [loading, setLoading] = useState(true);

  changeHandlerRef.current = onChange;
  readyHandlerRef.current = onReady;

  useEffect(() => {
    let disposed = false;
    let contentSubscription: Monaco.IDisposable | undefined;

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
        contextmenu: true,
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
      contentSubscription = editor.onDidChangeModelContent(() => {
        changeHandlerRef.current?.(model.getValue());
      });

      const api: EditorHandle = {
        focus: () => editor.focus(),
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

      setLoading(false);
      readyHandlerRef.current?.(api);
    }

    void mountEditor();

    return () => {
      disposed = true;
      readyHandlerRef.current?.(null);
      contentSubscription?.dispose();
      editorRef.current?.dispose();
      modelRef.current?.dispose();
      editorRef.current = null;
      modelRef.current = null;
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
    editorRef.current?.updateOptions(options ?? {});
  }, [options]);

  return (
    <div className={`sia-editor-control ${className}`.trim()} data-loading={loading || undefined}>
      <div className="sia-editor-control__surface" ref={containerRef} aria-label={ariaLabel} />
      {loading ? <div className="sia-editor-control__loading" role="status"><span />{loadingText}</div> : null}
    </div>
  );
}

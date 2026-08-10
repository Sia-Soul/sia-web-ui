/// <reference path="../vite-env.d.ts" />

import { useEffect, useId, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import { Dropdown } from "./Dropdown";
import { registerJsonLanguage } from "./jsonLanguage";
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

export interface EditorMarker extends EditorRange {
  message: string;
  severity?: "error" | "warning" | "info";
  source?: string;
}

export interface EditorSelectionChange {
  range: EditorRange;
  text: string;
  cursorOffset: number;
}

export interface EditorKeyDownEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export type EditorCompletionItemKind =
  | "text"
  | "keyword"
  | "snippet"
  | "database"
  | "schema"
  | "table"
  | "view"
  | "column"
  | "function"
  | "procedure"
  | "value";

export interface EditorCompletionContext {
  value: string;
  textBeforeCursor: string;
  lineTextBeforeCursor: string;
  word: string;
  position: {
    lineNumber: number;
    column: number;
    offset: number;
  };
  triggerCharacter?: string;
}

export interface EditorCompletionItem {
  label: string;
  insertText?: string;
  kind?: EditorCompletionItemKind;
  detail?: string;
  documentation?: string;
  filterText?: string;
  sortText?: string;
  preselect?: boolean;
  commitCharacters?: readonly string[];
  insertTextFormat?: "plain" | "snippet";
  range?: EditorRange;
}

export type EditorCompletionProvider = (
  context: EditorCompletionContext,
) => readonly EditorCompletionItem[] | Promise<readonly EditorCompletionItem[]>;

export type EditorCommand = "cut" | "copy" | "paste" | "selectAll";

export interface EditorContextMenuItem {
  key: string;
  label: string;
  command?: EditorCommand;
  shortcut?: string;
  disabled?: boolean | ((api: EditorHandle | null) => boolean);
  onClick?: (api: EditorHandle) => void;
}

const EDITOR_COMMAND_SHORTCUTS: Record<EditorCommand, string> = {
  cut: "Ctrl+X",
  copy: "Ctrl+C",
  paste: "Ctrl+V",
  selectAll: "Ctrl+A",
};

export interface EditorHandle {
  focus(): void;
  getValue(): string;
  getSelection(): EditorRange | null;
  getSelectedText(): string;
  insertBlock(content: string): void;
  prefixLines(prefix: string): void;
  replaceValue(content: string): void;
  revealLine(line: number): void;
  setSelection(range: EditorRange): void;
  wrapSelection(prefix: string, suffix: string, placeholder?: string): void;
}

export interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  onReady?: (api: EditorHandle | null) => void;
  onSelectionChange?: (selection: EditorSelectionChange) => void;
  onKeyDown?: (event: EditorKeyDownEvent) => void;
  language?: EditorLanguage;
  path?: string;
  theme?: EditorTheme;
  options?: Monaco.editor.IStandaloneEditorConstructionOptions;
  highlightRange?: EditorRange | null;
  markers?: readonly EditorMarker[];
  contextMenuItems?: readonly EditorContextMenuItem[];
  completionProvider?: EditorCompletionProvider;
  completionTriggerCharacters?: readonly string[];
  refreshSuggestionOnSpace?: boolean;
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
  await import("monaco-editor/nls/lang/zh-cn.js");
  await Promise.all([
    import("monaco-editor/languages/definitions/bat/register.js"),
    import("monaco-editor/languages/definitions/clojure/register.js"),
    import("monaco-editor/languages/definitions/coffee/register.js"),
    import("monaco-editor/languages/definitions/cpp/register.js"),
    import("monaco-editor/languages/definitions/csharp/register.js"),
    import("monaco-editor/languages/definitions/css/register.js"),
    import("monaco-editor/languages/definitions/dart/register.js"),
    import("monaco-editor/languages/definitions/dockerfile/register.js"),
    import("monaco-editor/languages/definitions/fsharp/register.js"),
    import("monaco-editor/languages/definitions/go/register.js"),
    import("monaco-editor/languages/definitions/graphql/register.js"),
    import("monaco-editor/languages/definitions/handlebars/register.js"),
    import("monaco-editor/languages/definitions/html/register.js"),
    import("monaco-editor/languages/definitions/ini/register.js"),
    import("monaco-editor/languages/definitions/java/register.js"),
    import("monaco-editor/languages/definitions/javascript/register.js"),
    import("monaco-editor/languages/definitions/julia/register.js"),
    import("monaco-editor/languages/definitions/kotlin/register.js"),
    import("monaco-editor/languages/definitions/less/register.js"),
    import("monaco-editor/languages/definitions/lua/register.js"),
    import("monaco-editor/languages/definitions/markdown/register.js"),
    import("monaco-editor/languages/definitions/mips/register.js"),
    import("monaco-editor/languages/definitions/objective-c/register.js"),
    import("monaco-editor/languages/definitions/pascal/register.js"),
    import("monaco-editor/languages/definitions/perl/register.js"),
    import("monaco-editor/languages/definitions/php/register.js"),
    import("monaco-editor/languages/definitions/powershell/register.js"),
    import("monaco-editor/languages/definitions/protobuf/register.js"),
    import("monaco-editor/languages/definitions/pug/register.js"),
    import("monaco-editor/languages/definitions/python/register.js"),
    import("monaco-editor/languages/definitions/r/register.js"),
    import("monaco-editor/languages/definitions/razor/register.js"),
    import("monaco-editor/languages/definitions/restructuredtext/register.js"),
    import("monaco-editor/languages/definitions/ruby/register.js"),
    import("monaco-editor/languages/definitions/rust/register.js"),
    import("monaco-editor/languages/definitions/scala/register.js"),
    import("monaco-editor/languages/definitions/scss/register.js"),
    import("monaco-editor/languages/definitions/shell/register.js"),
    import("monaco-editor/languages/definitions/solidity/register.js"),
    import("monaco-editor/languages/definitions/sql/register.js"),
    import("monaco-editor/languages/definitions/swift/register.js"),
    import("monaco-editor/languages/definitions/systemverilog/register.js"),
    import("monaco-editor/languages/definitions/tcl/register.js"),
    import("monaco-editor/languages/definitions/typescript/register.js"),
    import("monaco-editor/languages/definitions/vb/register.js"),
    import("monaco-editor/languages/definitions/wgsl/register.js"),
    import("monaco-editor/languages/definitions/xml/register.js"),
    import("monaco-editor/languages/definitions/yaml/register.js"),
    import("monaco-editor/editor/contrib/clipboard/browser/clipboard.js"),
    import("monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js"),
    import("monaco-editor/editor/contrib/find/browser/findController.js"),
    import("monaco-editor/editor/contrib/gotoError/browser/gotoError.js"),
    import("monaco-editor/editor/contrib/hover/browser/hoverContribution.js"),
    import("monaco-editor/editor/contrib/suggest/browser/suggestController.js"),
  ]);
  const monaco = await import("monaco-editor/editor/editor.api.js");
  registerJsonLanguage(monaco);
  registerSqlLanguages(monaco);
  return monaco;
}

export function Editor({
  value,
  onChange,
  onReady,
  onSelectionChange,
  onKeyDown,
  language = "plaintext",
  path,
  theme = "light",
  options,
  highlightRange,
  markers = [],
  contextMenuItems = [],
  completionProvider,
  completionTriggerCharacters = ["."],
  refreshSuggestionOnSpace = false,
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
  const applyingControlledValueRef = useRef(false);
  const updateHighlightRef = useRef<() => void>(() => undefined);
  const changeHandlerRef = useRef(onChange);
  const readyHandlerRef = useRef(onReady);
  const selectionHandlerRef = useRef(onSelectionChange);
  const keyDownHandlerRef = useRef(onKeyDown);
  const highlightRangeRef = useRef(highlightRange);
  const markersRef = useRef(markers);
  const contextMenuItemsRef = useRef(contextMenuItems);
  const completionProviderRef = useRef(completionProvider);
  const refreshSuggestionOnSpaceRef = useRef(refreshSuggestionOnSpace);
  const initialValueRef = useRef(value);
  const initialLanguageRef = useRef(language);
  const initialPathRef = useRef(path);
  const initialThemeRef = useRef(theme);
  const initialOptionsRef = useRef(options);
  const [loading, setLoading] = useState(true);
  const [, setSelectionVersion] = useState(0);

  // Monaco 按需异步加载；挂载完成前受控属性可能已经变化，初始化时必须使用最新值。
  initialValueRef.current = value;
  initialLanguageRef.current = language;
  initialPathRef.current = path;
  initialThemeRef.current = theme;
  initialOptionsRef.current = options;
  changeHandlerRef.current = onChange;
  readyHandlerRef.current = onReady;
  selectionHandlerRef.current = onSelectionChange;
  keyDownHandlerRef.current = onKeyDown;
  highlightRangeRef.current = highlightRange;
  markersRef.current = markers;
  contextMenuItemsRef.current = contextMenuItems;
  completionProviderRef.current = completionProvider;
  refreshSuggestionOnSpaceRef.current = refreshSuggestionOnSpace;

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
        fontFamily: '"Cascadia Mono", "Cascadia Code", "JetBrains Mono", "Microsoft YaHei UI", monospace',
        fontSize: 14,
        lineHeight: 23,
        minimap: { enabled: false },
        padding: { top: 18, bottom: 18 },
        renderWhitespace: "selection",
        dragAndDrop: true,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        stickyScroll: { enabled: true },
        hover: { enabled: "on", delay: 250, sticky: true },
        tabSize: 2,
        wordWrap: "on",
        ...initialOptionsRef.current,
      });

      editorRef.current = editor;
      modelRef.current = model;
      let refreshSuggestionAfterSpace = false;
      let refreshSuggestionTimer: number | undefined;
      let selectionClickCandidate: {
        x: number;
        y: number;
        moved: boolean;
        position: Monaco.Position;
        selection: Monaco.Selection;
        text: string;
        modelVersionId: number;
      } | null = null;
      let selectionDragTargetPosition: Monaco.Position | null = null;
      const selectionDragTargetElement = document.createElement("span");
      selectionDragTargetElement.className = "sia-editor-control__selection-drop-caret";
      const selectionDragTargetWidget: Monaco.editor.IContentWidget = {
        suppressMouseDown: true,
        getId: () => `${generatedId}-selection-drop-caret`,
        getDomNode: () => selectionDragTargetElement,
        getPosition: () => selectionDragTargetPosition ? {
          position: selectionDragTargetPosition,
          preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
        } : null,
      };
      editor.addContentWidget(selectionDragTargetWidget);
      const clearSelectionDragTarget = () => {
        if (!selectionDragTargetPosition) return;
        selectionDragTargetPosition = null;
        editor.layoutContentWidget(selectionDragTargetWidget);
      };
      const updateSelectionDragTarget = (clientX: number, clientY: number) => {
        const candidate = selectionClickCandidate;
        if (!candidate?.moved) {
          clearSelectionDragTarget();
          return;
        }
        const position = editor.getTargetAtClientPoint(clientX, clientY)?.position;
        if (!position || candidate.selection.containsPosition(position)) {
          clearSelectionDragTarget();
          return;
        }
        selectionDragTargetPosition = position;
        editor.layoutContentWidget(selectionDragTargetWidget);
      };
      subscriptions.push(editor.onDidChangeModelContent(() => {
        if (!applyingControlledValueRef.current) changeHandlerRef.current?.(model.getValue());
        if (!refreshSuggestionAfterSpace) return;
        refreshSuggestionAfterSpace = false;
        window.clearTimeout(refreshSuggestionTimer);
        refreshSuggestionTimer = window.setTimeout(() => {
          if (editor.hasTextFocus()) {
            editor.trigger("sia-editor", "editor.action.triggerSuggest", null);
          }
        }, 0);
      }));
      subscriptions.push(editor.onMouseDown((event) => {
        clearSelectionDragTarget();
        const selection = editor.getSelection();
        const position = event.target.position;
        if (event.event.leftButton
          && position
          && !event.event.ctrlKey
          && !event.event.metaKey
          && !event.event.altKey
          && !event.event.shiftKey
          && event.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
          && editor.getOption(monaco.editor.EditorOption.selectOnLineNumbers)) {
          const lineNumber = position.lineNumber;
          const endPosition = lineNumber < model.getLineCount()
            ? new monaco.Position(lineNumber + 1, 1)
            : new monaco.Position(lineNumber, model.getLineMaxColumn(lineNumber));
          editor.setSelection(new monaco.Selection(lineNumber, 1, endPosition.lineNumber, endPosition.column));
          editor.focus();
          selectionClickCandidate = null;
          return;
        }
        selectionClickCandidate = event.event.leftButton
          && !event.event.ctrlKey
          && !event.event.metaKey
          && !event.event.altKey
          && !event.event.shiftKey
          && position
          && selection
          && !selection.isEmpty()
          && selection.containsPosition(position)
          ? {
            x: event.event.posx,
            y: event.event.posy,
            moved: false,
            position,
            selection,
            text: model.getValueInRange(selection),
            modelVersionId: model.getVersionId(),
          }
          : null;
      }));
      const trackSelectionDrag = (clientX: number, clientY: number) => {
        if (!selectionClickCandidate) return;
        const horizontalDistance = clientX - selectionClickCandidate.x;
        const verticalDistance = clientY - selectionClickCandidate.y;
        // WebView 在按住鼠标移动时不一定持续报告 buttons=1，因此只按位移判断真实拖动。
        // Monaco 会把很小的手部抖动也识别为选区拖放；超过 4px 才视为用户确实在拖动。
        if (horizontalDistance * horizontalDistance + verticalDistance * verticalDistance > 16) {
          if (!selectionClickCandidate.moved) {
            // 与 VS Code / Monaco 原生选区拖放一致：开始拖动后由文本光标切换为箭头。
            editor.updateOptions({ mouseStyle: "default" });
          }
          selectionClickCandidate.moved = true;
        }
        if (selectionClickCandidate.moved) updateSelectionDragTarget(clientX, clientY);
      };
      subscriptions.push(editor.onMouseMove((event) => {
        trackSelectionDrag(event.event.posx, event.event.posy);
      }));
      const handlePointerMove = (event: PointerEvent) => {
        trackSelectionDrag(event.clientX, event.clientY);
      };
      const finishSelectionPointerInteraction = (
        clientX: number,
        clientY: number,
        fallbackPosition?: Monaco.Position | null,
      ) => {
        const candidate = selectionClickCandidate;
        selectionClickCandidate = null;
        clearSelectionDragTarget();
        if (!candidate) return;

        editor.updateOptions({ mouseStyle: "text" });
        if (!candidate.moved) {
          const clickPosition = editor.getTargetAtClientPoint(clientX, clientY)?.position
            ?? fallbackPosition
            ?? candidate.position;
          window.setTimeout(() => {
            // 在 Monaco 自己的 pointerup/mouseup 处理完成后再折叠选区，避免被拖放控制器覆盖。
            if (disposed || model.isDisposed() || model.getVersionId() !== candidate.modelVersionId) return;
            editor.setSelection(monaco.Selection.fromPositions(clickPosition));
            editor.focus();
          }, 0);
          return;
        }

        window.setTimeout(() => {
          // Monaco 原生拖放成功时模型版本已经变化，此处不能重复移动。
          if (disposed || model.isDisposed() || model.getVersionId() !== candidate.modelVersionId) return;
          const targetPosition = editor.getTargetAtClientPoint(clientX, clientY)?.position;
          if (!targetPosition) return;
          const sourceRange = model.validateRange(candidate.selection);
          const sourceStartOffset = model.getOffsetAt(sourceRange.getStartPosition());
          const sourceEndOffset = model.getOffsetAt(sourceRange.getEndPosition());
          const targetOffset = model.getOffsetAt(targetPosition);
          if (targetOffset >= sourceStartOffset && targetOffset <= sourceEndOffset) return;

          editor.pushUndoStop();
          editor.executeEdits("sia-editor-selection-drag", [
            { range: sourceRange, text: "", forceMoveMarkers: true },
            { range: monaco.Range.fromPositions(targetPosition), text: candidate.text, forceMoveMarkers: true },
          ]);
          const insertedStartOffset = targetOffset > sourceEndOffset
            ? targetOffset - candidate.text.length
            : targetOffset;
          editor.setSelection(monaco.Selection.fromPositions(
            model.getPositionAt(insertedStartOffset),
            model.getPositionAt(insertedStartOffset + candidate.text.length),
          ));
          editor.pushUndoStop();
          editor.focus();
        }, 0);
      };
      const handlePointerUp = (event: PointerEvent) => {
        finishSelectionPointerInteraction(event.clientX, event.clientY);
      };
      const handlePointerCancel = () => {
        selectionClickCandidate = null;
        clearSelectionDragTarget();
        editor.updateOptions({ mouseStyle: "text" });
      };
      window.addEventListener("pointermove", handlePointerMove, true);
      window.addEventListener("pointerup", handlePointerUp, true);
      window.addEventListener("pointercancel", handlePointerCancel, true);
      subscriptions.push({
        dispose: () => {
          editor.removeContentWidget(selectionDragTargetWidget);
          window.removeEventListener("pointermove", handlePointerMove, true);
          window.removeEventListener("pointerup", handlePointerUp, true);
          window.removeEventListener("pointercancel", handlePointerCancel, true);
        },
      });
      subscriptions.push(editor.onMouseUp((event) => {
        finishSelectionPointerInteraction(event.event.posx, event.event.posy, event.target.position);
      }));
      subscriptions.push(editor.onDidBlurEditorWidget(() => {
        selectionClickCandidate = null;
        clearSelectionDragTarget();
        editor.updateOptions({ mouseStyle: "text" });
      }));
      subscriptions.push(editor.onKeyDown((event) => {
        const browserEvent = event.browserEvent;
        if (refreshSuggestionOnSpaceRef.current
          && event.keyCode === monaco.KeyCode.Space
          && !browserEvent.ctrlKey
          && !browserEvent.metaKey
          && !browserEvent.altKey) {
          refreshSuggestionAfterSpace = true;
          editor.trigger("sia-editor", "hideSuggestWidget", null);
        }
        keyDownHandlerRef.current?.({
          key: browserEvent.key,
          code: browserEvent.code,
          ctrlKey: browserEvent.ctrlKey,
          metaKey: browserEvent.metaKey,
          shiftKey: browserEvent.shiftKey,
          altKey: browserEvent.altKey,
          repeat: browserEvent.repeat,
          preventDefault: () => event.preventDefault(),
          stopPropagation: () => event.stopPropagation(),
        });
      }));
      subscriptions.push({
        dispose: () => window.clearTimeout(refreshSuggestionTimer),
      });

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
        replaceValue(content) {
          if (model.getValue() === content) return;
          const selection = editor.getSelection();
          const startOffset = selection ? model.getOffsetAt(selection.getStartPosition()) : 0;
          const endOffset = selection ? model.getOffsetAt(selection.getEndPosition()) : startOffset;
          editor.pushUndoStop();
          editor.executeEdits("sia-editor-replace-value", [{
            range: model.getFullModelRange(),
            text: content,
            forceMoveMarkers: true,
          }]);
          editor.pushUndoStop();
          editor.setSelection(monaco.Selection.fromPositions(
            model.getPositionAt(Math.min(startOffset, content.length)),
            model.getPositionAt(Math.min(endOffset, content.length)),
          ));
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
    if (!model || model.getValue() === value) return;
    applyingControlledValueRef.current = true;
    try {
      model.setValue(value);
    } finally {
      applyingControlledValueRef.current = false;
    }
  }, [loading, value]);

  useEffect(() => {
    if (loading) return;
    void loadMonaco().then((monaco) => {
      const model = modelRef.current;
      if (model) monaco.editor.setModelLanguage(model, language);
    });
  }, [language, loading]);

  const completionEnabled = Boolean(completionProvider);
  const completionTriggerKey = completionTriggerCharacters.join("\u0000");

  useEffect(() => {
    if (loading || !completionEnabled) return undefined;
    let disposed = false;
    let subscription: Monaco.IDisposable | undefined;
    void loadMonaco().then((monaco) => {
      const editorModel = modelRef.current;
      if (disposed || !editorModel) return;
      const kindMap: Record<EditorCompletionItemKind, Monaco.languages.CompletionItemKind> = {
        text: monaco.languages.CompletionItemKind.Text,
        keyword: monaco.languages.CompletionItemKind.Keyword,
        snippet: monaco.languages.CompletionItemKind.Snippet,
        database: monaco.languages.CompletionItemKind.Module,
        schema: monaco.languages.CompletionItemKind.Module,
        table: monaco.languages.CompletionItemKind.Struct,
        view: monaco.languages.CompletionItemKind.Interface,
        column: monaco.languages.CompletionItemKind.Field,
        function: monaco.languages.CompletionItemKind.Function,
        procedure: monaco.languages.CompletionItemKind.Method,
        value: monaco.languages.CompletionItemKind.Value,
      };
      subscription = monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: completionTriggerKey ? completionTriggerKey.split("\u0000") : undefined,
        provideCompletionItems: async (model, position, context, token) => {
          const provider = completionProviderRef.current;
          if (!provider || model !== editorModel) return { suggestions: [] };
          const word = model.getWordUntilPosition(position);
          const offset = model.getOffsetAt(position);
          const defaultRange = new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          );
          const items = await provider({
            value: model.getValue(),
            textBeforeCursor: model.getValue().slice(0, offset),
            lineTextBeforeCursor: model.getLineContent(position.lineNumber).slice(0, position.column - 1),
            word: word.word,
            position: {
              lineNumber: position.lineNumber,
              column: position.column,
              offset,
            },
            triggerCharacter: context.triggerCharacter,
          });
          if (token.isCancellationRequested) return { suggestions: [] };
          return {
            suggestions: items.map((item) => ({
              label: item.label,
              insertText: item.insertText ?? item.label,
              kind: kindMap[item.kind ?? "text"],
              detail: item.detail,
              documentation: item.documentation,
              filterText: item.filterText,
              sortText: item.sortText,
              preselect: item.preselect,
              commitCharacters: item.commitCharacters ? [...item.commitCharacters] : undefined,
              insertTextRules: item.insertTextFormat === "snippet"
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              range: item.range ? new monaco.Range(
                item.range.startLineNumber,
                item.range.startColumn,
                item.range.endLineNumber,
                item.range.endColumn,
              ) : defaultRange,
            })),
          };
        },
      });
    });
    return () => {
      disposed = true;
      subscription?.dispose();
    };
  }, [completionEnabled, completionTriggerKey, language, loading]);

  useEffect(() => {
    if (loading) return;
    void loadMonaco().then((monaco) => {
      if (editorRef.current) monaco.editor.setTheme(theme === "dark" ? "vs-dark" : "vs");
    });
  }, [loading, theme]);

  useEffect(() => {
    if (loading) return;
    editorRef.current?.updateOptions({
      ...(options ?? {}),
      contextmenu: contextMenuItems.length === 0 ? (options?.contextmenu ?? true) : false,
    });
  }, [contextMenuItems.length, loading, options]);

  useEffect(() => {
    updateHighlightRef.current();
  }, [highlightRange]);

  useEffect(() => {
    if (loading) return;
    void loadMonaco().then((monaco) => {
      const model = modelRef.current;
      if (!model) return;
      const severityMap = {
        error: monaco.MarkerSeverity.Error,
        warning: monaco.MarkerSeverity.Warning,
        info: monaco.MarkerSeverity.Info,
      } as const;
      monaco.editor.setModelMarkers(model, `sia-editor-${generatedId}`, markers.map((marker) => ({
        ...model.validateRange(marker),
        message: marker.message,
        severity: severityMap[marker.severity ?? "error"],
        source: marker.source,
      })));
    });
  }, [generatedId, loading, markers]);

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
    extra: item.shortcut ?? (item.command ? EDITOR_COMMAND_SHORTCUTS[item.command] : undefined),
    disabled: typeof item.disabled === "function" ? item.disabled(apiRef.current) : item.disabled,
  }));

  function runContextMenuItem(key: string) {
    const item = contextMenuItemsRef.current.find((candidate) => candidate.key === key);
    const editor = editorRef.current;
    const api = apiRef.current;
    if (!item || !editor || !api) return;
    editor.focus();
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

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { FormEvent, HTMLAttributes, ReactNode } from "react";
import DOMPurify from "dompurify";
import { Editor as TiptapEditor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "@tiptap/markdown";
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";
import { Icon } from "./Icon";
import { Input } from "./Input";

export type RichTextImagePasteHandler = (file: File) => string | Promise<string>;
export type RichTextContentFormat = "html" | "markdown";
export type RichTextToolbar = "basic" | "full";

export interface RichTextEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "contentEditable" | "onChange"> {
  value?: string;
  defaultValue?: string;
  contentFormat?: RichTextContentFormat;
  toolbar?: RichTextToolbar;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number | string;
  pasteImageHint?: ReactNode;
  onChange?: (content: string) => void;
  onPasteImage?: RichTextImagePasteHandler;
  saveShortcut?: () => void;
}

export interface RichTextContentProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  content: string;
  emptyText?: ReactNode;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeContent(value: string) {
  if (!value.trim()) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return value;
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function sanitizeContent(value: string) {
  return DOMPurify.sanitize(normalizeContent(value), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["loading", "decoding"],
  }).replace(/<img\b/giu, '<img loading="lazy" decoding="async"');
}

export function RichTextContent({ content, emptyText = "暂无内容", className = "", ...props }: RichTextContentProps) {
  const html = useMemo(() => sanitizeContent(content), [content]);
  if (!html.trim()) return <div className={`sia-rich-text-content sia-rich-text-content--empty ${className}`.trim()}>{emptyText}</div>;
  return <article className={`sia-rich-text-content ${className}`.trim()} dangerouslySetInnerHTML={{ __html: html }} {...props} />;
}

export function RichTextEditor({
  value,
  defaultValue = "",
  contentFormat = "html",
  toolbar = "basic",
  placeholder = "请输入内容",
  disabled = false,
  minHeight = 150,
  pasteImageHint = "可直接粘贴图片",
  onChange,
  onPasteImage,
  saveShortcut,
  className = "",
  id,
  style,
  "aria-label": ariaLabel,
  ...props
}: RichTextEditorProps) {
  const initialValueRef = useRef(value ?? defaultValue);
  const lastEmittedValueRef = useRef(value ?? defaultValue);
  const onChangeRef = useRef(onChange);
  const onPasteImageRef = useRef(onPasteImage);
  const saveShortcutRef = useRef(saveShortcut);
  const contentFormatRef = useRef(contentFormat);
  const editorElementRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TiptapEditor | null>(null);
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [, setEditorRevision] = useState(0);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onPasteImageRef.current = onPasteImage; }, [onPasteImage]);
  useEffect(() => { saveShortcutRef.current = saveShortcut; }, [saveShortcut]);
  useEffect(() => { contentFormatRef.current = contentFormat; }, [contentFormat]);

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false, autolink: true, linkOnPaste: true },
      underline: { HTMLAttributes: { "data-sia-underline": "" } },
    }),
    Placeholder.configure({ placeholder }),
    Image.configure({ allowBase64: false, inline: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({ markedOptions: { gfm: true } }),
  ], [placeholder]);

  useEffect(() => {
    const element = editorElementRef.current;
    if (!element) return;
    const nextEditor = new TiptapEditor({
      element,
      extensions,
      content: initialValueRef.current,
      contentType: contentFormatRef.current,
      editable: !disabled,
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-label": ariaLabel ?? "富文本编辑器",
          "aria-multiline": "true",
        },
        handlePaste: (_view, event) => {
          const pasteHandler = onPasteImageRef.current;
          if (!pasteHandler) return false;
          const images = Array.from(event.clipboardData?.items ?? [])
            .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter((file): file is File => Boolean(file));
          if (!images.length) return false;
          event.preventDefault();
          void (async () => {
            for (const file of images) {
              try {
                const src = await pasteHandler(file);
                if (src) nextEditor.chain().focus().setImage({ src, alt: file.name || "粘贴的图片" }).run();
              } catch {
                // 具体上传错误由业务侧提示；编辑器保持当前内容不变。
              }
            }
          })();
          return true;
        },
        handleKeyDown: (_view, event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && saveShortcutRef.current) {
            event.preventDefault();
            saveShortcutRef.current();
            return true;
          }
          return false;
        },
      },
      onSelectionUpdate: () => setEditorRevision((current) => current + 1),
      onUpdate: ({ editor: currentEditor }) => {
        setEditorRevision((current) => current + 1);
        const nextValue = contentFormatRef.current === "markdown" ? currentEditor.getMarkdown() : currentEditor.getHTML();
        lastEmittedValueRef.current = nextValue;
        onChangeRef.current?.(nextValue);
      },
    });
    editorRef.current = nextEditor;
    setEditor(nextEditor);
    return () => {
      editorRef.current = null;
      setEditor(null);
      nextEditor.destroy();
    };
  }, [ariaLabel, extensions]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || value === undefined || value === lastEmittedValueRef.current) return;
    editor.commands.setContent(value, { emitUpdate: false, contentType: contentFormat });
    lastEmittedValueRef.current = value;
  }, [contentFormat, editor, value]);

  function openLinkEditor(open: boolean) {
    if (open && editor) setLinkHref(String(editor.getAttributes("link").href ?? ""));
    setLinkEditorOpen(open);
  }

  function submitLink(event?: FormEvent) {
    event?.preventDefault();
    if (!editor) return;
    if (!linkHref.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkHref.trim() }).run();
    }
    setLinkEditorOpen(false);
  }

  function formatButton(label: string, action: () => void, active = false, disabledByState = false, content?: ReactNode) {
    return <Button
      type="button"
      variant="text"
      size="small"
      className={`sia-rich-text-editor__tool${active ? " is-active" : ""}`}
      disabled={disabled || disabledByState || !editor}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >{content ?? label}</Button>;
  }

  const mergedStyle = {
    ...style,
    "--sia-rich-text-min-height": typeof minHeight === "number" ? `${minHeight}px` : minHeight,
  } as CSSProperties;

  const currentBlockLabel = editor?.isActive("heading", { level: 1 }) ? "H1"
    : editor?.isActive("heading", { level: 2 }) ? "H2"
      : editor?.isActive("heading", { level: 3 }) ? "H3"
        : "正文";

  const blockTypeMenu = {
    selectable: true,
    selectedKeys: [editor?.isActive("heading", { level: 1 }) ? "h1" : editor?.isActive("heading", { level: 2 }) ? "h2" : editor?.isActive("heading", { level: 3 }) ? "h3" : "paragraph"],
    items: [
      { key: "paragraph", label: "正文" },
      { key: "h1", label: "一级标题" },
      { key: "h2", label: "二级标题" },
      { key: "h3", label: "三级标题" },
    ],
    onClick: ({ key }: { key: string }) => {
      if (!editor) return;
      if (key === "paragraph") editor.chain().focus().setParagraph().run();
      else editor.chain().focus().toggleHeading({ level: Number(key.slice(1)) as 1 | 2 | 3 }).run();
    },
  };

  return <div {...props} id={id} style={mergedStyle} className={`sia-rich-text-editor${disabled ? " is-disabled" : ""} sia-rich-text-editor--${toolbar} ${className}`.trim()}>
    <div className="sia-rich-text-editor__toolbar" aria-label="文本格式工具栏">
      <div className="sia-rich-text-editor__toolbar-main">
        {toolbar === "full" ? <>
          {formatButton("撤销", () => editor?.chain().focus().undo().run(), false, !editor?.can().undo(), <Icon name="undo" />)}
          {formatButton("重做", () => editor?.chain().focus().redo().run(), false, !editor?.can().redo(), <Icon name="redo" />)}
          <span className="sia-rich-text-editor__divider" />
          <Dropdown menu={blockTypeMenu} trigger={["click"]} placement="bottomLeft" disabled={disabled || !editor}>
            <Button type="button" variant="text" size="small" className="sia-rich-text-editor__block-type" disabled={disabled || !editor} aria-label="段落格式" title="段落格式" onMouseDown={(event) => event.preventDefault()}>{currentBlockLabel}<Icon name="chevron-down" size={13} /></Button>
          </Dropdown>
          <span className="sia-rich-text-editor__divider" />
        </> : null}
        {formatButton("加粗", () => editor?.chain().focus().toggleBold().run(), Boolean(editor?.isActive("bold")), false, <strong>B</strong>)}
        {formatButton("斜体", () => editor?.chain().focus().toggleItalic().run(), Boolean(editor?.isActive("italic")), false, <em>I</em>)}
        {toolbar === "full" ? <>
          {formatButton("下划线", () => editor?.chain().focus().toggleUnderline().run(), Boolean(editor?.isActive("underline")), false, <u>U</u>)}
          {formatButton("删除线", () => editor?.chain().focus().toggleStrike().run(), Boolean(editor?.isActive("strike")), false, <s>S</s>)}
          {formatButton("行内代码", () => editor?.chain().focus().toggleCode().run(), Boolean(editor?.isActive("code")), false, "</>")}
          <Dropdown
            menu={{ items: [] }}
            trigger={["click"]}
            placement="bottomLeft"
            open={linkEditorOpen}
            disabled={disabled || !editor}
            onOpenChange={openLinkEditor}
            popupClassName="sia-rich-text-editor__link-popup"
            popupRender={() => <form className="sia-rich-text-editor__link-form" onSubmit={submitLink}>
              <Input autoFocus aria-label="链接地址" value={linkHref} onChange={(event) => setLinkHref(event.target.value)} placeholder="https://example.com" />
              <Button type="submit" variant="primary" size="small">应用</Button>
              {editor?.isActive("link") ? <Button type="button" size="small" onClick={() => { setLinkHref(""); editor.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkEditorOpen(false); }}>移除</Button> : null}
            </form>}
          >
            <Button type="button" variant="text" size="small" className={`sia-rich-text-editor__tool${editor?.isActive("link") ? " is-active" : ""}`} disabled={disabled || !editor} aria-label="链接" aria-pressed={editor?.isActive("link") || undefined} title="链接" onMouseDown={(event) => event.preventDefault()}><Icon name="link" /></Button>
          </Dropdown>
          <span className="sia-rich-text-editor__divider" />
        </> : null}
        {formatButton("无序列表", () => editor?.chain().focus().toggleBulletList().run(), Boolean(editor?.isActive("bulletList")), false, "• 列表")}
        {formatButton("有序列表", () => editor?.chain().focus().toggleOrderedList().run(), Boolean(editor?.isActive("orderedList")), false, "1. 列表")}
        {toolbar === "full" ? <>
          {formatButton("任务列表", () => editor?.chain().focus().toggleTaskList().run(), Boolean(editor?.isActive("taskList")), false, "☑ 任务")}
          {formatButton("引用", () => editor?.chain().focus().toggleBlockquote().run(), Boolean(editor?.isActive("blockquote")), false, "❝ 引用")}
          {formatButton("代码块", () => editor?.chain().focus().toggleCodeBlock().run(), Boolean(editor?.isActive("codeBlock")), false, "代码块")}
          {formatButton("插入表格", () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), Boolean(editor?.isActive("table")), false, "表格")}
          {formatButton("分割线", () => editor?.chain().focus().setHorizontalRule().run(), false, false, <Icon name="minus" />)}
        </> : null}
      </div>
      {onPasteImage ? <small><Icon name="image" size={14} />{pasteImageHint}</small> : null}
    </div>
    {toolbar === "full" && editor?.isActive("table") ? <div className="sia-rich-text-editor__table-toolbar" aria-label="表格工具栏">
      <span>表格</span>
      {formatButton("前方插入列", () => editor.chain().focus().addColumnBefore().run(), false, !editor.can().addColumnBefore(), "前插列")}
      {formatButton("后方插入列", () => editor.chain().focus().addColumnAfter().run(), false, !editor.can().addColumnAfter(), "后插列")}
      {formatButton("删除当前列", () => editor.chain().focus().deleteColumn().run(), false, !editor.can().deleteColumn(), "删列")}
      <span className="sia-rich-text-editor__divider" />
      {formatButton("上方插入行", () => editor.chain().focus().addRowBefore().run(), false, !editor.can().addRowBefore(), "上插行")}
      {formatButton("下方插入行", () => editor.chain().focus().addRowAfter().run(), false, !editor.can().addRowAfter(), "下插行")}
      {formatButton("删除当前行", () => editor.chain().focus().deleteRow().run(), false, !editor.can().deleteRow(), "删行")}
      <span className="sia-rich-text-editor__divider" />
      {formatButton("删除表格", () => editor.chain().focus().deleteTable().run(), false, !editor.can().deleteTable(), "删除表格")}
    </div> : null}
    <div ref={editorElementRef} className="sia-rich-text-editor__content" />
  </div>;
}

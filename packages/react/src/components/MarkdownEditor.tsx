import { useFloatingPlaceholder } from "./FloatingPlaceholder";
import type { InputPlaceholderMode } from "./shared";
import type { CSSProperties, HTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import "vditor/dist/index.css";
import { isLikelyMarkdown } from "./markdownPaste";
import { VDITOR_ZH_CN } from "./vditorZhCn";

export { isLikelyMarkdown } from "./markdownPaste";

type VditorConstructor = typeof import("vditor")["default"];
type VditorInstance = InstanceType<VditorConstructor>;

declare global {
  interface Window {
    Vditor?: VditorConstructor;
  }
}

const vditorLoaders = new Map<string, Promise<VditorConstructor>>();

export type MarkdownEditorMode = "wysiwyg" | "ir" | "sv";

export interface MarkdownEditorProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  mode?: MarkdownEditorMode;
  placeholder?: string;
  placeholderMode?: InputPlaceholderMode;
  minHeight?: number | string;
  disabled?: boolean;
  ariaLabel?: string;
  assetBaseUrl?: string;
  saveShortcut?: () => void;
  onUploadImage?: (file: File) => Promise<string> | string;
  smartMarkdownPaste?: boolean;
}

const BASE_TOOLBAR = [
  "headings",
  "bold",
  "italic",
  "strike",
  "link",
  "|",
  "list",
  "ordered-list",
  "check",
  "outdent",
  "indent",
  "|",
  "quote",
  "line",
  "code",
  "inline-code",
  "table",
  "|",
  "undo",
  "redo",
  "|",
  "edit-mode",
  "both",
  "preview",
  "outline",
  "fullscreen",
];

function escapeMarkdownAlt(value: string) {
  return value.replace(/[\[\]\\]/g, "\\$&");
}

function applyEditorAriaLabel(element: HTMLDivElement, label: string) {
  element
    .querySelectorAll<HTMLElement>(".vditor-wysiwyg, .vditor-ir, .vditor-sv")
    .forEach((editor) => {
      editor.setAttribute("aria-label", label);
      editor.setAttribute("role", "textbox");
      editor.setAttribute("aria-multiline", "true");
    });
}

function loadVditor(assetBaseUrl?: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Vditor 只能在浏览器中加载"));
  }
  if (window.Vditor) return Promise.resolve(window.Vditor);

  if (!assetBaseUrl) {
    const bundledKey = "__sia_bundled_vditor__";
    const bundledPending = vditorLoaders.get(bundledKey);
    if (bundledPending) return bundledPending;
    const bundledLoader = Promise.all([
      // Vditor normally requests its Markdown engine from a CDN at runtime.
      // @ts-ignore The bundled script installs window.Lute as a side effect.
      import("vditor/dist/js/lute/lute.min.js"),
      // Vditor also loads its SVG sprite from the CDN unless it already exists.
      // @ts-ignore The side-effect module injects the Ant Design icon sprite.
      import("vditor/dist/js/icons/ant.js"),
      import("vditor"),
    ]).then(([, , { default: Vditor }]) => {
      if (!document.getElementById("vditorLuteScript")) {
        const bundledLuteMarker = document.createElement("script");
        bundledLuteMarker.id = "vditorLuteScript";
        bundledLuteMarker.dataset.siaBundled = "true";
        document.head.append(bundledLuteMarker);
      }
      if (!document.getElementById("vditorIconScript")) {
        const bundledIconMarker = document.createElement("script");
        bundledIconMarker.id = "vditorIconScript";
        bundledIconMarker.dataset.siaBundled = "true";
        document.head.append(bundledIconMarker);
      }
      window.Vditor = Vditor;
      return Vditor;
    });
    vditorLoaders.set(bundledKey, bundledLoader);
    return bundledLoader;
  }

  const baseUrl = assetBaseUrl.replace(/\/$/, "");
  const scriptUrl = `${baseUrl}/dist/index.min.js`;
  const pending = vditorLoaders.get(scriptUrl);
  if (pending) return pending;

  const loader = new Promise<VditorConstructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-sia-vditor="${scriptUrl}"]`);
    const script = existing ?? document.createElement("script");
    const handleLoad = () => {
      if (window.Vditor) resolve(window.Vditor);
      else reject(new Error("Vditor 脚本已加载，但未找到全局构造器"));
    };
    const handleError = () => reject(new Error(`Vditor 脚本加载失败：${scriptUrl}`));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.src = scriptUrl;
      script.async = true;
      script.dataset.siaVditor = scriptUrl;
      document.head.append(script);
    }
  });

  vditorLoaders.set(scriptUrl, loader);
  return loader;
}

export function MarkdownEditor({
  value,
  defaultValue = "",
  onChange,
  mode = "wysiwyg",
  placeholder = "请输入 Markdown 正文",
  placeholderMode,
  minHeight = 320,
  disabled = false,
  ariaLabel = "Markdown 编辑器",
  assetBaseUrl,
  saveShortcut,
  onUploadImage,
  smartMarkdownPaste = true,
  className,
  style,
  ...props
}: MarkdownEditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<VditorInstance | null>(null);
  const onChangeRef = useRef(onChange);
  const saveShortcutRef = useRef(saveShortcut);
  const uploadImageRef = useRef(onUploadImage);
  const disabledRef = useRef(disabled);
  const smartMarkdownPasteRef = useRef(smartMarkdownPaste);
  const valueRef = useRef(value ?? defaultValue);
  const lastEmittedValueRef = useRef(value ?? defaultValue);
  const [hasContent, setHasContent] = useState(Boolean((value ?? defaultValue).trim()));
  const floating = useFloatingPlaceholder({ mode: placeholderMode, placeholder, filled: hasContent });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const hasImageUpload = Boolean(onUploadImage);
  useEffect(() => { if (value !== undefined) setHasContent(Boolean(value.trim())); }, [value]);

  onChangeRef.current = onChange;
  saveShortcutRef.current = saveShortcut;
  uploadImageRef.current = onUploadImage;
  disabledRef.current = disabled;
  smartMarkdownPasteRef.current = smartMarkdownPaste;
  valueRef.current = value ?? valueRef.current;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let createdEditor: VditorInstance | null = null;
    let editorInitialized = false;
    let removeSmartMarkdownPaste = () => {};

    setLoadError("");
    void loadVditor(assetBaseUrl).then((Vditor) => {
      if (disposed) return;

      const toolbar = hasImageUpload
        ? [...BASE_TOOLBAR.slice(0, 17), "upload", ...BASE_TOOLBAR.slice(17)]
        : [...BASE_TOOLBAR];

      createdEditor = new Vditor(mount, {
        value: valueRef.current,
        mode,
        lang: "zh_CN",
        i18n: VDITOR_ZH_CN,
        icon: "ant",
        width: "100%",
        height: "100%",
        minHeight: typeof minHeight === "number" ? minHeight : undefined,
        placeholder,
        cdn: assetBaseUrl,
        cache: { enable: false },
        toolbar,
        toolbarConfig: { pin: true },
        counter: { enable: true, type: "text" },
        outline: { enable: false, position: "right" },
        preview: {
          mode: "both",
          delay: 180,
          actions: [],
        },
        ...(hasImageUpload
          ? { upload: {
              accept: "image/*",
              handler: async (files) => {
                const imageFiles = Array.from(files).filter((file) =>
                  file.type.startsWith("image/"),
                );
                if (imageFiles.length === 0 || !uploadImageRef.current) return null;

                const images = await Promise.all(
                  imageFiles.map(async (file) => ({
                    name: file.name,
                    url: await uploadImageRef.current!(file),
                  })),
                );
                editorRef.current?.insertValue(
                  images
                    .map(({ name, url }) => `![${escapeMarkdownAlt(name)}](${url})`)
                    .join("\n"),
                );
                return null;
              },
            } }
          : {}),
        input: (markdown) => {
          setHasContent(Boolean(markdown.trim()));
          lastEmittedValueRef.current = markdown;
          onChangeRef.current?.(markdown);
        },
        keydown: (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            event.stopPropagation();
            saveShortcutRef.current?.();
          }
        },
        after: () => {
          editorInitialized = true;
          if (disposed || !createdEditor) {
            createdEditor?.destroy();
            return;
          }

          editorRef.current = createdEditor;
          applyEditorAriaLabel(mount, ariaLabel);
          const handleSmartMarkdownPaste = (event: ClipboardEvent) => {
            if (!smartMarkdownPasteRef.current || disabledRef.current) return;
            const target = event.target;
            if (!(target instanceof Element) || !target.closest(".vditor-wysiwyg, .vditor-ir")) return;

            const clipboard = event.clipboardData;
            const explicitMarkdown = clipboard?.getData("text/markdown") ?? "";
            const markdown = explicitMarkdown || clipboard?.getData("text/plain") || "";
            if (
              !clipboard ||
              (!explicitMarkdown && !isLikelyMarkdown(markdown))
            ) return;

            event.preventDefault();
            event.stopPropagation();
            editorRef.current?.insertMD(markdown);
          };
          mount.addEventListener("paste", handleSmartMarkdownPaste, true);
          removeSmartMarkdownPaste = () =>
            mount.removeEventListener("paste", handleSmartMarkdownPaste, true);
          if (disabledRef.current) createdEditor.disabled();
          setReady(true);
        },
      });
    }).catch((error: unknown) => {
      if (disposed) return;
      setLoadError(error instanceof Error ? error.message : "编辑器加载失败");
    });

    return () => {
      disposed = true;
      setReady(false);
      removeSmartMarkdownPaste();
      if (editorRef.current === createdEditor) editorRef.current = null;
      if (editorInitialized) createdEditor?.destroy();
    };
  }, [ariaLabel, assetBaseUrl, hasImageUpload, minHeight, mode, placeholder]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === undefined) return;
    if (value === lastEmittedValueRef.current || editor.getValue() === value) return;

    lastEmittedValueRef.current = value;
    editor.setValue(value, true);
  }, [ready, value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (disabled) editor.disabled();
    else editor.enable();
  }, [disabled, ready]);

  const editorStyle = {
    ...style,
    "--sia-markdown-editor-min-height":
      typeof minHeight === "number" ? `${minHeight}px` : minHeight,
  } as CSSProperties;

  return (
    <div
      className={["sia-markdown-editor", floating.className, disabled ? "is-disabled" : "", className].filter(Boolean).join(" ")}
      style={editorStyle}
      data-ready={ready ? "true" : "false"}
      {...props}
      onBlurCapture={(event) => {
        props.onBlurCapture?.(event);
        const current = editorRef.current?.getValue();
        if (current !== undefined) setHasContent(Boolean(current.trim()));
      }}
    >
      {floating.label}
      <div ref={mountRef} className="sia-markdown-editor__mount" />
      {!ready ? (
        <div className="sia-markdown-editor__loading" aria-live="polite">
          {loadError || "正在加载编辑器…"}
        </div>
      ) : null}
    </div>
  );
}

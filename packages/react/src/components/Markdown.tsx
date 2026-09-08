import { useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { ImagePreview } from "./DataDisplay";

export interface MarkdownProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  content: string;
  emptyText?: ReactNode;
  resolveImageSrc?: (src: string) => string | Promise<string>;
  imagePreview?: boolean;
}

export function Markdown({ content, emptyText = "暂无 Markdown 内容", resolveImageSrc, imagePreview = true, className = "", onClick, onKeyDown, ...props }: MarkdownProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const html = useMemo(() => {
    const rendered = marked.parse(content, { breaks: true, gfm: true });
    const sanitized = DOMPurify.sanitize(rendered as string, { USE_PROFILES: { html: true } });
    return sanitized.replace(/<img\b/giu, '<img loading="lazy" decoding="async" referrerpolicy="no-referrer"');
  }, [content]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    root.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
      if (imagePreview) {
        const previousRole = image.getAttribute("role");
        const previousTabIndex = image.getAttribute("tabindex");
        const previousAriaLabel = image.getAttribute("aria-label");
        image.setAttribute("role", "button");
        image.tabIndex = 0;
        image.setAttribute("aria-label", image.alt ? `预览图片：${image.alt}` : "预览图片");
        cleanups.push(() => {
          if (previousRole === null) image.removeAttribute("role"); else image.setAttribute("role", previousRole);
          if (previousTabIndex === null) image.removeAttribute("tabindex"); else image.setAttribute("tabindex", previousTabIndex);
          if (previousAriaLabel === null) image.removeAttribute("aria-label"); else image.setAttribute("aria-label", previousAriaLabel);
        });
      }

      const originalSrc = image.getAttribute("src");
      if (!originalSrc || !resolveImageSrc) return;
      let resolving = false;
      const resolveFailedImage = () => {
        if (resolving || cancelled) return;
        resolving = true;
        void Promise.resolve(resolveImageSrc(originalSrc)).then((resolvedSrc) => {
          if (!cancelled && image.isConnected && resolvedSrc && resolvedSrc !== originalSrc) {
            image.src = resolvedSrc;
          }
        }).catch(() => undefined);
      };
      image.addEventListener("error", resolveFailedImage, { once: true });
      cleanups.push(() => image.removeEventListener("error", resolveFailedImage));
      if (image.complete && image.naturalWidth === 0) resolveFailedImage();
    });

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [html, imagePreview, resolveImageSrc]);

  function openImagePreview(target: EventTarget | null) {
    if (!imagePreview || typeof HTMLImageElement === "undefined" || !(target instanceof HTMLImageElement)) return false;
    setPreviewImage({ src: target.currentSrc || target.src, alt: target.alt });
    return true;
  }

  function handleClick(event: ReactMouseEvent<HTMLElement>) {
    if (openImagePreview(event.target)) event.preventDefault();
    onClick?.(event);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if ((event.key === "Enter" || event.key === " ") && openImagePreview(event.target)) event.preventDefault();
    onKeyDown?.(event);
  }

  if (!content.trim()) {
    return <div className={`sia-markdown sia-markdown--empty ${className}`.trim()}>{emptyText}</div>;
  }

  return <>
    <article {...props} ref={rootRef} className={`sia-markdown ${className}`.trim()} onClick={handleClick} onKeyDown={handleKeyDown} dangerouslySetInnerHTML={{ __html: html }} />
    <ImagePreview open={Boolean(previewImage)} src={previewImage?.src} alt={previewImage?.alt} onOpenChange={(open) => { if (!open) setPreviewImage(null); }} />
  </>;
}

import { useEffect, useMemo, useRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

export interface MarkdownProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  content: string;
  emptyText?: ReactNode;
  resolveImageSrc?: (src: string) => string | Promise<string>;
}

export function Markdown({ content, emptyText = "暂无 Markdown 内容", resolveImageSrc, className = "", ...props }: MarkdownProps) {
  const rootRef = useRef<HTMLElement>(null);
  const html = useMemo(() => {
    const rendered = marked.parse(content, { breaks: true, gfm: true });
    const sanitized = DOMPurify.sanitize(rendered as string, { USE_PROFILES: { html: true } });
    return sanitized.replace(/<img\b/giu, '<img loading="lazy" decoding="async" referrerpolicy="no-referrer"');
  }, [content]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !resolveImageSrc) return undefined;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    root.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
      const originalSrc = image.getAttribute("src");
      if (!originalSrc) return;
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
  }, [html, resolveImageSrc]);

  if (!content.trim()) {
    return <div className={`sia-markdown sia-markdown--empty ${className}`.trim()}>{emptyText}</div>;
  }

  return <article ref={rootRef} className={`sia-markdown ${className}`.trim()} dangerouslySetInnerHTML={{ __html: html }} {...props} />;
}

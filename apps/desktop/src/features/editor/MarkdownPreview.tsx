import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    const rendered = marked.parse(content, {
      breaks: true,
      gfm: true,
    });

    return DOMPurify.sanitize(rendered as string, {
      USE_PROFILES: { html: true },
    });
  }, [content]);

  if (!content.trim()) {
    return <div className="markdown-preview markdown-preview--empty">开始输入 Markdown 后，这里会显示预览。</div>;
  }

  return <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}


import { useState } from "react";
import { Button, Card, Divider, Icon } from "@sia.soul/sia-react-ui";
import type { CardProps } from "@sia.soul/sia-react-ui";

export interface DemoCardProps extends Omit<CardProps, "extra"> {
  code: string;
  language?: string;
}

export function DemoCard({ code, language = "tsx", className = "", children, ...props }: DemoCardProps) {
  const [codeOpen, setCodeOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyCode() {
    const textarea = document.createElement("textarea");
    textarea.value = code;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copiedSynchronously = document.execCommand("copy");
    textarea.remove();
    if (!copiedSynchronously) void navigator.clipboard?.writeText(code).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return <Card {...props} className={`demo-card ${className}`.trim()}>
    <div className="demo-card__preview">{children}</div>
    <Divider className="demo-card__divider" />
    <div className="demo-card__actions" aria-label="示例操作">
      <Button
        variant="text"
        size="small"
        className="demo-card__action"
        icon={<Icon name={copied ? "check" : "copy"} size={16} />}
        aria-label={copied ? "已复制" : "复制代码"}
        title={copied ? "已复制" : "复制代码"}
        onClick={copyCode}
      />
      <Button
        variant="text"
        size="small"
        className="demo-card__action"
        icon={<Icon name="code" size={17} />}
        aria-label={codeOpen ? "收起代码" : "查看代码"}
        title={codeOpen ? "收起代码" : "查看代码"}
        aria-expanded={codeOpen}
        aria-pressed={codeOpen}
        onClick={() => setCodeOpen((value) => !value)}
      />
    </div>
    {codeOpen ? <div className="code-block demo-card__code">
      <div className="code-toolbar"><span>{language}</span></div>
      <pre><code>{code}</code></pre>
    </div> : null}
  </Card>;
}

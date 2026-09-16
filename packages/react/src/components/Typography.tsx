import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AnchorHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { TextArea } from "./TextArea";
import "../typography.css";

/** 排版的类型标识。 */
export type TypographyType = "secondary" | "success" | "warning" | "danger";
/** 排版的属性配置。 */
export interface TypographyProps extends HTMLAttributes<HTMLElement> {
  /** 辅助、成功、警告或危险文本 */
  type?: TypographyType;
  /** 禁用样式及复制、编辑操作 */
  disabled?: boolean;
  /** 是否显示为加粗文字。 */
  strong?: boolean;
  /** 是否显示为斜体。 */
  italic?: boolean;
  /** 是否显示下划线。 */
  underline?: boolean;
  /** 是否显示删除线。 */
  delete?: boolean;
  /** 是否使用标记高亮样式。 */
  mark?: boolean;
  /** 代码内容或按键代码。 */
  code?: boolean;
  /** 是否允许通过 Esc 等键盘操作关闭。 */
  keyboard?: boolean;
  /** 复制完整文本，可指定复制内容和成功回调 */
  copyable?: boolean | {
  /** 显示文本。 */
  text?: string;
  /** 复制操作触发后的回调。 */
  onCopy?: () => void };
  /** 纯文本编辑；text 用于受控内容，onChange 在保存时触发 */
  editable?: boolean | {
  /** 显示文本。 */
  text?: string;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (text: string) => void;
  /** 允许输入的最大字符数 */
  maxLength?: number };
  /** 是否对超出可用宽度的内容进行省略，或指定省略配置。 */
  ellipsis?: boolean | {
  /** 默认可见行数 */
  rows?: number;
  /** 是否允许展开更多内容。 */
  expandable?: boolean };
}
/** TypographyTitle的属性配置。 */
export interface TypographyTitleProps extends TypographyProps {
  /** 标题或节点的层级。 */
  level?: 1 | 2 | 3 | 4 | 5 }
/** TypographyLink的属性配置。 */
export interface TypographyLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** 是否禁用交互。 */
  disabled?: boolean }

function TypographyContent({ as: Tag = "span", type, disabled, strong, italic, underline, delete: deleted, mark, code, keyboard,
  copyable, editable, ellipsis, children, className = "", ...props
}: TypographyProps & { as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" }) {
  const contentRef = useRef<HTMLSpanElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [localText, setLocalText] = useState<string>();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const editConfig = typeof editable === "object" ? editable : undefined;
  const content = editConfig?.text ?? localText ?? children;
  const requestedRows = typeof ellipsis === "object" ? ellipsis.rows ?? 1 : 1;
  const rows = Number.isFinite(requestedRows) ? Math.max(1, Math.floor(requestedRows)) : 1;
  const expandable = typeof ellipsis === "object" && ellipsis.expandable;
  useEffect(() => { setLocalText(undefined); }, [children]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element || !ellipsis || editing || expanded) return;
    const measure = () => setOverflow(element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content, ellipsis, rows, editing, expanded]);
  async function copy() {
    try {
      const text = typeof copyable === "object" ? copyable.text ?? contentRef.current?.textContent ?? "" : contentRef.current?.textContent ?? "";
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
      if (typeof copyable === "object") copyable.onCopy?.();
    } catch { setCopyError(true); }
  }
  function finish(save: boolean) {
    if (save) { setLocalText(draft); editConfig?.onChange?.(draft); }
    setEditing(false);
    requestAnimationFrame(() => editRef.current?.focus());
  }
  let formatted: ReactNode = content;
  if (strong) formatted = <strong>{formatted}</strong>;
  if (italic) formatted = <em>{formatted}</em>;
  if (underline) formatted = <u>{formatted}</u>;
  if (deleted) formatted = <del>{formatted}</del>;
  if (mark) formatted = <mark>{formatted}</mark>;
  if (code) formatted = <code>{formatted}</code>;
  if (keyboard) formatted = <kbd>{formatted}</kbd>;
  return <Tag {...props} aria-disabled={disabled || undefined} className={`sia-typography sia-typography--${Tag}${type ? ` sia-typography--${type}` : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()}>
    {editing ? <span className="sia-typography__editor">
      <TextArea autoFocus aria-label="编辑文本" value={draft} maxLength={editConfig?.maxLength} rows={3} onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { event.preventDefault(); finish(false); }
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); finish(true); }
        }} />
      <span className="sia-typography__edit-actions"><Button size="small" onClick={() => finish(false)}>取消</Button><Button size="small" variant="primary" onClick={() => finish(true)}>保存</Button></span>
    </span> : <>
      <span ref={contentRef} className={ellipsis && !expanded ? "sia-typography__ellipsis" : undefined} style={ellipsis && !expanded ? { "--sia-typography-rows": rows } as CSSProperties : undefined}>{formatted}</span>
      {expandable && (overflow || expanded) ? <Button variant="link" size="small" className="sia-typography__action" aria-expanded={expanded} disabled={disabled} onClick={() => setExpanded(!expanded)}>{expanded ? "收起" : "展开"}</Button> : null}
      {editable ? <Button ref={editRef} variant="text" size="small" className="sia-typography__action" aria-label="编辑文本" title="编辑" disabled={disabled} icon={<Icon name="edit" size={14} />} onClick={() => { setDraft(contentRef.current?.textContent ?? ""); setEditing(true); }} /> : null}
      {copyable ? <Button variant="text" size="small" className="sia-typography__action" aria-label={copied ? "已复制" : "复制文本"} title={copied ? "已复制" : "复制"} disabled={disabled} icon={<Icon name={copied ? "check" : "copy"} size={14} />} onClick={() => void copy()} /> : null}
      {copyError ? <span role="status" className="sia-typography--danger">复制失败，请手动选择文本复制。</span> : null}
    </>}
  </Tag>;
}
function Title({ level = 1, ...props }: TypographyTitleProps) {
  return <TypographyContent {...props} as={`h${level}` as "h1"} />;
}
function Text(props: TypographyProps) { return <TypographyContent {...props} />; }
function Paragraph(props: TypographyProps) { return <TypographyContent {...props} as="p" />; }
function Link({ disabled, className = "", onClick, href, target, rel, ...props }: TypographyLinkProps) {
  return <a {...props} href={disabled ? undefined : href} target={target} rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : props.tabIndex}
    className={`sia-typography sia-typography--link${disabled ? " is-disabled" : ""} ${className}`.trim()} onClick={(event) => { if (disabled) event.preventDefault(); else onClick?.(event); }} />;
}
function TypographyRoot({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`sia-typography ${className}`.trim()} />;
}
/** 排版组件。 */
export const Typography = Object.assign(TypographyRoot, {
  /** 语义化标题，支持标题级别、复制和编辑。 */
  Title,
  /** 行内文本，支持强调、复制、编辑和省略。 */
  Text,
  /** 段落文本，支持复制、编辑和省略。 */
  Paragraph,
  /** 具有排版样式的链接。 */
  Link });

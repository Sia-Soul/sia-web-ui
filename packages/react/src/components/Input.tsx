import { withTitleTooltip } from "./titleTooltip";
import { useControlSize } from "./shared";
import { forwardRef, useId, useRef, useState } from "react";
import type { ChangeEvent, InputHTMLAttributes, MouseEvent, ReactNode } from "react";
import { usePlaceholderMode } from "./shared";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { TextArea } from "./TextArea";
import type { ControlSize, ControlStatus, InputPlaceholderMode } from "./shared";

/** 输入框的属性配置。 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "size"> {
  /** 字段标签 */
  label?: ReactNode;
  /** 帮助或校验信息 */
  hint?: ReactNode;
  /**
   * 校验状态
   * @defaultValue "default"
   */
  status?: ControlStatus;
  /** small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先 */
  size?: ControlSize;
  /** 输入框前缀 */
  prefix?: ReactNode;
  /** 输入框后缀 */
  suffix?: ReactNode;
  /**
   * 是否允许清空当前选择或输入值；默认启用，显式传入 false 可关闭。组件或所属 Form / fieldset 禁用时隐藏清空按钮。
   * @defaultValue true
   */
  allowClear?: boolean;
  /** 清空当前值时调用。 */
  onClear?: () => void;
  /**
   * 显示当前字符数；设置 maxLength 时显示“当前字数/上限”。计数按实际文字宽度占位，位数变化时自适应，不预留固定宽度。
   * @defaultValue false
   */
  showCount?: boolean;
  /** 占位文案的显示模式 */
  placeholderMode?: InputPlaceholderMode;
  /**
   * 在普通文本输入框末尾显示展开按钮，弹框正文仅显示多行编辑器，继承 maxLength、placeholder 和 showCount。
   * 打开时复制当前值，确定后通过原生 input 事件触发 onChange；受控模式需由调用方回写 value，取消不修改原值。
   * 多行换行在回填单行输入框时转换为空格；禁用、只读及非 text 类型不显示展开按钮。
   * @defaultValue false
   */
  expandable?: boolean;
}

/** 输入框组件。 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    status = "default",
    size: sizeProp,
    prefix,
    suffix,
    allowClear = true,
    onClear,
    showCount = false,
    placeholderMode,
    placeholder,
    className = "",
    id,
    disabled,
    value,
    defaultValue,
    maxLength,
    onChange,
    expandable = false,
    ...props
  },
  forwardedRef,
) {
  const size = useControlSize(sizeProp);
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const localRef = useRef<HTMLInputElement | null>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(() => defaultValue === undefined ? "" : String(defaultValue));
  const currentText = value !== undefined ? String(value) : uncontrolledValue;
  const hasValue = currentText.length > 0;
  const [expanded, setExpanded] = useState(false);
  const [expandedDraft, setExpandedDraft] = useState("");
  const floatingPlaceholder = usePlaceholderMode(placeholderMode) === "floating" && Boolean(placeholder);
  const hintId = `${inputId}-hint`;
  const describedBy = [props["aria-describedby"], hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  function setRef(node: HTMLInputElement | null) {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (maxLength !== undefined && maxLength >= 0 && event.target.value.length > maxLength) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(event.target, event.target.value.slice(0, maxLength));
    }
    setUncontrolledValue(event.target.value);
    onChange?.(event);
  }

  function clearValue() {
    const input = localRef.current;
    if (!input || disabled) return;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    setUncontrolledValue("");
    input.focus();
    onClear?.();
  }

  function handleControlMouseDown(event: MouseEvent<HTMLSpanElement>) {
    if (disabled || event.defaultPrevented || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    // Preserve native focus and text selection for actual interactive children.
    const interactive = target.closest("input, textarea, select, button, a[href], [tabindex], [contenteditable]:not([contenteditable='false']), [role='button'], [role='link']");
    if (interactive && event.currentTarget.contains(interactive) && !interactive.classList.contains("sia-input-control__clear")) return;
    // Prevent blur on mousedown, before click handlers or label activation run.
    event.preventDefault();
    localRef.current?.focus({ preventScroll: true });
  }

  const input = (
    <input
      {...withTitleTooltip(props)}
      ref={setRef}
      id={inputId}
      className="sia-input"
      disabled={disabled}
      value={value}
      defaultValue={defaultValue}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-describedby={describedBy}
      aria-invalid={status === "error" || undefined}
      onChange={handleChange}
    />
  );

  const control = (
    <span onMouseDown={handleControlMouseDown} className={`sia-input-control sia-input-control--${size} sia-input-control--${status}${floatingPlaceholder ? " sia-input-control--floating" : ""}${floatingPlaceholder && hasValue ? " is-filled" : ""}${disabled ? " is-disabled" : ""}`}>
      {prefix ? <span className="sia-input-control__affix">{prefix}</span> : null}
      {floatingPlaceholder ? <span className="sia-input-control__input-wrap">
        {input}
        <span className="sia-input-control__floating-placeholder" aria-hidden="true">{placeholder}</span>
      </span> : input}
      {allowClear && hasValue && !disabled ? <button className="sia-input-control__clear" type="button" aria-label="清空输入" onClick={clearValue}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
      {suffix ? <span className="sia-input-control__affix">{suffix}</span> : null}
      {expandable && !disabled && !props.readOnly && (!props.type || props.type === "text") ? <button
        type="button" className="sia-input-control__expand" aria-label="展开编辑" title="展开编辑"
        onClick={() => {
          if (localRef.current?.matches(":disabled")) return;
          setExpandedDraft(currentText);
          setExpanded(true);
        }}
      ><Icon name="expand" size={15} /></button> : null}
      {showCount ? <span className={`sia-input-control__count${maxLength !== undefined && currentText.length >= maxLength ? " is-limit" : ""}`} aria-live="polite">{currentText.length}{maxLength !== undefined ? `/${maxLength}` : null}</span> : null}
    </span>
  );

  // 弹框始终挂载，关闭时保留草稿直至动画完成；取消不派发输入事件。
  const editor = expandable ? <Modal open={expanded} title="展开编辑" okText="确定" cancelText="取消"
    onCancel={() => setExpanded(false)}
    afterOpenChange={(open) => { if (!open) setExpandedDraft(""); }}
    onOk={() => {
      const target = localRef.current;
      if (!target || target.matches(":disabled") || props.readOnly) return false;
      // 单行输入遵循原生语义，换行转换为空格，确定时再次限制长度。
      const normalized = expandedDraft.replace(/\r\n|[\r\n]/g, " ");
      const next = maxLength !== undefined && maxLength >= 0 ? normalized.slice(0, maxLength) : normalized;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(target, next);
      target.dispatchEvent(new Event("input", { bubbles: true }));
      setUncontrolledValue(next);
      setExpanded(false);
    }}>
    <TextArea aria-label="展开编辑内容" value={expandedDraft} onChange={(event) => setExpandedDraft(event.target.value)}
      maxLength={maxLength} showCount={showCount} placeholder={placeholder} rows={8} disabled={disabled} readOnly={props.readOnly} />
  </Modal> : null;

  if (!label && !hint) return <><span className={`sia-field ${className}`.trim()}>{control}</span>{editor}</>;

  return (
    <><span className={`sia-field ${className}`.trim()}>
      {label ? <label className="sia-field__label" htmlFor={inputId}>{label}</label> : null}
      {control}
      {hint ? <span id={hintId} className={`sia-field__hint sia-field__hint--${status}`}>{hint}</span> : null}
    </span>{editor}</>
  );
});

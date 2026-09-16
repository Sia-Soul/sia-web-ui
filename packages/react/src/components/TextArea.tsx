import { withTitleTooltip } from "./titleTooltip";
import { useFloatingPlaceholder } from "./FloatingPlaceholder";
import type { InputPlaceholderMode } from "./shared";
import { forwardRef, useId, useState } from "react";
import type { ChangeEvent, ReactNode, TextareaHTMLAttributes } from "react";
import type { ControlSize, ControlStatus } from "./shared";
import { useControlSize } from "./shared";

/** 多行输入的属性配置。 */
export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 调整字号和内边距；保留 rows 和内容决定的多行高度。默认继承 Form */
  size?: ControlSize;
  /** 字段标签 */
  label?: ReactNode;
  /** 帮助或校验信息 */
  hint?: ReactNode;
  /**
   * 校验状态
   * @defaultValue "default"
   */
  status?: ControlStatus;
  /**
   * 显示当前字符数
   * @defaultValue false
   */
  showCount?: boolean;
  /** 占位提示的显示模式；floating 为浮动标签。 */
  placeholderMode?: InputPlaceholderMode;
}

/** 多行输入组件。 */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {
    label,
    hint,
    status = "default",
    size: sizeProp,
    showCount = false,
    placeholder,
    placeholderMode,
    className = "",
    id,
    disabled,
    value,
    defaultValue,
    maxLength,
    onChange,
    ...props
  },
  ref,
) {
  const size = useControlSize(sizeProp);
  const fallbackId = useId();
  const textAreaId = id ?? fallbackId;
  const [uncontrolledValue, setUncontrolledValue] = useState(() => defaultValue === undefined ? "" : String(defaultValue));
  const currentText = value !== undefined ? String(value) : uncontrolledValue;
  const floating = useFloatingPlaceholder({ mode: placeholderMode, placeholder, filled: currentText.length > 0 });
  const hintId = `${textAreaId}-hint`;
  const describedBy = [props["aria-describedby"], hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setUncontrolledValue(event.target.value);
    onChange?.(event);
  }

  const control = (
    <span className={`sia-textarea-control sia-textarea-control--${size} sia-textarea-control--${status}${floating.className}${disabled ? " is-disabled" : ""}`}>
      <textarea
        {...withTitleTooltip(props)}
        ref={ref}
        id={textAreaId}
        className="sia-textarea"
        disabled={disabled}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-invalid={status === "error" || undefined}
        onChange={handleChange}
      />
      {floating.label}
      {showCount ? (
        <span className={`sia-textarea-control__count${maxLength !== undefined && currentText.length >= maxLength ? " is-limit" : ""}`} aria-live="polite">
          {currentText.length}{maxLength !== undefined ? `/${maxLength}` : null}
        </span>
      ) : null}
    </span>
  );

  if (!label && !hint) return <span className={`sia-field ${className}`.trim()}>{control}</span>;

  return (
    <span className={`sia-field ${className}`.trim()}>
      {label ? <label className="sia-field__label" htmlFor={textAreaId}>{label}</label> : null}
      {control}
      {hint ? <span id={hintId} className={`sia-field__hint sia-field__hint--${status}`}>{hint}</span> : null}
    </span>
  );
});

import { useFloatingPlaceholder } from "./FloatingPlaceholder";
import type { InputPlaceholderMode } from "./shared";
import { forwardRef, useId, useState } from "react";
import type { ChangeEvent, ReactNode, TextareaHTMLAttributes } from "react";
import type { ControlSize, ControlStatus } from "./shared";
import { useControlSize } from "./shared";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: ControlSize;
  label?: ReactNode;
  hint?: ReactNode;
  status?: ControlStatus;
  showCount?: boolean;
  placeholderMode?: InputPlaceholderMode;
}

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
        {...props}
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

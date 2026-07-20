import { forwardRef, useId, useRef, useState } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import type { ControlSize, ControlStatus } from "./shared";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  status?: ControlStatus;
  size?: ControlSize;
  prefix?: ReactNode;
  suffix?: ReactNode;
  allowClear?: boolean;
  onClear?: () => void;
  showCount?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    status = "default",
    size = "medium",
    prefix,
    suffix,
    allowClear = false,
    onClear,
    showCount = false,
    className = "",
    id,
    disabled,
    value,
    defaultValue,
    maxLength,
    onChange,
    ...props
  },
  forwardedRef,
) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const localRef = useRef<HTMLInputElement | null>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(() => defaultValue === undefined ? "" : String(defaultValue));
  const currentText = value !== undefined ? String(value) : uncontrolledValue;
  const hasValue = currentText.length > 0;
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

  const control = (
    <span className={`sia-input-control sia-input-control--${size} sia-input-control--${status}${disabled ? " is-disabled" : ""}`}>
      {prefix ? <span className="sia-input-control__affix">{prefix}</span> : null}
      <input
        {...props}
        ref={setRef}
        id={inputId}
        className="sia-input"
        disabled={disabled}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-describedby={describedBy}
        aria-invalid={status === "error" || undefined}
        onChange={handleChange}
      />
      {allowClear && hasValue && !disabled ? <button className="sia-input-control__clear" type="button" aria-label="清空输入" onClick={clearValue}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
      {suffix ? <span className="sia-input-control__affix">{suffix}</span> : null}
      {showCount ? <span className={`sia-input-control__count${maxLength !== undefined && currentText.length >= maxLength ? " is-limit" : ""}`} aria-live="polite">{currentText.length}{maxLength !== undefined ? `/${maxLength}` : null}</span> : null}
    </span>
  );

  if (!label && !hint) return <span className={`sia-field ${className}`.trim()}>{control}</span>;

  return (
    <span className={`sia-field ${className}`.trim()}>
      {label ? <label className="sia-field__label" htmlFor={inputId}>{label}</label> : null}
      {control}
      {hint ? <span id={hintId} className={`sia-field__hint sia-field__hint--${status}`}>{hint}</span> : null}
    </span>
  );
});

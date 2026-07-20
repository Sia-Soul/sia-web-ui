import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { FocusEvent, InputHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { Icon } from "./Icon";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";

export interface InputNumberProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "prefix" | "size" | "type" | "value"> {
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  size?: ControlSize;
  status?: ControlStatus;
  prefix?: ReactNode;
  suffix?: ReactNode;
  controls?: boolean;
}

function formatValue(value: number | null, precision?: number) {
  if (value === null || !Number.isFinite(value)) return "";
  return precision === undefined ? String(value) : value.toFixed(precision);
}

export const InputNumber = forwardRef<HTMLInputElement, InputNumberProps>(function InputNumber(
  {
    value,
    defaultValue = null,
    onChange,
    min,
    max,
    step = 1,
    precision,
    size = "medium",
    status = "default",
    prefix,
    suffix,
    controls = true,
    disabled,
    readOnly,
    className = "",
    id,
    onBlur,
    onKeyDown,
    ...props
  },
  forwardedRef,
) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const localRef = useRef<HTMLInputElement | null>(null);
  const [currentValue, setCurrentValue] = useControllableState({ value, defaultValue, onChange });
  const [text, setText] = useState(() => formatValue(currentValue, precision));

  useEffect(() => {
    setText(formatValue(currentValue, precision));
  }, [currentValue, precision]);

  function setRef(node: HTMLInputElement | null) {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function normalize(next: number) {
    let normalized = next;
    if (min !== undefined) normalized = Math.max(min, normalized);
    if (max !== undefined) normalized = Math.min(max, normalized);
    if (precision !== undefined) normalized = Number(normalized.toFixed(precision));
    return normalized;
  }

  function commit(rawText: string) {
    if (rawText.trim() === "") {
      setText("");
      setCurrentValue(null);
      return;
    }
    const parsed = Number(rawText);
    if (!Number.isFinite(parsed)) {
      setText(formatValue(currentValue, precision));
      return;
    }
    const nextValue = normalize(parsed);
    setText(formatValue(nextValue, precision));
    setCurrentValue(nextValue);
  }

  function changeBy(direction: 1 | -1) {
    if (disabled || readOnly) return;
    const baseValue = currentValue ?? 0;
    commit(String(baseValue + step * direction));
    localRef.current?.focus();
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    commit(text);
    onBlur?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      changeBy(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      changeBy(-1);
    } else if (event.key === "Enter") {
      commit(text);
    }
    onKeyDown?.(event);
  }

  const increaseDisabled = disabled || readOnly || (max !== undefined && currentValue !== null && currentValue >= max);
  const decreaseDisabled = disabled || readOnly || (min !== undefined && currentValue !== null && currentValue <= min);

  return (
    <span className={`sia-input-number sia-input-number--${size} sia-input-number--${status}${disabled ? " is-disabled" : ""} ${className}`.trim()}>
      {prefix ? <span className="sia-input-number__affix">{prefix}</span> : null}
      <input
        {...props}
        ref={setRef}
        id={inputId}
        type="text"
        role="spinbutton"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={currentValue ?? undefined}
        aria-invalid={status === "error" || undefined}
        onChange={(event) => setText(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {suffix ? <span className="sia-input-number__affix">{suffix}</span> : null}
      {controls ? <span className="sia-input-number__controls">
        <button type="button" tabIndex={-1} aria-label="增加数值" disabled={increaseDisabled} onClick={() => changeBy(1)}><Icon name="chevron-up" size={12} /></button>
        <button type="button" tabIndex={-1} aria-label="减少数值" disabled={decreaseDisabled} onClick={() => changeBy(-1)}><Icon name="chevron-down" size={12} /></button>
      </span> : null}
    </span>
  );
});

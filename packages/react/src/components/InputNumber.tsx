import { withTitleTooltip } from "./titleTooltip";
import { useControlSize } from "./shared";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { FocusEvent, InputHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { usePlaceholderMode } from "./shared";
import { Icon } from "./Icon";
import type { ControlSize, ControlStatus, InputPlaceholderMode } from "./shared";
import { useControllableState } from "./shared";

/** 数字输入的属性配置。 */
export interface InputNumberProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "prefix" | "size" | "type" | "value"> {
  /** 当前数值（受控） */
  value?: number | null;
  /**
   * 初始数值
   * @defaultValue null
   */
  defaultValue?: number | null;
  /** 数值变化回调 */
  onChange?: (value: number | null) => void;
  /** 允许的最小值。 */
  min?: number;
  /** 允许的最大值。 */
  max?: number;
  /**
   * 每次改变的步长
   * @defaultValue 1
   */
  step?: number;
  /** 固定小数位数 */
  precision?: number;
  /** small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先 */
  size?: ControlSize;
  /**
   * 当前状态，用于选择对应的状态样式。
   * @defaultValue "default"
   */
  status?: ControlStatus;
  /** 输入框前缀 */
  prefix?: ReactNode;
  /** 输入框后缀 */
  suffix?: ReactNode;
  /**
   是否显示操作控件。
   * @defaultValue true
   */
  controls?: boolean;
  /** 占位文案的显示模式 */
  placeholderMode?: InputPlaceholderMode;
}

function formatValue(value: number | null, precision?: number) {
  if (value === null || !Number.isFinite(value)) return "";
  return precision === undefined ? String(value) : value.toFixed(precision);
}

/** 数字输入组件。 */
export const InputNumber = forwardRef<HTMLInputElement, InputNumberProps>(function InputNumber(
  {
    value,
    defaultValue = null,
    onChange,
    min,
    max,
    step = 1,
    precision,
    size: sizeProp,
    status = "default",
    prefix,
    suffix,
    controls = true,
    placeholderMode,
    placeholder,
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
  const size = useControlSize(sizeProp);
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
  const floatingPlaceholder = usePlaceholderMode(placeholderMode) === "floating" && Boolean(placeholder);

  const input = (
    <input
      {...withTitleTooltip(props)}
      ref={setRef}
      id={inputId}
      type="text"
      role="spinbutton"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
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
  );

  return (
    <span className={`sia-input-number sia-input-number--${size} sia-input-number--${status}${floatingPlaceholder ? " sia-input-number--floating" : ""}${floatingPlaceholder && text.length > 0 ? " is-filled" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()}>
      {prefix ? <span className="sia-input-number__affix">{prefix}</span> : null}
      {floatingPlaceholder ? <span className="sia-input-number__input-wrap">
        {input}
        <span className="sia-input-number__floating-placeholder" aria-hidden="true">{placeholder}</span>
      </span> : input}
      {suffix ? <span className="sia-input-number__affix">{suffix}</span> : null}
      {controls ? <span className="sia-input-number__controls">
        <button type="button" tabIndex={-1} aria-label="增加数值" disabled={increaseDisabled} onClick={() => changeBy(1)}><Icon name="chevron-up" size={12} /></button>
        <button type="button" tabIndex={-1} aria-label="减少数值" disabled={decreaseDisabled} onClick={() => changeBy(-1)}><Icon name="chevron-down" size={12} /></button>
      </span> : null}
    </span>
  );
});

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
  /**
   * 将已提交的数值转换为显示文本，例如千分位或货币符号；输入过程中保留原始草稿，失焦、回车、步进及外部 value 更新后格式化。
   * 参数为应用 precision 后的十进制文本，空值为空字符串；应返回显示文本，并与 parser 配套。未指定时显示普通十进制文本。
   */
  formatter?: (value: string) => string;
  /**
   * 失焦或回车时将输入文本解析为数字或数字字符串；无效值或抛出异常时恢复当前值，不触发 onChange。
   * 空输入或解析为空字符串提交 null；未指定时使用 Number 转换。步进使用数值计算，不经过 parser。
   */
  parser?: (text: string) => number | string;
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
    formatter,
    parser,
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
  const displayValue = (next: number | null) => {
    const plain = formatValue(next, precision);
    return plain && formatter ? formatter(plain) : plain;
  };
  const [text, setText] = useState(() => displayValue(currentValue));

  useEffect(() => {
    setText(displayValue(currentValue));
  }, [currentValue, precision, formatter]);

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
    let parsed: number;
    try {
      const value = parser ? parser(rawText) : rawText;
      if (typeof value === "string" && value.trim() === "") {
        setText("");
        setCurrentValue(null);
        return;
      }
      parsed = Number(value);
    } catch {
      setText(displayValue(currentValue));
      return;
    }
    if (!Number.isFinite(parsed)) {
      setText(displayValue(currentValue));
      return;
    }
    const nextValue = normalize(parsed);
    setText(displayValue(nextValue));
    setCurrentValue(nextValue);
  }

  function changeBy(direction: 1 | -1) {
    if (disabled || readOnly) return;
    const baseValue = currentValue ?? 0;
    // 步进已经是数值，避免业务 parser 对其再次换算单位。
    const nextValue = normalize(baseValue + step * direction);
    setText(displayValue(nextValue));
    setCurrentValue(nextValue);
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

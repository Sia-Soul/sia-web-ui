import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { InputNumber } from "./InputNumber";
import { Icon } from "./Icon";
import { useControlSize, useControllableState } from "./shared";
import type { ControlSize, ControlStatus, InputPlaceholderMode } from "./shared";

/** 数字区间，依次为下限和上限；null 表示该端未填写，0 是有效数值。 */
export type NumberRangeValue = [number | null, number | null];

/** 数字区间输入属性；两端独立录入，不自动交换上下限，大小关系由业务校验。 */
export interface NumberRangeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "onChange" | "defaultValue"> {
  /** 当前区间（受控），需在 onChange 中更新；null 清空两端。 */
  value?: NumberRangeValue | null;
  /** 非受控初始区间。@defaultValue [null, null] */
  defaultValue?: NumberRangeValue;
  /** 一端失焦、按 Enter 或方向键提交时返回完整区间；清空返回 [null, null]。 */
  onChange?: (value: NumberRangeValue) => void;
  /** 两端占位文案。@defaultValue ["最小值", "最大值"] */
  placeholder?: [string, string];
  /** 两端可访问名称；未提供时使用各自占位文案。 */
  inputLabels?: [string, string];
  /** 两端允许的最小数值，提交时按 InputNumber 规则截断。 */
  min?: number;
  /** 两端允许的最大数值，提交时按 InputNumber 规则截断。 */
  max?: number;
  /** 键盘上下方向键步长。@defaultValue 1 */
  step?: number;
  /** 固定小数位数，沿用 InputNumber 的四舍五入规则。 */
  precision?: number;
  /** small / medium / large 高度为 22 / 30 / 38px，未指定时继承 Form。 */
  size?: ControlSize;
  /** 校验状态。@defaultValue "default" */
  status?: ControlStatus;
  /** 禁用两端输入及清空。@defaultValue false */
  disabled?: boolean;
  /** 只读显示，不能输入、步进或清空。@defaultValue false */
  readOnly?: boolean;
  /** 有数值时显示清空入口，禁用和只读时隐藏。@defaultValue true */
  allowClear?: boolean;
  /** 占位模式，未指定时继承 Form 或 QueryForm。 */
  placeholderMode?: InputPlaceholderMode;
}

/** 日期区间风格的双数字输入框，使用波浪线分隔；可直接绑定 Form.Item。 */
export const NumberRange = forwardRef<HTMLSpanElement, NumberRangeProps>(function NumberRange(
  { value, defaultValue = [null, null], onChange, placeholder = ["最小值", "最大值"], inputLabels,
    min, max, step = 1, precision, size: sizeProp, status = "default", disabled = false,
    readOnly = false, allowClear = true, placeholderMode, className = "", id, ...props }, ref,
) {
  const size = useControlSize(sizeProp);
  const [currentValue, setValue] = useControllableState<NumberRangeValue | null>({ value, defaultValue, onChange: (next) => onChange?.(next ?? [null, null]) });
  // Form 重置或旧快捷查询可携带空值；只在组件边界归一化，不改变业务条件。
  const range: NumberRangeValue = Array.isArray(currentValue) ? [currentValue[0] ?? null, currentValue[1] ?? null] : [null, null];
  function change(index: 0 | 1, next: number | null) {
    if (disabled || readOnly || range[index] === next) return;
    setValue(index === 0 ? [next, range[1]] : [range[0], next]);
  }
  const inputProps = { min, max, step, precision, size, status, disabled, readOnly, placeholderMode, controls: false };
  return <span {...props} ref={ref} role={props.role ?? "group"} aria-disabled={disabled || undefined}
    className={`sia-number-range sia-number-range--${size} sia-number-range--${status}${disabled ? " is-disabled" : ""} ${className}`.trim()}>
    <InputNumber {...inputProps} id={id} aria-label={inputLabels?.[0] ?? placeholder[0]} aria-describedby={props["aria-describedby"]}
      value={range[0]} placeholder={placeholder[0]} onChange={(next) => change(0, next)} />
    {/* 分隔符弱于输入文字，缩小尺寸并减细线条，避免抢占视觉焦点。 */}
    <Icon className="sia-number-range__separator" name="tilde" size={12} strokeWidth={1.5} aria-hidden="true" />
    <InputNumber {...inputProps} id={id ? `${id}-end` : undefined} aria-label={inputLabels?.[1] ?? placeholder[1]} aria-describedby={props["aria-describedby"]}
      value={range[1]} placeholder={placeholder[1]} onChange={(next) => change(1, next)} />
    {allowClear && !disabled && !readOnly && range.some((item) => item !== null)
      ? <button type="button" className="sia-number-range__clear" aria-label="清除数字区间" onClick={() => setValue([null, null])}>
        <Icon name="circle-close" variant="filled" size={15} />
      </button> : null}
  </span>;
});

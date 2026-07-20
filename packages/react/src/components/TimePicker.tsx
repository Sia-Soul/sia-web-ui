import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";

export interface TimePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "value" | "defaultValue" | "onChange"> {
  value?: string;
  defaultValue?: string;
  size?: ControlSize;
  status?: ControlStatus;
  allowClear?: boolean;
  use12Hours?: boolean;
  showSecond?: boolean;
  suffixIcon?: ReactNode;
  disabledTime?: (value: string) => boolean;
  onChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export interface TimeRangePickerProps extends Omit<TimePickerProps, "value" | "defaultValue" | "onChange" | "placeholder"> {
  value?: readonly [string, string];
  defaultValue?: readonly [string, string];
  placeholder?: readonly [string, string];
  separator?: ReactNode;
  onChange?: (value: readonly [string, string]) => void;
}

export function TimePicker({
  value,
  defaultValue = "",
  size = "medium",
  status = "default",
  allowClear = true,
  use12Hours = false,
  showSecond = false,
  suffixIcon,
  disabledTime,
  disabled,
  className = "",
  onChange,
  onOpenChange,
  ...props
}: TimePickerProps) {
  const id = useId();
  const [currentValue, setValue] = useControllableState({ value, defaultValue, onChange });
  return <span className={`sia-picker sia-picker--${size} sia-picker--${status}${disabled ? " is-disabled" : ""} ${className}`.trim()}>
    <input
      {...props}
      id={props.id ?? id}
      type="time"
      value={currentValue}
      disabled={disabled}
      step={props.step ?? (showSecond ? 1 : 60)}
      aria-label={props["aria-label"] ?? (use12Hours ? "时间（12 小时制）" : "时间")}
      aria-invalid={status === "error" || undefined}
      onFocus={(event) => { onOpenChange?.(true); props.onFocus?.(event); }}
      onBlur={(event) => { onOpenChange?.(false); props.onBlur?.(event); }}
      onChange={(event) => {
        const next = event.currentTarget.value;
        if (!disabledTime?.(next)) setValue(next);
      }}
    />
    {allowClear && currentValue && !disabled ? <button type="button" className="sia-picker__clear" aria-label="清除时间" onMouseDown={(event) => event.preventDefault()} onClick={() => setValue("")}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
    <span className="sia-picker__icon" aria-hidden="true">{suffixIcon ?? <Icon name="clock" size={16} />}</span>
  </span>;
}

function TimeRangePicker({
  value,
  defaultValue = ["", ""],
  placeholder = ["开始时间", "结束时间"],
  separator = "至",
  onChange,
  ...props
}: TimeRangePickerProps) {
  const [currentValue, setValue] = useControllableState<readonly [string, string]>({ value, defaultValue, onChange });
  function update(index: 0 | 1, next: string) {
    const pair: [string, string] = [currentValue[0], currentValue[1]];
    pair[index] = next;
    setValue(pair);
  }
  return <span className="sia-picker-range">
    <TimePicker {...props} value={currentValue[0]} placeholder={placeholder[0]} onChange={(next) => update(0, next)} />
    <span className="sia-picker-range__separator">{separator}</span>
    <TimePicker {...props} value={currentValue[1]} placeholder={placeholder[1]} min={currentValue[0] || props.min} onChange={(next) => update(1, next)} />
  </span>;
}

export namespace TimePicker {
  export const RangePicker = TimeRangePicker;
}

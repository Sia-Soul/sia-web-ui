import type { InputPlaceholderMode } from "./shared";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { DatePicker } from "./DatePicker";
import type { DateRangePickerPreset } from "./DatePicker";
import { Select } from "./Select";
import type { SelectOption, SelectValue } from "./Select";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";

export interface SelectDateRangeValue {
  select: SelectValue;
  range: readonly [string, string];
}

export interface SelectDateRangeProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  options: readonly SelectOption[];
  value?: SelectDateRangeValue;
  defaultValue?: SelectDateRangeValue;
  selectPlaceholder?: ReactNode;
  placeholderMode?: InputPlaceholderMode;
  /** 左侧选择器宽度，数字单位为 px；右侧日期范围自动填充剩余宽度。 */
  selectWidth?: CSSProperties["width"];
  rangePlaceholder?: readonly [string, string];
  selectAriaLabel?: string;
  rangeAriaLabel?: string;
  presets?: readonly DateRangePickerPreset[];
  size?: ControlSize;
  status?: ControlStatus;
  disabled?: boolean;
  onChange?: (value: SelectDateRangeValue) => void;
}

export function SelectDateRange({
  options,
  value,
  defaultValue,
  selectPlaceholder = "请选择类型",
  placeholderMode,
  selectWidth = 180,
  rangePlaceholder = ["开始日期", "结束日期"],
  selectAriaLabel = "选择类型",
  rangeAriaLabel = "日期范围",
  presets,
  size = "medium",
  status = "default",
  disabled = false,
  onChange,
  className = "",
  style,
  ...props
}: SelectDateRangeProps) {
  const initialValue = defaultValue ?? { select: options[0]?.value ?? "", range: ["", ""] };
  const [currentValue, setCurrentValue] = useControllableState<SelectDateRangeValue>({ value: value === undefined ? undefined : value && typeof value === "object" ? value : { select: "", range: ["", ""] }, defaultValue: initialValue, onChange });

  return <div className={`sia-select-date-range sia-select-date-range--${size} ${className}`.trim()} role="group" aria-label={`${selectAriaLabel}与${rangeAriaLabel}`} {...props} style={{ ...style, "--sia-select-date-range-select-width": typeof selectWidth === "number" ? `${selectWidth}px` : selectWidth } as CSSProperties}>
    <Select
      className="sia-select-date-range__select"
      aria-label={selectAriaLabel}
      options={options}
      value={currentValue.select}
      placeholder={selectPlaceholder}
      placeholderMode={placeholderMode}
      size={size}
      status={status}
      disabled={disabled}
      onChange={(nextSelect) => {
        if (nextSelect === null || Array.isArray(nextSelect)) return;
        setCurrentValue({ ...currentValue, select: nextSelect });
      }}
    />
    <DatePicker.RangePicker
      className="sia-select-date-range__picker"
      aria-label={rangeAriaLabel}
      value={currentValue.range}
      placeholder={rangePlaceholder}
      placeholderMode={placeholderMode}
      presets={presets}
      size={size}
      status={status}
      disabled={disabled}
      onChange={(nextRange) => setCurrentValue({ ...currentValue, range: nextRange })}
    />
  </div>;
}

import { useId } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { DatePicker } from "./DatePicker";
import type { DateRangePickerPreset } from "./DatePicker";
import { Select } from "./Select";
import type { SelectOption, SelectValue } from "./Select";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";

export interface DateRangeQueryValue {
  type: SelectValue;
  range: readonly [string, string];
}

export interface DateRangeQueryProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  options: readonly SelectOption[];
  value?: DateRangeQueryValue;
  defaultValue?: DateRangeQueryValue;
  label?: ReactNode;
  typeLabel?: ReactNode;
  rangeLabel?: ReactNode;
  typePlaceholder?: ReactNode;
  rangePlaceholder?: readonly [string, string];
  presets?: readonly DateRangePickerPreset[];
  size?: ControlSize;
  status?: ControlStatus;
  disabled?: boolean;
  onChange?: (value: DateRangeQueryValue) => void;
}

export function DateRangeQuery({
  options,
  value,
  defaultValue,
  label = "时间范围",
  typeLabel = "时间范围类型",
  rangeLabel = "日期范围",
  typePlaceholder = "请选择时间类型",
  rangePlaceholder = ["开始日期", "结束日期"],
  presets,
  size = "medium",
  status = "default",
  disabled = false,
  onChange,
  className = "",
  ...props
}: DateRangeQueryProps) {
  const id = useId();
  const initialValue = defaultValue ?? { type: options[0]?.value ?? "", range: ["", ""] };
  const [currentValue, setCurrentValue] = useControllableState<DateRangeQueryValue>({ value, defaultValue: initialValue, onChange });
  const typeLabelId = typeLabel ? `${id}-type-label` : undefined;
  const rangeLabelId = rangeLabel ? `${id}-range-label` : undefined;

  return <div className={`sia-date-range-query ${className}`.trim()} role="group" aria-label={typeof label === "string" ? label : "时间范围组合查询"} {...props}>
    {label ? <strong className="sia-date-range-query__title">{label}</strong> : null}
    <div className="sia-date-range-query__controls">
      <div className="sia-date-range-query__field sia-date-range-query__field--type">
        <span id={typeLabelId}>{typeLabel}</span>
        <Select
          aria-labelledby={typeLabelId}
          options={options}
          value={currentValue.type}
          placeholder={typePlaceholder}
          size={size}
          status={status}
          disabled={disabled}
          onChange={(nextType) => {
            if (nextType === null || Array.isArray(nextType)) return;
            setCurrentValue({ ...currentValue, type: nextType });
          }}
        />
      </div>
      <div className="sia-date-range-query__field sia-date-range-query__field--range">
        <span id={rangeLabelId}>{rangeLabel}</span>
        <DatePicker.RangePicker
          aria-labelledby={rangeLabelId}
          value={currentValue.range}
          placeholder={rangePlaceholder}
          presets={presets}
          size={size}
          status={status}
          disabled={disabled}
          onChange={(nextRange) => setCurrentValue({ ...currentValue, range: nextRange })}
        />
      </div>
    </div>
  </div>;
}

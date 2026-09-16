import { useControlSize } from "./shared";
import type { InputPlaceholderMode } from "./shared";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { DatePicker } from "./DatePicker";
import type { DateRangePickerPreset } from "./DatePicker";
import { Select } from "./Select";
import type { SelectOption, SelectValue } from "./Select";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";

/** 类型与日期区间组合选择的值类型。 */
export interface SelectDateRangeValue {
  /** 选择指定项，或日期类型选择器的配置。 */
  select: SelectValue;
  /** 是否启用范围选择，或指定选择范围。 */
  range: readonly [string, string];
}

/** 类型与日期区间组合选择的属性配置。 */
export interface SelectDateRangeProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** 可供用户选择的候选项列表。 */
  options: readonly SelectOption[];
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: SelectDateRangeValue;
  /** 非受控模式的初始值，仅在初始化时使用。 */
  defaultValue?: SelectDateRangeValue;
  /**
   * 选择器占位内容
   * @defaultValue "请选择类型"
   */
  selectPlaceholder?: ReactNode;
  /** 占位提示的显示模式；floating 为浮动标签。 */
  placeholderMode?: InputPlaceholderMode;
  /** 左侧选择器宽度，数字单位为 px；右侧日期范围自动填充剩余宽度。 */
  selectWidth?: CSSProperties["width"];
  /**
   * 开始和结束日期占位内容
   * @defaultValue ["开始日期", "结束日期"]
   */
  rangePlaceholder?: readonly [string, string];
  /**
   * 日期类型选择器的无障碍名称。
   * @defaultValue "选择类型"
   */
  selectAriaLabel?: string;
  /**
   * 日期区间控件的无障碍名称。
   * @defaultValue "日期范围"
   */
  rangeAriaLabel?: string;
  /** 预设候选值或快捷选项集合。 */
  presets?: readonly DateRangePickerPreset[];
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /**
   * 当前状态，用于选择对应的状态样式。
   * @defaultValue "default"
   */
  status?: ControlStatus;
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (value: SelectDateRangeValue) => void;
}

/** 类型与日期区间组合选择组件。 */
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
  size: sizeProp,
  status = "default",
  disabled = false,
  onChange,
  className = "",
  style,
  ...props
}: SelectDateRangeProps) {
  const size = useControlSize(sizeProp);
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

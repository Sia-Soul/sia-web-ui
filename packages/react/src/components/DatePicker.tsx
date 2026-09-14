import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import { PopupPortal } from "./PopupPortal";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";
import {
  addMonths,
  CalendarHeader,
  CalendarMonth,
  dateKey,
  DatePanelFooter,
  daysBetween,
  normalizeDateValue,
  parseDate,
  startOfMonth,
  timePart,
  TimePanel,
  withTime,
} from "./DatePickerPanel";
import type { DatePickerShowTime } from "./DatePickerPanel";

export type DatePickerType = "date" | "week" | "month" | "year" | "quarter";
export type DatePickerValue = string | readonly string[];
export type DatePickerPreset = { label: ReactNode; value: string | (() => string) };
export type DateRangePickerPreset = { label: ReactNode; value: readonly [string, string] | (() => readonly [string, string]) };
export type DatePickerDisabledInfo = { from?: string; type: "date" };

type SharedDatePickerProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "value" | "defaultValue" | "onChange" | "multiple">;

export interface DatePickerProps extends SharedDatePickerProps {
  value?: DatePickerValue;
  defaultValue?: DatePickerValue;
  picker?: DatePickerType;
  size?: ControlSize;
  status?: ControlStatus;
  allowClear?: boolean;
  multiple?: boolean;
  needConfirm?: boolean;
  showTime?: DatePickerShowTime;
  showToday?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  suffixIcon?: ReactNode;
  minDate?: string;
  maxDate?: string;
  presets?: readonly DatePickerPreset[];
  disabledDate?: (value: string, info: DatePickerDisabledInfo) => boolean;
  onChange?: (value: DatePickerValue) => void;
  onOpenChange?: (open: boolean) => void;
  /** 只格式化显示文字，不改变传入和回调的标准日期值。 */
  formatValue?: (value: string) => string;
  renderExtraFooter?: () => ReactNode;
}

export interface DateRangePickerProps extends Omit<DatePickerProps, "value" | "defaultValue" | "onChange" | "placeholder" | "multiple" | "presets"> {
  value?: readonly [string, string];
  defaultValue?: readonly [string, string];
  placeholder?: readonly [string, string];
  separator?: ReactNode;
  presets?: readonly DateRangePickerPreset[];
  maxRangeDays?: number;
  /** 允许单独保留起点或终点；需要点击确定提交未完整的范围。 */
  allowEmpty?: readonly [boolean, boolean];
  /** 锁定指定端点，编辑和清空时保留其值。 */
  endpointDisabled?: readonly [boolean, boolean];
  onCalendarChange?: (value: readonly [string, string]) => void;
  onChange?: (value: readonly [string, string]) => void;
}

function formatWeek(date: Date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function formatPickerValue(day: string, picker: DatePickerType) {
  const date = parseDate(day);
  if (!date) return day;
  if (picker === "month") return day.slice(0, 7);
  if (picker === "year") return day.slice(0, 4);
  if (picker === "quarter") return `${day.slice(0, 4)}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  if (picker === "week") return formatWeek(date);
  return day;
}

function dayFromValue(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}-Q[1-4]$/.test(value)) return `${value.slice(0, 4)}-${String((Number(value.slice(-1)) - 1) * 3 + 1).padStart(2, "0")}-01`;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  return "";
}

function placeholderFor(picker: DatePickerType, showTime: DatePickerShowTime, multiple: boolean) {
  if (multiple) return "请选择多个日期";
  if (picker === "month") return "请选择月份";
  if (picker === "year") return "请选择年份";
  if (picker === "quarter") return "请选择季度";
  if (picker === "week") return "请选择周";
  return showTime ? "请选择日期时间" : "请选择日期";
}

function showSecondFrom(showTime: DatePickerShowTime) {
  return Boolean(typeof showTime === "object" && showTime.showSecond);
}

function defaultTimeFrom(showTime: DatePickerShowTime, index: 0 | 1 = 0): string {
  const value = typeof showTime === "object" ? showTime.defaultValue : undefined;
  return typeof value === "string" ? value : value?.[index] ?? "00:00:00";
}

function resolvePreset(value: string | (() => string)) {
  return typeof value === "function" ? value() : value;
}

function resolveRangePreset(value: readonly [string, string] | (() => readonly [string, string])) {
  return typeof value === "function" ? value() : value;
}

export function DatePicker({
  value,
  defaultValue,
  picker = "date",
  size = "medium",
  status = "default",
  allowClear = true,
  multiple = false,
  needConfirm,
  showTime = false,
  showToday = true,
  open,
  defaultOpen = false,
  suffixIcon,
  minDate,
  maxDate,
  presets,
  disabledDate,
  disabled,
  className = "",
  onChange,
  onOpenChange,
  placeholder,
  formatValue = (value) => value,
  renderExtraFooter,
  ...props
}: DatePickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const initialValue: DatePickerValue = defaultValue ?? (multiple ? [] : "");
  const [currentValue, setCurrentValue] = useControllableState<DatePickerValue>({ value, defaultValue: initialValue, onChange });
  const [visible, setVisible] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const [draftValue, setDraftValue] = useState<DatePickerValue>(currentValue);
  const firstCurrent = Array.isArray(currentValue) ? currentValue[0] : currentValue;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseDate(dayFromValue(firstCurrent)) ?? new Date()));
  const [draftTime, setDraftTime] = useState(() => timePart(firstCurrent, defaultTimeFrom(showTime)));
  const resolvedNeedConfirm = needConfirm ?? Boolean(showTime);
  const showSecond = showSecondFrom(showTime);
  const selectedDates = useMemo(() => {
    const values = Array.isArray(draftValue) ? draftValue : draftValue ? [draftValue] : [];
    return values.map(dayFromValue).filter(Boolean);
  }, [draftValue]);

  useEffect(() => {
    if (!visible) return undefined;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setVisible(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [setVisible, visible]);

  function changeOpen(next: boolean) {
    if (next) {
      setDraftValue(currentValue);
      const current = Array.isArray(currentValue) ? currentValue[0] : currentValue;
      setViewMonth(startOfMonth(parseDate(dayFromValue(current)) ?? new Date()));
      setDraftTime(timePart(current, defaultTimeFrom(showTime)));
    }
    setVisible(next);
  }

  function isDisabled(day: string) {
    const minimum = minDate ?? props.min;
    const maximum = maxDate ?? props.max;
    if (minimum && day < String(minimum).slice(0, 10)) return true;
    if (maximum && day > String(maximum).slice(0, 10)) return true;
    return disabledDate?.(day, { type: "date" }) ?? false;
  }

  function buildValue(day: string) {
    const picked = formatPickerValue(day, picker);
    return showTime && picker === "date" ? withTime(picked, draftTime, showSecond) : picked;
  }

  function selectDate(day: string) {
    if (isDisabled(day)) return;
    const nextValue = buildValue(day);
    if (multiple) {
      const current = Array.isArray(draftValue) ? [...draftValue] : [];
      const exists = current.some((item) => dayFromValue(item) === day);
      const next = exists ? current.filter((item) => dayFromValue(item) !== day) : [...current, nextValue];
      setDraftValue(next);
      if (!resolvedNeedConfirm) setCurrentValue(next);
      return;
    }
    setDraftValue(nextValue);
    if (!resolvedNeedConfirm) {
      setCurrentValue(nextValue);
      changeOpen(false);
    }
  }

  function commitDraft() {
    const values = Array.isArray(draftValue) ? draftValue : [draftValue as string];
    if (values.some((value) => !value || isDisabled(dayFromValue(value)))) return;
    setCurrentValue(draftValue);
    changeOpen(false);
  }

  function clearValue(event: React.MouseEvent) {
    event.stopPropagation();
    const empty: DatePickerValue = multiple ? [] : "";
    setDraftValue(empty);
    setCurrentValue(empty);
  }

  const display = Array.isArray(currentValue) ? currentValue.map(formatValue).join("、") : currentValue ? formatValue(currentValue as string) : "";
  const triggerLabel = props["aria-label"] ?? (typeof placeholder === "string" ? placeholder : "日期选择器");

  return <span ref={rootRef} className={`sia-picker sia-picker--${size} sia-picker--${status}${visible ? " is-open" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()}>
    <button
      type="button"
      id={props.id ?? id}
      className="sia-picker__trigger"
      aria-label={triggerLabel}
      aria-labelledby={props["aria-labelledby"]}
      aria-haspopup="dialog"
      aria-expanded={visible}
      aria-invalid={status === "error" || undefined}
      aria-describedby={props["aria-describedby"]}
      aria-errormessage={props["aria-errormessage"]}
      disabled={disabled}
      onClick={() => changeOpen(!visible)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          changeOpen(true);
        } else if (event.key === "Escape") changeOpen(false);
      }}
    >
      <span className={`sia-picker__value${display ? "" : " is-placeholder"}`}>{display || placeholder || placeholderFor(picker, showTime, multiple)}</span>

      <span className="sia-picker__icon" aria-hidden="true">{suffixIcon ?? <Icon name="calendar" size={16} />}</span>
    </button>
    {allowClear && display && !disabled ? <button type="button" className="sia-picker__clear" aria-label="清除日期" onClick={clearValue}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
    <PopupPortal ref={popupRef} anchorRef={rootRef} open={visible} className={`sia-date-panel${showTime ? " sia-date-panel--with-time" : ""}${presets?.length ? " sia-date-panel--with-presets" : ""}`} role="dialog" aria-label="日期选择面板">
      <div className="sia-date-panel__body">
        {presets?.length ? <aside className="sia-date-panel__presets">
          {presets.map((preset, index) => <button type="button" key={index} onClick={() => {
            const next = resolvePreset(preset.value);
            if (!next || isDisabled(dayFromValue(next))) return;
            setDraftValue(next);
            if (!resolvedNeedConfirm) {
              setCurrentValue(next);
              changeOpen(false);
            }
          }}>{preset.label}</button>)}
        </aside> : null}
        <section className="sia-date-panel__calendar">
          <CalendarHeader
            month={viewMonth}
            onPreviousYear={() => setViewMonth(addMonths(viewMonth, -12))}
            onPreviousMonth={() => setViewMonth(addMonths(viewMonth, -1))}
            onNextMonth={() => setViewMonth(addMonths(viewMonth, 1))}
            onNextYear={() => setViewMonth(addMonths(viewMonth, 12))}
          />
          <CalendarMonth month={viewMonth} selectedDates={selectedDates} disabledDate={isDisabled} onSelect={selectDate} />
        </section>
        {showTime ? <TimePanel value={draftTime} showSecond={showSecond} onChange={(next) => {
          setDraftTime(next);
          if (typeof draftValue === "string" && draftValue) setDraftValue(withTime(dayFromValue(draftValue), next, showSecond));
        }} /> : null}
      </div>
      <DatePanelFooter
        extra={renderExtraFooter?.()}
        showToday={showToday}
        needConfirm={resolvedNeedConfirm}
        disabledConfirm={Array.isArray(draftValue) ? draftValue.length === 0 : !draftValue}
        onToday={() => selectDate(dateKey(new Date()))}
        onConfirm={commitDraft}
      />
    </PopupPortal>
  </span>;
}

function DateRangePicker({
  value,
  defaultValue = ["", ""],
  placeholder = ["开始日期", "结束日期"],
  separator = "→",
  presets,
  maxRangeDays,
  allowEmpty = [false, false],
  endpointDisabled = [false, false],
  size = "medium",
  status = "default",
  allowClear = true,
  needConfirm,
  showTime = false,
  showToday = true,
  open,
  defaultOpen = false,
  suffixIcon,
  minDate,
  maxDate,
  disabledDate,
  disabled,
  className = "",
  onCalendarChange,
  onChange,
  onOpenChange,
  formatValue = (value) => value,
  renderExtraFooter,
  ...props
}: DateRangePickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [currentValue, setCurrentValue] = useControllableState<readonly [string, string]>({ value, defaultValue, onChange });
  const [visible, setVisible] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const [draftValue, setDraftValue] = useState<readonly [string, string]>(currentValue);
  const [activeIndex, setActiveIndex] = useState<0 | 1>(currentValue[0] && !currentValue[1] ? 1 : 0);
  const [hoverDate, setHoverDate] = useState("");
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseDate(dayFromValue(currentValue[0] || currentValue[1])) ?? new Date()));
  const [endViewMonth, setEndViewMonth] = useState(() => startOfMonth(parseDate(dayFromValue(currentValue[1])) ?? addMonths(parseDate(dayFromValue(currentValue[0])) ?? new Date(), 1)));
  const [compactDateTime, setCompactDateTime] = useState(false);
  const showSecond = showSecondFrom(showTime);
  const defaultTime = defaultTimeFrom(showTime);
  const defaultEndTime = defaultTimeFrom(showTime, 1);
  const [times, setTimes] = useState<[string, string]>([
    timePart(currentValue[0], defaultTime),
    timePart(currentValue[1], defaultEndTime),
  ]);
  const resolvedNeedConfirm = needConfirm ?? Boolean(showTime);
  const rangeDates: [string, string] = [dayFromValue(draftValue[0]), dayFromValue(draftValue[1])];
  const invalidDateTimeRange = Boolean(showTime && draftValue[0] && draftValue[1] && draftValue[0] > draftValue[1]);

  useEffect(() => {
    if (!showTime || typeof document === "undefined") {
      setCompactDateTime(false);
      return undefined;
    }
    const updateLayout = () => {
      const pairedPanelWidth = 2 * (280 + (showSecond ? 144 : 96) + 1) + 3;
      setCompactDateTime(document.documentElement.clientWidth < pairedPanelWidth + 16);
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [showSecond, showTime]);

  useEffect(() => {
    if (!visible) return undefined;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setVisible(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [setVisible, visible]);

  function changeOpen(next: boolean) {
    if (next) {
      setDraftValue(currentValue);
      setTimes([timePart(currentValue[0], defaultTime), timePart(currentValue[1], defaultEndTime)]);
      setActiveIndex(endpointDisabled[0] ? 1 : endpointDisabled[1] ? 0 : currentValue[0] && !currentValue[1] ? 1 : 0);
      const nextStartMonth = startOfMonth(parseDate(dayFromValue(currentValue[0] || currentValue[1])) ?? new Date());
      setViewMonth(nextStartMonth);
      setEndViewMonth(startOfMonth(parseDate(dayFromValue(currentValue[1])) ?? addMonths(nextStartMonth, 1)));
    }
    setVisible(next);
  }

  function isDisabled(day: string, index: 0 | 1 = activeIndex, pairedDateTime = false) {
    if (endpointDisabled[index]) return true;
    const minimum = minDate ?? props.min;
    const maximum = maxDate ?? props.max;
    if (minimum && day < String(minimum).slice(0, 10)) return true;
    if (maximum && day > String(maximum).slice(0, 10)) return true;
    const from = index === 1 ? rangeDates[0] : undefined;
    if (pairedDateTime) {
      const otherEndpoint = index === 0 ? rangeDates[1] : rangeDates[0];
      if (index === 0 && otherEndpoint && day > otherEndpoint) return true;
      if (index === 1 && otherEndpoint && day < otherEndpoint) return true;
      if (otherEndpoint && maxRangeDays && Math.abs(daysBetween(otherEndpoint, day)) >= maxRangeDays) return true;
    } else if (from && maxRangeDays && Math.abs(daysBetween(from, day)) >= maxRangeDays) return true;
    return disabledDate?.(day, { from, type: "date" }) ?? false;
  }

  function buildRangeValue(day: string, index: 0 | 1) {
    return showTime ? withTime(day, times[index], showSecond) : day;
  }

  function updateDraft(next: readonly [string, string]) {
    setDraftValue(next);
    onCalendarChange?.(next);
  }

  function selectDate(day: string) {
    if (isDisabled(day)) return;
    if (endpointDisabled.some(Boolean)) {
      const index = endpointDisabled[0] ? 1 : 0;
      const next: [string, string] = [...draftValue];
      next[index] = buildRangeValue(day, index);
      updateDraft(next);
      if (!resolvedNeedConfirm && isValidRange(next)) {
        setCurrentValue(next);
        changeOpen(false);
      }
      return;
    }
    if (activeIndex === 0 || !rangeDates[0] || rangeDates[1]) {
      const next: readonly [string, string] = [buildRangeValue(day, 0), ""];
      updateDraft(next);
      setActiveIndex(1);
      setHoverDate("");
      return;
    }
    const startDay = rangeDates[0];
    const ordered: [string, string] = day < startDay
      ? [buildRangeValue(day, 0), buildRangeValue(startDay, 1)]
      : [draftValue[0], buildRangeValue(day, 1)];
    updateDraft(ordered);
    setActiveIndex(0);
    setHoverDate("");
    if (!resolvedNeedConfirm) {
      setCurrentValue(ordered);
      changeOpen(false);
    }
  }

  function selectDateTime(day: string, index: 0 | 1) {
    if (isDisabled(day, index, true)) return;
    const nextValue: [string, string] = [...draftValue];
    nextValue[index] = buildRangeValue(day, index);
    updateDraft(nextValue);
    setHoverDate("");
    if (!resolvedNeedConfirm && compactDateTime && index === 0) {
      setActiveIndex(1);
      setEndViewMonth(startOfMonth(parseDate(day) ?? new Date()));
      return;
    }
    setActiveIndex(index);
    if (!resolvedNeedConfirm && nextValue[0] && nextValue[1] && nextValue[0] <= nextValue[1]) {
      setCurrentValue(nextValue);
      changeOpen(false);
    }
  }

  function changeTime(index: 0 | 1, nextTime: string) {
    if (endpointDisabled[index]) return;
    const nextTimes: [string, string] = [...times];
    nextTimes[index] = nextTime;
    setTimes(nextTimes);
    setActiveIndex(index);
    if (draftValue[index]) {
      const nextValue: [string, string] = [...draftValue];
      nextValue[index] = withTime(dayFromValue(draftValue[index]), nextTime, showSecond);
      updateDraft(nextValue);
    }
  }

  function isValidRange(next: readonly [string, string]) {
    if (!next.some(Boolean)) return false;
    for (const index of [0, 1] as const) {
      if (!next[index]) { if (!allowEmpty[index]) return false; else continue; }
      if (endpointDisabled[index]) { if (next[index] !== currentValue[index]) return false; else continue; }
      const day = dayFromValue(next[index]);
      if (!day) return false;
      if (minDate && day < minDate.slice(0, 10) || maxDate && day > maxDate.slice(0, 10)) return false;
      if (disabledDate?.(day, { from: index === 1 ? dayFromValue(next[0]) || undefined : undefined, type: "date" })) return false;
    }
    if (next[0] && next[1]) {
      if (next[0] > next[1]) return false;
      if (maxRangeDays && Math.abs(daysBetween(dayFromValue(next[0]), dayFromValue(next[1]))) >= maxRangeDays) return false;
    }
    return true;
  }

  function confirm() {
    if (compactDateTime && showTime && activeIndex === 0) {
      if (!draftValue[0]) return;
      setActiveIndex(1);
      setEndViewMonth(startOfMonth(parseDate(dayFromValue(draftValue[1] || draftValue[0])) ?? new Date()));
      setHoverDate("");
      return;
    }
    if (!isValidRange(draftValue)) return;
    setCurrentValue(draftValue);
    changeOpen(false);
  }

  function applyPreset(preset: DateRangePickerPreset) {
    const raw = resolveRangePreset(preset.value);
    const next: readonly [string, string] = [
      normalizeDateValue(raw[0], showTime),
      normalizeDateValue(raw[1], showTime, 1),
    ];
    if (!isValidRange(next)) return;
    updateDraft(next);
    setTimes([timePart(next[0], defaultTime), timePart(next[1], defaultEndTime)]);
    const nextStartMonth = startOfMonth(parseDate(dayFromValue(next[0] || next[1])) ?? new Date());
    setViewMonth(nextStartMonth);
    setEndViewMonth(startOfMonth(parseDate(dayFromValue(next[1])) ?? addMonths(nextStartMonth, 1)));
    if (!resolvedNeedConfirm) {
      setCurrentValue(next);
      changeOpen(false);
    }
  }

  function clearValue(event: React.MouseEvent) {
    event.stopPropagation();
    const empty: readonly [string, string] = [endpointDisabled[0] ? currentValue[0] : "", endpointDisabled[1] ? currentValue[1] : ""];
    updateDraft(empty);
    setCurrentValue(empty);
    setActiveIndex(0);
  }

  function renderDateTimeGroup(index: 0 | 1) {
    const month = index === 0 ? viewMonth : endViewMonth;
    const setMonth = index === 0 ? setViewMonth : setEndViewMonth;
    const endpointLabel = index === 0 ? "开始" : "结束";
    return <div
      className={`sia-date-panel__range-date-time-group${activeIndex === index ? " is-active" : ""}`}
      aria-label={`${endpointLabel}日期时间`}
      key={endpointLabel}
    >
      <section className="sia-date-panel__calendar">
        <CalendarHeader
          month={month}
          label={endpointLabel}
          range
          onPreviousYear={() => setMonth(addMonths(month, -12))}
          onPreviousMonth={() => setMonth(addMonths(month, -1))}
          onNextMonth={() => setMonth(addMonths(month, 1))}
          onNextYear={() => setMonth(addMonths(month, 12))}
        />
        <CalendarMonth
          month={month}
          range={rangeDates}
          disabledDate={(day) => isDisabled(day, index, true)}
          onSelect={(day) => selectDateTime(day, index)}
        />
      </section>
      <TimePanel
        value={times[index]}
        showSecond={showSecond}
        ariaLabel={`${endpointLabel}时间`}
        onChange={(nextTime) => changeTime(index, nextTime)}
      />
    </div>;
  }

  return <span ref={rootRef} className={`sia-picker sia-picker-range-control sia-picker--${size} sia-picker--${status}${visible ? " is-open" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()}>
    <button
      type="button"
      id={props.id ?? id}
      className="sia-picker__trigger"
      aria-label={props["aria-label"] ?? "日期范围选择器"}
      aria-labelledby={props["aria-labelledby"]}
      aria-haspopup="dialog"
      aria-expanded={visible}
      aria-invalid={status === "error" || undefined}
      aria-describedby={props["aria-describedby"]}
      aria-errormessage={props["aria-errormessage"]}
      disabled={disabled}
      onClick={() => changeOpen(!visible)}
    >
      <span className={`sia-picker-range-control__value${currentValue[0] ? "" : " is-placeholder"}`}>{currentValue[0] ? formatValue(currentValue[0]) : placeholder[0]}</span>
      <span className="sia-picker-range-control__separator">{separator}</span>
      <span className={`sia-picker-range-control__value${currentValue[1] ? "" : " is-placeholder"}`}>{currentValue[1] ? formatValue(currentValue[1]) : placeholder[1]}</span>

      <span className="sia-picker__icon" aria-hidden="true">{suffixIcon ?? <Icon name="calendar" size={16} />}</span>
    </button>
    {allowClear && (currentValue[0] || currentValue[1]) && !disabled ? <button type="button" className="sia-picker__clear" aria-label="清除日期范围" onClick={clearValue}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
    <PopupPortal ref={popupRef} anchorRef={rootRef} open={visible} className={`sia-date-panel sia-date-panel--range${showTime ? ` sia-date-panel--with-time sia-date-panel--range-time-${compactDateTime ? "compact" : "paired"}` : ""}${presets?.length ? " sia-date-panel--with-presets" : ""}`} role="dialog" aria-label="日期范围选择面板">
      <div className="sia-date-panel__body">
        {showTime ? <div className="sia-date-panel__range-date-time">
          {compactDateTime ? renderDateTimeGroup(activeIndex) : <>{renderDateTimeGroup(0)}{renderDateTimeGroup(1)}</>}
        </div> : <div className="sia-date-panel__range-calendars">
          <section className="sia-date-panel__calendar">
            <CalendarHeader
              month={viewMonth}
              range
              onPreviousYear={() => setViewMonth(addMonths(viewMonth, -12))}
              onPreviousMonth={() => setViewMonth(addMonths(viewMonth, -1))}
            />
            <CalendarMonth month={viewMonth} range={rangeDates} previewEnd={activeIndex === 1 ? hoverDate : ""} disabledDate={isDisabled} onSelect={selectDate} onHover={activeIndex === 1 ? setHoverDate : undefined} />
          </section>
          <section className="sia-date-panel__calendar">
            <CalendarHeader
              month={addMonths(viewMonth, 1)}
              range
              onNextMonth={() => setViewMonth(addMonths(viewMonth, 1))}
              onNextYear={() => setViewMonth(addMonths(viewMonth, 12))}
            />
            <CalendarMonth month={addMonths(viewMonth, 1)} range={rangeDates} previewEnd={activeIndex === 1 ? hoverDate : ""} disabledDate={isDisabled} onSelect={selectDate} onHover={activeIndex === 1 ? setHoverDate : undefined} />
          </section>
        </div>}
      </div>
      <DatePanelFooter
        showToday={showToday && !presets?.length}
        needConfirm={resolvedNeedConfirm || allowEmpty.some(Boolean)}
        disabledConfirm={compactDateTime && showTime && activeIndex === 0 ? !draftValue[0] : !isValidRange(draftValue)}
        confirmText={compactDateTime && showTime && activeIndex === 0 ? "下一步" : "确定"}
        extra={<>
          {renderExtraFooter?.()}
          {presets?.map((preset, index) => <button type="button" key={index} onClick={() => applyPreset(preset)}>{preset.label}</button>)}
          {compactDateTime && showTime && activeIndex === 1 ? <button type="button" onClick={() => {
            setActiveIndex(0);
            setViewMonth(startOfMonth(parseDate(dayFromValue(draftValue[0])) ?? new Date()));
          }}>上一步</button> : null}
          {invalidDateTimeRange ? <small className="sia-date-panel__range-error">结束时间不能早于开始时间</small> : maxRangeDays ? <small>最多选择 {maxRangeDays} 天</small> : null}
        </>}
        onToday={() => showTime ? selectDateTime(dateKey(new Date()), activeIndex) : selectDate(dateKey(new Date()))}
        onConfirm={confirm}
      />
    </PopupPortal>
  </span>;
}

export namespace DatePicker {
  export const RangePicker = DateRangePicker;
}

export type { DatePickerShowTime };

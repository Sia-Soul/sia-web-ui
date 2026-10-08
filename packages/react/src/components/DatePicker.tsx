import { useControlSize } from "./shared";
import { useFloatingPlaceholder } from "./FloatingPlaceholder";
import type { InputPlaceholderMode } from "./shared";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  pad,
  parseDate,
  startOfMonth,
  timePart,
  TimePanel,
  withTime,
} from "./DatePickerPanel";
import type { DatePickerShowTime } from "./DatePickerPanel";

/** 日期选择的类型标识。 */
export type DatePickerType = "date" | "week" | "month" | "year" | "quarter";
/** 日期选择的值类型。 */
export type DatePickerValue = string | readonly string[];
/** 日期选择面板中的快捷日期选项。 */
export type DatePickerPreset = {
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: string | (() => string) };
/** 日期区间面板中的快捷范围选项。 */
export type DateRangePickerPreset = {
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: readonly [string, string] | (() => readonly [string, string]) };
/** 日期禁用判断函数收到的面板和范围上下文。 */
export type DatePickerDisabledInfo = {
  /** 范围、渐变或转换的起始值。 */
  from?: string;
  /** 类型标识，用于选择对应的表现形式。 */
  type: "date" };

/** SharedDatePicker的属性配置。 */
type SharedDatePickerProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "value" | "defaultValue" | "onChange" | "multiple">;

/** 日期选择的属性配置。 */
export interface DatePickerProps extends SharedDatePickerProps {
  /** 占位提示的显示模式；floating 为浮动标签。 */
  placeholderMode?: InputPlaceholderMode;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: DatePickerValue;
  /** 非受控模式的初始值，仅在初始化时使用。 */
  defaultValue?: DatePickerValue;
  /**
   * 日期粒度
   * @defaultValue "date"
   */
  picker?: DatePickerType;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /**
   * 当前状态，用于选择对应的状态样式。
   * @defaultValue "default"
   */
  status?: ControlStatus;
  /**
   是否允许清空当前选择或输入值。
   * @defaultValue true
   */
  allowClear?: boolean;
  /**
   是否允许在同一面板选择多个日期。
   * @defaultValue false
   */
  multiple?: boolean;
  /** 选择后需要点击确定才提交；带时间的范围必须确认后保存；纯日期范围点选后立即保存合法值，此属性仅控制是否保留面板供确认关闭。 */
  needConfirm?: boolean;
  /**
   * 组合时间面板，可显示秒；范围选择始终显示单个面板，点击起止输入区域直接编辑对应端点。日历点选结束日期时自动填入 23:59，开启 showSecond 时为 23:59:59，可随后手动调整；开始日期保留原时间，“此刻”使用当前时间，快捷范围保留预设时间。先确认当前端点，再切换到另一端点，两个端点确认后提交并关闭；锁定端点无需再次确认，快捷范围只需一次确认。
   * @defaultValue false
   */
  showTime?: DatePickerShowTime;
  /**
   * 是否显示“此刻”入口。点击选择本机当前日期；开启 showTime 时同时填入当前时分，showSecond 为 true 时包含秒。沿用 needConfirm 的提交规则；范围选择仅更新当前编辑端点，禁用日期不可选择。
   * @defaultValue true
   */
  showToday?: boolean;
  /** 是否打开；传入后由外部控制显示状态。 */
  open?: boolean;
  /**
   * 非受控模式下的初始打开状态。
   * @defaultValue false
   */
  defaultOpen?: boolean;
  /** 显示在控件末尾的图标。 */
  suffixIcon?: ReactNode;
  /** 允许选择的最早日期。 */
  minDate?: string;
  /** 允许选择的最晚日期。 */
  maxDate?: string;
  /** 预设候选值或快捷选项集合。 */
  presets?: readonly DatePickerPreset[];
  /** 判断某个日期是否不可选的函数。 */
  disabledDate?: (value: string, info: DatePickerDisabledInfo) => boolean;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (value: DatePickerValue) => void;
  /** 打开状态改变时触发，参数为新的打开状态。 */
  onOpenChange?: (open: boolean) => void;
  /** 只格式化显示文字，不改变传入和回调的标准日期值。 */
  formatValue?: (value: string) => string;
  /** 渲染面板底部的自定义扩展区域。 */
  renderExtraFooter?: () => ReactNode;
}

/** 日期区间选择的属性配置。 */
export interface DateRangePickerProps extends Omit<DatePickerProps, "value" | "defaultValue" | "onChange" | "placeholder" | "multiple" | "presets"> {
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: readonly [string, string];
  /**
   * 非受控模式的初始值，仅在初始化时使用。
   * @defaultValue ["", ""]
   */
  defaultValue?: readonly [string, string];
  /**
   * 未填写或未选择时的提示内容。
   * @defaultValue ["开始日期", "结束日期"]
   */
  placeholder?: readonly [string, string];
  /**
   * 全局分隔符，可传入图标或文字
   * @defaultValue "→"
   */
  separator?: ReactNode;
  /** 在面板左侧按配置顺序纵向显示的快捷范围；带时间时点击仅回填暂存值，再点击一次确定即提交并关闭，无需逐端确认；手动修改后恢复分步确认。 */
  presets?: readonly DateRangePickerPreset[];
  /** 日期区间允许的最大天数。 */
  maxRangeDays?: number;
  /**
   * 按开始、结束顺序指定端点是否允许为空。任一端允许为空时，展开期间输入框即时显示暂存的日期时间；两端均必填时保留已提交值，完整确认后一起更新。
   * 纯日期点选后立即通过 onChange 保存合法值，收起后保留；带时间仅即时显示暂存值，必须点击确定保存，未确认就收起则恢复已提交值。缺少必填端点或范围不合法时不保存。
   * @defaultValue [false, false]
   */
  allowEmpty?: readonly [boolean, boolean];
  /** 锁定指定端点，编辑和清空时保留其值。 */
  endpointDisabled?: readonly [boolean, boolean];
  /** 日期区间选择过程中的暂存值变化时调用。 */
  onCalendarChange?: (value: readonly [string, string]) => void;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
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

/** 日期选择组件。 */
export function DatePicker({
  value,
  defaultValue,
  picker = "date",
  size: sizeProp,
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
  placeholderMode,
  formatValue = (value) => value,
  renderExtraFooter,
  ...props
}: DatePickerProps) {
  const size = useControlSize(sizeProp);
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

  // 快捷选择显式传入本次点击时间，避免读取尚未更新的 React 时间状态。
  function buildValue(day: string, time = draftTime) {
    const picked = formatPickerValue(day, picker);
    return showTime && picker === "date" ? withTime(picked, time, showSecond) : picked;
  }

  // 此刻入口确保日期被选中；普通多选点击仍切换该日期的选中状态。
  function selectDate(day: string, time = draftTime, ensureSelected = false) {
    if (isDisabled(day)) return;
    const nextValue = buildValue(day, time);
    if (multiple) {
      const current = Array.isArray(draftValue) ? [...draftValue] : [];
      const exists = current.some((item) => dayFromValue(item) === day);
      const next = exists
        ? ensureSelected ? current.map((item) => dayFromValue(item) === day ? nextValue : item) : current.filter((item) => dayFromValue(item) !== day)
        : [...current, nextValue];
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
  const floating = useFloatingPlaceholder({ mode: placeholderMode, placeholder: placeholder ?? placeholderFor(picker, showTime, multiple), filled: Boolean(display), active: visible });
  const triggerLabel = props["aria-label"] ?? (typeof placeholder === "string" ? placeholder : "日期选择器");

  return <span ref={rootRef} className={`sia-picker${floating.className} sia-picker--${size} sia-picker--${status}${visible ? " is-open" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()}>
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
    {floating.label}
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
        onToday={() => {
          // 日期与时间取自同一时刻，跨午夜点击也不会拼接出不一致的值。
          const now = new Date();
          const day = dateKey(now);
          if (isDisabled(day)) return;
          const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map(pad).join(":");
          if (showTime) setDraftTime(time);
          setViewMonth(startOfMonth(now));
          selectDate(day, time, true);
        }}
        onConfirm={commitDraft}
      />
    </PopupPortal>
  </span>;
}

/** 日期范围选择；纯日期按两次点击组成范围，带时间时使用单面板分步设置起止值并确认提交，活动底线随编辑端点平滑移动。 */
function DateRangePicker({
  value,
  defaultValue = ["", ""],
  placeholder = ["开始日期", "结束日期"],
  placeholderMode,
  separator = "→",
  presets,
  maxRangeDays,
  allowEmpty = [false, false],
  endpointDisabled = [false, false],
  size: sizeProp,
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
  const size = useControlSize(sizeProp);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [currentValue, setCurrentValue] = useControllableState<readonly [string, string]>({ value: value === undefined ? undefined : Array.isArray(value) ? value : ["", ""], defaultValue, onChange });
  const [visible, setVisible] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const [draftValue, setDraftValue] = useState<readonly [string, string]>(currentValue);
  const [activeIndex, setActiveIndex] = useState<0 | 1>(endpointDisabled[0] || currentValue[0] && !currentValue[1] ? 1 : 0);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  // 共用底线按实际输入区域定位，兼容自定义分隔符及容器尺寸变化，避免切换时重建动画节点。
  useLayoutEffect(() => {
    const field = rootRef.current?.querySelector<HTMLElement>(`[data-range-endpoint="${activeIndex}"]`);
    const indicator = indicatorRef.current;
    if (!field || !indicator) return;
    /** 将底线对齐当前输入区域；偏移与宽度均为相对触发按钮的 CSS 像素。 */
    const alignIndicator = () => {
      indicator.style.transform = `translateX(${field.offsetLeft}px)`;
      indicator.style.width = `${field.offsetWidth}px`;
    };
    alignIndicator();
    const observer = new ResizeObserver(alignIndicator);
    // 同时观察分隔符，确保只改变分隔符宽度时也能更新底线位置。
    const trigger = field.parentElement;
    if (trigger) {
      observer.observe(trigger);
      for (const child of trigger.children) if (child !== indicator) observer.observe(child);
    }
    return () => observer.disconnect();
  });
  // 每次打开独立记录已确认端点，使从开始或结束进入都先确认本端、再确认另一端。
  const [confirmedIndex, setConfirmedIndex] = useState<0 | 1 | null>(null);
  // 快捷范围一次提供两端，无需逐端确认；重新手动编辑后恢复分步确认。
  const [presetSelected, setPresetSelected] = useState(false);
  const [hoverDate, setHoverDate] = useState("");
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseDate(dayFromValue(currentValue[0] || currentValue[1])) ?? new Date()));
  const [endViewMonth, setEndViewMonth] = useState(() => startOfMonth(parseDate(dayFromValue(currentValue[1])) ?? addMonths(parseDate(dayFromValue(currentValue[0])) ?? new Date(), 1)));
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
    if (!visible) return undefined;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) dismissPanel();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  });

  /** 收起面板；纯日期已在点选时保存，带时间的暂存值需显式确认。 */
  function dismissPanel() {
    setVisible(false);
  }

  function changeOpen(next: boolean, endpoint?: 0 | 1) {
    if (next && !visible) {
      setConfirmedIndex(null);
      setPresetSelected(false);
      setDraftValue(currentValue);
      setTimes([timePart(currentValue[0], defaultTime), timePart(currentValue[1], defaultEndTime)]);
      setActiveIndex(endpointDisabled[0] ? 1 : endpointDisabled[1] ? 0 : endpoint ?? (currentValue[0] && !currentValue[1] ? 1 : 0));
      const nextStartMonth = startOfMonth(parseDate(dayFromValue(currentValue[0] || currentValue[1])) ?? new Date());
      setViewMonth(nextStartMonth);
      setEndViewMonth(startOfMonth(parseDate(dayFromValue(currentValue[1])) ?? addMonths(nextStartMonth, 1)));
    }
    // 已展开时切换输入端点仅切换面板，保留尚未提交的日期、时间和月份。
    if (next && endpoint !== undefined && !endpointDisabled[endpoint]) setActiveIndex(endpoint);
    setVisible(next);
  }

  function isDisabled(day: string, index: 0 | 1 = activeIndex, dateTimeStep = false) {
    if (endpointDisabled[index]) return true;
    const minimum = minDate ?? props.min;
    const maximum = maxDate ?? props.max;
    if (minimum && day < String(minimum).slice(0, 10)) return true;
    if (maximum && day > String(maximum).slice(0, 10)) return true;
    const from = index === 1 ? rangeDates[0] : undefined;
    if (dateTimeStep) {
      // 只有另一端已确认或锁定时才约束当前日期，避免旧值阻止从任一端重新选择。
      const otherIndex = index === 0 ? 1 : 0;
      const otherEndpoint = rangeDates[otherIndex];
      if (otherEndpoint && (endpointDisabled[otherIndex] || confirmedIndex === otherIndex)) {
        if (index === 0 && day > otherEndpoint || index === 1 && day < otherEndpoint) return true;
        if (maxRangeDays && Math.abs(daysBetween(otherEndpoint, day)) >= maxRangeDays) return true;
      }
    } else if (from && maxRangeDays && Math.abs(daysBetween(from, day)) >= maxRangeDays) return true;
    return disabledDate?.(day, { from, type: "date" }) ?? false;
  }

  function buildRangeValue(day: string, index: 0 | 1) {
    return showTime ? withTime(day, times[index], showSecond) : day;
  }

  function updateDraft(next: readonly [string, string]) {
    setPresetSelected(false);
    setDraftValue(next);
    onCalendarChange?.(next);
    // 纯日期点击即保存合法值；允许为空的端点可留空，必填范围必须先选齐。
    if (!showTime && isValidRange(next) && (next[0] !== currentValue[0] || next[1] !== currentValue[1])) {
      setCurrentValue(next);
    }
  }

  function selectDate(day: string) {
    if (isDisabled(day)) return;
    if (endpointDisabled.some(Boolean)) {
      const index = endpointDisabled[0] ? 1 : 0;
      const next: [string, string] = [...draftValue];
      next[index] = buildRangeValue(day, index);
      updateDraft(next);
      if (!resolvedNeedConfirm && isValidRange(next)) {
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
      changeOpen(false);
    }
  }

  // 日历点选结束日期时取当天末尾；开始日期保留原时间，“此刻”显式传入即时值优先。
  function selectDateTime(day: string, index: 0 | 1, time = index === 1 ? "23:59:59" : times[index]) {
    if (isDisabled(day, index, true)) return;
    // 同步时间列与草稿，提交时由 showSecond 决定保留到分钟还是秒。
    const nextTimes: [string, string] = [...times];
    nextTimes[index] = time;
    setTimes(nextTimes);
    const nextValue: [string, string] = [...draftValue];
    nextValue[index] = withTime(day, time, showSecond);
    updateDraft(nextValue);
    setHoverDate("");
    // 点选日期只更新当前步骤，必须由底部按钮切换步骤或提交。
    setActiveIndex(index);
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

  const otherIndex: 0 | 1 = activeIndex === 0 ? 1 : 0;
  const needsOtherConfirmation = Boolean(showTime && !presetSelected && !endpointDisabled[otherIndex] && confirmedIndex !== otherIndex);

  function confirm() {
    if (needsOtherConfirmation) {
      if (!draftValue[activeIndex] && !allowEmpty[activeIndex]) return;
      setConfirmedIndex(activeIndex);
      setActiveIndex(otherIndex);
      // 另一端从刚确认的月份继续选择，两个进入方向均适用于同月范围。
      const month = startOfMonth(parseDate(dayFromValue(draftValue[activeIndex])) ?? new Date());
      if (otherIndex === 0) setViewMonth(month);
      else setEndViewMonth(month);
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
    setConfirmedIndex(null);
    setPresetSelected(true);
    setTimes([timePart(next[0], defaultTime), timePart(next[1], defaultEndTime)]);
    const nextStartMonth = startOfMonth(parseDate(dayFromValue(next[0] || next[1])) ?? new Date());
    setViewMonth(nextStartMonth);
    setEndViewMonth(startOfMonth(parseDate(dayFromValue(next[1])) ?? addMonths(nextStartMonth, 1)));
    if (!showTime && !resolvedNeedConfirm) {
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
        disabledTime={endpointDisabled[index] ? () => true : undefined}
        onChange={(nextTime) => changeTime(index, nextTime)}
      />
    </div>;
  }

  // 允许部分范围时回显草稿，避免把输入框显示与最终提交绑定；必填范围保持原子的确认更新。
  const displayValue = visible && allowEmpty.some(Boolean) ? draftValue : currentValue;
  const startFloating = useFloatingPlaceholder({ mode: placeholderMode, placeholder: placeholder[0], filled: Boolean(displayValue[0]), active: visible });
  const endFloating = useFloatingPlaceholder({ mode: placeholderMode, placeholder: placeholder[1], filled: Boolean(displayValue[1]), active: visible });
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
      onClick={(event) => {
        // 浮动标签和日期文字都归属各自输入区域，点击结束区域直接编辑结束值。
        const field = (event.target as HTMLElement).closest<HTMLElement>("[data-range-endpoint]");
        const endpoint = field?.dataset.rangeEndpoint;
        if (showTime && (endpoint === "0" || endpoint === "1")) {
          const index = Number(endpoint) as 0 | 1;
          if (!endpointDisabled[index]) changeOpen(true, index);
        } else if (visible) dismissPanel();
        else changeOpen(true);
      }}
    >
      <span data-range-endpoint="0" className={`sia-picker-range-control__field${startFloating.className}${visible && activeIndex === 0 ? " is-active" : ""}`}>
      <span className={`sia-picker-range-control__value${displayValue[0] ? "" : " is-placeholder"}`}>{displayValue[0] ? formatValue(displayValue[0]) : placeholder[0]}</span>
        {startFloating.label}
      </span>
      <span className="sia-picker-range-control__separator">{separator}</span>
      <span data-range-endpoint="1" className={`sia-picker-range-control__field${endFloating.className}${visible && activeIndex === 1 ? " is-active" : ""}`}>
      <span className={`sia-picker-range-control__value${displayValue[1] ? "" : " is-placeholder"}`}>{displayValue[1] ? formatValue(displayValue[1]) : placeholder[1]}</span>
        {endFloating.label}
      </span>
      <span ref={indicatorRef} className="sia-picker-range-control__indicator" aria-hidden="true" />

      <span className="sia-picker__icon" aria-hidden="true">{suffixIcon ?? <Icon name="calendar" size={16} />}</span>
    </button>
    {allowClear && (displayValue[0] || displayValue[1]) && !disabled ? <button type="button" className="sia-picker__clear" aria-label="清除日期范围" onClick={clearValue}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
    <PopupPortal ref={popupRef} anchorRef={rootRef} open={visible} className={`sia-date-panel sia-date-panel--range${showTime ? " sia-date-panel--with-time sia-date-panel--range-time-compact" : ""}${presets?.length ? " sia-date-panel--with-presets" : ""}`} role="dialog" aria-label="日期范围选择面板">
      <div className="sia-date-panel__body">
        {/* 快捷范围复用框架日期面板侧栏，在日历左侧按配置顺序纵向排列。 */}
        {presets?.length ? <aside className="sia-date-panel__presets" aria-label="快捷日期范围">
          {presets.map((preset, index) => <button type="button" key={index} onClick={() => applyPreset(preset)}>{preset.label}</button>)}
        </aside> : null}
        {showTime ? <div className="sia-date-panel__range-date-time">
          {renderDateTimeGroup(activeIndex)}
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
        needConfirm={Boolean(showTime) || resolvedNeedConfirm || allowEmpty.some(Boolean)}
        disabledConfirm={needsOtherConfirmation ? !draftValue[activeIndex] && !allowEmpty[activeIndex] : !isValidRange(draftValue)}
        extra={<>
          {renderExtraFooter?.()}
          {invalidDateTimeRange ? <small className="sia-date-panel__range-error">结束时间不能早于开始时间</small> : maxRangeDays ? <small>最多选择 {maxRangeDays} 天</small> : null}
        </>}
        onToday={() => {
          // 范围快捷选择仅更新活动端点，保留另一端和现有分步确认规则。
          const now = new Date();
          const day = dateKey(now);
          if (isDisabled(day, activeIndex, Boolean(showTime))) return;
          if (showTime) {
            const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map(pad).join(":");
            (activeIndex === 0 ? setViewMonth : setEndViewMonth)(startOfMonth(now));
            selectDateTime(day, activeIndex, time);
          } else {
            setViewMonth(startOfMonth(now));
            selectDate(day);
          }
        }}
        onConfirm={confirm}
      />
    </PopupPortal>
  </span>;
}

export namespace DatePicker {
  /** 日期区间选择器；带时间时可从任一端开始，点击确定切换到另一端，两端确认后提交；锁定端点无需再次确认，快捷范围只需一次确认。纯日期支持在任一日历连续点选起止日期。 */
  export const RangePicker = DateRangePicker;
}

export type { DatePickerShowTime };

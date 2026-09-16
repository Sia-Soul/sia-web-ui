import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { FloatingScrollbarProvider } from "./FloatingScrollbarProvider";

/** 日期选择附带的时间选择配置。 */
export type DatePickerShowTime = boolean | {
  /** 是否显示秒选择。 */
  showSecond?: boolean;
  /** 非受控模式的初始值，仅在初始化时使用。 */
  defaultValue?: string | readonly [string, string];
};

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDate(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

export function addDays(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + amount);
}

export function daysBetween(left: string, right: string) {
  const leftDate = parseDate(left);
  const rightDate = parseDate(right);
  if (!leftDate || !rightDate) return 0;
  return Math.round((rightDate.getTime() - leftDate.getTime()) / 86_400_000);
}

export function timePart(value?: string, fallback = "00:00:00") {
  const match = value?.match(/[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  return match ? `${match[1]}:${match[2]}:${match[3] ?? "00"}` : fallback;
}

export function withTime(date: string, time: string, showSecond = false) {
  if (!date) return "";
  const [hour = "00", minute = "00", second = "00"] = time.split(":");
  return `${date} ${hour}:${minute}${showSecond ? `:${second}` : ""}`;
}

export function normalizeDateValue(value: string, showTime: DatePickerShowTime, index: 0 | 1 = 0) {
  if (!value) return "";
  const date = parseDate(value);
  if (!date) return value;
  const day = dateKey(date);
  if (!showTime) return day;
  const config = typeof showTime === "object" ? showTime : {};
  const fallback = typeof config.defaultValue === "string" ? config.defaultValue : config.defaultValue?.[index] ?? "00:00:00";
  return withTime(day, timePart(value, fallback), Boolean(config.showSecond));
}

type CalendarMonthProps = {
  month: Date;
  selectedDates?: readonly string[];
  range?: readonly [string, string];
  previewEnd?: string;
  disabledDate?: (date: string) => boolean;
  onSelect: (date: string) => void;
  onHover?: (date: string) => void;
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function CalendarMonth({
  month,
  selectedDates = [],
  range = ["", ""],
  previewEnd,
  disabledDate,
  onSelect,
  onHover,
}: CalendarMonthProps) {
  const first = startOfMonth(month);
  const mondayIndex = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -mondayIndex);
  const today = dateKey(new Date());
  const start = range[0];
  const end = range[1] || previewEnd || "";
  const low = start && end ? (start <= end ? start : end) : "";
  const high = start && end ? (start <= end ? end : start) : "";
  return <div className="sia-date-panel__month">
    <div className="sia-date-panel__weekdays" aria-hidden="true">
      {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
    </div>
    <div className="sia-date-panel__days">
      {Array.from({ length: 42 }, (_, index) => {
        const date = addDays(gridStart, index);
        const key = dateKey(date);
        const outside = date.getMonth() !== month.getMonth();
        const disabled = disabledDate?.(key) ?? false;
        const selected = selectedDates.includes(key);
        const rangeStart = Boolean(start && key === start);
        const rangeEnd = Boolean(range[1] && key === range[1]);
        const inRange = Boolean(low && high && key >= low && key <= high);
        return <span
          className={`sia-date-panel__cell${outside ? " is-outside" : ""}${selected ? " is-selected" : ""}${rangeStart ? " is-range-start" : ""}${rangeEnd ? " is-range-end" : ""}${inRange ? " is-in-range" : ""}${key === today ? " is-today" : ""}`}
          key={key}
        >
          <button
            type="button"
            aria-label={key}
            aria-pressed={selected || rangeStart || rangeEnd || undefined}
            disabled={disabled}
            onClick={() => onSelect(key)}
            onMouseEnter={() => onHover?.(key)}
          >
            {date.getDate()}
          </button>
        </span>;
      })}
    </div>
  </div>;
}

export function CalendarHeader({
  month,
  label,
  range = false,
  onPreviousYear,
  onPreviousMonth,
  onNextMonth,
  onNextYear,
}: {
  month: Date;
  label?: ReactNode;
  range?: boolean;
  onPreviousYear?: () => void;
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
  onNextYear?: () => void;
}) {
  return <div className="sia-date-panel__header">
    <span className="sia-date-panel__nav">
      {onPreviousYear ? <button type="button" aria-label="上一年" onClick={onPreviousYear}><Icon name="chevron-left" size={13} /><Icon name="chevron-left" size={13} /></button> : null}
      {onPreviousMonth ? <button type="button" aria-label="上个月" onClick={onPreviousMonth}><Icon name="chevron-left" size={15} /></button> : null}
    </span>
    <strong>
      {label ? <small>{label}</small> : null}
      <span>{month.getFullYear()}年&nbsp; {month.getMonth() + 1}月</span>
    </strong>
    <span className="sia-date-panel__nav">
      {onNextMonth ? <button type="button" aria-label="下个月" onClick={onNextMonth}><Icon name="chevron-right" size={15} /></button> : null}
      {onNextYear ? <button type="button" aria-label="下一年" onClick={onNextYear}><Icon name="chevron-right" size={13} /><Icon name="chevron-right" size={13} /></button> : null}
    </span>
    {range ? null : null}
  </div>;
}

export function TimePanel({
  value,
  showSecond = false,
  ariaLabel = "时间",
  disabledTime,
  use12Hours = false,
  onChange,
}: {
  value: string;
  showSecond?: boolean;
  ariaLabel?: string;
  disabledTime?: (value: string) => boolean;
  use12Hours?: boolean;
  onChange: (value: string) => void;
}) {
  const [hour = "00", minute = "00", second = "00"] = value.split(":");
  const columnsRef = useRef<HTMLDivElement>(null);
  // 每一列独立接管滚动，不增加包裹层，保留选中时间的定位和键盘导航。
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);
  const secondRef = useRef<HTMLDivElement>(null);
  const columnRefs = [hourRef, minuteRef, secondRef];
  useLayoutEffect(() => {
    for (const column of columnsRef.current?.children ?? []) {
      const selected = column.querySelector<HTMLElement>('[aria-selected="true"]');
      const first = column.firstElementChild as HTMLElement | null;
      if (!selected || !first) continue;
      const top = selected.offsetTop - first.offsetTop + parseFloat(getComputedStyle(column).paddingTop || "0");
      const bottom = top + selected.offsetHeight;
      // 只滚动当前时间列，避免 scrollIntoView 连带移动弹层或页面。
      if (top < column.scrollTop || bottom > column.scrollTop + column.clientHeight) {
        column.scrollTop = Math.max(0, top - (column.clientHeight - selected.offsetHeight) / 2);
      }
    }
  }, [hour, minute, second, showSecond, ariaLabel]);
  const columns: Array<{ label: string; value: string; count: number; index: 0 | 1 | 2 }> = [
    { label: "小时", value: hour, count: 24, index: 0 },
    { label: "分钟", value: minute, count: 60, index: 1 },
    ...(showSecond ? [{ label: "秒", value: second, count: 60, index: 2 as const }] : []),
  ];
  function update(index: 0 | 1 | 2, next: string) {
    const values = [hour, minute, second];
    values[index] = next;
    onChange(values.join(":"));
  }
  return <aside className="sia-date-panel__time" aria-label={ariaLabel}>
    <strong>{use12Hours ? pad(Number(hour) % 12 || 12) : hour}:{minute}{showSecond ? `:${second}` : ""}{use12Hours ? (Number(hour) < 12 ? " AM" : " PM") : ""}</strong>
    <div ref={columnsRef} className="sia-date-panel__time-columns">
      {columns.map((column) => <div ref={columnRefs[column.index]} role="listbox" aria-label={`${ariaLabel}${column.label}`} key={column.label}>
        {Array.from({ length: column.count }, (_, index) => {
          const next = pad(index);
          const candidate = [hour, minute, second];
          candidate[column.index] = next;
          return <button type="button" role="option" disabled={disabledTime?.(candidate.join(":"))} aria-selected={next === column.value} className={next === column.value ? "is-selected" : ""} key={next} onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const buttons = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
            const position = buttons.indexOf(event.currentTarget);
            const target = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, position + (event.key === "ArrowDown" ? 1 : -1)));
            buttons[target]?.focus();
          }} onClick={() => update(column.index, next)}>{use12Hours && column.index === 0 ? `${pad(index % 12 || 12)} ${index < 12 ? "AM" : "PM"}` : next}</button>;
        })}
      </div>)}
    </div>
    {columns.map(column => <FloatingScrollbarProvider key={column.index} targetRef={columnRefs[column.index]} />)}
  </aside>;
}

export function DatePanelFooter({
  showToday = true,
  needConfirm = false,
  disabledConfirm = false,
  confirmText = "确定",
  extra,
  onToday,
  onConfirm,
}: {
  showToday?: boolean;
  needConfirm?: boolean;
  disabledConfirm?: boolean;
  confirmText?: ReactNode;
  extra?: ReactNode;
  onToday?: () => void;
  onConfirm?: () => void;
}) {
  return <footer className="sia-date-panel__footer">
    <span>{showToday ? <button type="button" onClick={onToday}>今天</button> : null}{extra}</span>
    {needConfirm ? <button type="button" className="sia-date-panel__confirm" disabled={disabledConfirm} onClick={onConfirm}>{confirmText}</button> : null}
  </footer>;
}

import { useControlSize } from "./shared";
import { useFloatingPlaceholder } from "./FloatingPlaceholder";
import type { InputPlaceholderMode } from "./shared";
import { useEffect, useId, useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { PopupPortal } from "./PopupPortal";
import { TimePanel } from "./DatePickerPanel";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";

export interface TimePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "value" | "defaultValue" | "onChange"> {
  placeholderMode?: InputPlaceholderMode;
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

function seconds(value: string) {
  const [h = 0, m = 0, s = 0] = value.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

export function TimePicker({
  value, defaultValue = "", size: sizeProp, status = "default", allowClear = true,
  use12Hours = false, showSecond = false, suffixIcon, disabledTime, disabled, readOnly,
  className = "", style, onChange, onOpenChange, placeholder = "请选择时间", placeholderMode, min, max, step,
  ...props
}: TimePickerProps) {
  const size = useControlSize(sizeProp);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const focusPanel = useRef(false);
  const [currentValue, setValue] = useControllableState({ value, defaultValue, onChange });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("00:00:00");
  const normalize = (time: string) => showSecond ? (time + ":00").slice(0, 8) : time.slice(0, 5);
  const unavailable = (time: string) => {
    const normalized = normalize(time);
    const count = seconds(normalized);
    const lower = min === undefined ? undefined : seconds(String(min));
    const upper = max === undefined ? undefined : seconds(String(max));
    const outside = lower !== undefined && upper !== undefined && lower > upper
      ? count < lower && count > upper
      : (lower !== undefined && count < lower) || (upper !== undefined && count > upper);
    const interval = step === undefined || step === "any" ? 0 : Number(step);
    return Boolean(outside || (interval > 0 && (count - (lower ?? 0)) % interval !== 0) || disabledTime?.(normalized));
  };
  function changeOpen(next: boolean) {
    if (next && (disabled || readOnly)) return;
    if (next === open) return;
    if (next) setDraft(currentValue ? (currentValue + ":00").slice(0, 8) : min ? (String(min) + ":00").slice(0, 8) : "00:00:00");
    setOpen(next);
    onOpenChange?.(next);
  }
  useEffect(() => {
    if (!open) return;
    if (focusPanel.current) {
      popupRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
      focusPanel.current = false;
    }
    const close = (event: Event) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) changeOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("focusin", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("focusin", close);
    };
  });
  const display = !currentValue ? "" : use12Hours
    ? String(Number(currentValue.slice(0, 2)) % 12 || 12).padStart(2, "0") + normalize(currentValue).slice(2) + (Number(currentValue.slice(0, 2)) < 12 ? " AM" : " PM")
    : normalize(currentValue);
  function confirm() {
    if (unavailable(draft)) return;
    setValue(normalize(draft));
    changeOpen(false);
    inputRef.current?.focus();
  }
  const floating = useFloatingPlaceholder({ mode: placeholderMode, placeholder, filled: Boolean(display), active: open });
  return <span ref={rootRef} style={style} className={`sia-picker sia-time-picker${floating.className} sia-picker--${size} sia-picker--${status}${disabled ? " is-disabled" : ""} ${className}`.trim()}>
    <input {...props} ref={inputRef} id={props.id ?? id} type="text" readOnly value={display} disabled={disabled}
      placeholder={placeholder} role="combobox" aria-expanded={open && !disabled && !readOnly} aria-haspopup="dialog" aria-controls={open ? id + "-panel" : undefined}
      aria-label={props["aria-label"] ?? "时间"} aria-invalid={status === "error" || undefined}
      onClick={(event) => { props.onClick?.(event); if (!event.defaultPrevented) changeOpen(true); }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (["Enter", " ", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          if (open) popupRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
          else { focusPanel.current = true; changeOpen(true); }
        }
        if (event.key === "Escape") changeOpen(false);
      }} />
    {floating.label}
    {allowClear && currentValue && !disabled && !readOnly ? <button type="button" className="sia-picker__clear" aria-label="清除时间" onMouseDown={(event) => event.preventDefault()} onClick={() => { setValue(""); changeOpen(false); }}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
    <span className="sia-picker__icon" aria-hidden="true">{suffixIcon ?? <Icon name="clock" size={16} />}</span>
    <PopupPortal ref={popupRef} anchorRef={rootRef} open={open && !disabled && !readOnly} id={id + "-panel"} role="dialog" aria-label="选择时间"
      className={`sia-time-panel${use12Hours ? " sia-time-panel--12h" : ""}`}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); changeOpen(false); inputRef.current?.focus(); } }}>
      <TimePanel value={draft} showSecond={showSecond} use12Hours={use12Hours} onChange={setDraft} />
      {unavailable(draft) ? <div className="sia-time-panel__error" role="status">该时间不可选</div> : null}
      <footer className="sia-time-panel__footer">
        <Button variant="text" size="small" onClick={() => { const now = new Date(); setDraft([now.getHours(), now.getMinutes(), showSecond ? now.getSeconds() : 0].map(part => String(part).padStart(2, "0")).join(":")); }}>此刻</Button>
        <Button variant="primary" size="small" disabled={unavailable(draft)} onClick={confirm}>确定</Button>
      </footer>
    </PopupPortal>
  </span>;
}

function TimeRangePicker({ value, defaultValue = ["", ""], placeholder = ["开始时间", "结束时间"], separator = "→", onChange, className = "", style, ...props }: TimeRangePickerProps) {
  const size = useControlSize(props.size);
  const [currentValue, setValue] = useControllableState<readonly [string, string]>({ value: value === undefined ? undefined : Array.isArray(value) ? value : ["", ""], defaultValue, onChange });
  function update(index: 0 | 1, next: string) {
    const pair: [string, string] = [currentValue[0], currentValue[1]];
    pair[index] = next;
    setValue(pair);
  }
  return <span style={style} className={`sia-time-range sia-picker--${size} sia-picker--${props.status ?? "default"}${props.disabled ? " is-disabled" : ""} ${className}`.trim()}>
    <TimePicker {...props} aria-label={props["aria-label"] ? props["aria-label"] + "开始时间" : "开始时间"} value={currentValue[0]} placeholder={placeholder[0]} max={currentValue[1] && (!props.max || seconds(currentValue[1]) < seconds(String(props.max))) ? currentValue[1] : props.max} onChange={(next) => update(0, next)} />
    <span className="sia-time-range__separator">{separator}</span>
    <TimePicker {...props} id={props.id ? props.id + "-end" : undefined} aria-label={props["aria-label"] ? props["aria-label"] + "结束时间" : "结束时间"} value={currentValue[1]} placeholder={placeholder[1]} min={currentValue[0] && (!props.min || seconds(currentValue[0]) > seconds(String(props.min))) ? currentValue[0] : props.min} onChange={(next) => update(1, next)} />
  </span>;
}

export namespace TimePicker {
  export const RangePicker = TimeRangePicker;
}

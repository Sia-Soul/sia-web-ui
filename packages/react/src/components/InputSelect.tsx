import type { InputPlaceholderMode } from "./shared";
import { forwardRef, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { PopupPortal } from "./PopupPortal";
import { SelectionPanel } from "./SelectionPanel";
import type { SelectionOption, SelectionValue } from "./SelectionPanel";
import type { ControlSize, ControlStatus } from "./shared";

export interface InputSelectProps {
  options: readonly SelectionOption[];
  value?: SelectionValue | readonly SelectionValue[] | null;
  defaultValue?: SelectionValue | readonly SelectionValue[];
  onChange?: (value: SelectionValue | SelectionValue[] | undefined) => void;
  multiple?: boolean;
  displayField?: "label" | "value";
  showValue?: boolean;
  placeholder?: string;
  placeholderMode?: InputPlaceholderMode;
  size?: ControlSize;
  status?: ControlStatus;
  disabled?: boolean;
  loading?: boolean;
  allowClear?: boolean;
  hideSearch?: boolean;
  inputMaxLength?: number;
  parseInput?: (text: string) => SelectionValue | SelectionValue[] | undefined;
  enableModal?: boolean | { title?: string; width?: number | string; columns?: number; maxHeight?: number };
  suffix?: ReactNode;
  style?: CSSProperties;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-required"?: boolean | "true" | "false";
  onOpenChange?: (open: boolean) => void;
}

export const InputSelect = forwardRef<HTMLInputElement, InputSelectProps>(function InputSelect({ options, value, defaultValue, onChange,
  multiple = false, displayField = "label", showValue = false, placeholder = "请选择", placeholderMode, size = "medium", status,
  disabled = false, loading = false, allowClear = true, hideSearch, inputMaxLength, parseInput,
  enableModal, suffix, style, className = "", onOpenChange, ...inputProps }, forwardedRef) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value !== undefined ? value : internal;
  const values = current == null ? [] : Array.isArray(current) ? current : [current];
  const text = values.map(item => displayField === "label" ? String(options.find(option => option.optionType !== "divider" && option.value === item)?.label ?? item) : String(item)).join(",");
  const [draft, setDraft] = useState(text);
  useEffect(() => { setDraft(text); }, [text, current]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalValues, setModalValues] = useState<SelectionValue[]>([]);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const config = typeof enableModal === "object" ? enableModal : {};
  function changeOpen(next: boolean) {
    if (next && (disabled || loading)) return;
    setOpen(next);
    if (next !== open) onOpenChange?.(next);
    if (!next) setSearch("");
  }
  function emit(next: SelectionValue | SelectionValue[] | undefined) {
    if (disabled || loading) return;
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }
  function select(next: SelectionValue[]) {
    emit(multiple ? next : next[0]);
    if (!multiple) { changeOpen(false); inputRef.current?.focus(); }
  }
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) changeOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onOpenChange]);
  useEffect(() => { if (disabled || loading) { changeOpen(false); setModalOpen(false); } }, [disabled, loading]);
  function openModal() {
    if (disabled || loading) return;
    changeOpen(false); setModalValues([...values]); setSelectedOnly(false); setModalOpen(true);
  }
  return <div ref={rootRef} style={style} className={`sia-input-select${open || modalOpen ? " is-open" : ""} ${className}`} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.stopPropagation(); changeOpen(false); inputRef.current?.focus(); }
  }}>
    <Input {...inputProps} ref={node => { inputRef.current = node; if (typeof forwardedRef === "function") forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }}
      role="combobox" aria-label={inputProps["aria-label"] ?? placeholder} aria-expanded={open} aria-haspopup="listbox"
      size={size} status={status} disabled={disabled} readOnly={displayField === "label" || loading} placeholder={placeholder} placeholderMode={placeholderMode}
      value={draft} maxLength={inputMaxLength && inputMaxLength > 0 ? inputMaxLength : undefined} showCount={!!inputMaxLength && inputMaxLength > 0}
      onClick={() => changeOpen(!open)} autoComplete="off"
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "Enter" && displayField === "label") {
          event.preventDefault();
          if (open) popupRef.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus(); else changeOpen(true);
        }
      }}
      onChange={event => {
        const next = event.target.value; setDraft(next);
        emit(parseInput ? parseInput(next) : multiple ? next.split(",").map(item => item.trim()).filter(Boolean) : next);
        changeOpen(true);
      }}
      suffix={<span className="sia-input-select__suffix">
        {allowClear && draft && !disabled && <Button variant="text" size="small" disabled={loading} aria-label="清除输入选择" onClick={event => {
          event.stopPropagation(); setDraft(""); emit(multiple ? [] : undefined); inputRef.current?.focus();
        }}>×</Button>}
        {suffix}
        {enableModal && <Button variant="text" size="small" disabled={disabled || loading} aria-label="打开选择弹窗" onClick={event => { event.stopPropagation(); openModal(); }}>…</Button>}
        <Button variant="text" size="small" disabled={disabled || loading} aria-label="展开选项" onClick={event => { event.stopPropagation(); changeOpen(!open); }}>
          <Icon name={loading ? "refresh" : open ? "chevron-up" : "chevron-down"} size={13} />
        </Button>
      </span>} />
    <PopupPortal ref={popupRef} anchorRef={rootRef} open={open && !disabled && !loading} className="sia-input-select__popup">
      <SelectionPanel options={options} value={values} multiple={multiple} onChange={select} showValue={showValue} displayField={displayField}
        showSearch={!(hideSearch ?? (!multiple && displayField === "value"))} autoFocusSearch={displayField === "label"}
        searchValue={search || (!multiple && displayField === "value" ? draft : "")} onSearch={setSearch} />
    </PopupPortal>
    {enableModal && <Modal open={modalOpen} title={config.title ?? "选择"} width={config.width ?? 900}
      onCancel={() => setModalOpen(false)} onOpenChange={setModalOpen} onOk={() => { emit(multiple ? modalValues : modalValues[0]); setModalOpen(false); }}>
      <div className="sia-selection-panel__actions" role="tablist" aria-label="选项范围">
        <Button role="tab" aria-selected={!selectedOnly} variant={!selectedOnly ? "primary" : "text"} onClick={() => setSelectedOnly(false)}>全部</Button>
        <Button role="tab" aria-selected={selectedOnly} variant={selectedOnly ? "primary" : "text"} onClick={() => setSelectedOnly(true)}>已选项({modalValues.length})</Button>
      </div>
      {modalOpen && <SelectionPanel options={options} value={modalValues} multiple={multiple} onChange={setModalValues}
        selectedOnly={selectedOnly} columns={config.columns ?? 3} maxHeight={config.maxHeight ?? 450} showValue={showValue} displayField={displayField} />}
    </Modal>}
  </div>;
});

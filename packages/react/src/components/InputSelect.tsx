import { useControlSize } from "./shared";
import type { InputPlaceholderMode } from "./shared";
import { forwardRef, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { PopupPortal } from "./PopupPortal";
import { SelectionPanel } from "./SelectionPanel";
import { normalizeSelectionValues } from "./selectionValues";
import type { SelectionOption, SelectionValue } from "./SelectionPanel";
import type { ControlSize, ControlStatus } from "./shared";

/** 输入选择组合控件的属性配置。 */
export interface InputSelectProps {
  /** 可供用户选择的候选项列表。 */
  options: readonly SelectionOption[];
  /** 当前值；受控时需在 onChange 中同步更新。null 表示未选择；未匹配 options 的空字符串或纯空格不计入选择，数字 0 和显式空值选项仍有效。 */
  value?: SelectionValue | readonly SelectionValue[] | null;
  /** 非受控模式的初始值，仅在初始化时使用；未匹配 options 的空字符串或纯空格按未选择处理，保留数字 0 和显式空值选项。 */
  defaultValue?: SelectionValue | readonly SelectionValue[];
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (value: SelectionValue | SelectionValue[] | undefined) => void;
  /**
   是否允许同时选择多个项目。
   * @defaultValue false
   */
  multiple?: boolean;
  /**
   * 选项主文本显示 label 还是 value。
   * @defaultValue "label"
   */
  displayField?: "label" | "value";
  /**
   * 在选项名称下方显示 value，下拉与弹框模式均支持；不影响按 value 搜索
   * @defaultValue false
   */
  showValue?: boolean;
  /**
   * 未填写或未选择时的提示内容。
   * @defaultValue "请选择"
   */
  placeholder?: string;
  /** 占位提示的显示模式；floating 为浮动标签。 */
  placeholderMode?: InputPlaceholderMode;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /** 当前状态，用于选择对应的状态样式。 */
  status?: ControlStatus;
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /**
   * 是否处于加载状态。
   * @defaultValue false
   */
  loading?: boolean;
  /**
   * 是否允许清空当前选择或输入值；组件或所属 Form / fieldset 禁用时隐藏清空按钮。
   * @defaultValue true
   */
  allowClear?: boolean;
  /** 是否隐藏搜索输入框。 */
  hideSearch?: boolean;
  /** 手动输入内容的最大长度 */
  inputMaxLength?: number;
  /** 将输入文本解析为选项值的函数。 */
  parseInput?: (text: string) => SelectionValue | SelectionValue[] | undefined;
  /** 是否显示通过弹框选择的入口。 */
  enableModal?: boolean | {
  /** 标题内容，可传入文本或 React 节点。 */
  title?: string;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?: number | string;
  /** 列配置或选项布局列数，具体类型见签名。 */
  columns?: number;
  /** 允许的最大高度。 */
  maxHeight?: number };
  /** 输入框后缀 */
  suffix?: ReactNode;
  /** 组件根节点的内联样式。 */
  style?: CSSProperties;
  /**
   * 附加到组件根节点的 CSS 类名。
   * @defaultValue ""
   */
  className?: string;
  /** 唯一标识，用于关联实例或插件。 */
  id?: string;
  /** 辅助技术读取的控件名称。 */
  "aria-label"?: string;
  /** 向辅助技术声明该控件是否必填。 */
  "aria-required"?: boolean | "true" | "false";
  /** 打开状态改变时触发，参数为新的打开状态。 */
  onOpenChange?: (open: boolean) => void;
}

/** 输入选择组合控件；下拉面板背景与文字跟随当前主题，支持直接输入及从候选项选择。 */
export const InputSelect = forwardRef<HTMLInputElement, InputSelectProps>(function InputSelect({ options, value, defaultValue, onChange,
  multiple = false, displayField = "label", showValue = false, placeholder = "请选择", placeholderMode, size: sizeProp, status,
  disabled = false, loading = false, allowClear = true, hideSearch, inputMaxLength, parseInput,
  enableModal, suffix, style, className = "", onOpenChange, ...inputProps }, forwardedRef) {
  const size = useControlSize(sizeProp);
  const [internal, setInternal] = useState(defaultValue);
  const current = value !== undefined ? value : internal;
  // 输入回显、下拉列表和弹窗计数共用空值规则，避免空白自定义项占据选中位置。
  const values = normalizeSelectionValues(current == null ? [] : Array.isArray(current) ? current : [current], options);
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
        {allowClear && draft && !disabled && <Button className="sia-input-select__clear" variant="text" size="small" disabled={loading} aria-label="清除输入选择" onClick={event => {
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

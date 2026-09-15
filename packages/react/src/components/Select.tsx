import { useControlSize } from "./shared";
import { useFloatingPlaceholder } from "./FloatingPlaceholder";
import type { InputPlaceholderMode } from "./shared";
import { forwardRef, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, UIEvent } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";
import { Checkbox } from "./Checkbox";
import { SelectionPanel } from "./SelectionPanel";
import { OverflowTags } from "./OverflowTags";
import { Icon } from "./Icon";
import { PopupPortal } from "./PopupPortal";
import { FloatingScrollbarProvider } from "./FloatingScrollbarProvider";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";

export type SelectValue = string | number;
export type SelectMode = "single" | "multiple";
export type SelectChangeValue = SelectValue | SelectValue[] | null;

export type SelectOption = {
  label: ReactNode;
  value: SelectValue;
  disabled?: boolean;
  /** 弹框模式中的分组标题。 */
  group?: string;
};

export interface SelectProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "defaultValue" | "onChange" | "value"> {
  options: readonly SelectOption[];
  mode?: SelectMode;
  popupMode?: "dropdown" | "modal";
  modalConfig?: { title?: ReactNode; width?: number | string; columns?: number; maxHeight?: number; footerExtra?: ReactNode };
  value?: SelectChangeValue;
  defaultValue?: SelectChangeValue;
  onChange?: (value: SelectChangeValue, option: SelectOption | SelectOption[] | null) => void;
  placeholder?: ReactNode;
  placeholderMode?: InputPlaceholderMode;
  size?: ControlSize;
  status?: ControlStatus;
  allowClear?: boolean;
  loading?: boolean;
  showSearch?: boolean;
  /** 在选项名称下方显示对应的 value。 */
  showValue?: boolean;
  /** 允许将搜索框内容作为自定义选项提交。 */
  allowInput?: boolean;
  inputMaxLength?: number;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  filterOption?: (query: string, option: SelectOption) => boolean;
  showSelectAll?: boolean;
  /** 是否显示下拉面板底部的条数统计与操作行；默认单选隐藏、多选显示，不影响弹框模式。 */
  showActions?: boolean;
  /** 最多显示的标签数；空间不足时会继续折叠，并为 +N 预留宽度。 */
  maxTagCount?: number;
  virtual?: boolean;
  virtualThreshold?: number;
  listHeight?: number;
  optionHeight?: number;
  notFoundContent?: ReactNode;
}

function defaultFilterOption(query: string, option: SelectOption) {
  const keyword = query.toLowerCase();
  return [option.label, option.value].some(value => String(value).toLowerCase().includes(keyword));
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    options,
    mode = "single",
    popupMode = "dropdown",
    modalConfig,
    value,
    defaultValue,
    onChange,
    placeholder = "请选择",
    placeholderMode,
    size: sizeProp,
    status = "default",
    allowClear = false,
    loading = false,
    showSearch = false,
    showValue = false,
    allowInput = false,
    inputMaxLength,
    searchPlaceholder = "搜索选项",
    onSearch,
    filterOption = defaultFilterOption,
    showSelectAll = true,
    showActions = mode === "multiple",
    maxTagCount = 2,
    virtual = true,
    virtualThreshold = 100,
    listHeight = 256,
    optionHeight = showValue ? 54 : 34,
    disabled,
    className = "",
    style,
    id,
    notFoundContent = "暂无数据",
    onKeyDown,
    ...props
  },
  forwardedRef,
) {
  const size = useControlSize(sizeProp);
  const fallbackId = useId();
  const selectId = id ?? fallbackId;
  const listboxId = `${selectId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [modalValues, setModalValues] = useState<SelectValue[]>([]);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const deferredQuery = useDeferredValue(query.trim());
  const initialValue = defaultValue === undefined ? (mode === "multiple" ? [] : null) : defaultValue;
  const [currentValue, setCurrentValue] = useControllableState<SelectChangeValue>({
    value,
    defaultValue: initialValue,
    onChange: (nextValue) => {
      if (Array.isArray(nextValue)) {
        const selectedOptions = nextValue.map((selectedValue) => (
          options.find((option) => option.value === selectedValue) ?? (allowInput ? { label: String(selectedValue), value: selectedValue } : undefined)
        )).filter((option): option is SelectOption => option !== undefined);
        onChange?.(nextValue, selectedOptions);
      } else {
        const selectedOption = nextValue === null ? null : options.find((option) => option.value === nextValue) ?? (allowInput ? { label: String(nextValue), value: nextValue } : null);
        onChange?.(nextValue, selectedOption);
      }
    },
  });

  const selectedValues = useMemo<SelectValue[]>(() => {
    if (mode === "multiple") return Array.isArray(currentValue) ? currentValue : currentValue === null ? [] : [currentValue];
    return Array.isArray(currentValue) ? currentValue.slice(0, 1) : currentValue === null ? [] : [currentValue];
  }, [currentValue, mode]);
  const selectedValueSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const availableOptions = useMemo(() => {
    if (!allowInput) return options;
    const optionValueSet = new Set(options.map((option) => option.value));
    const selectedCustomOptions: SelectOption[] = selectedValues
      .filter((selectedValue) => !optionValueSet.has(selectedValue))
      .map((selectedValue) => ({ label: String(selectedValue), value: selectedValue }));
    return selectedCustomOptions.length ? [...selectedCustomOptions, ...options] : options;
  }, [allowInput, options, selectedValues]);
  const selectedOptions = useMemo(() => selectedValues.map((selectedValue) => (
    availableOptions.find((option) => option.value === selectedValue)
  )).filter((option): option is SelectOption => option !== undefined), [availableOptions, selectedValues]);
  const filteredOptions = useMemo(() => deferredQuery ? availableOptions.filter((option) => filterOption(deferredQuery, option)) : availableOptions, [availableOptions, deferredQuery, filterOption]);
  const inputValue = query.trim();
  const exactInputOption = inputValue ? availableOptions.find((option) => String(option.value).toLowerCase() === inputValue.toLowerCase() || (typeof option.label === "string" && option.label.toLowerCase() === inputValue.toLowerCase())) : undefined;
  const canSubmitInput = allowInput && Boolean(inputValue) && !exactInputOption;
  const multiple = mode === "multiple";
  const hasValue = selectedOptions.length > 0;
  const virtualEnabled = virtual && filteredOptions.length >= virtualThreshold;
  const overscan = 3;
  const visibleCount = Math.ceil(listHeight / optionHeight) + overscan * 2;
  const virtualStart = virtualEnabled ? Math.max(0, Math.floor(scrollTop / optionHeight) - overscan) : 0;
  const virtualEnd = virtualEnabled ? Math.min(filteredOptions.length, virtualStart + visibleCount) : filteredOptions.length;
  const renderedOptions = virtualEnabled ? filteredOptions.slice(virtualStart, virtualEnd) : filteredOptions;
  const enabledFilteredOptions = filteredOptions.filter((option) => !option.disabled);
  const allFilteredSelected = enabledFilteredOptions.length > 0 && enabledFilteredOptions.every((option) => selectedValueSet.has(option.value));

  useEffect(() => {
    if (!open || popupMode === "modal") return undefined;
    function closeFromOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) closeDropdown();
    }
    document.addEventListener("mousedown", closeFromOutside);
    return () => document.removeEventListener("mousedown", closeFromOutside);
  }, [open, popupMode]);

  useEffect(() => {
    if (open && (showSearch || allowInput)) searchRef.current?.focus();
  }, [allowInput, open, showSearch]);

  useEffect(() => { if (disabled || loading) closeDropdown(); }, [disabled, loading]);

  function firstEnabledIndex() {
    return filteredOptions.findIndex((option) => !option.disabled);
  }

  function closeDropdown() {
    setOpen(false);
    setQuery("");
    setScrollTop(0);
  }

  function openDropdown() {
    if (disabled || loading) return;
    const selectedIndex = filteredOptions.findIndex((option) => selectedValueSet.has(option.value) && !option.disabled);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex());
    if (popupMode === "modal") { setModalValues([...selectedValues]); setSelectedOnly(false); }
    setOpen(true);
  }

  function keepActiveVisible(index: number) {
    if (!virtualEnabled || !listRef.current) return;
    const optionTop = index * optionHeight;
    const optionBottom = optionTop + optionHeight;
    const viewportTop = listRef.current.scrollTop;
    const viewportBottom = viewportTop + listHeight;
    const nextScrollTop = optionTop < viewportTop ? optionTop : optionBottom > viewportBottom ? optionBottom - listHeight : viewportTop;
    if (nextScrollTop !== viewportTop) {
      listRef.current.scrollTop = nextScrollTop;
      setScrollTop(nextScrollTop);
    }
  }

  function moveActive(direction: 1 | -1) {
    if (filteredOptions.length === 0) return;
    let nextIndex = activeIndex;
    for (let index = 0; index < filteredOptions.length; index += 1) {
      nextIndex = (nextIndex + direction + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[nextIndex]?.disabled) {
        setActiveIndex(nextIndex);
        keepActiveVisible(nextIndex);
        return;
      }
    }
  }

  function selectOption(option: SelectOption) {
    if (option.disabled) return;
    if (multiple) {
      const nextValues = selectedValueSet.has(option.value) ? selectedValues.filter((item) => item !== option.value) : [...selectedValues, option.value];
      setCurrentValue(nextValues);
      return;
    }
    setCurrentValue(option.value);
    closeDropdown();
  }

  function selectAllFiltered() {
    if (allFilteredSelected) return;
    const nextValues = [...selectedValues];
    const nextValueSet = new Set(nextValues);
    enabledFilteredOptions.forEach((option) => {
      if (!nextValueSet.has(option.value)) nextValues.push(option.value);
    });
    setCurrentValue(nextValues);
  }

  function submitInputValue() {
    if (!allowInput || !inputValue) return;
    selectOption(exactInputOption ?? { label: inputValue, value: inputValue });
    if (multiple) {
      setQuery("");
      setActiveIndex(-1);
      setScrollTop(0);
    }
  }

  function invertFiltered() {
    const enabled = new Set(enabledFilteredOptions.map(option => option.value));
    setCurrentValue([...selectedValues.filter(value => !enabled.has(value)), ...enabledFilteredOptions.filter(option => !selectedValueSet.has(option.value)).map(option => option.value)]);
  }

  function clearSelection() {
    setCurrentValue(multiple ? [] : null);
  }

  function handleInteractionKeyDown(event: KeyboardEvent<HTMLButtonElement | HTMLInputElement>, fromSearch = false) {
    if (popupMode === "modal" && open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openDropdown();
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" || (event.key === " " && !fromSearch)) {
      event.preventDefault();
      if (!open) openDropdown();
      else if (activeIndex >= 0 && filteredOptions[activeIndex]) selectOption(filteredOptions[activeIndex]);
      else if (fromSearch && allowInput) submitInputValue();
    } else if (event.key === "Escape") {
      closeDropdown();
    } else if (event.key === "Home" && open && !fromSearch) {
      event.preventDefault();
      const firstIndex = firstEnabledIndex();
      setActiveIndex(firstIndex);
      keepActiveVisible(firstIndex);
    } else if (event.key === "End" && open && !fromSearch) {
      event.preventDefault();
      const reversedIndex = [...filteredOptions].reverse().findIndex((option) => !option.disabled);
      const lastIndex = reversedIndex < 0 ? -1 : filteredOptions.length - 1 - reversedIndex;
      setActiveIndex(lastIndex);
      keepActiveVisible(lastIndex);
    }
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    handleInteractionKeyDown(event);
    onKeyDown?.(event);
  }

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setActiveIndex(-1);
    setScrollTop(0);
    if (listRef.current) listRef.current.scrollTop = 0;
    onSearch?.(nextQuery);
  }

  function clearValue(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    clearSelection();
  }

  function handleListScroll(event: UIEvent<HTMLDivElement>) {
    if (virtualEnabled) setScrollTop(event.currentTarget.scrollTop);
  }

  function renderOption(option: SelectOption, renderedIndex: number) {
    const optionIndex = virtualEnabled ? virtualStart + renderedIndex : renderedIndex;
    const selected = selectedValueSet.has(option.value);
    return <div
      id={`${listboxId}-${optionIndex}`}
      key={`${typeof option.value}-${option.value}`}
      className={`sia-select__option${selected ? " is-selected" : ""}${optionIndex === activeIndex ? " is-active" : ""}${option.disabled ? " is-disabled" : ""}`}
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled || undefined}
      style={virtualEnabled ? { position: "absolute", top: optionIndex * optionHeight, right: 0, left: 0, height: optionHeight } : undefined}
      onMouseEnter={() => !option.disabled && setActiveIndex(optionIndex)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => selectOption(option)}
    >
      <span className="sia-select__option-content"><span className="sia-select__option-label">{option.label}</span>{showValue ? <small className="sia-select__option-value">{String(option.value)}</small> : null}</span>{selected ? <Icon name="check" size={15} /> : null}
    </div>;
  }


  const modalAvailable: SelectOption[] = [...availableOptions, ...modalValues.filter(value => !availableOptions.some(option => option.value === value)).map(value => ({ value, label: String(value) }))];
  const modalFiltered = deferredQuery ? modalAvailable.filter(option => filterOption(deferredQuery, option)) : modalAvailable;
  const modalEnabled = modalFiltered.filter(option => !option.disabled && (!selectedOnly || modalValues.includes(option.value)));
  function modalBatch(operation: "all" | "remove" | "invert") {
    const editable = new Set(modalEnabled.map(option => option.value));
    setModalValues([...modalValues.filter(value => !editable.has(value)), ...modalEnabled.filter(option => operation === "all" || operation === "invert" && !modalValues.includes(option.value)).map(option => option.value)]);
  }

  const floating = useFloatingPlaceholder({ mode: placeholderMode, placeholder, filled: hasValue, active: open });

  return (
    <div ref={rootRef} className={`sia-select sia-select--${size} sia-select--${status}${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}${multiple ? " sia-select--multiple" : ""} ${className}`.trim()} style={style}>
      <button
        {...props}
        ref={forwardedRef}
        className={`sia-select__trigger${floating.className}`}
        id={selectId}
        type="button"
        role="combobox"
        aria-controls={popupMode === "modal" ? undefined : listboxId}
        aria-expanded={open}
        aria-haspopup={popupMode === "modal" ? "dialog" : "listbox"}
        aria-activedescendant={popupMode === "dropdown" && open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        aria-invalid={status === "error" || undefined}
        disabled={disabled}
        onClick={() => open ? closeDropdown() : openDropdown()}
        onKeyDown={handleTriggerKeyDown}
      >
        {multiple && hasValue ? <OverflowTags className="sia-select__tags" tagClassName="sia-select__tag" restClassName="sia-select__tag--rest" maxCount={maxTagCount} items={selectedOptions.map(option => ({ key: `${typeof option.value}-${option.value}`, label: option.label }))} /> : <span className={`sia-select__value${hasValue ? "" : " is-placeholder"}`}>{selectedOptions[0]?.label ?? placeholder}</span>}
        {loading ? <span className="sia-select__spinner" aria-hidden="true" /> : null}
        {floating.label}
        <Icon className="sia-select__arrow" name="chevron-down" size={15} />
      </button>
      {allowClear && hasValue && !disabled && !loading ? <button className="sia-select__clear" type="button" aria-label="清空选择" onClick={clearValue}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
      <PopupPortal ref={popupRef} anchorRef={rootRef} open={open && popupMode === "dropdown"} className={`sia-select__dropdown${filteredOptions.length === 0 && !canSubmitInput ? " sia-select__dropdown--empty" : ""}`}>
        <FloatingScrollbarProvider targetRef={listRef} />
        {showSearch || allowInput ? <label className="sia-select__search"><Icon name="search" size={15} /><input ref={searchRef} value={query} maxLength={inputMaxLength} onChange={handleSearchChange} onKeyDown={(event) => handleInteractionKeyDown(event, true)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></label> : null}
        {canSubmitInput ? <button type="button" className="sia-select__input-option" onMouseDown={(event) => event.preventDefault()} onClick={submitInputValue}><Icon name="plus" size={14} /><span>使用“{inputValue}”</span></button> : null}
        <div
          ref={listRef}
          id={listboxId}
          className="sia-select__list"
          role="listbox"
          aria-labelledby={selectId}
          aria-multiselectable={multiple || undefined}
          style={{ maxHeight: listHeight }}
          onScroll={handleListScroll}
        >
          {filteredOptions.length > 0 ? virtualEnabled ? <div className="sia-select__virtual-space" style={{ height: filteredOptions.length * optionHeight }}>
            {renderedOptions.map(renderOption)}
          </div> : renderedOptions.map(renderOption) : canSubmitInput ? null : <div className="sia-select__empty">{notFoundContent}</div>}
        </div>
        {showActions ? <div className="sia-select__actions">
          <span>共 {filteredOptions.length} 条</span>
          {multiple && showSelectAll ? <>
            <Button variant="link" size="small" disabled={allFilteredSelected || !enabledFilteredOptions.length} onClick={selectAllFiltered}>全选</Button>
            <Button variant="link" size="small" disabled={!enabledFilteredOptions.length} onClick={invertFiltered}>反选</Button>
          </> : null}
          {multiple || allowClear ? <Button variant="link" size="small" danger disabled={!hasValue} onClick={clearSelection}>清空</Button> : null}
        </div> : null}
      </PopupPortal>
      {popupMode === "modal" ? <Modal className="sia-select-modal" open={open} title={modalConfig?.title ?? placeholder} width={modalConfig?.width ?? 900}
        onOpenChange={(next) => { if (!next) closeDropdown(); }} onCancel={closeDropdown}
        footer={<div className="sia-select-modal__footer"><div>{modalConfig?.footerExtra}</div><div>
          <Button onClick={closeDropdown}>取消</Button>
          <Button variant="primary" disabled={disabled || loading} onClick={() => { setCurrentValue(multiple ? modalValues : modalValues[0] ?? null); closeDropdown(); }}>确定</Button>
        </div></div>}>
        {open ? <>
          <div className="sia-select-modal__heading">
            <div role="tablist" aria-label="选项范围">
              <Button role="tab" aria-selected={!selectedOnly} variant="link" onClick={() => setSelectedOnly(false)}>全部</Button>
              <Button role="tab" aria-selected={selectedOnly} variant="link" onClick={() => setSelectedOnly(true)}>已选项({modalValues.length})</Button>
            </div>
            <Input aria-label={searchPlaceholder} placeholder={searchPlaceholder} prefix={<Icon name="search" size={14} />} value={query} allowClear
              onChange={(event) => { setQuery(event.target.value); onSearch?.(event.target.value); }} />
          </div>
          {multiple && showSelectAll ? <div className="sia-select-modal__actions">
            <Checkbox checked={modalEnabled.length > 0 && modalEnabled.every(option => modalValues.includes(option.value))}
              indeterminate={modalEnabled.some(option => modalValues.includes(option.value)) && !modalEnabled.every(option => modalValues.includes(option.value))}
              disabled={!modalEnabled.length} onChange={(checked) => modalBatch(checked ? "all" : "remove")}>全选</Checkbox>
            <Button variant="link" size="small" disabled={!modalEnabled.length} onClick={() => modalBatch("invert")}>反选</Button>
            <Button variant="link" size="small" danger disabled={!modalValues.length} onClick={() => setModalValues([])}>清空</Button>
          </div> : null}
          {allowInput && canSubmitInput ? <Button variant="link" onClick={() => { setModalValues(multiple ? [...new Set([...modalValues, inputValue])] : [inputValue]); setQuery(""); }}>使用“{inputValue}”</Button> : null}
          <SelectionPanel options={modalFiltered} value={modalValues} onChange={setModalValues} multiple={multiple} selectedOnly={selectedOnly}
            showValue={showValue} showSearch={false} showActions={false} includeUnknownValues={false} columns={modalConfig?.columns ?? 3} maxHeight={modalConfig?.maxHeight ?? 360} />
        </> : null}
      </Modal> : null}
    </div>
  );
});

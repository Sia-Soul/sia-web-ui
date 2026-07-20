import { forwardRef, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, UIEvent } from "react";
import { Icon } from "./Icon";
import { PopupPortal } from "./PopupPortal";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";

export type SelectValue = string | number;
export type SelectMode = "single" | "multiple";
export type SelectChangeValue = SelectValue | SelectValue[] | null;

export type SelectOption = {
  label: ReactNode;
  value: SelectValue;
  disabled?: boolean;
};

export interface SelectProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "defaultValue" | "onChange" | "value"> {
  options: readonly SelectOption[];
  mode?: SelectMode;
  value?: SelectChangeValue;
  defaultValue?: SelectChangeValue;
  onChange?: (value: SelectChangeValue, option: SelectOption | SelectOption[] | null) => void;
  placeholder?: ReactNode;
  size?: ControlSize;
  status?: ControlStatus;
  allowClear?: boolean;
  loading?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  filterOption?: (query: string, option: SelectOption) => boolean;
  showSelectAll?: boolean;
  maxTagCount?: number;
  virtual?: boolean;
  virtualThreshold?: number;
  listHeight?: number;
  optionHeight?: number;
  notFoundContent?: ReactNode;
}

function defaultFilterOption(query: string, option: SelectOption) {
  return String(option.label).toLowerCase().includes(query.toLowerCase());
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    options,
    mode = "single",
    value,
    defaultValue,
    onChange,
    placeholder = "请选择",
    size = "medium",
    status = "default",
    allowClear = false,
    loading = false,
    showSearch = false,
    searchPlaceholder = "搜索选项",
    onSearch,
    filterOption = defaultFilterOption,
    showSelectAll = false,
    maxTagCount = 2,
    virtual = true,
    virtualThreshold = 100,
    listHeight = 256,
    optionHeight = 34,
    disabled,
    className = "",
    id,
    notFoundContent = "暂无数据",
    onKeyDown,
    ...props
  },
  forwardedRef,
) {
  const fallbackId = useId();
  const selectId = id ?? fallbackId;
  const listboxId = `${selectId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
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
        const valueSet = new Set(nextValue);
        onChange?.(nextValue, options.filter((option) => valueSet.has(option.value)));
      } else {
        onChange?.(nextValue, options.find((option) => option.value === nextValue) ?? null);
      }
    },
  });

  const selectedValues = useMemo<SelectValue[]>(() => {
    if (mode === "multiple") return Array.isArray(currentValue) ? currentValue : currentValue === null ? [] : [currentValue];
    return Array.isArray(currentValue) ? currentValue.slice(0, 1) : currentValue === null ? [] : [currentValue];
  }, [currentValue, mode]);
  const selectedValueSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const selectedOptions = useMemo(() => options.filter((option) => selectedValueSet.has(option.value)), [options, selectedValueSet]);
  const filteredOptions = useMemo(() => deferredQuery ? options.filter((option) => filterOption(deferredQuery, option)) : options, [deferredQuery, filterOption, options]);
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
    if (!open) return undefined;
    function closeFromOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) closeDropdown();
    }
    document.addEventListener("mousedown", closeFromOutside);
    return () => document.removeEventListener("mousedown", closeFromOutside);
  }, [open]);

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
  }, [open, showSearch]);

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

  function clearSelection() {
    setCurrentValue(multiple ? [] : null);
  }

  function handleInteractionKeyDown(event: KeyboardEvent<HTMLButtonElement | HTMLInputElement>, fromSearch = false) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openDropdown();
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" || (event.key === " " && !fromSearch)) {
      event.preventDefault();
      if (!open) openDropdown();
      else if (activeIndex >= 0 && filteredOptions[activeIndex]) selectOption(filteredOptions[activeIndex]);
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
      <span>{option.label}</span>{selected ? <Icon name="check" size={15} /> : null}
    </div>;
  }

  const visibleTags = selectedOptions.slice(0, Math.max(0, maxTagCount));
  const hiddenTagCount = selectedOptions.length - visibleTags.length;

  return (
    <div ref={rootRef} className={`sia-select sia-select--${size} sia-select--${status}${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}${multiple ? " sia-select--multiple" : ""} ${className}`.trim()}>
      <button
        {...props}
        ref={forwardedRef}
        className="sia-select__trigger"
        id={selectId}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        aria-invalid={status === "error" || undefined}
        disabled={disabled}
        onClick={() => open ? closeDropdown() : openDropdown()}
        onKeyDown={handleTriggerKeyDown}
      >
        {multiple && hasValue ? <span className="sia-select__tags">
          {visibleTags.map((option) => <span className="sia-select__tag" key={`${typeof option.value}-${option.value}`}>{option.label}</span>)}
          {hiddenTagCount > 0 ? <span className="sia-select__tag sia-select__tag--rest">+{hiddenTagCount}</span> : null}
        </span> : <span className={`sia-select__value${hasValue ? "" : " is-placeholder"}`}>{selectedOptions[0]?.label ?? placeholder}</span>}
        {loading ? <span className="sia-select__spinner" aria-hidden="true" /> : null}
        <Icon className="sia-select__arrow" name="chevron-down" size={15} />
      </button>
      {allowClear && hasValue && !disabled && !loading ? <button className="sia-select__clear" type="button" aria-label="清空选择" onClick={clearValue}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
      <PopupPortal ref={popupRef} anchorRef={rootRef} open={open} className="sia-select__dropdown">
        {showSearch ? <label className="sia-select__search"><Icon name="search" size={15} /><input ref={searchRef} value={query} onChange={handleSearchChange} onKeyDown={(event) => handleInteractionKeyDown(event, true)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></label> : null}
        {multiple && showSelectAll ? <div className="sia-select__actions">
          <button type="button" disabled={allFilteredSelected || enabledFilteredOptions.length === 0} onClick={selectAllFiltered}>全选</button>
          <button type="button" disabled={!hasValue} onClick={clearSelection}>清除</button>
          <span>{selectedValues.length} 项已选</span>
        </div> : null}
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
          </div> : renderedOptions.map(renderOption) : <div className="sia-select__empty">{notFoundContent}</div>}
        </div>
      </PopupPortal>
    </div>
  );
});

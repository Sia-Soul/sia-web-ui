import { withTitleTooltip } from "./titleTooltip";
import { useControlSize } from "./shared";
import { useFloatingPlaceholder } from "./FloatingPlaceholder";
import type { InputPlaceholderMode } from "./shared";
import { forwardRef, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, UIEvent } from "react";
import { Modal } from "./Modal";
import type { ModalActionResult } from "./Modal";
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

/** 选择器的值类型。 */
export type SelectValue = string | number;
/** 选择器的模式类型。 */
export type SelectMode = "single" | "multiple";
/** 选择变更后的值：单选为字符串、数字或 null，多选为值数组。 */
export type SelectChangeValue = SelectValue | SelectValue[] | null;

/** 选择器的候选项定义。 */
export type SelectOption = {
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: SelectValue;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 弹框模式中的分组标题。 */
  group?: string;
  /** 弹框模式中显示在选项名称旁的帮助说明，不参与搜索或回填。 */
  description?: ReactNode;
};

/** 选择器的属性配置。 */
export interface SelectProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "defaultValue" | "onChange" | "value"> {
  /** 下拉选项 */
  options: readonly SelectOption[];
  /**
   * 单选或多选模式
   * @defaultValue "single"
   */
  mode?: SelectMode;
  /** 显式指定下拉或弹框。未设置时根据 options 总数判断：超过 modalThreshold 使用弹框。显式配置优先于阈值；弹框点击确定才提交。 */
  popupMode?: "dropdown" | "modal";
  /**
   * 未指定 popupMode 时，选项总数超过此值自动使用弹框，等于阈值时仍使用下拉。
   * @defaultValue 15
   */
  modalThreshold?: number;
  /** 弹框标题、布局及顶部/底部扩展内容。 */
  modalConfig?: {
    /** 多选弹框显示分组复选框，仅切换当前搜索及已选视图中该组的可用项。
     * @defaultValue false */
    groupCheckable?: boolean;
    /** 弹框标题，未设置时使用 Select 的 placeholder。 */
    title?: ReactNode;
    /** 弹框宽度，默认 900px。 */
    width?: number | string;
    /** 每行选项列数，默认 3 列。 */
    columns?: number;
    /** 列表最大可视高度，默认 360px。 */
    maxHeight?: number;
    /** 标题下方的独立首行扩展内容，位于选项范围和搜索框上方。 */
    headerExtra?: ReactNode;
    /** 顶部扩展控件的业务数据，由业务方更新此属性；框架不会自动绑定 headerExtra 内的控件。确认时将当前对象的浅拷贝作为 onConfirm 第三个参数传出，未配置时为 {}。 */
    extraValues?: Record<string, unknown>;
    /** 点击确定时传出选中值、对应选项及扩展数据浅拷贝；单选无值为 null，多选为数组。异步完成后才提交 onChange 并关闭；返回 false 或抛出异常保留草稿和弹框，不触发 onChange。取消不调用。 */
    onConfirm?: (value: SelectChangeValue, option: SelectOption | SelectOption[] | null, extraValues: Record<string, unknown>) => ModalActionResult;
    /** 底部左侧扩展内容，例如维护按钮。 */
    footerExtra?: ReactNode;
  };
  /** 当前值（受控） */
  value?: SelectChangeValue;
  /** 初始选中值 */
  defaultValue?: SelectChangeValue;
  /** 确认选择或清空时调用。单选返回单值及对应选项，清空返回 null；多选返回值数组及选项数组。弹框中的草稿变化不会直接触发。 */
  onChange?: (value: SelectChangeValue, option: SelectOption | SelectOption[] | null) => void;
  /**
   * 未选择时的提示
   * @defaultValue "请选择"
   */
  placeholder?: ReactNode;
  /** 占位提示的显示模式；floating 为浮动标签。 */
  placeholderMode?: InputPlaceholderMode;
  /** small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先 */
  size?: ControlSize;
  /**
   * 当前状态，用于选择对应的状态样式。
   * @defaultValue "default"
   */
  status?: ControlStatus;
  /**
   * 是否允许清空当前选择；单选弹框中同时允许再次点击已选项取消选择。显式设为 false 可禁用。
   * @defaultValue true
   */
  allowClear?: boolean;
  /**
   * 显示加载状态并禁用展开
   * @defaultValue false
   */
  loading?: boolean;
  /**
   * 是否显示下拉搜索输入框。未设置时，options 总数超过 15 项自动显示；显式值优先。
   * 弹框始终提供搜索，allowInput 仍会显示输入框；此规则独立于 modalThreshold。
   * @defaultValue options.length > 15
   */
  showSearch?: boolean;
  /** 在选项名称下方显示对应的 value。 */
  showValue?: boolean;
  /** 允许将面板输入框内容作为自定义选项提交，默认 false。开启时始终显示输入框，展开下拉后自动聚焦；输入后按 Enter 或点击“使用”提交，受控时通过 onChange 回填 value。 */
  allowInput?: boolean;
  /** 手动输入内容的最大长度 */
  inputMaxLength?: number;
  /**
   * 面板输入框的占位提示文字；allowInput 开启时默认“输入或搜索”，否则默认“搜索选项”，显式设置优先。
   * @defaultValue allowInput 为 true 时为 "输入或搜索"，否则为 "搜索选项"
   */
  searchPlaceholder?: string;
  /** 搜索条件变化或提交搜索时调用，具体参数见签名。 */
  onSearch?: (query: string) => void;
  /**
   * 自定义搜索匹配函数，返回 true 时保留该选项。
   * @defaultValue defaultFilterOption
   */
  filterOption?: (query: string, option: SelectOption) => boolean;
  /**
   * 多选时显示全选、反选；下拉操作栏固定在列表底部
   * @defaultValue true
   */
  showSelectAll?: boolean;
  /** 是否显示下拉面板底部的条数统计与操作行；默认单选隐藏、多选显示，不影响弹框模式。 */
  showActions?: boolean;
  /** 多选标签的数量上限。默认不限制数量，按组件可用宽度自动显示并折叠为 +N，长标签利用剩余空间后才省略文字；显式设置后同时受数量上限与可用宽度约束，0 表示全部折叠。 */
  maxTagCount?: number;
  /**
   * 长列表启用窗口化渲染
   * @defaultValue true
   */
  virtual?: boolean;
  /**
   * 启用虚拟滚动的选项数量
   * @defaultValue 100
   */
  virtualThreshold?: number;
  /**
   * 选项列表的最大可视高度，单位为像素。
   * @defaultValue 256
   */
  listHeight?: number;
  /**
   * 单个选项的高度，虚拟列表据此计算可见区域。
   * @defaultValue showValue ? 54 : 34
   */
  optionHeight?: number;
  /**
   * 没有匹配选项时的提示内容。
   * @defaultValue "暂无数据"
   */
  notFoundContent?: ReactNode;
}

function defaultFilterOption(query: string, option: SelectOption) {
  const keyword = query.toLowerCase();
  return [option.label, option.value].some(value => String(value).toLowerCase().includes(keyword));
}

/** 选择器组件。下拉面板以 260ms 缩放淡入、弹大回收后归位，关闭为 140ms 无回弹缩小淡出；最终外观沿用组件样式，系统减少动态效果时直接显示。下拉面板每次展开自动定位到列表顺序中的第一个已选项，支持普通和虚拟列表；未选中时从顶部显示。展开时 Escape 只收起选择器，不关闭外层弹框或抽屉。 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    options,
    mode = "single",
    popupMode: popupModeProp,
    modalThreshold = 15,
    modalConfig,
    value,
    defaultValue,
    onChange,
    placeholder = "请选择",
    placeholderMode,
    size: sizeProp,
    status = "default",
    allowClear = true,
    loading = false,
    showSearch: showSearchProp,
    showValue = false,
    allowInput = false,
    inputMaxLength,
    searchPlaceholder = allowInput ? "输入或搜索" : "搜索选项",
    onSearch,
    filterOption = defaultFilterOption,
    showSelectAll = true,
    showActions = mode === "multiple",
    maxTagCount,
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
  // 按原始候选项总数启用搜索，显式下拉或提高弹框阈值也不影响大列表检索。
  const showSearch = showSearchProp ?? options.length > 15;
  const size = useControlSize(sizeProp);
  const fallbackId = useId();
  const selectId = id ?? fallbackId;
  const listboxId = `${selectId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const automaticMode = popupModeProp ?? (options.length > modalThreshold ? "modal" : "dropdown");
  const [openedMode, setOpenedMode] = useState<"dropdown" | "modal">(automaticMode);
  // 本次打开期间保持模式稳定，避免远程搜索更新 options 时切换面板并丢失草稿。
  const popupMode = open ? openedMode : automaticMode;
  const [modalValues, setModalValues] = useState<SelectValue[]>([]);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const modalSubmitLock = useRef(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const [dropdownFontSize, setDropdownFontSize] = useState<string>();
  const pendingSelectedScroll = useRef(false);
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
    // Form 的空字段默认值为 ""；没有显式空字符串选项时视为未选择，保留合法的 0/"" 选项。
    if (currentValue == null || currentValue === "" && !options.some(option => option.value === "")) return [];
    if (mode === "multiple") return Array.isArray(currentValue) ? currentValue : currentValue === null ? [] : [currentValue];
    return Array.isArray(currentValue) ? currentValue.slice(0, 1) : currentValue === null ? [] : [currentValue];
  }, [currentValue, mode, options]);
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
    if (!open || popupMode !== "dropdown" || !(showSearch || allowInput)) return;
    // Portal 首次定位时暂时 visibility:hidden，此时 focus 会被浏览器忽略；下一帧定位完成即可输入，无需等待入场动画。
    const frame = requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [allowInput, open, popupMode, showSearch]);

  useEffect(() => { if (disabled || loading) closeDropdown(); }, [disabled, loading]);

  // 每次展开只定位一次；异步候选项到达后可补定位，之后不干扰用户滚动或搜索。
  useEffect(() => {
    if (!open || popupMode !== "dropdown" || !pendingSelectedScroll.current || query) return;
    const index = filteredOptions.findIndex(option => selectedValueSet.has(option.value));
    if (index < 0) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      const item = virtualEnabled ? null : list.querySelectorAll<HTMLElement>('[role="option"]')[index];
      const top = virtualEnabled ? index * optionHeight : item ? item.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop : 0;
      list.scrollTop = Math.max(0, top - (list.clientHeight - (item?.offsetHeight ?? optionHeight)) / 2);
      setScrollTop(list.scrollTop);
      pendingSelectedScroll.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, popupMode, filteredOptions, selectedValueSet, virtualEnabled, optionHeight, query]);

  // 弹层通过 Portal 挂载到 body，需要显式继承触发器的实际字号（含 size 和业务 CSS 覆盖）。
  useLayoutEffect(() => {
    if (!open || popupMode !== "dropdown") return;
    const trigger = rootRef.current?.querySelector<HTMLElement>(".sia-select__trigger");
    if (trigger) setDropdownFontSize(getComputedStyle(trigger).fontSize);
  }, [open, popupMode, size]);

  function firstEnabledIndex() {
    return filteredOptions.findIndex((option) => !option.disabled);
  }

  function closeDropdown() {
    pendingSelectedScroll.current = false;
    setOpen(false);
    setQuery("");
    setScrollTop(0);
  }

  async function confirmModalSelection() {
    if (disabled || loading || modalSubmitLock.current) return;
    modalSubmitLock.current = true;
    const nextValue = multiple ? [...modalValues] : modalValues[0] ?? null;
    const selected = modalValues.map(selectedValue => availableOptions.find(option => option.value === selectedValue)
      ?? (allowInput ? { value: selectedValue, label: String(selectedValue) } : undefined))
      .filter((option): option is SelectOption => option !== undefined);
    const extraValues = { ...modalConfig?.extraValues };
    setModalSubmitting(true);
    try {
      const result = await modalConfig?.onConfirm?.(nextValue, multiple ? selected : selected[0] ?? null, extraValues);
      if (result === false) return;
      setCurrentValue(nextValue);
      closeDropdown();
    } catch {
      // The caller can display a validation/request error and let the user retry.
    } finally {
      modalSubmitLock.current = false;
      setModalSubmitting(false);
    }
  }

  function openDropdown() {
    if (disabled || loading) return;
    pendingSelectedScroll.current = true;
    setOpenedMode(automaticMode);
    const selectedIndex = filteredOptions.findIndex((option) => selectedValueSet.has(option.value) && !option.disabled);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex());
    if (automaticMode === "modal") { setModalValues([...selectedValues]); setSelectedOnly(false); }
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

  // 触发器、搜索框和多选底部按钮共同消费本层 Escape，避免传播到外层弹框的 document 监听。
  function handleDropdownEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || !open || popupMode !== "dropdown") return false;
    event.preventDefault();
    event.stopPropagation();
    closeDropdown();
    return true;
  }

  function handleInteractionKeyDown(event: KeyboardEvent<HTMLButtonElement | HTMLInputElement>, fromSearch = false) {
    if (handleDropdownEscape(event) || (popupMode === "modal" && open)) return;
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
        {...withTitleTooltip(props)}
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
        {multiple && hasValue ? <OverflowTags expandToFit className="sia-select__tags" tagClassName="sia-select__tag" restClassName="sia-select__tag--rest" maxCount={maxTagCount ?? selectedOptions.length} items={selectedOptions.map(option => ({ key: `${typeof option.value}-${option.value}`, label: option.label }))} /> : <span className={`sia-select__value${hasValue ? "" : " is-placeholder"}`}>{selectedOptions[0]?.label ?? placeholder}</span>}
        {loading ? <span className="sia-select__spinner" aria-hidden="true" /> : null}
        {floating.label}
        <Icon className="sia-select__arrow" name="chevron-down" size={15} />
      </button>
      {allowClear && hasValue && !disabled && !loading ? <button className="sia-select__clear" type="button" aria-label="清空选择" onClick={clearValue}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
      <PopupPortal ref={popupRef} onKeyDown={handleDropdownEscape} anchorRef={rootRef} open={open && popupMode === "dropdown"} style={{ fontSize: dropdownFontSize }} className={`sia-select__dropdown${filteredOptions.length === 0 && !canSubmitInput ? " sia-select__dropdown--empty" : ""}`}>
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
        confirmLoading={modalSubmitting}
        onOpenChange={(next) => { if (!next) closeDropdown(); }} onCancel={closeDropdown}
        footer={<div className="sia-select-modal__footer"><div>{modalConfig?.footerExtra}</div><div>
          <Button disabled={modalSubmitting} onClick={closeDropdown}>取消</Button>
          <Button variant="primary" loading={modalSubmitting} disabled={disabled || loading} onClick={confirmModalSelection}>确定</Button>
        </div></div>}>
        {open ? <>
          {modalConfig?.headerExtra != null && modalConfig.headerExtra !== false ? <div className="sia-select-modal__header-extra">{modalConfig.headerExtra}</div> : null}
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
          <SelectionPanel options={modalFiltered} value={modalValues} onChange={setModalValues} multiple={multiple} groupCheckable={modalConfig?.groupCheckable} allowDeselect={allowClear} selectedOnly={selectedOnly}
            showValue={showValue} showSearch={false} showActions={false} includeUnknownValues={false} columns={modalConfig?.columns ?? 3} maxHeight={modalConfig?.maxHeight ?? 360} />
        </> : null}
      </Modal> : null}
    </div>
  );
});

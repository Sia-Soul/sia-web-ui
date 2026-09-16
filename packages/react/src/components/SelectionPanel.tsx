import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Checkbox } from "./Checkbox";
import { Button } from "./Button";
import { Tooltip } from "./FloatingDisplay";
import { Input } from "./Input";

/** Selection的值类型。 */
export type SelectionValue = string | number;
/** Selection的候选项定义。 */
export interface SelectionOption {
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: SelectionValue;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 禁用项悬停时显示的原因说明。 */
  disabledTip?: ReactNode;
  /** 选项所属分组名称。 */
  group?: string;
  /** 普通或按钮形态 */
  optionType?: "divider";
}
/** 分组选择面板的属性配置。 */
export interface SelectionPanelProps {
  /** 可供用户选择的候选项列表。 */
  options: readonly SelectionOption[];
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value: readonly SelectionValue[];
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange: (values: SelectionValue[]) => void;
  /**
   是否允许同时选择多个项目。
   * @defaultValue false
   */
  multiple?: boolean;
  /** 单选时允许再次点击已选项以清空选择。 */
  allowDeselect?: boolean;
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
   是否显示搜索输入框。
   * @defaultValue true
   */
  showSearch?: boolean;
  /**
   是否显示全选、反选、清空及已选数量操作行。
   * @defaultValue true
   */
  showActions?: boolean;
  /**
   * 是否将不在 options 中的已选值作为自定义选项展示。
   * @defaultValue true
   */
  includeUnknownValues?: boolean;
  /** 受控的搜索文本。 */
  searchValue?: string;
  /** 搜索条件变化或提交搜索时调用，具体参数见签名。 */
  onSearch?: (value: string) => void;
  /**
   * 是否只显示已选中的选项。
   * @defaultValue false
   */
  selectedOnly?: boolean;
  /**
   * 在选项名称下方显示 value，下拉与弹框模式均支持；不影响按 value 搜索
   * @defaultValue false
   */
  showValue?: boolean;
  /**
   * 选项主文本显示 label 还是 value。
   * @defaultValue "label"
   */
  displayField?: "label" | "value";
  /**
   * 每行选项列数；长文本在格内单行省略。
   * @defaultValue 1
   */
  columns?: number;
  /**
   * 允许的最大高度。
   * @defaultValue 250
   */
  maxHeight?: number;
  /**
   * 面板挂载后是否自动聚焦搜索框。
   * @defaultValue false
   */
  autoFocusSearch?: boolean;
}

/** 可嵌入下拉或弹窗的分组选择面板，长列表按行虚拟化。 */
export function SelectionPanel({ options, value, onChange, multiple = false, allowDeselect = false, disabled = false, loading = false,
  showSearch = true, showActions = true, includeUnknownValues = true, searchValue, onSearch, selectedOnly = false, showValue = false,
  displayField = "label", columns = 1, maxHeight = 250, autoFocusSearch = false }: SelectionPanelProps) {
  const [localSearch, setLocalSearch] = useState("");
  const search = searchValue ?? localSearch;
  const [scrollTop, setScrollTop] = useState(0);
  const [active, setActive] = useState<SelectionValue>();
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [deselectedHover, setDeselectedHover] = useState<SelectionValue>();
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = useMemo(() => new Set(value), [value]);
  const count = Math.max(1, Math.floor(columns));
  const allOptions = useMemo<SelectionOption[]>(() => {
    if (!includeUnknownValues) return [...options];
    const known = new Set(options.filter(option => option.optionType !== "divider").map(option => option.value));
    return [...value.filter(item => !known.has(item)).map(item => ({ value: item, label: String(item), group: "自定义值" })), ...options];
  }, [options, value, includeUnknownValues]);
  const filtered = useMemo(() => allOptions.filter(option => (!selectedOnly || selected.has(option.value)) &&
    (!search || option.optionType !== "divider" && [option.label, option.value].some(text => String(text ?? "").toLowerCase().includes(search.toLowerCase())))),
  [allOptions, selectedOnly, selected, search]);
  const rows = useMemo(() => {
    const groups = new Map<string | undefined, SelectionOption[]>();
    filtered.forEach(option => { const items = groups.get(option.group) ?? []; items.push(option); groups.set(option.group, items); });
    const rows: { key: string; title?: string; items?: SelectionOption[]; top: number; height: number }[] = [];
    let top = 0;
    for (const [group, items] of groups) {
      if (group) { rows.push({ key: `group-${rows.length}`, title: group, top, height: 30 }); top += 30; }
      for (let index = 0; index < items.length; index += count) {
        const height = showValue ? 48 : 34;
        rows.push({ key: `row-${rows.length}`, items: items.slice(index, index + count), top, height }); top += height;
      }
    }
    return rows;
  }, [filtered, count, showValue]);
  const totalHeight = rows.length ? rows[rows.length - 1].top + rows[rows.length - 1].height : 0;
  const virtual = filtered.length > 100;
  const renderedRows = virtual ? rows.filter(row => row.top + row.height >= scrollTop - 100 && row.top <= scrollTop + maxHeight + 100) : rows;
  const enabled = filtered.filter(option => !option.disabled && option.optionType !== "divider");
  useEffect(() => { setScrollTop(0); if (listRef.current) listRef.current.scrollTop = 0; setActive(undefined); }, [search, selectedOnly, count]);
  function toggle(option: SelectionOption, keyboard = false) {
    if (disabled || loading || option.disabled || option.optionType === "divider") return;
    setActive(option.value);
    setKeyboardActive(keyboard);
    setDeselectedHover(!keyboard && !multiple && allowDeselect && selected.has(option.value) ? option.value : undefined);
    onChange(multiple ? selected.has(option.value) ? value.filter(item => item !== option.value) : [...value, option.value] : allowDeselect && selected.has(option.value) ? [] : [option.value]);
  }
  function batch(operation: "all" | "invert" | "clear") {
    if (disabled || loading) return;
    if (operation === "clear") { onChange([]); return; }
    const editable = new Set(enabled.map(option => option.value));
    const retained = value.filter(item => !editable.has(item));
    const add = enabled.filter(option => operation === "all" || !selected.has(option.value)).map(option => option.value);
    onChange([...retained, ...add]);
  }
  return <div className="sia-selection-panel">
    {showSearch && <Input aria-label="搜索选项" placeholder="搜索" autoFocus={autoFocusSearch} value={search} allowClear
      onChange={event => { setLocalSearch(event.target.value); onSearch?.(event.target.value); }} />}
    {multiple && showActions && <div className="sia-selection-panel__actions">
      <Button variant="link" size="small" disabled={disabled || loading || !enabled.length} onClick={() => batch("all")}>全选</Button>
      <Button variant="link" size="small" disabled={disabled || loading || !enabled.length} onClick={() => batch("invert")}>反选</Button>
      <Button variant="link" size="small" disabled={disabled || loading || !value.length} onClick={() => batch("clear")}>清空</Button>
      <span>已选 {value.length} 项</span>
    </div>}
    <div ref={listRef} role="listbox" aria-label="选项列表" aria-multiselectable={multiple || undefined} tabIndex={disabled ? -1 : 0}
      className="sia-selection-panel__list" style={{ maxHeight }} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onPointerDown={() => setKeyboardActive(false)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setKeyboardActive(false); }}
      aria-activedescendant={active !== undefined ? `${id}-${typeof active}-${active}` : undefined}
      onKeyDown={event => {
        if (event.target instanceof HTMLInputElement) return;
        if (disabled || loading || !enabled.length) return;
        const index = enabled.findIndex(option => option.value === active);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          setKeyboardActive(true);
          setDeselectedHover(undefined);
          const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : Math.max(0, Math.min(enabled.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
          const option = enabled[next]; setActive(option.value);
          const row = rows.find(row => row.items?.includes(option));
          if (row && listRef.current) { listRef.current.scrollTop = Math.max(0, row.top - maxHeight / 2); setScrollTop(listRef.current.scrollTop); }
        } else if ((event.key === "Enter" || event.key === " ") && index >= 0) { event.preventDefault(); toggle(enabled[index], true); }
      }}>
      {loading ? <div role="status">加载中…</div> : !rows.length ? <div className="sia-selection-panel__empty">暂无匹配选项</div> :
        <div style={{ height: totalHeight, position: "relative" }}>{renderedRows.map(row => <div key={row.key}
          className={row.title !== undefined ? "sia-selection-panel__group" : "sia-selection-panel__row"}
          style={{ position: "absolute", top: row.top, height: row.height, width: "100%", gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
          {row.title ?? row.items?.map((option, index) => option.optionType === "divider" ? <div role="separator" key={`divider-${index}`} className="sia-selection-panel__divider" /> :
            <Tooltip key={`${typeof option.value}-${option.value}`} title={option.disabled ? option.disabledTip : undefined} placement="right">
              <div role="option" id={`${id}-${typeof option.value}-${option.value}`} tabIndex={-1}
                aria-selected={selected.has(option.value)} aria-disabled={disabled || option.disabled || undefined}
                className={`sia-selection-panel__option${keyboardActive && active === option.value ? " is-active" : ""}`}
                data-deselected-hover={deselectedHover === option.value || undefined}
                onPointerLeave={() => { if (deselectedHover === option.value) setDeselectedHover(undefined); }}
                onClick={(event) => { if (!(event.target as Element).closest(".sia-checkbox")) toggle(option); }}>
                {multiple ? <Checkbox checked={selected.has(option.value)} disabled={disabled || loading || option.disabled} tabIndex={-1} onChange={() => toggle(option)}>
                  <span className="sia-selection-panel__text"><span className="sia-selection-panel__label">{showValue || displayField === "label" ? option.label : String(option.value)}</span>{showValue && <small>{String(option.value)}</small>}</span>
                </Checkbox> :
                <span className="sia-selection-panel__text"><span className="sia-selection-panel__label">{showValue || displayField === "label" ? option.label : String(option.value)}</span>
                  {showValue && <small>{String(option.value)}</small>}</span>
                }
              </div>
            </Tooltip>)}
        </div>)}</div>}
    </div>
  </div>;
}

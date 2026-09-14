import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Tooltip } from "./FloatingDisplay";
import { Input } from "./Input";

export type SelectionValue = string | number;
export interface SelectionOption {
  value: SelectionValue;
  label: ReactNode;
  disabled?: boolean;
  disabledTip?: ReactNode;
  group?: string;
  optionType?: "divider";
}
export interface SelectionPanelProps {
  options: readonly SelectionOption[];
  value: readonly SelectionValue[];
  onChange: (values: SelectionValue[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  loading?: boolean;
  showSearch?: boolean;
  searchValue?: string;
  onSearch?: (value: string) => void;
  selectedOnly?: boolean;
  showValue?: boolean;
  displayField?: "label" | "value";
  columns?: number;
  maxHeight?: number;
  autoFocusSearch?: boolean;
}

/** 可嵌入下拉或弹窗的分组选择面板，长列表按行虚拟化。 */
export function SelectionPanel({ options, value, onChange, multiple = false, disabled = false, loading = false,
  showSearch = true, searchValue, onSearch, selectedOnly = false, showValue = false,
  displayField = "label", columns = 1, maxHeight = 250, autoFocusSearch = false }: SelectionPanelProps) {
  const [localSearch, setLocalSearch] = useState("");
  const search = searchValue ?? localSearch;
  const [scrollTop, setScrollTop] = useState(0);
  const [active, setActive] = useState<SelectionValue>();
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = useMemo(() => new Set(value), [value]);
  const count = Math.max(1, Math.floor(columns));
  const allOptions = useMemo<SelectionOption[]>(() => {
    const known = new Set(options.filter(option => option.optionType !== "divider").map(option => option.value));
    return [...value.filter(item => !known.has(item)).map(item => ({ value: item, label: String(item), group: "自定义值" })), ...options];
  }, [options, value]);
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
  function toggle(option: SelectionOption) {
    if (disabled || loading || option.disabled || option.optionType === "divider") return;
    setActive(option.value);
    onChange(multiple ? selected.has(option.value) ? value.filter(item => item !== option.value) : [...value, option.value] : [option.value]);
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
    {multiple && <div className="sia-selection-panel__actions">
      <Button variant="link" size="small" disabled={disabled || loading || !enabled.length} onClick={() => batch("all")}>全选</Button>
      <Button variant="link" size="small" disabled={disabled || loading || !enabled.length} onClick={() => batch("invert")}>反选</Button>
      <Button variant="link" size="small" disabled={disabled || loading || !value.length} onClick={() => batch("clear")}>清空</Button>
      <span>已选 {value.length} 项</span>
    </div>}
    <div ref={listRef} role="listbox" aria-label="选项列表" aria-multiselectable={multiple || undefined} tabIndex={disabled ? -1 : 0}
      className="sia-selection-panel__list" style={{ maxHeight }} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      aria-activedescendant={active !== undefined ? `${id}-${typeof active}-${active}` : undefined}
      onKeyDown={event => {
        if (disabled || loading || !enabled.length) return;
        const index = enabled.findIndex(option => option.value === active);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : Math.max(0, Math.min(enabled.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
          const option = enabled[next]; setActive(option.value);
          const row = rows.find(row => row.items?.includes(option));
          if (row && listRef.current) { listRef.current.scrollTop = Math.max(0, row.top - maxHeight / 2); setScrollTop(listRef.current.scrollTop); }
        } else if ((event.key === "Enter" || event.key === " ") && index >= 0) { event.preventDefault(); toggle(enabled[index]); }
      }}>
      {loading ? <div role="status">加载中…</div> : !rows.length ? <div className="sia-selection-panel__empty">暂无匹配选项</div> :
        <div style={{ height: totalHeight, position: "relative" }}>{renderedRows.map(row => <div key={row.key}
          className={row.title !== undefined ? "sia-selection-panel__group" : "sia-selection-panel__row"}
          style={{ position: "absolute", top: row.top, height: row.height, width: "100%", gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
          {row.title ?? row.items?.map((option, index) => option.optionType === "divider" ? <div role="separator" key={`divider-${index}`} className="sia-selection-panel__divider" /> :
            <Tooltip key={`${typeof option.value}-${option.value}`} title={option.disabled ? option.disabledTip : undefined} placement="right">
              <button type="button" role="option" id={`${id}-${typeof option.value}-${option.value}`} tabIndex={-1}
                aria-selected={selected.has(option.value)} aria-disabled={disabled || option.disabled || undefined}
                className={`sia-selection-panel__option${active === option.value ? " is-active" : ""}`}
                onClick={() => toggle(option)}>
                {multiple && <span aria-hidden="true" className="sia-selection-panel__check">{selected.has(option.value) ? "✓" : ""}</span>}
                <span className="sia-selection-panel__text">{showValue || displayField === "label" ? option.label : String(option.value)}
                  {showValue && <small>{String(option.value)}</small>}</span>
              </button>
            </Tooltip>)}
        </div>)}</div>}
    </div>
  </div>;
}

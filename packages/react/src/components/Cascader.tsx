import { useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Checkbox } from "./Checkbox";
import { Icon } from "./Icon";
import { PopupPortal } from "./PopupPortal";
import { useControllableState } from "./shared";

export type CascaderValue = string | number;
export interface CascaderOption {
  value: CascaderValue;
  label?: ReactNode;
  disabled?: boolean;
  isLeaf?: boolean;
  children?: readonly CascaderOption[];
  [key: string]: unknown;
}
export interface CascaderFieldNames { label?: string; value?: string; children?: string }
export interface CascaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  options: readonly CascaderOption[];
  value?: readonly CascaderValue[] | readonly (readonly CascaderValue[])[];
  defaultValue?: readonly CascaderValue[] | readonly (readonly CascaderValue[])[];
  multiple?: boolean;
  showSearch?: boolean;
  allowClear?: boolean;
  changeOnSelect?: boolean;
  expandTrigger?: "click" | "hover";
  placeholder?: ReactNode;
  disabled?: boolean;
  fieldNames?: CascaderFieldNames;
  displayRender?: (labels: ReactNode[], selectedOptions: CascaderOption[]) => ReactNode;
  loadData?: (selectedOptions: CascaderOption[]) => void | Promise<void>;
  onChange?: (value: readonly CascaderValue[] | readonly (readonly CascaderValue[])[] | undefined, selectedOptions: CascaderOption[] | CascaderOption[][]) => void;
}

function optionValue(option: CascaderOption, fields: Required<CascaderFieldNames>) { return option[fields.value] as CascaderValue; }
function optionLabel(option: CascaderOption, fields: Required<CascaderFieldNames>) { return option[fields.label] as ReactNode ?? optionValue(option, fields); }
function optionChildren(option: CascaderOption, fields: Required<CascaderFieldNames>) { return option[fields.children] as readonly CascaderOption[] | undefined; }
function pathKey(path: readonly CascaderValue[]) { return path.map(String).join("\u001f"); }

function findPath(options: readonly CascaderOption[], values: readonly CascaderValue[], fields: Required<CascaderFieldNames>) {
  const result: CascaderOption[] = [];
  let level = options;
  for (const value of values) {
    const found = level.find((option) => optionValue(option, fields) === value);
    if (!found) break;
    result.push(found);
    level = optionChildren(found, fields) ?? [];
  }
  return result;
}

function leafPaths(options: readonly CascaderOption[], fields: Required<CascaderFieldNames>, parents: CascaderOption[] = []): CascaderOption[][] {
  const result: CascaderOption[][] = [];
  for (const option of options) {
    const path = [...parents, option];
    const children = optionChildren(option, fields);
    if (children?.length) result.push(...leafPaths(children, fields, path));
    else result.push(path);
  }
  return result;
}

export function Cascader({
  options, value, defaultValue, multiple = false, showSearch = false, allowClear = false, changeOnSelect = false,
  expandTrigger = "click", placeholder = "请选择", disabled = false, fieldNames, displayRender, loadData, onChange, className = "", ...props
}: CascaderProps) {
  const fields = useMemo(() => ({ label: fieldNames?.label ?? "label", value: fieldNames?.value ?? "value", children: fieldNames?.children ?? "children" }), [fieldNames]);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useControllableState<readonly CascaderValue[] | readonly (readonly CascaderValue[])[] | undefined>({
    value, defaultValue: defaultValue ?? (multiple ? [] : undefined),
  });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<CascaderOption[]>([]);
  const [search, setSearch] = useState("");
  const [loadingKey, setLoadingKey] = useState("");
  const selectedPaths = multiple
    ? (current as readonly (readonly CascaderValue[])[] | undefined) ?? []
    : current?.length && !Array.isArray(current[0])
      ? [current as readonly CascaderValue[]]
      : [];
  const selectedKeys = new Set(selectedPaths.map(pathKey));
  const selectedPathSignature = selectedPaths.map(pathKey).join("\u001e");
  const searchPaths = useMemo(() => search ? leafPaths(options, fields).filter((path) => path.some((option) => String(optionLabel(option, fields)).toLowerCase().includes(search.toLowerCase()))) : [], [fields, options, search]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (selectedPaths.length) return;
    setActive([]);
    setSearch("");
    setLoadingKey("");
  }, [selectedPaths.length]);

  useEffect(() => {
    if (!open || !selectedPaths.length) return;
    setActive(findPath(options, selectedPaths[0], fields));
  }, [fields, open, options, selectedPathSignature]);

  function emit(next: readonly CascaderValue[] | readonly (readonly CascaderValue[])[] | undefined) {
    setCurrent(next);
    if (multiple) onChange?.(next, ((next as readonly (readonly CascaderValue[])[] | undefined) ?? []).map((path) => findPath(options, path, fields)));
    else onChange?.(next, next ? findPath(options, next as readonly CascaderValue[], fields) : []);
  }
  function clearSelection() {
    setActive([]);
    setSearch("");
    setLoadingKey("");
    emit(multiple ? [] : undefined);
  }
  function toggleOpen() {
    const nextOpen = !open;
    if (nextOpen) {
      const selectedPath = selectedPaths[0];
      setActive(selectedPath ? findPath(options, selectedPath, fields) : []);
    }
    setOpen(nextOpen);
  }
  async function activate(option: CascaderOption, depth: number) {
    if (option.disabled) return;
    const next = [...active.slice(0, depth), option];
    setActive(next);
    let children = optionChildren(option, fields);
    if (!children?.length && option.isLeaf === false && loadData) {
      setLoadingKey(pathKey(next.map((item) => optionValue(item, fields))));
      await loadData(next);
      setLoadingKey("");
      children = optionChildren(option, fields);
    }
    const values = next.map((item) => optionValue(item, fields));
    if (!children?.length || changeOnSelect) {
      if (multiple) {
        const key = pathKey(values);
        emit(selectedKeys.has(key) ? selectedPaths.filter((path) => pathKey(path) !== key) : [...selectedPaths, values]);
      } else {
        emit(values);
        if (!children?.length) setOpen(false);
      }
    }
  }
  const display = multiple
    ? selectedPaths.map((values) => {
      const path = findPath(options, values, fields);
      return displayRender?.(path.map((item) => optionLabel(item, fields)), path) ?? path.map((item) => optionLabel(item, fields)).join(" / ");
    })
    : (() => {
      const path = current ? findPath(options, current as readonly CascaderValue[], fields) : [];
      return path.length ? displayRender?.(path.map((item) => optionLabel(item, fields)), path) ?? path.map((item) => optionLabel(item, fields)).join(" / ") : null;
    })();
  const columns: (readonly CascaderOption[])[] = [options];
  active.forEach((option) => { const children = optionChildren(option, fields); if (children?.length) columns.push(children); });

  return <div ref={rootRef} className={`sia-cascader${open ? " is-open" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()} {...props}>
    <button type="button" className="sia-cascader__trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={toggleOpen}>
      <span className="sia-cascader__value">{display
        ? multiple && Array.isArray(display) ? display.map((label, index) => <span className="sia-cascader__tag" key={pathKey(selectedPaths[index] ?? [])}>{label}</span>) : display
        : <span className="sia-cascader__placeholder">{placeholder}</span>}</span>
      {allowClear && selectedPaths.length ? <span className="sia-cascader__clear" role="button" aria-label="清除选择" onClick={(event) => { event.stopPropagation(); clearSelection(); }}><Icon name="circle-close" variant="filled" size={15} /></span> : null}
      <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
    </button>
    <PopupPortal ref={popupRef} anchorRef={rootRef} open={open} className="sia-cascader__popup">
      {showSearch ? <label className="sia-cascader__search"><Icon name="search" size={15} /><input autoFocus value={search} placeholder="搜索选项" onChange={(event) => setSearch(event.currentTarget.value)} /></label> : null}
      {search ? <div className="sia-cascader__results">
        {searchPaths.map((path) => {
          const values = path.map((item) => optionValue(item, fields));
          const checked = selectedKeys.has(pathKey(values));
          return <button key={pathKey(values)} type="button" onClick={() => { setActive(path); if (multiple) emit(checked ? selectedPaths.filter((item) => pathKey(item) !== pathKey(values)) : [...selectedPaths, values]); else { emit(values); setOpen(false); } }}>
            {multiple ? <Checkbox checked={checked} tabIndex={-1} /> : null}<span>{path.map((item) => optionLabel(item, fields)).join(" / ")}</span>
          </button>;
        })}
        {!searchPaths.length ? <div className="sia-cascader__empty">暂无匹配选项</div> : null}
      </div> : <div className="sia-cascader__menus">
        {columns.map((column, depth) => <div className="sia-cascader__menu" role="listbox" key={depth}>
          {column.map((option) => {
            const nextPath = [...active.slice(0, depth), option];
            const values = nextPath.map((item) => optionValue(item, fields));
            const children = optionChildren(option, fields);
            const selected = active[depth] === option;
            const checked = selectedKeys.has(pathKey(values));
            const loading = loadingKey === pathKey(values);
            return <button type="button" role="option" aria-selected={selected} disabled={option.disabled} className={selected ? "is-active" : ""} key={optionValue(option, fields)}
              onMouseEnter={expandTrigger === "hover" ? () => void activate(option, depth) : undefined}
              onClick={() => void activate(option, depth)}>
              {multiple && !children?.length ? <Checkbox checked={checked} tabIndex={-1} /> : null}
              <span>{optionLabel(option, fields)}</span>
              {loading ? <Icon name="loader" className="sia-spin-icon" size={14} /> : children?.length || option.isLeaf === false ? <Icon name="chevron-right" size={13} /> : null}
            </button>;
          })}
        </div>)}
      </div>}
    </PopupPortal>
  </div>;
}

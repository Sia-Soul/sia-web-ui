import { withTitleTooltip } from "./titleTooltip";
import { useFloatingPlaceholder } from "./FloatingPlaceholder";
import type { ControlSize, InputPlaceholderMode } from "./shared";
import { useControlSize } from "./shared";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Checkbox } from "./Checkbox";
import { Icon } from "./Icon";
import { PopupPortal } from "./PopupPortal";
import { useControllableState } from "./shared";

/** 级联选择的值类型。 */
export type CascaderValue = string | number;
/** 级联选择的候选项定义。 */
export interface CascaderOption {
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: CascaderValue;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: ReactNode;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 是否为叶子节点；异步加载场景可用于标识无子项节点。 */
  isLeaf?: boolean;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: readonly CascaderOption[];
  [key: string]: unknown;
}
/** 级联数据中 label、value 和 children 的字段映射。 */
export interface CascaderFieldNames {
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: string;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value?: string;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: string }
/** 级联选择的属性配置。 */
export interface CascaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先 */
  size?: ControlSize;
  /** 级联选项树 */
  options: readonly CascaderOption[];
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: readonly CascaderValue[] | readonly (readonly CascaderValue[])[];
  /** 非受控模式的初始值，仅在初始化时使用。 */
  defaultValue?: readonly CascaderValue[] | readonly (readonly CascaderValue[])[];
  /**
   是否允许同时选择多个项目。
   * @defaultValue false
   */
  multiple?: boolean;
  /**
   是否显示搜索输入框。
   * @defaultValue false
   */
  showSearch?: boolean;
  /**
   * 是否允许清空当前选择或输入值；默认启用，显式传入 false 可关闭。
   * @defaultValue true
   */
  allowClear?: boolean;
  /**
   * 是否在选中任意层级节点时立即提交值。
   * @defaultValue false
   */
  changeOnSelect?: boolean;
  /**
   * 子级面板的展开方式。
   * @defaultValue "click"
   */
  expandTrigger?: "click" | "hover";
  /**
   * 未填写或未选择时的提示内容。
   * @defaultValue "请选择"
   */
  placeholder?: ReactNode;
  /** 占位提示的显示模式；floating 为浮动标签。 */
  placeholderMode?: InputPlaceholderMode;
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /** 数据字段名映射，用于适配业务数据结构。 */
  fieldNames?: CascaderFieldNames;
  /** 自定义已选结果的显示内容。 */
  displayRender?: (labels: ReactNode[], selectedOptions: CascaderOption[]) => ReactNode;
  /** 按当前节点异步加载子节点的函数。 */
  loadData?: (selectedOptions: CascaderOption[]) => void | Promise<void>;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
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

/** 级联选择组件。 */
export function Cascader({
  options, value, defaultValue, size: sizeProp, multiple = false, showSearch = false, allowClear = true, changeOnSelect = false,
  expandTrigger = "click", placeholder = "请选择", placeholderMode, disabled = false, fieldNames, displayRender, loadData, onChange, className = "", ...props
}: CascaderProps) {
  const size = useControlSize(sizeProp);
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
    ? (Array.isArray(current) ? current as readonly (readonly CascaderValue[])[] : [])
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

  const floating = useFloatingPlaceholder({ mode: placeholderMode, placeholder, filled: selectedPaths.length > 0, active: open });
  return <div ref={rootRef} className={`sia-cascader sia-cascader--${size}${open ? " is-open" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()} {...withTitleTooltip(props)}>
    <button type="button" className={`sia-cascader__trigger${floating.className}`} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={toggleOpen}>
      <span className="sia-cascader__value">{display
        ? multiple && Array.isArray(display) ? display.map((label, index) => <span className="sia-cascader__tag" key={pathKey(selectedPaths[index] ?? [])}>{label}</span>) : display
        : <span className="sia-cascader__placeholder">{placeholder}</span>}</span>
      {allowClear && selectedPaths.length ? <span className="sia-cascader__clear" role="button" aria-label="清除选择" onClick={(event) => { event.stopPropagation(); clearSelection(); }}><Icon name="circle-close" variant="filled" size={15} /></span> : null}
      {floating.label}
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

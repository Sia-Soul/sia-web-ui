import { useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Checkbox } from "./Checkbox";
import { Icon } from "./Icon";
import { PopupPortal } from "./PopupPortal";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";

export type TreeSelectValue = string | number;

export interface TreeSelectNode {
  title: ReactNode;
  value: TreeSelectValue;
  key?: string | number;
  disabled?: boolean;
  selectable?: boolean;
  children?: readonly TreeSelectNode[];
}

export interface TreeSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  treeData: readonly TreeSelectNode[];
  value?: TreeSelectValue | readonly TreeSelectValue[];
  defaultValue?: TreeSelectValue | readonly TreeSelectValue[];
  multiple?: boolean;
  treeCheckable?: boolean;
  showSearch?: boolean;
  allowClear?: boolean;
  treeDefaultExpandAll?: boolean;
  placeholder?: ReactNode;
  searchPlaceholder?: string;
  maxTagCount?: number;
  disabled?: boolean;
  size?: ControlSize;
  status?: ControlStatus;
  onChange?: (value: TreeSelectValue | readonly TreeSelectValue[] | undefined, nodes: readonly TreeSelectNode[]) => void;
  onSearch?: (value: string) => void;
  onDropdownVisibleChange?: (open: boolean) => void;
}

type FlatTreeNode = TreeSelectNode & { depth: number; parentValues: readonly TreeSelectValue[] };

function flattenTree(nodes: readonly TreeSelectNode[], expanded: ReadonlySet<TreeSelectValue>, search: string, depth = 0, parents: readonly TreeSelectValue[] = []): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];
  for (const node of nodes) {
    const matches = !search || String(node.title).toLowerCase().includes(search.toLowerCase());
    const childMatches = search && node.children ? flattenTree(node.children, new Set(node.children.map((child) => child.value)), search, depth + 1, [...parents, node.value]) : [];
    if (matches || childMatches.length) result.push({ ...node, depth, parentValues: parents });
    if (node.children && (expanded.has(node.value) || search)) {
      result.push(...(search ? childMatches : flattenTree(node.children, expanded, search, depth + 1, [...parents, node.value])));
    }
  }
  return result;
}

function findNodes(nodes: readonly TreeSelectNode[], values: readonly TreeSelectValue[], result: TreeSelectNode[] = []) {
  for (const node of nodes) {
    if (values.includes(node.value)) result.push(node);
    if (node.children) findNodes(node.children, values, result);
  }
  return result;
}

export function TreeSelect({
  treeData,
  value,
  defaultValue,
  multiple = false,
  treeCheckable = false,
  showSearch = false,
  allowClear = false,
  treeDefaultExpandAll = false,
  placeholder = "请选择",
  searchPlaceholder = "搜索节点",
  maxTagCount = 3,
  disabled = false,
  size = "medium",
  status = "default",
  className = "",
  onChange,
  onSearch,
  onDropdownVisibleChange,
  ...props
}: TreeSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const multi = multiple || treeCheckable;
  const initial = defaultValue ?? (multi ? [] : undefined);
  const [currentValue, setCurrentValue] = useControllableState<TreeSelectValue | readonly TreeSelectValue[] | undefined>({
    value,
    defaultValue: initial,
    onChange: (next) => onChange?.(next, findNodes(treeData, Array.isArray(next) ? [...next] : next === undefined ? [] : [next])),
  });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<TreeSelectValue>>(() => {
    if (!treeDefaultExpandAll) return new Set();
    const values: TreeSelectValue[] = [];
    const collect = (nodes: readonly TreeSelectNode[]) => nodes.forEach((node) => { if (node.children?.length) { values.push(node.value); collect(node.children); } });
    collect(treeData);
    return new Set(values);
  });
  const selectedValues = Array.isArray(currentValue) ? [...currentValue] : currentValue === undefined ? [] : [currentValue];
  const selectedNodes = useMemo(() => findNodes(treeData, selectedValues), [treeData, selectedValues.join("|")]);
  const visibleNodes = useMemo(() => flattenTree(treeData, expanded, search), [expanded, search, treeData]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
        onDropdownVisibleChange?.(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [onDropdownVisibleChange, open]);

  function changeOpen(next: boolean) {
    setOpen(next);
    onDropdownVisibleChange?.(next);
  }

  function select(node: TreeSelectNode) {
    if (node.disabled || node.selectable === false) return;
    if (multi) {
      const next = selectedValues.includes(node.value) ? selectedValues.filter((item) => item !== node.value) : [...selectedValues, node.value];
      setCurrentValue(next);
    } else {
      setCurrentValue(node.value);
      changeOpen(false);
    }
  }

  return <div ref={rootRef} className={`sia-tree-select sia-tree-select--${size} sia-tree-select--${status}${open ? " is-open" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()} {...props}>
    <button
      type="button"
      className="sia-tree-select__trigger"
      disabled={disabled}
      aria-haspopup="tree"
      aria-expanded={open}
      onClick={() => changeOpen(!open)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") changeOpen(true);
        if (event.key === "Escape") changeOpen(false);
      }}
    >
      <span className="sia-tree-select__value">
        {selectedNodes.length ? (multi ? <>
          {selectedNodes.slice(0, maxTagCount).map((node) => <span className="sia-tree-select__tag" key={node.value}>{node.title}</span>)}
          {selectedNodes.length > maxTagCount ? <span className="sia-tree-select__tag">+{selectedNodes.length - maxTagCount}</span> : null}
        </> : selectedNodes[0]?.title) : <span className="sia-tree-select__placeholder">{placeholder}</span>}
      </span>
      {allowClear && selectedValues.length && !disabled ? <span role="button" tabIndex={-1} className="sia-tree-select__clear" aria-label="清除选择" onClick={(event) => { event.stopPropagation(); setCurrentValue(multi ? [] : undefined); }}><Icon name="circle-close" variant="filled" size={15} /></span> : null}
      <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
    </button>
    <PopupPortal ref={popupRef} anchorRef={rootRef} open={open} className="sia-tree-select__dropdown">
      {showSearch ? <label className="sia-tree-select__search"><Icon name="search" size={15} /><input value={search} placeholder={searchPlaceholder} onChange={(event) => { setSearch(event.currentTarget.value); onSearch?.(event.currentTarget.value); }} /></label> : null}
      <div className="sia-tree-select__tree" role="tree" aria-multiselectable={multi || undefined}>
        {visibleNodes.length ? visibleNodes.map((node) => {
          const hasChildren = Boolean(node.children?.length);
          const selected = selectedValues.includes(node.value);
          return <div
            className={`sia-tree-select__node${selected ? " is-selected" : ""}${node.disabled ? " is-disabled" : ""}`}
            style={{ paddingInlineStart: 8 + node.depth * 20 }}
            role="treeitem"
            aria-selected={selected}
            aria-expanded={hasChildren ? expanded.has(node.value) : undefined}
            key={node.key ?? node.value}
          >
            {hasChildren ? <button type="button" className="sia-tree-select__expand" aria-label={expanded.has(node.value) ? "收起节点" : "展开节点"} onClick={() => setExpanded((current) => {
              const next = new Set(current);
              if (next.has(node.value)) next.delete(node.value); else next.add(node.value);
              return next;
            })}><Icon name={expanded.has(node.value) ? "chevron-down" : "chevron-right"} size={13} /></button> : <span className="sia-tree-select__indent" />}
            {treeCheckable ? <Checkbox checked={selected} disabled={node.disabled} onChange={() => select(node)} /> : null}
            <button type="button" className="sia-tree-select__title" disabled={node.disabled} onClick={() => select(node)}>{node.title}</button>
          </div>;
        }) : <div className="sia-tree-select__empty">暂无匹配节点</div>}
      </div>
    </PopupPortal>
  </div>;
}

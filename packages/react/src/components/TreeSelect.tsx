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
  disableCheckbox?: boolean;
  checkable?: boolean;
  children?: readonly TreeSelectNode[];
}

export interface TreeSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange" | "onSelect"> {
  treeData: readonly TreeSelectNode[];
  value?: TreeSelectValue | readonly TreeSelectValue[] | null;
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
  open?: boolean;
  defaultOpen?: boolean;
  searchValue?: string;
  treeExpandedKeys?: readonly TreeSelectValue[];
  treeDefaultExpandedKeys?: readonly TreeSelectValue[];
  onTreeExpand?: (keys: TreeSelectValue[]) => void;
  filterTreeNode?: false | ((search: string, node: TreeSelectNode) => boolean);
  /** 默认独立勾选；关闭后父子节点联动，禁用节点作为边界。 */
  treeCheckStrictly?: boolean;
  showCheckedStrategy?: "all" | "parent" | "child";
  loading?: boolean;
  listHeight?: number;
  popupClassName?: string;
  popupStyle?: React.CSSProperties;
  dropdownFooter?: ReactNode;
  displayRender?: (nodes: readonly TreeSelectNode[]) => ReactNode;
  renderTrigger?: (state: { open: boolean; toggle: () => void; clear: () => void }) => ReactNode;
  onClear?: () => void;
  onSelect?: (value: TreeSelectValue, node: TreeSelectNode) => void;
  onDeselect?: (value: TreeSelectValue, node: TreeSelectNode) => void;
  onChange?: (value: TreeSelectValue | readonly TreeSelectValue[] | undefined, nodes: readonly TreeSelectNode[]) => void;
  onSearch?: (value: string) => void;
  onDropdownVisibleChange?: (open: boolean) => void;
}

type FlatTreeNode = TreeSelectNode & { depth: number; parentValues: readonly TreeSelectValue[] };

function flattenTree(nodes: readonly TreeSelectNode[], expanded: ReadonlySet<TreeSelectValue>, search: string, filter: TreeSelectProps["filterTreeNode"], depth = 0, parents: readonly TreeSelectValue[] = [], ancestorMatched = false): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];
  for (const node of nodes) {
    const matches = !search || ancestorMatched || filter === false || (filter ? filter(search, node) : String(node.title).toLowerCase().includes(search.toLowerCase()));
    const childMatches = search && node.children ? flattenTree(node.children, expanded, search, filter, depth + 1, [...parents, node.value], matches) : [];
    if (matches || childMatches.length) result.push({ ...node, depth, parentValues: parents });
    if (node.children && (expanded.has(node.key ?? node.value) || search)) {
      result.push(...(search ? childMatches : flattenTree(node.children, expanded, search, filter, depth + 1, [...parents, node.value])));
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
  open: controlledOpen, defaultOpen = false, searchValue,
  treeExpandedKeys, treeDefaultExpandedKeys = [], onTreeExpand,
  filterTreeNode, treeCheckStrictly = true, showCheckedStrategy = "all",
  loading = false, listHeight = 300, popupClassName = "", popupStyle,
  dropdownFooter, displayRender, renderTrigger, onClear, onSelect, onDeselect,
  ...props
}: TreeSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const nodeIndex = useMemo(() => {
    const index = new Map<TreeSelectValue, TreeSelectNode>();
    const visit = (nodes: readonly TreeSelectNode[]) => nodes.forEach(node => { index.set(node.value, node); if (node.children) visit(node.children); });
    visit(treeData);
    return index;
  }, [treeData]);
  const resolveNodes = (values: readonly TreeSelectValue[]) => values.map(value => nodeIndex.get(value) ?? { value, title: String(value) });
  const multi = multiple || treeCheckable;
  const initial = defaultValue ?? (multi ? [] : undefined);
  const [currentValue, setCurrentValue] = useControllableState<TreeSelectValue | readonly TreeSelectValue[] | undefined>({
    value: value === null ? [] : value,
    defaultValue: initial,
    onChange: (next) => onChange?.(next, resolveNodes(Array.isArray(next) ? [...next] : next === undefined ? [] : [next])),
  });
  const [open, setOpen] = useControllableState({ value: controlledOpen, defaultValue: defaultOpen, onChange: onDropdownVisibleChange });
  const [search, setSearch] = useControllableState({ value: searchValue, defaultValue: "", onChange: onSearch });
  const [expanded, setExpanded] = useState<Set<TreeSelectValue>>(() => {
    if (!treeDefaultExpandAll) return new Set(treeDefaultExpandedKeys);
    const values: TreeSelectValue[] = [];
    const collect = (nodes: readonly TreeSelectNode[]) => nodes.forEach((node) => { if (node.children?.length) { values.push(node.key ?? node.value); collect(node.children); } });
    collect(treeData);
    return new Set(values);
  });
  const selectedValues = Array.isArray(currentValue) ? [...currentValue] : currentValue === undefined ? [] : [currentValue];
  const expandedSet = treeExpandedKeys ? new Set(treeExpandedKeys) : expanded;
  const selectedNodes = resolveNodes(selectedValues);
  const visibleNodes = flattenTree(treeData, expandedSet, search, filterTreeNode);

  useEffect(() => {
    if (!open || treeExpandedKeys) return;
    const keys = new Set(expanded);
    const walk = (nodes: readonly TreeSelectNode[], parents: TreeSelectValue[]) => nodes.forEach(node => {
      if (selectedValues.includes(node.value)) parents.forEach(key => keys.add(key));
      if (node.children) walk(node.children, [...parents, node.key ?? node.value]);
    });
    walk(treeData, []);
    if (keys.size !== expanded.size) setExpanded(keys);
    const frame = requestAnimationFrame(() => popupRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [open, treeData, currentValue, treeExpandedKeys]);

  function toggleNode(node: TreeSelectNode) {
    const key = node.key ?? node.value;
    const next = new Set(expandedSet);
    if (next.has(key)) next.delete(key); else next.add(key);
    if (!treeExpandedKeys) setExpanded(next);
    onTreeExpand?.([...next]);
  }

  const cascade = treeCheckable && !treeCheckStrictly;
  function checkState(values: readonly TreeSelectValue[]) {
    const checked = new Set(values);
    const affected = (node: TreeSelectNode): TreeSelectValue[] => node.disabled || node.disableCheckbox ? [] : [
      ...(node.checkable === false ? [] : [node.value]), ...(node.children?.flatMap(affected) ?? []),
    ];
    if (cascade) {
      findNodes(treeData, values).forEach(node => affected(node).forEach(value => checked.add(value)));
      const fold = (nodes: readonly TreeSelectNode[]) => nodes.forEach(node => {
        if (node.disabled || node.disableCheckbox) return;
        if (node.children) fold(node.children);
        const children = node.children?.filter(child => !child.disabled && !child.disableCheckbox && child.checkable !== false) ?? [];
        if (children.length && node.checkable !== false) {
          if (children.every(child => checked.has(child.value))) checked.add(node.value);
          else checked.delete(node.value);
        }
      });
      fold(treeData);
    }
    return { checked, affected };
  }
  const { checked, affected } = checkState(selectedValues);
  function outputValues(values: Set<TreeSelectValue>) {
    if (!cascade || showCheckedStrategy === "all") return [...values];
    const output: TreeSelectValue[] = [...values].filter(value => !nodeIndex.has(value));
    const walk = (nodes: readonly TreeSelectNode[], parentChecked = false) => nodes.forEach(node => {
      const selected = values.has(node.value);
      const enabledChildren = node.children?.filter(child => !child.disabled && !child.disableCheckbox) ?? [];
      if (selected && (showCheckedStrategy === "parent" ? !parentChecked : !enabledChildren.length)) output.push(node.value);
      if (node.children) walk(node.children, selected && !node.disabled && !node.disableCheckbox);
    });
    walk(treeData);
    return output;
  }
  function clear() {
    if (disabled || loading) return;
    setCurrentValue(multi ? [] : undefined);
    onClear?.();
  }

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [onDropdownVisibleChange, open]);

  function changeOpen(next: boolean) {
    if (disabled) return;
    setOpen(next);
    if (!next) setSearch("");
  }

  function select(node: TreeSelectNode) {
    if (disabled || loading || node.disabled) return;
    if (treeCheckable ? node.disableCheckbox || node.checkable === false : node.selectable === false) {
      if (node.children?.length) toggleNode(node);
      return;
    }
    if (multi) {
      const exists = checked.has(node.value);
      const next = new Set(checked);
      (cascade ? affected(node) : [node.value]).forEach(value => { if (exists) next.delete(value); else next.add(value); });
      // 删除祖先的显式状态，重新由子节点计算，避免取消子项时被祖先再次全选。
      if (cascade && exists) {
        const removeParents = (nodes: readonly TreeSelectNode[]): boolean => {
          let found = false;
          nodes.forEach(item => { const childFound = item.children ? removeParents(item.children) : false; if (childFound) next.delete(item.value); if (item.value === node.value || childFound) found = true; });
          return found;
        };
        removeParents(treeData);
      }
      setCurrentValue(outputValues(checkState([...next]).checked));
      if (exists) onDeselect?.(node.value, node); else onSelect?.(node.value, node);
    } else {
      setCurrentValue(node.value);
      onSelect?.(node.value, node);
      changeOpen(false);
    }
  }

  return <div ref={rootRef} className={`sia-tree-select sia-tree-select--${size} sia-tree-select--${status}${open ? " is-open" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()} {...props}
    onKeyDown={event => { props.onKeyDown?.(event); if (event.key === "Escape") { event.stopPropagation(); changeOpen(false); } }}>
    {renderTrigger ? renderTrigger({ open, toggle: () => changeOpen(!open), clear }) : <>
    <button
      type="button"
      className="sia-tree-select__trigger"
      disabled={disabled}
      aria-haspopup="tree"
      aria-expanded={open}
      aria-label={props["aria-label"]}
      onClick={() => changeOpen(!open)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); changeOpen(true); }
        if (event.key === "Escape") changeOpen(false);
      }}
    >
      <span className="sia-tree-select__value">
        {selectedNodes.length ? (displayRender ? displayRender(selectedNodes) : multi ? <>
          {selectedNodes.slice(0, maxTagCount).map((node) => <span className="sia-tree-select__tag" key={node.value}>{node.title}</span>)}
          {selectedNodes.length > maxTagCount ? <span className="sia-tree-select__tag">+{selectedNodes.length - maxTagCount}</span> : null}
        </> : selectedNodes[0]?.title) : <span className="sia-tree-select__placeholder">{placeholder}</span>}
      </span>
      <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
    </button>
    {allowClear && selectedValues.length > 0 && !disabled ? <button type="button" className="sia-tree-select__clear" aria-label="清除选择" onClick={clear}><Icon name="circle-close" variant="filled" size={15} /></button> : null}
    </>}
    <PopupPortal ref={popupRef} anchorRef={rootRef} open={open && !disabled} className={`sia-tree-select__dropdown ${popupClassName}`} style={popupStyle}>
      {showSearch ? <label className="sia-tree-select__search"><Icon name="search" size={15} /><input aria-label={searchPlaceholder} autoFocus value={search} placeholder={searchPlaceholder} onChange={(event) => setSearch(event.currentTarget.value)} /></label> : null}
      <div className="sia-tree-select__tree" role="tree" aria-multiselectable={multi || undefined} style={{ maxHeight: listHeight }}>
        {loading ? <div role="status" className="sia-tree-select__empty">加载中…</div> : visibleNodes.length ? visibleNodes.map((node) => {
          const hasChildren = Boolean(node.children?.length);
          const selected = checked.has(node.value);
          const partial = cascade && !selected && affected(node).some(value => checked.has(value));
          return <div
            className={`sia-tree-select__node${selected ? " is-selected" : ""}${node.disabled ? " is-disabled" : ""}`}
            style={{ paddingInlineStart: 8 + node.depth * 20 }}
            role="treeitem"
            aria-level={node.depth + 1}
            aria-disabled={node.disabled || undefined}
            aria-selected={selected}
            aria-expanded={hasChildren ? !!search || expandedSet.has(node.key ?? node.value) : undefined}
            aria-checked={treeCheckable ? partial ? "mixed" : selected : undefined}
            key={node.key ?? node.value}
          >
            {hasChildren ? <button type="button" className="sia-tree-select__expand" aria-label={expandedSet.has(node.key ?? node.value) ? "收起节点" : "展开节点"} disabled={node.disabled} onClick={() => toggleNode(node)}><Icon name={expandedSet.has(node.key ?? node.value) ? "chevron-down" : "chevron-right"} size={13} /></button> : <span className="sia-tree-select__indent" />}
            {treeCheckable && node.checkable !== false ? <Checkbox aria-label={typeof node.title === "string" ? node.title : undefined} checked={selected} indeterminate={partial} disabled={node.disabled || node.disableCheckbox} onChange={() => select(node)} /> : null}
            <button type="button" className="sia-tree-select__title" disabled={node.disabled} onClick={() => select(node)}>{node.title}</button>
          </div>;
        }) : <div className="sia-tree-select__empty">暂无匹配节点</div>}
      </div>
      {dropdownFooter}
    </PopupPortal>
  </div>;
}

import { useControlSize } from "./shared";
import { useFloatingPlaceholder } from "./FloatingPlaceholder";
import type { InputPlaceholderMode } from "./shared";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Checkbox } from "./Checkbox";
import { OverflowTags } from "./OverflowTags";
import { Icon } from "./Icon";
import { PopupPortal } from "./PopupPortal";
import type { ControlSize, ControlStatus } from "./shared";
import { useControllableState } from "./shared";

/** 树选择的值类型。 */
export type TreeSelectValue = string | number;

/** 树选择器的节点，包含值、标签、子节点和禁用状态。 */
export interface TreeSelectNode {
  /** 标题内容，可传入文本或 React 节点。 */
  title: ReactNode;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: TreeSelectValue;
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key?: string | number;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 是否允许选中项目。 */
  selectable?: boolean;
  /** 是否仅禁用该节点的勾选框。 */
  disableCheckbox?: boolean;
  /** 是否显示勾选框或允许勾选。 */
  checkable?: boolean;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: readonly TreeSelectNode[];
}

/** 树选择的属性配置。 */
export interface TreeSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange" | "onSelect"> {
  /** 树形节点数据 */
  treeData: readonly TreeSelectNode[];
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: TreeSelectValue | readonly TreeSelectValue[] | null;
  /** 非受控模式的初始值，仅在初始化时使用。 */
  defaultValue?: TreeSelectValue | readonly TreeSelectValue[];
  /**
   是否允许同时选择多个项目。
   * @defaultValue false
   */
  multiple?: boolean;
  /**
   * 是否显示树节点复选框。
   * @defaultValue false
   */
  treeCheckable?: boolean;
  /**
   是否显示搜索输入框。
   * @defaultValue false
   */
  showSearch?: boolean;
  /**
   是否允许清空当前选择或输入值。
   * @defaultValue false
   */
  allowClear?: boolean;
  /**
   * 默认展开全部节点
   * @defaultValue false
   */
  treeDefaultExpandAll?: boolean;
  /**
   * 未填写或未选择时的提示内容。
   * @defaultValue "请选择"
   */
  placeholder?: ReactNode;
  /** 占位提示的显示模式；floating 为浮动标签。 */
  placeholderMode?: InputPlaceholderMode;
  /**
   * 搜索框的占位提示文字。
   * @defaultValue "搜索节点"
   */
  searchPlaceholder?: string;
  /** 最多显示的标签数；空间不足时会继续折叠，并为 +N 预留宽度。 */
  maxTagCount?: number;
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /**
   * 当前状态，用于选择对应的状态样式。
   * @defaultValue "default"
   */
  status?: ControlStatus;
  /** 是否打开；传入后由外部控制显示状态。 */
  open?: boolean;
  /**
   * 非受控模式下的初始打开状态。
   * @defaultValue false
   */
  defaultOpen?: boolean;
  /** 受控的搜索文本。 */
  searchValue?: string;
  /** 受控的树节点展开标识集合。 */
  treeExpandedKeys?: readonly TreeSelectValue[];
  /**
   * 初始展开的树节点标识集合。
   * @defaultValue []
   */
  treeDefaultExpandedKeys?: readonly TreeSelectValue[];
  /** 树节点展开状态改变时调用。 */
  onTreeExpand?: (keys: TreeSelectValue[]) => void;
  /** 自定义树节点的搜索匹配规则。 */
  filterTreeNode?: false | ((search: string, node: TreeSelectNode) => boolean);
  /** 默认独立勾选；关闭后父子节点联动，禁用节点作为边界。 */
  treeCheckStrictly?: boolean;
  /**
   * 勾选结果的展示策略，控制父子节点如何显示。
   * @defaultValue "all"
   */
  showCheckedStrategy?: "all" | "parent" | "child";
  /**
   * 是否处于加载状态。
   * @defaultValue false
   */
  loading?: boolean;
  /**
   * 选项列表的最大可视高度，单位为像素。
   * @defaultValue 300
   */
  listHeight?: number;
  /**
   * 弹出面板的附加 CSS 类名。
   * @defaultValue ""
   */
  popupClassName?: string;
  /** 弹出面板的内联样式。 */
  popupStyle?: React.CSSProperties;
  /** 下拉面板底部扩展内容。 */
  dropdownFooter?: ReactNode;
  /** 自定义已选结果的显示内容。 */
  displayRender?: (nodes: readonly TreeSelectNode[]) => ReactNode;
  /** 自定义触发控件的渲染函数。 */
  renderTrigger?: (state: {
  /** 是否打开；传入后由外部控制显示状态。 */
  open: boolean;
  /** 切换当前打开或选中状态。 */
  toggle: () => void;
  /** 清空当前值或内容。 */
  clear: () => void }) => ReactNode;
  /** 清空当前值时调用。 */
  onClear?: () => void;
  /** 选中项目时调用，参数包含选中项目及关联状态。 */
  onSelect?: (value: TreeSelectValue, node: TreeSelectNode) => void;
  /** 取消选中项目时调用。 */
  onDeselect?: (value: TreeSelectValue, node: TreeSelectNode) => void;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (value: TreeSelectValue | readonly TreeSelectValue[] | undefined, nodes: readonly TreeSelectNode[]) => void;
  /** 搜索条件变化或提交搜索时调用，具体参数见签名。 */
  onSearch?: (value: string) => void;
  /** 下拉面板显示状态变化时调用。 */
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

/** 树选择组件。 */
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
  placeholderMode,
  searchPlaceholder = "搜索节点",
  maxTagCount = 3,
  disabled = false,
  size: sizeProp,
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
  const size = useControlSize(sizeProp);
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
  const selectedValues = Array.isArray(currentValue) ? [...currentValue] : (currentValue === undefined || currentValue === "" && !nodeIndex.has("")) ? [] : [currentValue];
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

  const floating = useFloatingPlaceholder({ mode: placeholderMode, placeholder, filled: selectedNodes.length > 0, active: open });
  return <div ref={rootRef} className={`sia-tree-select sia-tree-select--${size} sia-tree-select--${status}${open ? " is-open" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()} {...props}
    onKeyDown={event => { props.onKeyDown?.(event); if (event.key === "Escape") { event.stopPropagation(); changeOpen(false); } }}>
    {renderTrigger ? renderTrigger({ open, toggle: () => changeOpen(!open), clear }) : <>
    <button
      type="button"
      className={`sia-tree-select__trigger${floating.className}`}
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
        {selectedNodes.length ? (displayRender ? displayRender(selectedNodes) : multi ? <OverflowTags tagClassName="sia-tree-select__tag" maxCount={maxTagCount} items={selectedNodes.map(node => ({ key: node.value, label: node.title }))} /> : selectedNodes[0]?.title) : <span className="sia-tree-select__placeholder">{placeholder}</span>}
      </span>
      {floating.label}
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

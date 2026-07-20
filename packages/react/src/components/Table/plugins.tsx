import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../Button";
import { Drawer } from "../Drawer";
import { Icon } from "../Icon";
import { Input } from "../Input";
import { InputNumber } from "../InputNumber";
import { DEFAULT_PAGE_SIZE_OPTIONS, Pagination } from "../Pagination";
import { Select } from "../Select";
import type {
  TableColumn,
  TableColumnSettingItem,
  TableEditableCellConfig,
  TableFixed,
  TableKey,
  TablePageParams,
  TablePlugin,
  TablePluginContext,
  TableRow,
  TableSettingsAdapter,
  TableSettingsSnapshot,
  TableSortInfo,
  TableSummaryRow,
} from "./types";
import { flattenTableColumns, getColumnLabel, getTableValue, mapTableLeafColumns, normalizeFixed, toTablePageParams } from "./utils";

function TableCheckbox({ checked, indeterminate, disabled, label, onChange }: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = Boolean(indeterminate); }, [indeterminate]);
  return <input ref={ref} className="sia-table__checkbox" type="checkbox" aria-label={label} checked={checked} disabled={disabled} onClick={(event) => event.stopPropagation()} onChange={(event) => onChange(event.target.checked)} />;
}

function flattenRecords<T extends Record<string, unknown>>(data: readonly T[], childrenColumnName: string): T[] {
  const result: T[] = [];
  const walk = (records: readonly T[]) => {
    for (const record of records) {
      result.push(record);
      const children = record[childrenColumnName];
      if (Array.isArray(children)) walk(children as T[]);
    }
  };
  walk(data);
  return result;
}

// Selection plugin
export type TableSelectionMode = "single" | "multiple" | "row";
export interface TableSelectionPluginOptions<T> {
  mode?: TableSelectionMode;
  selectedKeys?: readonly TableKey[];
  defaultSelectedKeys?: readonly TableKey[];
  onChange?: (keys: readonly TableKey[], rows: readonly T[]) => void;
  getCheckboxDisabled?: (record: T) => boolean;
  showSelectedCount?: boolean;
  childrenColumnName?: string;
}
interface SelectionState { selectedKeys: readonly TableKey[]; }
export interface TableSelectionApi<T> {
  getSelectedKeys: () => readonly TableKey[];
  setSelectedKeys: (keys: readonly TableKey[]) => void;
  clear: () => void;
  getSelectedRows: () => readonly T[];
}

export function createSelectionPlugin<T extends Record<string, unknown>>(options: TableSelectionPluginOptions<T> = {}): TablePlugin<T, SelectionState, TableSelectionApi<T>> {
  const { mode = "multiple", childrenColumnName = "children" } = options;
  function selected(context: TablePluginContext<T, SelectionState>) { return options.selectedKeys ?? context.state.selectedKeys ?? []; }
  function allRecords(context: TablePluginContext<T, SelectionState>) { return flattenRecords(context.sourceData, childrenColumnName); }
  function rowsForKeys(keys: readonly TableKey[], context: TablePluginContext<T, SelectionState>) {
    return allRecords(context).filter((record, index) => keys.includes(context.getRowKey(record, index)));
  }
  function setKeys(keys: readonly TableKey[], context: TablePluginContext<T, SelectionState>) {
    context.setState({ selectedKeys: keys });
    options.onChange?.(keys, rowsForKeys(keys, context));
  }
  function toggle(key: TableKey, record: T, context: TablePluginContext<T, SelectionState>, checked?: boolean) {
    if (options.getCheckboxDisabled?.(record)) return;
    const keys = selected(context);
    if (mode === "single" || mode === "row") return setKeys(keys.includes(key) ? [] : [key], context);
    const nextChecked = checked ?? !keys.includes(key);
    setKeys(nextChecked ? [...new Set([...keys, key])] : keys.filter((item) => item !== key), context);
  }
  return {
    id: "selection",
    order: 20,
    initialState: { selectedKeys: options.defaultSelectedKeys ?? [] },
    transformColumns(columns, context) {
      if (mode === "row") return columns;
      const selectionColumn: TableColumn<T> = {
        key: "__selection__",
        name: "选择",
        title: "",
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        fixed: "left",
        align: "center",
        ellipsis: false,
        meta: { plugin: "selection" },
        renderHeader: () => {
          if (mode !== "multiple") return null;
          const enabledRows = context.rows.filter((row) => !options.getCheckboxDisabled?.(row.record));
          const keys = selected(context);
          const allChecked = enabledRows.length > 0 && enabledRows.every((row) => keys.includes(row.key));
          const someChecked = enabledRows.some((row) => keys.includes(row.key));
          return <TableCheckbox label="选择当前页全部行" checked={allChecked} indeterminate={!allChecked && someChecked} onChange={(checked) => {
            const pageKeys = enabledRows.map((row) => row.key);
            setKeys(checked ? [...new Set([...keys, ...pageKeys])] : keys.filter((key) => !pageKeys.includes(key)), context);
          }} />;
        },
        render: (_value, record, _index, info) => mode === "single"
          ? <input className="sia-table__checkbox" type="radio" aria-label={`选择第 ${info.rowIndex + 1} 行`} checked={selected(context).includes(info.row.key)} disabled={options.getCheckboxDisabled?.(record)} onClick={(event) => event.stopPropagation()} onChange={() => toggle(info.row.key, record, context)} />
          : <TableCheckbox label={`选择第 ${info.rowIndex + 1} 行`} checked={selected(context).includes(info.row.key)} disabled={options.getCheckboxDisabled?.(record)} onChange={(checked) => toggle(info.row.key, record, context, checked)} />,
      };
      return [selectionColumn, ...columns];
    },
    onRowClick(row, context) { if (mode === "row") toggle(row.key, row.record, context); },
    getRowClassName(row, context) { return selected(context).includes(row.key) ? "sia-table__row--selected" : ""; },
    renderFooter(context) { return options.showSelectedCount && selected(context).length > 0 ? <span className="sia-table__selected-count">已选 {selected(context).length} 条</span> : null; },
    getApi(context) {
      return {
        getSelectedKeys: () => selected(context),
        setSelectedKeys: (keys) => setKeys(keys, context),
        clear: () => setKeys([], context),
        getSelectedRows: () => rowsForKeys(selected(context), context),
      };
    },
  };
}

// Sort plugin
export interface TableSortPluginOptions {
  mode?: "local" | "remote";
  value?: TableSortInfo | null;
  defaultValue?: TableSortInfo | null;
  onChange?: (sort: TableSortInfo) => void;
  compare?: (a: unknown, b: unknown, field: string) => number;
}
interface SortState { sort: TableSortInfo | null; }
export interface TableSortApi { getSortInfo: () => TableSortInfo | null; setSortInfo: (sort: TableSortInfo | null) => void; clear: () => void; }

export function createSortPlugin<T extends Record<string, unknown>>(options: TableSortPluginOptions = {}): TablePlugin<T, SortState, TableSortApi> {
  const mode = options.mode ?? "local";
  const current = (context: TablePluginContext<T, SortState>) => options.value === undefined ? context.state.sort : options.value;
  const update = (sort: TableSortInfo | null, context: TablePluginContext<T, SortState>) => {
    context.setState({ sort });
    options.onChange?.(sort ?? { field: "", order: null });
  };
  const cycle = (field: string, context: TablePluginContext<T, SortState>) => {
    const previous = current(context);
    const order = previous?.field !== field ? "ascend" : previous.order === "ascend" ? "descend" : null;
    update(order ? { field, order } : null, context);
  };
  return {
    id: "sort",
    order: 40,
    initialState: { sort: options.defaultValue ?? null },
    transformColumns(columns, context) {
      return mapTableLeafColumns(columns, (column) => {
        if (!column.sortable) return column;
        const field = Array.isArray(column.dataIndex) ? column.dataIndex.join(".") : String(column.dataIndex ?? column.code ?? column.key);
        const previousHeader = column.renderHeader;
        return { ...column, renderHeader: (currentColumn, coreContext) => {
          const info = current(context);
          return <span className="sia-table__sortable-header"><span>{previousHeader ? previousHeader(currentColumn, coreContext) : currentColumn.title ?? currentColumn.name ?? currentColumn.key}</span><button type="button" className="sia-table__sort-button" aria-label={`切换${getColumnLabel(currentColumn)}排序`} onClick={(event) => { event.stopPropagation(); cycle(field, context); }}><Icon name="chevron-up" size={11} className={info?.field === field && info.order === "ascend" ? "is-active" : ""} /><Icon name="chevron-down" size={11} className={info?.field === field && info.order === "descend" ? "is-active" : ""} /></button></span>;
        }};
      });
    },
    transformRows(rows, context) {
      const info = current(context);
      if (mode === "remote" || !info?.order) return rows;
      const direction = info.order === "ascend" ? 1 : -1;
      return rows.map((row, index) => ({ row, index })).sort((a, b) => {
        const aValue = getTableValue(a.row.record, info.field, info.field);
        const bValue = getTableValue(b.row.record, info.field, info.field);
        const result = options.compare ? options.compare(aValue, bValue, info.field) : aValue == null && bValue == null ? 0 : aValue == null ? -1 : bValue == null ? 1 : typeof aValue === "number" && typeof bValue === "number" ? aValue - bValue : String(aValue).localeCompare(String(bValue), "zh-CN", { numeric: true });
        return result === 0 ? a.index - b.index : result * direction;
      }).map((item) => item.row);
    },
    getApi: (context) => ({ getSortInfo: () => current(context), setSortInfo: (sort) => update(sort, context), clear: () => update(null, context) }),
  };
}

// Pagination plugin
export interface TablePaginationPluginOptions {
  totalCount?: number;
  current?: number;
  pageSize?: number;
  defaultCurrent?: number;
  defaultPageSize?: number;
  pageSizeOptions?: readonly number[];
  onChange?: (current: number, pageSize: number, isFirstLoad?: boolean) => void;
  requestTotal?: (model?: unknown) => Promise<void>;
  isFirstLoad?: boolean;
}
interface PaginationState { current: number; pageSize: number; requestLoading: boolean; }
export interface TablePaginationApi {
  getPage: () => { current: number; pageSize: number };
  setPage: (page: Partial<{ current: number; pageSize: number }>) => void;
  generatePageParams: <Model extends Record<string, unknown>>(model: Model) => Model & TablePageParams;
  requestCount: (model?: unknown) => Promise<void>;
}
export function createPaginationPlugin<T extends Record<string, unknown>>(options: TablePaginationPluginOptions = {}): TablePlugin<T, PaginationState, TablePaginationApi> {
  const currentPage = (context: TablePluginContext<T, PaginationState>) => ({ current: options.current ?? context.state.current, pageSize: options.pageSize ?? context.state.pageSize });
  const setPage = (next: Partial<{ current: number; pageSize: number }>, context: TablePluginContext<T, PaginationState>, notify = true) => {
    const previous = currentPage(context);
    const page = { current: Math.max(1, next.current ?? previous.current), pageSize: Math.max(1, next.pageSize ?? previous.pageSize) };
    context.setState((state) => ({ ...state, ...page }));
    if (page.pageSize !== previous.pageSize) context.emit({ type: "pageSizeChange", source: "pagination", payload: page.pageSize });
    if (notify) options.onChange?.(page.current, page.pageSize);
  };
  const requestCount = async (model: unknown, context: TablePluginContext<T, PaginationState>) => {
    if (!options.requestTotal) return;
    context.setState((state) => ({ ...state, requestLoading: true }));
    try { await options.requestTotal(model); } finally { context.setState((state) => ({ ...state, requestLoading: false })); }
  };
  return {
    id: "pagination",
    order: 50,
    initialState: { current: options.defaultCurrent ?? 1, pageSize: options.defaultPageSize ?? 25, requestLoading: false },
    onMount(context) { if (options.isFirstLoad) options.onChange?.(currentPage(context).current, currentPage(context).pageSize, true); },
    transformRows(rows, context) {
      const page = currentPage(context);
      const serverPagination = options.totalCount != null && options.totalCount > context.sourceData.length;
      return serverPagination ? rows : rows.slice((page.current - 1) * page.pageSize, page.current * page.pageSize);
    },
    renderFooter(context) {
      const page = currentPage(context);
      const totalRecords = options.totalCount ?? context.sourceData.length;
      return (
        <Pagination
          className="sia-table__pagination"
          current={page.current}
          pageSize={page.pageSize}
          pageSizeOptions={options.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS}
          total={totalRecords}
          refreshing={context.state.requestLoading}
          onRefreshTotal={options.requestTotal ? () => requestCount(undefined, context) : undefined}
          onChange={(current, pageSize) => setPage({ current, pageSize }, context)}
        />
      );
    },
    getApi(context) {
      return {
        getPage: () => currentPage(context),
        setPage: (page) => setPage(page, context),
        generatePageParams: (model) => {
          const page = currentPage(context);
          const next = { current: typeof model.pageIndex === "number" ? model.pageIndex : page.current, pageSize: typeof model.pageSize === "number" ? model.pageSize : page.pageSize };
          setPage(next, context, false);
          return { ...model, ...toTablePageParams(next.current, next.pageSize) };
        },
        requestCount: (model) => requestCount(model, context),
      };
    },
  };
}

// Index plugin
export interface TableIndexPluginOptions { title?: ReactNode; width?: number; startIndex?: number; }
export function createIndexPlugin<T extends Record<string, unknown>>(options: TableIndexPluginOptions = {}): TablePlugin<T, undefined> {
  return {
    id: "index",
    order: 30,
    transformColumns(columns, context) {
      const column: TableColumn<T> = { key: "__index__", title: options.title ?? "序号", name: "序号", width: options.width ?? 60, minWidth: 48, fixed: "left", align: "center", ellipsis: false, meta: { plugin: "index" }, render: (_value, _record, _index, info) => {
        const page = context.getState<PaginationState>("pagination");
        const offset = page ? ((page.current ?? 1) - 1) * (page.pageSize ?? 0) : 0;
        return (options.startIndex ?? 1) + offset + info.rowIndex;
      }};
      const selectionIndex = columns.findIndex((item) => item.meta?.plugin === "selection");
      if (selectionIndex < 0) return [column, ...columns];
      return [...columns.slice(0, selectionIndex + 1), column, ...columns.slice(selectionIndex + 1)];
    },
  };
}

// Tree plugin
export interface TableTreePluginOptions<T> {
  childrenColumnName?: string;
  ignoreChildrenColumn?: boolean;
  expandedRowKeys?: readonly TableKey[];
  defaultExpandedRowKeys?: readonly TableKey[];
  defaultExpandAllRows?: boolean;
  onExpandedRowsChange?: (keys: readonly TableKey[]) => void;
  canExpand?: (record: T) => boolean;
}
interface TreeState { expandedKeys: readonly TableKey[]; }
export interface TableTreeApi { getExpandedKeys: () => readonly TableKey[]; setExpandedKeys: (keys: readonly TableKey[]) => void; expandAll: () => void; collapseAll: () => void; }

export function createTreePlugin<T extends Record<string, unknown>>(options: TableTreePluginOptions<T> = {}): TablePlugin<T, TreeState, TableTreeApi> {
  const childKey = options.childrenColumnName ?? "children";
  const current = (context: TablePluginContext<T, TreeState>) => options.expandedRowKeys ?? context.state.expandedKeys;
  const allExpandableKeys = (context: TablePluginContext<T, TreeState>) => flattenRecords(context.sourceData, childKey).filter((record) => Array.isArray(record[childKey]) && (record[childKey] as unknown[]).length > 0).map((record, index) => context.getRowKey(record, index));
  const setKeys = (keys: readonly TableKey[], context: TablePluginContext<T, TreeState>) => { context.setState({ expandedKeys: keys }); options.onExpandedRowsChange?.(keys); };
  const toggle = (key: TableKey, context: TablePluginContext<T, TreeState>) => setKeys(current(context).includes(key) ? current(context).filter((item) => item !== key) : [...current(context), key], context);
  return {
    id: "tree",
    order: 60,
    initialState: { expandedKeys: options.defaultExpandedRowKeys ?? [] },
    onMount(context) { if (options.defaultExpandAllRows && options.expandedRowKeys === undefined) setKeys(allExpandableKeys(context), context); },
    transformRows(rows, context) {
      if (options.ignoreChildrenColumn ?? true) return rows;
      const result: TableRow<T>[] = [];
      const walk = (items: readonly TableRow<T>[], depth: number) => {
        for (const row of items) {
          const children = row.record[childKey];
          const hasChildren = Array.isArray(children) && children.length > 0 && (options.canExpand?.(row.record) ?? true);
          result.push({ ...row, depth, meta: { ...row.meta, treeHasChildren: hasChildren } });
          if (hasChildren && current(context).includes(row.key)) {
            walk((children as T[]).map((record, index) => ({ key: context.getRowKey(record, index), record, sourceIndex: index, depth: depth + 1, meta: {} })), depth + 1);
          }
        }
      };
      walk(rows, 0);
      return result;
    },
    transformColumns(columns, context) {
      if (options.ignoreChildrenColumn ?? true) return columns;
      let wrapped = false;
      return mapTableLeafColumns(columns, (column) => {
        if (wrapped || column.meta?.plugin) return column;
        wrapped = true;
        const previousRender = column.render;
        return { ...column, render: (value, record, index, info) => <span className="sia-table__tree-cell" style={{ paddingLeft: info.row.depth * 18 }}>{info.row.meta.treeHasChildren ? <button type="button" className="sia-table__tree-toggle" aria-label={current(context).includes(info.row.key) ? "收起子节点" : "展开子节点"} aria-expanded={current(context).includes(info.row.key)} onClick={(event) => { event.stopPropagation(); toggle(info.row.key, context); }}><Icon name={current(context).includes(info.row.key) ? "chevron-down" : "chevron-right"} size={13} /></button> : <span className="sia-table__tree-placeholder" />}{previousRender ? previousRender(value, record, index, info) : value as ReactNode}</span> };
      });
    },
    getApi: (context) => ({ getExpandedKeys: () => current(context), setExpandedKeys: (keys) => setKeys(keys, context), expandAll: () => setKeys(allExpandableKeys(context), context), collapseAll: () => setKeys([], context) }),
  };
}

// Summary plugin
export interface TableSummaryPluginOptions<T> {
  subTotal?: Record<string, ReactNode> | ((pageData: readonly T[]) => Record<string, ReactNode>);
  total?: Record<string, ReactNode>;
  subTotalLabel?: ReactNode;
  totalLabel?: ReactNode;
}
export function createSummaryPlugin<T extends Record<string, unknown>>(options: TableSummaryPluginOptions<T>): TablePlugin<T, undefined> {
  return {
    id: "summary",
    order: 90,
    renderSummary(context) {
      const rows: TableSummaryRow[] = [];
      if (options.subTotal) rows.push({ key: "subtotal", label: options.subTotalLabel ?? "小计", values: typeof options.subTotal === "function" ? options.subTotal(context.rows.map((row) => row.record)) : options.subTotal });
      if (options.total) rows.push({ key: "total", label: options.totalLabel ?? "总计", values: options.total, className: "sia-table__summary-row--total" });
      return rows;
    },
  };
}

// Editable plugin
interface EditableState { editing: { rowKey: TableKey; columnKey: string } | null; }
export interface TableEditablePluginOptions<T> {
  onCellChange?: (columnKey: string, record: T, newValue: unknown) => boolean | Promise<boolean>;
  trigger?: "click" | "doubleClick";
}
export interface TableEditableApi { cancel: () => void; getEditingCell: () => EditableState["editing"]; }

function EditableTableCell<T extends Record<string, unknown>>({
  active,
  editable,
  value,
  record,
  content,
  onStart,
  onSave,
  onCancel,
  trigger,
}: {
  active: boolean;
  editable: boolean | TableEditableCellConfig<T>;
  value: unknown;
  record: T;
  content: ReactNode;
  onStart: () => void;
  onSave: (value: unknown) => Promise<boolean>;
  onCancel: () => void;
  trigger: "click" | "doubleClick";
}) {
  const config = typeof editable === "object" ? editable : { type: "input" as const };
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!active) return;
    setEditValue(value);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [active, value]);

  async function save(nextValue = editValue) {
    if (savingRef.current) return;
    if (Object.is(nextValue, value)) return onCancel();
    savingRef.current = true;
    setSaving(true);
    try { if (await onSave(nextValue)) onCancel(); } finally { savingRef.current = false; setSaving(false); }
  }

  if (!active) return <div className="sia-table__editable-display" onClick={trigger === "click" ? onStart : undefined} onDoubleClick={trigger === "doubleClick" ? onStart : undefined}><span>{content}</span><Icon name="edit" size={13} /></div>;
  let editor: ReactNode;
  if (config.type === "custom" && config.editRender) {
    editor = config.editRender(record, (next) => void save(next), onCancel);
  } else if (config.type === "inputNumber") {
    editor = <InputNumber ref={inputRef as never} size="small" value={typeof editValue === "number" ? editValue : null} onChange={setEditValue} disabled={saving} onBlur={() => void save()} onKeyDown={(event) => { if (event.key === "Enter") void save(); if (event.key === "Escape") onCancel(); }} />;
  } else if (config.type === "select") {
    editor = <Select size="small" value={editValue as string | number | null} options={config.options ?? []} disabled={saving} onChange={(next) => { setEditValue(next); void save(next); }} />;
  } else {
    editor = <Input ref={inputRef} size="small" value={String(editValue ?? "")} disabled={saving} suffix={saving ? <Icon name="loader" size={13} spin /> : null} onChange={(event) => setEditValue(event.target.value)} onBlur={() => void save()} onKeyDown={(event) => { if (event.key === "Enter") void save(); if (event.key === "Escape") onCancel(); }} />;
  }
  return <div className="sia-table__editor">{editor}</div>;
}

export function createEditablePlugin<T extends Record<string, unknown>>(options: TableEditablePluginOptions<T> = {}): TablePlugin<T, EditableState, TableEditableApi> {
  const trigger = options.trigger ?? "click";
  return {
    id: "editable",
    order: 70,
    initialState: { editing: null },
    transformColumns(columns, context) {
      return mapTableLeafColumns(columns, (column) => {
        if (!column.editable) return column;
        const previousRender = column.render;
        return { ...column, render: (value, record, index, info) => {
          const config = typeof column.editable === "object" ? column.editable : undefined;
          const canEdit = config?.canEdit?.(record) ?? true;
          const active = canEdit && context.state.editing?.rowKey === info.row.key && context.state.editing.columnKey === column.key;
          const content = previousRender ? previousRender(value, record, index, info) : value as ReactNode;
          if (!canEdit) return content;
          return <EditableTableCell active={active} editable={column.editable!} value={value} record={record} content={content} trigger={trigger} onStart={() => context.setState({ editing: { rowKey: info.row.key, columnKey: column.key } })} onCancel={() => context.setState({ editing: null })} onSave={async (nextValue) => (await options.onCellChange?.(column.key, record, nextValue)) !== false} />;
        }};
      });
    },
    getApi: (context) => ({ cancel: () => context.setState({ editing: null }), getEditingCell: () => context.state.editing }),
  };
}

// Column resize plugin
interface ResizeState { widths: Record<string, number>; }
export interface TableResizePluginOptions { enabled?: boolean; onResize?: (columnKey: string, width: number) => void; }
export interface TableResizeApi { getWidths: () => Readonly<Record<string, number>>; setWidth: (columnKey: string, width: number) => void; }

export function createResizePlugin<T extends Record<string, unknown>>(options: TableResizePluginOptions = {}): TablePlugin<T, ResizeState, TableResizeApi> {
  const enabled = options.enabled ?? true;
  function setWidth(columnKey: string, width: number, context: TablePluginContext<T, ResizeState>, notify = false) {
    context.setState((state) => ({ widths: { ...state.widths, [columnKey]: width } }));
    if (notify) {
      options.onResize?.(columnKey, width);
      context.emit({ type: "columnResize", source: "resize", payload: { columnKey, width } });
    }
  }
  return {
    id: "resize",
    order: 80,
    initialState: { widths: {} },
    transformColumns(columns, context) {
      if (!enabled) return columns;
      return mapTableLeafColumns(columns, (column) => {
        const width = context.state.widths[column.key] ?? column.width ?? 160;
        const previousHeader = column.renderHeader;
        return { ...column, width, renderHeader: (currentColumn, coreContext) => <span className="sia-table__resizable-header"><span>{previousHeader ? previousHeader(currentColumn, coreContext) : currentColumn.title ?? currentColumn.name ?? currentColumn.key}</span><span className="sia-table__resize-handle" role="separator" aria-label={`调整${getColumnLabel(currentColumn)}列宽`} onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const startX = event.clientX;
          const startWidth = width;
          const minWidth = column.minWidth ?? 56;
          const maxWidth = column.maxWidth ?? Number.POSITIVE_INFINITY;
          let finalWidth = startWidth;
          const move = (moveEvent: globalThis.MouseEvent) => { finalWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + moveEvent.clientX - startX)); setWidth(column.key, finalWidth, context); };
          const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); document.body.style.cursor = ""; document.body.style.userSelect = ""; setWidth(column.key, finalWidth, context, true); };
          document.addEventListener("mousemove", move);
          document.addEventListener("mouseup", up);
          document.body.style.cursor = "ew-resize";
          document.body.style.userSelect = "none";
        }} /></span> };
      });
    },
    getApi: (context) => ({ getWidths: () => context.state.widths, setWidth: (columnKey, width) => setWidth(columnKey, width, context, true) }),
  };
}

// Column setting plugin and persistence adapter
export interface TableColumnSettingPluginOptions<T> {
  defaultVisibleKeys?: readonly string[];
  onVisibleChange?: (columns: readonly TableColumn<T>[]) => void;
  onOrderChange?: (columns: readonly TableColumn<T>[]) => void;
  adapter?: TableSettingsAdapter;
  scope?: { moduleName: string; businessKey: string };
}
interface ColumnSettingState { open: boolean; items: readonly TableColumnSettingItem[]; loaded: boolean; pageSize?: number; }
export interface TableColumnSettingApi { open: () => void; close: () => void; getSettings: () => readonly TableColumnSettingItem[]; apply: (settings: readonly TableColumnSettingItem[]) => void; }

function createColumnSettingItems<T>(columns: readonly TableColumn<T>[], visibleKeys?: readonly string[]): TableColumnSettingItem[] {
  return flattenTableColumns(columns).map((column, order) => ({ key: column.key, width: column.width, fixed: normalizeFixed(column.fixed), visible: !column.hidden && (!visibleKeys || visibleKeys.includes(column.key)), order }));
}

function ColumnSettingPanel<T extends Record<string, unknown>>({ open, items, columns, onClose, onApply }: {
  open: boolean;
  items: readonly TableColumnSettingItem[];
  columns: readonly TableColumn<T>[];
  onClose: () => void;
  onApply: (items: readonly TableColumnSettingItem[]) => void;
}) {
  const [draft, setDraft] = useState<readonly TableColumnSettingItem[]>(items);
  const dragIndex = useRef<number | null>(null);
  useEffect(() => { if (open) setDraft(items); }, [items, open]);
  const labels = new Map(flattenTableColumns(columns).map((column) => [column.key, getColumnLabel(column)]));
  const visibleCount = draft.filter((item) => item.visible).length;
  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setDraft(next.map((entry, order) => ({ ...entry, order })));
  }
  function setFixed(key: string, fixed: TableFixed | undefined) { setDraft((previous) => previous.map((item) => item.key === key ? { ...item, fixed } : item)); }
  return <Drawer open={open} title="列设置" size={440} onOpenChange={(next) => { if (!next) onClose(); }} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={() => onApply(draft)}>应用</Button></>}>
    <label className="sia-table-settings__all"><TableCheckbox label="全选列" checked={visibleCount === draft.length && draft.length > 0} indeterminate={visibleCount > 0 && visibleCount < draft.length} onChange={(checked) => setDraft((previous) => previous.map((item) => ({ ...item, visible: checked })))} /><span>全选（{visibleCount}/{draft.length}）</span></label>
    <div className="sia-table-settings__list">{draft.map((item, index) => <div key={item.key} className="sia-table-settings__item" draggable onDragStart={() => { dragIndex.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex.current == null || dragIndex.current === index) return; const next = [...draft]; const [dragged] = next.splice(dragIndex.current, 1); next.splice(index, 0, dragged); setDraft(next.map((entry, order) => ({ ...entry, order }))); dragIndex.current = null; }}><Icon name="menu" size={15} /><TableCheckbox label={`显示${labels.get(item.key) ?? item.key}列`} checked={item.visible} onChange={(checked) => setDraft((previous) => previous.map((entry) => entry.key === item.key ? { ...entry, visible: checked } : entry))} /><span className="sia-table-settings__name" title={labels.get(item.key) ?? item.key}>{labels.get(item.key) ?? item.key}</span><div className="sia-table-settings__actions"><Button size="small" variant="text" icon={<Icon name="arrow-up" size={13} />} aria-label="上移" disabled={index === 0} onClick={() => move(index, -1)} /><Button size="small" variant="text" icon={<Icon name="arrow-down" size={13} />} aria-label="下移" disabled={index === draft.length - 1} onClick={() => move(index, 1)} /><Button size="small" variant={item.fixed === "left" ? "primary" : "text"} aria-label="左固定" onClick={() => setFixed(item.key, item.fixed === "left" ? undefined : "left")}>左</Button><Button size="small" variant={item.fixed === "right" ? "primary" : "text"} aria-label="右固定" onClick={() => setFixed(item.key, item.fixed === "right" ? undefined : "right")}>右</Button></div></div>)}</div>
  </Drawer>;
}

export function createColumnSettingPlugin<T extends Record<string, unknown>>(options: TableColumnSettingPluginOptions<T> = {}): TablePlugin<T, ColumnSettingState, TableColumnSettingApi> {
  const baseItems = (context: TablePluginContext<T, ColumnSettingState>) => createColumnSettingItems(context.baseColumns, options.defaultVisibleKeys);
  const currentItems = (context: TablePluginContext<T, ColumnSettingState>) => context.state.items?.length ? context.state.items : baseItems(context);
  const save = (snapshot: TableSettingsSnapshot) => options.adapter && options.scope ? options.adapter.save(options.scope, snapshot).catch(() => undefined) : Promise.resolve();
  function apply(items: readonly TableColumnSettingItem[], context: TablePluginContext<T, ColumnSettingState>, persist = true) {
    const normalized = [...items].sort((a, b) => a.order - b.order).map((item, order) => ({ ...item, order }));
    context.setState((state) => ({ ...state, items: normalized, open: false }));
    const columnMap = new Map(flattenTableColumns(context.baseColumns).map((column) => [column.key, column]));
    options.onVisibleChange?.(normalized.filter((item) => item.visible).map((item) => columnMap.get(item.key)).filter(Boolean) as TableColumn<T>[]);
    options.onOrderChange?.(normalized.map((item) => columnMap.get(item.key)).filter(Boolean) as TableColumn<T>[]);
    if (persist) void save({ columns: normalized, pageSize: context.state.pageSize, version: 1 });
  }
  return {
    id: "columnSetting",
    order: 10,
    initialState: { open: false, items: [], loaded: false },
    onMount(context) {
      const fallback = baseItems(context);
      context.setState((state) => ({ ...state, items: state.items.length ? state.items : fallback, loaded: !options.adapter }));
      if (options.adapter && options.scope) void options.adapter.load(options.scope).then((snapshot) => {
        const merged = snapshot?.columns?.length ? snapshot.columns : fallback;
        context.setState((state) => ({ ...state, items: merged, pageSize: snapshot?.pageSize, loaded: true }));
        if (snapshot?.pageSize) context.setPluginState<PaginationState>("pagination", (state) => ({ ...state, pageSize: snapshot.pageSize! }));
      }).catch(() => context.setState((state) => ({ ...state, items: fallback, loaded: true })));
    },
    transformColumns(columns, context) {
      const columnMap = new Map(flattenTableColumns(columns).map((column) => [column.key, column]));
      return currentItems(context).filter((item) => item.visible && columnMap.has(item.key)).sort((a, b) => a.order - b.order).map((item) => ({ ...columnMap.get(item.key)!, width: item.width ?? columnMap.get(item.key)!.width, fixed: item.fixed }));
    },
    onEvent(event, context) {
      if (event.type === "columnResize") {
        const { columnKey, width } = event.payload as { columnKey: string; width: number };
        const next = currentItems(context).map((item) => item.key === columnKey ? { ...item, width } : item);
        context.setState((state) => ({ ...state, items: next }));
        void save({ columns: next, pageSize: context.state.pageSize, version: 1 });
      }
      if (event.type === "pageSizeChange") {
        const pageSize = event.payload as number;
        context.setState((state) => ({ ...state, pageSize }));
        void save({ columns: currentItems(context), pageSize, version: 1 });
      }
    },
    renderToolbarEnd: (context) => <Button size="small" variant="text" className="sia-table__toolbar-icon" icon={<Icon name="settings" size={16} />} aria-label="打开列设置" title="列设置" onClick={() => context.setState((state) => ({ ...state, open: true }))} />,
    renderOverlay: (context) => <ColumnSettingPanel open={context.state.open} items={currentItems(context)} columns={context.baseColumns} onClose={() => context.setState((state) => ({ ...state, open: false }))} onApply={(items) => apply(items, context)} />,
    getApi: (context) => ({ open: () => context.setState((state) => ({ ...state, open: true })), close: () => context.setState((state) => ({ ...state, open: false })), getSettings: () => currentItems(context), apply: (items) => apply(items, context) }),
  };
}

export function createLocalStorageTableSettingsAdapter(prefix = "sia-table"): TableSettingsAdapter {
  return {
    async load(scope) {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(`${prefix}:${scope.moduleName}:${scope.businessKey}`);
      if (!raw) return null;
      try { return JSON.parse(raw) as TableSettingsSnapshot; } catch { return null; }
    },
    async save(scope, settings) {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(`${prefix}:${scope.moduleName}:${scope.businessKey}`, JSON.stringify(settings));
    },
  };
}

// Toolbar plugin. Upload/export/permission actions are provided as independent items.
export interface TableToolbarItem<T> {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  position?: "start" | "end";
  inSettings?: boolean;
  danger?: boolean;
  disabled?: boolean | ((context: TablePluginContext<T, any>) => boolean);
  hidden?: boolean | ((context: TablePluginContext<T, any>) => boolean);
  onClick?: (context: TablePluginContext<T, any>) => void | Promise<void>;
}
export interface TableToolbarPluginOptions<T> {
  start?: ReactNode;
  end?: ReactNode;
  items?: readonly TableToolbarItem<T>[];
  canAccess?: (item: TableToolbarItem<T>) => boolean;
}
function ToolbarItems<T extends Record<string, unknown>>({ items, context }: { items: readonly TableToolbarItem<T>[]; context: TablePluginContext<T, any> }) {
  return <>{items.map((item) => {
    if (item.hidden === true || typeof item.hidden === "function" && item.hidden(context)) return null;
    const disabled = item.disabled === true || typeof item.disabled === "function" && item.disabled(context);
    return <Button key={item.key} size="small" danger={item.danger} icon={item.icon} disabled={disabled} title={typeof item.label === "string" ? item.label : undefined} onClick={() => void item.onClick?.(context)}>{item.label}</Button>;
  })}</>;
}
export function createToolbarPlugin<T extends Record<string, unknown>>(options: TableToolbarPluginOptions<T>): TablePlugin<T, undefined> {
  const allowed = (item: TableToolbarItem<T>) => options.canAccess?.(item) ?? true;
  const items = (position: "start" | "end", inSettings = false) => (options.items ?? []).filter((item) => allowed(item) && (item.position ?? "start") === position && Boolean(item.inSettings) === inSettings);
  return {
    id: "toolbar",
    order: 5,
    renderToolbarStart: (context) => <>{options.start}<ToolbarItems items={items("start")} context={context} /></>,
    renderToolbarEnd: (context) => <>{options.end}<ToolbarItems items={items("end")} context={context} />{items("end", true).length > 0 ? <details className="sia-table__toolbar-menu"><summary aria-label="更多表格操作"><Icon name="more-horizontal" size={16} /></summary><div><ToolbarItems items={items("end", true)} context={context} /></div></details> : null}</>,
  };
}

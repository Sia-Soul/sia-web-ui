import { isValidElement, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "../Button";
import { Checkbox } from "../Checkbox";
import { Drawer } from "../Drawer";
import { Icon } from "../Icon";
import { Input } from "../Input";
import { InputNumber } from "../InputNumber";
import { DEFAULT_PAGE_SIZE_OPTIONS, Pagination } from "../Pagination";
import { Popover } from "../FloatingDisplay";
import { Radio } from "../Radio";
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
import { flattenTableColumns, getColumnLabel, getTableValue, mapTableLeafColumns, normalizeFixed, sortTableColumnsByFixed, toTablePageParams } from "./utils";

function TableCheckbox({ checked, indeterminate, disabled, label, onChange }: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return <Checkbox className="sia-table__checkbox" aria-label={label} checked={checked} indeterminate={indeterminate} disabled={disabled} onClick={(event) => event.stopPropagation()} onChange={onChange} />;
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

// Column composition plugin
export interface TableColumnTransformPluginOptions<T> {
  prepend?: readonly TableColumn<T>[];
  append?: readonly TableColumn<T>[];
  transform?: (columns: readonly TableColumn<T>[]) => readonly TableColumn<T>[];
}

export function createColumnTransformPlugin<T extends Record<string, unknown>>(
  options: TableColumnTransformPluginOptions<T>,
): TablePlugin<T, undefined> {
  return {
    id: "columnTransform",
    order: 2,
    transformColumns(columns) {
      const composed = [...(options.prepend ?? []), ...columns, ...(options.append ?? [])];
      return options.transform?.(composed) ?? composed;
    },
  };
}

// Hover highlight plugin
export type TableHighlightValue = boolean | CSSProperties;
export interface TableHighlightPluginOptions {
  row?: TableHighlightValue;
  column?: TableHighlightValue;
  cell?: TableHighlightValue;
}
interface HighlightState { rowKey?: TableKey; columnKey?: string; }

function highlightStyle(value: TableHighlightValue | undefined) {
  return value && typeof value === "object" ? value : undefined;
}

export function createHighlightPlugin<T extends Record<string, unknown>>(
  options: TableHighlightPluginOptions = { row: true },
): TablePlugin<T, HighlightState> {
  const rowEnabled = options.row !== false && options.row !== undefined;
  const columnEnabled = options.column !== false && options.column !== undefined;
  const cellEnabled = options.cell !== false && options.cell !== undefined;
  return {
    id: "highlight",
    order: 15,
    initialState: {},
    getCellProps(row, column, context) {
      const hoveredRow = context.state.rowKey === row.key;
      const hoveredColumn = context.state.columnKey === column.key;
      const rowActive = rowEnabled && hoveredRow;
      const columnActive = columnEnabled && hoveredColumn;
      const cellActive = cellEnabled && hoveredRow && hoveredColumn;
      if (!rowActive && !columnActive && !cellActive) return undefined;
      return {
        className: [
          rowActive ? "sia-table__cell--highlight-row" : "",
          columnActive ? "sia-table__cell--highlight-column" : "",
          cellActive ? "sia-table__cell--highlight-cell" : "",
        ].filter(Boolean).join(" "),
        style: {
          ...(rowActive ? highlightStyle(options.row) : undefined),
          ...(columnActive ? highlightStyle(options.column) : undefined),
          ...(cellActive ? highlightStyle(options.cell) : undefined),
        },
      };
    },
    onCellMouseEnter(row, column, context) {
      if (!rowEnabled && !columnEnabled && !cellEnabled) return;
      if (context.state.rowKey === row.key && context.state.columnKey === column.key) return;
      context.setState({ rowKey: row.key, columnKey: column.key });
    },
    onRowMouseLeave(row, context) {
      if (context.state.rowKey === row.key) context.setState({});
    },
  };
}

// Excel-like rectangular cell selection plugin
export interface TableCellAddress {
  rowKey: TableKey;
  columnKey: string;
}

export interface TableCellRange {
  anchor: TableCellAddress;
  focus: TableCellAddress;
}

export interface TableSelectedCell<T> {
  rowKey: TableKey;
  columnKey: string;
  record: T;
  column: TableColumn<T>;
  value: unknown;
  rowIndex: number;
  columnIndex: number;
}

export interface TableCellSelectionPluginOptions<T> {
  defaultRange?: TableCellRange | null;
  includeUtilityColumns?: boolean;
  copyable?: boolean;
  isCellSelectable?: (record: T, column: TableColumn<T>, rowIndex: number, columnIndex: number) => boolean;
  onChange?: (range: TableCellRange | null, cells: readonly TableSelectedCell<T>[]) => void;
  onCopy?: (text: string, cells: readonly TableSelectedCell<T>[]) => void;
}

interface CellSelectionState {
  range: TableCellRange | null;
  includeHeaders: boolean;
  selectedHeaderKey: string | null;
}

export interface TableCellSelectionApi<T> {
  getRange: () => TableCellRange | null;
  setRange: (range: TableCellRange | null) => void;
  clear: () => void;
  getSelectedCells: () => readonly TableSelectedCell<T>[];
  getCopyText: () => string;
}

interface CellSelectionSnapshot<T> {
  rows: readonly TableRow<T>[];
  columns: readonly TableColumn<T>[];
  range: TableCellRange | null;
  rowIndexes: ReadonlyMap<TableKey, number>;
  columnIndexes: ReadonlyMap<string, number>;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function sameCellAddress(left: TableCellAddress, right: TableCellAddress) {
  return Object.is(left.rowKey, right.rowKey) && left.columnKey === right.columnKey;
}

function isInteractiveTableTarget(target: EventTarget | null) {
  return target instanceof Element
    && Boolean(target.closest("button, input, textarea, select, a, [contenteditable='true'], [role='button'], [role='separator']"));
}

export function createCellSelectionPlugin<T extends Record<string, unknown>>(
  options: TableCellSelectionPluginOptions<T> = {},
): TablePlugin<T, CellSelectionState, TableCellSelectionApi<T>> {
  let dragMode: "cells" | "rows" | "headers" | null = null;
  let dragAnchor: TableCellAddress | null = null;
  let headerDragAnchorKey: string | null = null;
  let snapshotCache: CellSelectionSnapshot<T> | null = null;
  let latestContext: TablePluginContext<T, CellSelectionState> | null = null;
  let activeRoot: HTMLElement | null = null;

  function selectableColumns(context: TablePluginContext<T, CellSelectionState>) {
    return flattenTableColumns(sortTableColumnsByFixed(context.columns)).filter((column) =>
      options.includeUtilityColumns || !column.meta?.plugin || column.meta.plugin === "index",
    );
  }

  function rememberContext(context: TablePluginContext<T, CellSelectionState>) {
    latestContext = context;
    return context;
  }

  function focusTable(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    const root = target.closest<HTMLElement>(".sia-table");
    if (!root) return;
    activeRoot = root;
    if (!root.hasAttribute("tabindex")) root.tabIndex = -1;
    root.focus({ preventScroll: true });
  }

  function findColumn(context: TablePluginContext<T, CellSelectionState>, key: string) {
    const stack = [...sortTableColumnsByFixed(context.columns)];
    while (stack.length > 0) {
      const column = stack.shift()!;
      if (column.key === key) return column;
      if (column.children?.length) stack.unshift(...column.children);
    }
    return undefined;
  }

  function findColumnPath(columns: readonly TableColumn<T>[], key: string, path: readonly TableColumn<T>[] = []): readonly TableColumn<T>[] | null {
    for (const column of columns) {
      if (column.hidden) continue;
      const nextPath = [...path, column];
      if (column.key === key) return nextPath;
      const childPath = column.children?.length ? findColumnPath(column.children, key, nextPath) : null;
      if (childPath) return childPath;
    }
    return null;
  }

  function isSelectable(
    row: TableRow<T>,
    column: TableColumn<T>,
    context: TablePluginContext<T, CellSelectionState>,
  ) {
    const snapshot = getSnapshot(context);
    const columnIndex = snapshot.columnIndexes.get(column.key);
    if (columnIndex === undefined) return false;
    const rowIndex = snapshot.rowIndexes.get(row.key);
    return rowIndex !== undefined && (options.isCellSelectable?.(row.record, column, rowIndex, columnIndex) ?? true);
  }

  function getSnapshot(context: TablePluginContext<T, CellSelectionState>): CellSelectionSnapshot<T> {
    rememberContext(context);
    const rows = context.rows;
    const columns = selectableColumns(context);
    const range = context.state.range;
    if (snapshotCache?.rows === rows && snapshotCache.columns.length === columns.length
      && snapshotCache.columns.every((column, index) => column === columns[index])
      && snapshotCache.range === range) return snapshotCache;

    const rowIndexes = new Map(rows.map((row, index) => [row.key, index]));
    const columnIndexes = new Map(columns.map((column, index) => [column.key, index]));
    const anchorRow = range ? rowIndexes.get(range.anchor.rowKey) : undefined;
    const focusRow = range ? rowIndexes.get(range.focus.rowKey) : undefined;
    const anchorColumn = range ? columnIndexes.get(range.anchor.columnKey) : undefined;
    const focusColumn = range ? columnIndexes.get(range.focus.columnKey) : undefined;
    const valid = anchorRow !== undefined && focusRow !== undefined && anchorColumn !== undefined && focusColumn !== undefined;
    snapshotCache = {
      rows,
      columns,
      range,
      rowIndexes,
      columnIndexes,
      top: valid ? Math.min(anchorRow, focusRow) : -1,
      right: valid ? Math.max(anchorColumn, focusColumn) : -1,
      bottom: valid ? Math.max(anchorRow, focusRow) : -1,
      left: valid ? Math.min(anchorColumn, focusColumn) : -1,
    };
    return snapshotCache;
  }

  function selectedCells(context: TablePluginContext<T, CellSelectionState>) {
    const snapshot = getSnapshot(context);
    if (!snapshot.range || snapshot.top < 0) return [] as TableSelectedCell<T>[];
    const cells: TableSelectedCell<T>[] = [];
    for (let rowIndex = snapshot.top; rowIndex <= snapshot.bottom; rowIndex += 1) {
      const row = snapshot.rows[rowIndex];
      for (let columnIndex = snapshot.left; columnIndex <= snapshot.right; columnIndex += 1) {
        const column = snapshot.columns[columnIndex];
        if (!(options.isCellSelectable?.(row.record, column, rowIndex, columnIndex) ?? true)) continue;
        cells.push({
          rowKey: row.key,
          columnKey: column.key,
          record: row.record,
          column,
          value: getTableValue(row.record, column.dataIndex, column.code ?? column.key),
          rowIndex,
          columnIndex,
        });
      }
    }
    return cells;
  }

  function selectedColumns(context: TablePluginContext<T, CellSelectionState>) {
    const snapshot = getSnapshot(context);
    if (!snapshot.range || snapshot.left < 0) return [] as TableColumn<T>[];
    return snapshot.columns.slice(snapshot.left, snapshot.right + 1);
  }

  function clipboardCellText(row: TableRow<T>, column: TableColumn<T>, rowIndex: number) {
    const value = getTableValue(row.record, column.dataIndex, column.code ?? column.key);
    const info = { row, rowIndex, column };
    const exported = column.exportRender?.(value, row.record, row.sourceIndex, info);
    if (exported !== undefined) return tableExportText(exported);
    // Editable columns are wrapped with an editor React element by the editable plugin.
    // Copy their underlying value unless the consumer explicitly supplied exportRender.
    if (column.editable) return tableExportCell(value, true);
    const rendered = column.render?.(value, row.record, row.sourceIndex, info);
    return rendered !== undefined ? tableExportText(rendered) : tableExportCell(value, true);
  }

  function copyText(context: TablePluginContext<T, CellSelectionState>) {
    const snapshot = getSnapshot(context);
    if (!snapshot.range || snapshot.top < 0) return "";
    const columns = selectedColumns(context);
    const lines: string[] = [];
    if (context.state.includeHeaders && columns.length > 0) {
      const paths = columns.map((column) => findColumnPath(sortTableColumnsByFixed(context.columns), column.key) ?? [column]);
      const maximumDepth = paths.reduce((maximum, path) => Math.max(maximum, path.length), 1);
      for (let depth = 0; depth < maximumDepth; depth += 1) {
        lines.push(paths.map((path) => {
          const offset = maximumDepth - path.length;
          return depth < offset ? "" : tableExportEscape(getColumnLabel(path[depth - offset]), "\t");
        }).join("\t"));
      }
    }
    for (let rowIndex = snapshot.top; rowIndex <= snapshot.bottom; rowIndex += 1) {
      const row = snapshot.rows[rowIndex];
      lines.push(columns.map((column, columnOffset) => {
        const columnIndex = snapshot.left + columnOffset;
        if (!(options.isCellSelectable?.(row.record, column, rowIndex, columnIndex) ?? true)) return "";
        return tableExportEscape(clipboardCellText(row, column, rowIndex), "\t");
      }).join("\t"));
    }
    return lines.join("\r\n");
  }

  function setSelection(
    context: TablePluginContext<T, CellSelectionState>,
    range: TableCellRange | null,
    includeHeaders = false,
    selectedHeaderKey: string | null = null,
  ) {
    rememberContext(context);
    snapshotCache = null;
    const nextState = { range, includeHeaders: Boolean(range) && includeHeaders, selectedHeaderKey: range ? selectedHeaderKey : null };
    context.setState((previous) => {
      if (previous.range === range && previous.includeHeaders === nextState.includeHeaders && previous.selectedHeaderKey === nextState.selectedHeaderKey) return previous;
      if (previous.range && range
        && sameCellAddress(previous.range.anchor, range.anchor)
        && sameCellAddress(previous.range.focus, range.focus)
        && previous.includeHeaders === nextState.includeHeaders
        && previous.selectedHeaderKey === nextState.selectedHeaderKey) return previous;
      return nextState;
    });
    options.onChange?.(range, range ? selectedCells({ ...context, state: nextState }) : []);
  }

  function selectRows(
    context: TablePluginContext<T, CellSelectionState>,
    anchorRowKey: TableKey,
    focusRowKey: TableKey,
  ) {
    const columns = selectableColumns(context);
    if (columns.length === 0) return;
    setSelection(context, {
      anchor: { rowKey: anchorRowKey, columnKey: columns[0].key },
      focus: { rowKey: focusRowKey, columnKey: columns[columns.length - 1].key },
    });
  }

  function headerColumns(column: TableColumn<T>, snapshot: CellSelectionSnapshot<T>) {
    return flattenTableColumns([column]).filter((item) => snapshot.columnIndexes.has(item.key));
  }

  function selectHeaders(
    anchor: TableColumn<T>,
    focus: TableColumn<T>,
    context: TablePluginContext<T, CellSelectionState>,
  ) {
    const snapshot = getSnapshot(context);
    if (snapshot.rows.length === 0 || snapshot.columns.length === 0) return;
    const anchorColumns = headerColumns(anchor, snapshot);
    const focusColumns = headerColumns(focus, snapshot);
    if (anchorColumns.length === 0 || focusColumns.length === 0) return;
    const indexes = [...anchorColumns, ...focusColumns]
      .map((column) => snapshot.columnIndexes.get(column.key))
      .filter((index): index is number => index !== undefined);
    if (indexes.length === 0) return;
    const left = Math.min(...indexes);
    const right = Math.max(...indexes);
    setSelection(context, {
      anchor: { rowKey: snapshot.rows[0].key, columnKey: snapshot.columns[left].key },
      focus: { rowKey: snapshot.rows[snapshot.rows.length - 1].key, columnKey: snapshot.columns[right].key },
    }, true, anchor.key);
  }

  return {
    id: "cellSelection",
    order: 18,
    initialState: { range: options.defaultRange ?? null, includeHeaders: false, selectedHeaderKey: null },
    getCellProps(row, column, context) {
      rememberContext(context);
      if (!isSelectable(row, column, context)) return undefined;
      const snapshot = getSnapshot(context);
      const rowIndex = snapshot.rowIndexes.get(row.key);
      const columnIndex = snapshot.columnIndexes.get(column.key);
      if (rowIndex === undefined || columnIndex === undefined
        || rowIndex < snapshot.top || rowIndex > snapshot.bottom
        || columnIndex < snapshot.left || columnIndex > snapshot.right) return undefined;
      const multiple = snapshot.top !== snapshot.bottom || snapshot.left !== snapshot.right;
      return {
        className: [
          "sia-table__cell--range-selected",
          multiple ? "sia-table__cell--range-multiple" : "",
          rowIndex === snapshot.top ? "sia-table__cell--range-top" : "",
          rowIndex === snapshot.bottom ? "sia-table__cell--range-bottom" : "",
          columnIndex === snapshot.left ? "sia-table__cell--range-left" : "",
          columnIndex === snapshot.right ? "sia-table__cell--range-right" : "",
        ].filter(Boolean).join(" "),
      };
    },
    getHeaderCellProps(column, context) {
      rememberContext(context);
      if (!context.state.includeHeaders) return undefined;
      const snapshot = getSnapshot(context);
      const columns = headerColumns(column, snapshot);
      if (columns.length === 0) return undefined;
      const indexes = columns.map((item) => snapshot.columnIndexes.get(item.key)).filter((index): index is number => index !== undefined);
      if (indexes.length === 0 || indexes.some((index) => index < snapshot.left || index > snapshot.right)) return undefined;
      return {
        className: [
          "sia-table__header-cell--range-selected",
          column.key === context.state.selectedHeaderKey ? "sia-table__header-cell--range-anchor" : "",
        ].filter(Boolean).join(" "),
      };
    },
    onCellPointerDown(row, column, event, context) {
      if (event.button !== 0 || isInteractiveTableTarget(event.target)) return;
      if (column.meta?.plugin === "index") {
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        focusTable(event.currentTarget);
        dragAnchor = { rowKey: row.key, columnKey: selectableColumns(context)[0]?.key ?? column.key };
        dragMode = "rows";
        selectRows(context, row.key, row.key);
        return;
      }
      if (!isSelectable(row, column, context)) return;
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      focusTable(event.currentTarget);
      const address = { rowKey: row.key, columnKey: column.key };
      dragAnchor = event.shiftKey && context.state.range ? context.state.range.anchor : address;
      dragMode = "cells";
      setSelection(context, { anchor: dragAnchor, focus: address });
    },
    onCellPointerMove(row, column, event, context) {
      if (!dragMode || !dragAnchor) return;
      if ((event.buttons & 1) === 0) {
        dragMode = null;
        dragAnchor = null;
        return;
      }
      if (dragMode === "rows") {
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        selectRows(context, dragAnchor.rowKey, row.key);
        return;
      }
      if (!isSelectable(row, column, context)) return;
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      setSelection(context, { anchor: dragAnchor, focus: { rowKey: row.key, columnKey: column.key } });
    },
    onHeaderPointerDown(column, event, context) {
      if (event.button !== 0 || isInteractiveTableTarget(event.target) || column.meta?.plugin === "selection") return;
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      focusTable(event.currentTarget);
      dragAnchor = null;
      headerDragAnchorKey = column.key;
      dragMode = "headers";
      selectHeaders(column, column, context);
    },
    onHeaderPointerMove(column, event, context) {
      if (dragMode !== "headers" || !headerDragAnchorKey) return;
      if ((event.buttons & 1) === 0) {
        dragMode = null;
        headerDragAnchorKey = null;
        return;
      }
      const anchor = findColumn(context, headerDragAnchorKey);
      if (!anchor) return;
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      selectHeaders(anchor, column, context);
    },
    onMount() {
      const stopDragging = () => {
        dragMode = null;
        dragAnchor = null;
        headerDragAnchorKey = null;
      };
      const handleCopy = (event: ClipboardEvent) => {
        const context = latestContext;
        if (options.copyable === false || !context || !activeRoot || !activeRoot.contains(document.activeElement) || isInteractiveTableTarget(document.activeElement)) return;
        const text = copyText(context);
        if (!text) return;
        event.preventDefault();
        event.clipboardData?.setData("text/plain", text);
        options.onCopy?.(text, selectedCells(context));
      };
      window.addEventListener("pointerup", stopDragging);
      window.addEventListener("blur", stopDragging);
      document.addEventListener("copy", handleCopy);
      return () => {
        window.removeEventListener("pointerup", stopDragging);
        window.removeEventListener("blur", stopDragging);
        document.removeEventListener("copy", handleCopy);
      };
    },
    getApi: (context) => ({
      getRange: () => context.state.range,
      setRange: (range) => setSelection(context, range),
      clear: () => setSelection(context, null),
      getSelectedCells: () => selectedCells(context),
      getCopyText: () => copyText(context),
    }),
  };
}

// Consecutive cell merge plugin
interface RowSpanCellMeta { rowSpan?: number; hidden?: boolean; }
type RowSpanMeta = Record<string, RowSpanCellMeta>;
const ROW_SPAN_META_KEY = "__siaTableRowSpan";

export interface TableRowSpanPluginOptions<T> {
  columns?: readonly string[];
  equals?: (left: unknown, right: unknown, column: TableColumn<T>) => boolean;
  disableVirtual?: boolean;
}

function getRowSpanGroupValue<T extends Record<string, unknown>>(
  column: TableColumn<T>,
  record: T,
  index: number,
  records: readonly T[],
) {
  const config = column.rowSpan;
  if (typeof config === "function") return config(record, index, records);
  const dataIndex = typeof config === "boolean" || config === undefined ? column.dataIndex : config;
  return getTableValue(record, dataIndex, column.code ?? column.key);
}

export function createRowSpanPlugin<T extends Record<string, unknown>>(
  options: TableRowSpanPluginOptions<T> = {},
): TablePlugin<T, undefined> {
  return {
    id: "rowSpan",
    order: 65,
    disableVirtual: options.disableVirtual ?? true,
    transformRows(rows, context) {
      const configured = flattenTableColumns(context.columns).filter((column) =>
        column.rowSpan && (!options.columns || options.columns.includes(column.key)),
      );
      if (configured.length === 0 || rows.length === 0) return rows;
      const records = rows.map((row) => row.record);
      const nextRows = rows.map((row) => ({
        ...row,
        meta: { ...row.meta, [ROW_SPAN_META_KEY]: {} as RowSpanMeta },
      }));
      for (const column of configured) {
        let start = 0;
        while (start < rows.length) {
          const value = getRowSpanGroupValue(column, rows[start].record, start, records);
          let end = start + 1;
          while (end < rows.length) {
            const nextValue = getRowSpanGroupValue(column, rows[end].record, end, records);
            const equal = options.equals?.(value, nextValue, column) ?? Object.is(value, nextValue);
            if (!equal) break;
            end += 1;
          }
          const span = end - start;
          const firstMeta = nextRows[start].meta[ROW_SPAN_META_KEY] as RowSpanMeta;
          firstMeta[column.key] = { rowSpan: span };
          for (let index = start + 1; index < end; index += 1) {
            const meta = nextRows[index].meta[ROW_SPAN_META_KEY] as RowSpanMeta;
            meta[column.key] = { hidden: true };
          }
          start = end;
        }
      }
      return nextRows;
    },
    getCellProps(row, column, context) {
      const meta = row.meta[ROW_SPAN_META_KEY] as RowSpanMeta | undefined;
      const cell = meta?.[column.key];
      if (!cell?.rowSpan || cell.rowSpan <= 1) return cell;
      const sticky = column.mergeSticky;
      if (!sticky) return { ...cell, className: "sia-table__cell--row-span" };
      const config = typeof sticky === "object" ? sticky : {};
      const records = context.rows.map((item) => item.record);
      return {
        ...cell,
        className: ["sia-table__cell--row-span", "sia-table__cell--merge-sticky", config.className].filter(Boolean).join(" "),
        style: {
          ...config.style,
          textAlign: config.align,
          "--sia-table-merge-sticky-inset": `${config.inset ?? 0}px`,
          "--sia-table-merge-sticky-z-index": config.zIndex ?? 3,
        } as CSSProperties,
        content: config.getValue?.(row.record, row.sourceIndex, records),
      };
    },
  };
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
  preserveSelectedRowKeys?: boolean;
  showPreserveSelectedRowKeys?: boolean;
  selectionPanelColumnCount?: number;
  selectionPanelMaxCount?: number;
  onPreserveSelectedRowKeysChange?: (preserve: boolean) => void;
  childrenColumnName?: string;
}
interface SelectionState {
  selectedKeys: readonly TableKey[];
  preserveSelectedRowKeys: boolean;
  panelOpen: boolean;
}
export interface TableSelectionApi<T> {
  getSelectedKeys: () => readonly TableKey[];
  setSelectedKeys: (keys: readonly TableKey[]) => void;
  clear: () => void;
  toggle: (key: TableKey, checked?: boolean) => void;
  getSelectedRows: () => readonly T[];
  getPreserveSelectedRowKeys: () => boolean;
  setPreserveSelectedRowKeys: (preserve: boolean) => void;
}

interface TableSelectedEntry<T> {
  key: TableKey;
  record: T;
  sourceIndex: number;
}

function TableSelectedItemsPanel<T extends Record<string, unknown>>({
  entries,
  columns,
  baseColumns,
  maxCount,
  onRemove,
  onClear,
}: {
  entries: readonly TableSelectedEntry<T>[];
  columns: readonly TableColumn<T>[];
  baseColumns: readonly TableColumn<T>[];
  maxCount: number;
  onRemove: (key: TableKey) => void;
  onClear: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleEntries = showAll ? entries : entries.slice(0, maxCount);
  const hiddenCount = Math.max(0, entries.length - visibleEntries.length);
  const baseColumnMap = new Map(flattenTableColumns(baseColumns).map((column) => [column.key, column]));

  return <div className="sia-table-selection-panel">
    <div className="sia-table-selection-panel__header">
      <strong>已选 <span>{entries.length}</span> 项</strong>
      <Button size="small" variant="link" disabled={entries.length === 0} onClick={onClear}>清空</Button>
    </div>
    <div className="sia-table-selection-panel__body">
      <table>
        <thead><tr>{columns.map((column) => <th key={column.key}>{getColumnLabel(column)}</th>)}<th aria-label="操作" /></tr></thead>
        <tbody>{visibleEntries.map((entry, selectedIndex) => <tr key={entry.key}>
          {columns.map((column) => {
            if (column.meta?.plugin === "index") return <td key={column.key}>{entry.sourceIndex + 1}</td>;
            const baseColumn = baseColumnMap.get(column.key) ?? column;
            const value = getTableValue(entry.record, baseColumn.dataIndex, baseColumn.code ?? baseColumn.key);
            const row: TableRow<T> = { key: entry.key, record: entry.record, sourceIndex: entry.sourceIndex, depth: 0, meta: {} };
            const content = baseColumn.render?.(value, entry.record, entry.sourceIndex, { row, rowIndex: entry.sourceIndex, column: baseColumn }) ?? value as ReactNode;
            return <td key={column.key}>{content}</td>;
          })}
          <td><Button size="small" variant="link" onClick={() => onRemove(entry.key)}>取消</Button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {hiddenCount > 0 ? <div className="sia-table-selection-panel__more">还有 {hiddenCount} 项未展示<Button size="small" variant="link" onClick={() => setShowAll(true)}>展示全部</Button></div> : null}
  </div>;
}

export function createSelectionPlugin<T extends Record<string, unknown>>(options: TableSelectionPluginOptions<T> = {}): TablePlugin<T, SelectionState, TableSelectionApi<T>> {
  const { mode = "multiple", childrenColumnName = "children" } = options;
  const preservedRows = new Map<TableKey, T>();
  function selected(context: TablePluginContext<T, SelectionState>) { return options.selectedKeys ?? context.state.selectedKeys ?? []; }
  function preserving(context: TablePluginContext<T, SelectionState>) { return context.state.preserveSelectedRowKeys; }
  function allRecords(context: TablePluginContext<T, SelectionState>) { return flattenRecords(context.sourceData, childrenColumnName); }
  function entriesForKeys(keys: readonly TableKey[], context: TablePluginContext<T, SelectionState>) {
    const records = allRecords(context);
    const currentRows = new Map(records.map((record, index) => [context.getRowKey(record, index), { key: context.getRowKey(record, index), record, sourceIndex: index }] as const));
    if (preserving(context)) {
      for (const key of keys) {
        const entry = currentRows.get(key);
        if (entry) preservedRows.set(key, entry.record);
      }
      for (const key of preservedRows.keys()) if (!keys.includes(key)) preservedRows.delete(key);
      return keys.map((key, selectedIndex) => currentRows.get(key) ?? (preservedRows.has(key) ? { key, record: preservedRows.get(key)!, sourceIndex: selectedIndex } : undefined)).filter((entry): entry is TableSelectedEntry<T> => entry !== undefined);
    }
    return keys.map((key) => currentRows.get(key)).filter((entry): entry is TableSelectedEntry<T> => entry !== undefined);
  }
  function rowsForKeys(keys: readonly TableKey[], context: TablePluginContext<T, SelectionState>) {
    return entriesForKeys(keys, context).map((entry) => entry.record);
  }
  function setKeys(keys: readonly TableKey[], context: TablePluginContext<T, SelectionState>) {
    if (keys.length === 0) preservedRows.clear();
    context.setState((state) => ({ ...state, selectedKeys: keys, panelOpen: keys.length > 0 && state.panelOpen }));
    options.onChange?.(keys, rowsForKeys(keys, context));
  }
  function setPreserving(preserve: boolean, context: TablePluginContext<T, SelectionState>) {
    if (preserve === preserving(context)) return;
    if (!preserve) {
      const pageKeys = new Set(context.rows.map((row) => row.key));
      const currentPageKeys = selected(context).filter((key) => pageKeys.has(key));
      setKeys(currentPageKeys, context);
      preservedRows.clear();
    }
    context.setState((state) => ({ ...state, preserveSelectedRowKeys: preserve }));
    options.onPreserveSelectedRowKeysChange?.(preserve);
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
    initialState: { selectedKeys: options.defaultSelectedKeys ?? [], preserveSelectedRowKeys: options.preserveSelectedRowKeys ?? false, panelOpen: false },
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
          ? <Radio className="sia-table__checkbox" value={String(info.row.key)} aria-label={`选择第 ${info.rowIndex + 1} 行`} checked={selected(context).includes(info.row.key)} disabled={options.getCheckboxDisabled?.(record)} onClick={(event) => event.stopPropagation()} onChange={() => toggle(info.row.key, record, context)} />
          : <TableCheckbox label={`选择第 ${info.rowIndex + 1} 行`} checked={selected(context).includes(info.row.key)} disabled={options.getCheckboxDisabled?.(record)} onChange={(checked) => toggle(info.row.key, record, context, checked)} />,
      };
      return [selectionColumn, ...columns];
    },
    getCellProps(_row, column) {
      return column.meta?.plugin === "selection" ? { className: "sia-table__cell--selection-action" } : undefined;
    },
    onCellClick(row, column, event, context) {
      if (column.meta?.plugin !== "selection" || event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest(".sia-checkbox, .sia-radio, input")) return;
      event.stopPropagation();
      toggle(row.key, row.record, context);
    },
    onRowClick(row, context) { if (mode === "row") toggle(row.key, row.record, context); },
    getRowClassName(row, context) { return selected(context).includes(row.key) ? "sia-table__row--selected" : ""; },
    onEvent(event, context) {
      if ((event.type === "pageChange" || event.type === "pageSizeChange") && !preserving(context) && selected(context).length > 0) setKeys([], context);
    },
    renderFooter(context) {
      if (!options.showSelectedCount) return null;
      const keys = selected(context);
      const entries = entriesForKeys(keys, context);
      const columns = flattenTableColumns(context.columns)
        .filter((column) => !column.hidden && column.meta?.plugin !== "selection")
        .slice(0, Math.max(1, options.selectionPanelColumnCount ?? 4));
      return <span className="sia-table__selection-footer">
        <Popover
          placement="top-start"
          arrow={false}
          open={context.state.panelOpen && entries.length > 0}
          onOpenChange={(panelOpen) => context.setState((state) => ({ ...state, panelOpen }))}
          overlayClassName="sia-table-selection-popover"
          content={<TableSelectedItemsPanel entries={entries} columns={columns} baseColumns={context.baseColumns} maxCount={Math.max(1, options.selectionPanelMaxCount ?? 100)} onRemove={(key) => {
            setKeys(keys.filter((item) => item !== key), context);
          }} onClear={() => setKeys([], context)} />}
        >
          <Button className="sia-table__selected-trigger" size="small" variant="link" disabled={entries.length === 0}>已选 {entries.length} 条</Button>
        </Popover>
        {mode === "multiple" && options.showPreserveSelectedRowKeys !== false ? <Checkbox checked={preserving(context)} onChange={(checked) => setPreserving(checked, context)}>跨页保留勾选</Checkbox> : null}
      </span>;
    },
    getApi(context) {
      return {
        getSelectedKeys: () => selected(context),
        setSelectedKeys: (keys) => setKeys(keys, context),
        clear: () => setKeys([], context),
        toggle: (key, checked) => {
          const records = allRecords(context);
          const record = records.find((item, index) => Object.is(context.getRowKey(item, index), key)) ?? preservedRows.get(key);
          if (record) toggle(key, record, context, checked);
        },
        getSelectedRows: () => rowsForKeys(selected(context), context),
        getPreserveSelectedRowKeys: () => preserving(context),
        setPreserveSelectedRowKeys: (preserve) => setPreserving(preserve, context),
      };
    },
  };
}

// Sort plugin
export interface TableSortPluginOptions {
  mode?: "local" | "remote";
  scope?: "page" | "all";
  value?: TableSortInfo | null;
  defaultValue?: TableSortInfo | null;
  onChange?: (sort: TableSortInfo) => void;
  compare?: (a: unknown, b: unknown, field: string) => number;
}
interface SortState { sort: TableSortInfo | null; }
export interface TableSortApi { getSortInfo: () => TableSortInfo | null; setSortInfo: (sort: TableSortInfo | null) => void; clear: () => void; }

export function createSortPlugin<T extends Record<string, unknown>>(options: TableSortPluginOptions = {}): TablePlugin<T, SortState, TableSortApi> {
  const mode = options.mode ?? "local";
  const scope = options.scope ?? "all";
  const current = (context: TablePluginContext<T, SortState>) => options.value === undefined ? context.state.sort : options.value;
  const update = (sort: TableSortInfo | null, context: TablePluginContext<T, SortState>) => {
    context.setState({ sort });
    options.onChange?.(sort ?? { field: "", order: null });
  };
  const cycle = (field: string, context: TablePluginContext<T, SortState>) => {
    const previous = current(context);
    const order = previous?.field !== field ? "ascend" : previous.order === "ascend" ? "descend" : null;
    update(order ? { field, order, scope } : null, context);
  };
  return {
    id: "sort",
    order: scope === "page" ? 55 : 40,
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
  mode?: "local" | "server" | "auto";
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
    if (page.current !== previous.current) context.emit({ type: "pageChange", source: "pagination", payload: page });
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
      const mode = options.mode ?? "auto";
      const serverPagination = mode === "server" || mode === "auto" && options.totalCount != null && options.totalCount > context.sourceData.length;
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
    getCellProps(_row, column, context) {
      const hasSelectionColumn = context.columns.some((item) => item.meta?.plugin === "selection");
      return column.meta?.plugin === "index" && hasSelectionColumn ? { className: "sia-table__cell--index-action" } : undefined;
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
  const editorRef = useRef<HTMLDivElement>(null);
  const editValueRef = useRef(value);
  const savingRef = useRef(false);
  const saveRef = useRef<(nextValue?: unknown) => Promise<void>>(async () => {});
  useEffect(() => {
    if (!active) return;
    editValueRef.current = value;
    setEditValue(value);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [active, value]);

  function getCurrentEditValue() {
    if (config.type !== "inputNumber") return editValueRef.current;
    const rawValue = inputRef.current?.value.trim() ?? "";
    if (rawValue === "") return null;
    const nextValue = Number(rawValue);
    return Number.isFinite(nextValue) ? nextValue : editValueRef.current;
  }

  function updateEditValue(nextValue: unknown) {
    editValueRef.current = nextValue;
    setEditValue(nextValue);
  }

  async function save(nextValue = getCurrentEditValue()) {
    if (savingRef.current) return;
    if (Object.is(nextValue, value)) return onCancel();
    savingRef.current = true;
    setSaving(true);
    try { if (await onSave(nextValue)) onCancel(); } finally { savingRef.current = false; setSaving(false); }
  }
  saveRef.current = save;

  useEffect(() => {
    if (!active || config.type === "select" || config.type === "custom") return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || editorRef.current?.contains(target)) return;
      void saveRef.current();
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
  }, [active, config.type]);

  if (!active) return <div className="sia-table__editable-display" onClick={trigger === "click" ? onStart : undefined} onDoubleClick={trigger === "doubleClick" ? onStart : undefined}><span>{content}</span><Icon name="edit" size={13} /></div>;
  let editor: ReactNode;
  if (config.type === "custom" && config.editRender) {
    editor = config.editRender(record, (next) => void save(next), onCancel);
  } else if (config.type === "inputNumber") {
    editor = <InputNumber ref={inputRef as never} size="small" value={typeof editValue === "number" ? editValue : null} onChange={updateEditValue} disabled={saving} onBlur={() => void save()} onKeyDown={(event) => {
      if (event.key === "Enter") {
        const rawValue = event.currentTarget.value.trim();
        const nextValue = rawValue === "" ? null : Number(rawValue);
        if (nextValue === null || Number.isFinite(nextValue)) void save(nextValue);
      }
      if (event.key === "Escape") onCancel();
    }} />;
  } else if (config.type === "select") {
    editor = <Select size="small" value={editValue as string | number | null} options={config.options ?? []} disabled={saving} onChange={(next) => { updateEditValue(next); void save(next); }} />;
  } else {
    editor = <Input ref={inputRef} size="small" value={String(editValue ?? "")} disabled={saving} suffix={saving ? <Icon name="loader" size={13} spin /> : null} onChange={(event) => updateEditValue(event.target.value)} onBlur={() => void save()} onKeyDown={(event) => { if (event.key === "Enter") void save(); if (event.key === "Escape") onCancel(); }} />;
  }
  return <div ref={editorRef} className="sia-table__editor">{editor}</div>;
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
          return <EditableTableCell active={active} editable={column.editable!} value={value} record={record} content={content} trigger={trigger} onStart={() => context.setState({ editing: { rowKey: info.row.key, columnKey: column.key } })} onCancel={() => context.setState((state) => state.editing?.rowKey === info.row.key && state.editing.columnKey === column.key ? { editing: null } : state)} onSave={async (nextValue) => (await options.onCellChange?.(column.key, record, nextValue)) !== false} />;
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

function applyColumnSettingsToTree<T>(
  columns: readonly TableColumn<T>[],
  items: readonly TableColumnSettingItem[],
): TableColumn<T>[] {
  const itemMap = new Map(items.map((item) => [item.key, item]));
  const walk = (source: readonly TableColumn<T>[]): Array<{ column: TableColumn<T>; order: number }> => source.flatMap((column, sourceOrder) => {
    if (column.children?.length) {
      const children = walk(column.children);
      if (children.length === 0) return [];
      return [{
        column: { ...column, children: children.map((entry) => entry.column) },
        order: Math.min(...children.map((entry) => entry.order)),
      }];
    }
    const item = itemMap.get(column.key);
    if (item && !item.visible) return [];
    return [{
      column: item ? { ...column, width: item.width ?? column.width, fixed: item.fixed } : column,
      order: item?.order ?? items.length + sourceOrder,
    }];
  }).sort((left, right) => left.order - right.order);
  return walk(columns).map((entry) => entry.column);
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
      return applyColumnSettingsToTree(columns, currentItems(context));
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

// CSV export plugin
export type TableExportScope = "visible" | "all" | "selected";
export interface TableExportPluginOptions<T> {
  scope?: TableExportScope;
  fileName?: string | ((context: TablePluginContext<T, undefined>) => string);
  delimiter?: "," | "\t" | ";";
  includeBom?: boolean;
  sanitizeFormula?: boolean;
  buttonLabel?: ReactNode;
  onExport?: (csv: string, rows: readonly T[]) => void | Promise<void>;
}
export interface TableExportApi<T> {
  getCsv: (scope?: TableExportScope) => string;
  download: (scope?: TableExportScope) => Promise<void>;
  getRows: (scope?: TableExportScope) => readonly T[];
}

function tableExportText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(tableExportText).join("");
  if (isValidElement(node)) return tableExportText((node.props as { children?: ReactNode }).children);
  return "";
}

function tableExportCell(value: unknown, sanitizeFormula: boolean) {
  const text = value === null || value === undefined
    ? ""
    : typeof value === "object" ? JSON.stringify(value) : String(value);
  return sanitizeFormula && /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function tableExportEscape(value: string, delimiter: string) {
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
}

export function createExportPlugin<T extends Record<string, unknown>>(
  options: TableExportPluginOptions<T> = {},
): TablePlugin<T, undefined, TableExportApi<T>> {
  function getRows(context: TablePluginContext<T, undefined>, scope = options.scope ?? "visible") {
    if (scope === "all") return context.sourceData;
    if (scope === "selected") return context.getPluginApi<TableSelectionApi<T>>("selection")?.getSelectedRows() ?? [];
    return context.rows.map((row) => row.record);
  }
  function getCsv(context: TablePluginContext<T, undefined>, scope?: TableExportScope) {
    const delimiter = options.delimiter ?? ",";
    const sanitizeFormula = options.sanitizeFormula ?? true;
    const rows = getRows(context, scope);
    const columns = flattenTableColumns(context.columns).filter((column) =>
      column.exportable !== false && (!column.meta?.plugin || column.exportable === true),
    );
    const header = columns.map((column) => tableExportEscape(getColumnLabel(column), delimiter)).join(delimiter);
    const lines = rows.map((record, rowIndex) => {
      const row: TableRow<T> = {
        key: context.getRowKey(record, rowIndex),
        record,
        sourceIndex: rowIndex,
        depth: 0,
        meta: {},
      };
      return columns.map((column) => {
        const value = getTableValue(record, column.dataIndex, column.code ?? column.key);
        const rendered = column.exportRender?.(value, record, rowIndex, { row, rowIndex, column });
        const text = rendered === undefined ? tableExportCell(value, sanitizeFormula) : tableExportText(rendered);
        return tableExportEscape(text, delimiter);
      }).join(delimiter);
    });
    return `${options.includeBom === false ? "" : "\uFEFF"}${[header, ...lines].join("\r\n")}`;
  }
  async function download(context: TablePluginContext<T, undefined>, scope?: TableExportScope) {
    const rows = getRows(context, scope);
    const csv = getCsv(context, scope);
    if (options.onExport) {
      await options.onExport(csv, rows);
      return;
    }
    if (typeof document === "undefined") return;
    const fileName = typeof options.fileName === "function" ? options.fileName(context) : options.fileName ?? "table.csv";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return {
    id: "export",
    order: 95,
    renderToolbarEnd: (context) => <Button
      size="small"
      icon={<Icon name="download" size={14} />}
      disabled={getRows(context).length === 0}
      onClick={() => void download(context)}
    >
      {options.buttonLabel ?? "导出"}
    </Button>,
    getApi: (context) => ({
      getCsv: (scope) => getCsv(context, scope),
      download: (scope) => download(context, scope),
      getRows: (scope) => getRows(context, scope),
    }),
  };
}

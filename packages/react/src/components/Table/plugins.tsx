import { isValidElement, useEffect, useRef, useState } from "react";
import { withTitleTooltip } from "../titleTooltip";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { Button } from "../Button";
import type { ButtonProps } from "../Button";
import { Checkbox } from "../Checkbox";
import { Dropdown } from "../Dropdown";
import type { MenuItem } from "../Navigation";
import { Drawer } from "../Drawer";
import { Spin } from "../Feedback";
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
import {
  flattenTableColumns,
  getColumnLabel,
  getTableValue,
  isTableAutoWidthColumn,
  mapTableLeafColumns,
  normalizeFixed,
  sortTableColumnsByFixed,
  toTablePageParams,
} from "./utils";

function TableCheckbox({
  checked,
  indeterminate,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      className="sia-table__checkbox"
      aria-label={label}
      checked={checked}
      indeterminate={indeterminate}
      disabled={disabled}
      onClick={(event) => event.stopPropagation()}
      onChange={onChange}
    />
  );
}

function flattenRecords<T extends Record<string, unknown>>(
  data: readonly T[],
  childrenColumnName: string,
): T[] {
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
/** TableColumnTransform的插件配置。 */
export interface TableColumnTransformPluginOptions<T> {
  /** 插入在原有列之前的列配置。 */
  prepend?: readonly TableColumn<T>[];
  /** 追加在原有列之后的列配置。 */
  append?: readonly TableColumn<T>[];
  /** 转换表格列配置，返回用于后续处理和渲染的新列集合。 */
  transform?: (columns: readonly TableColumn<T>[]) => readonly TableColumn<T>[];
}

/** 创建表格列转换插件。将返回值加入 Table 的 plugins 后生效。 */
export function createColumnTransformPlugin<T extends Record<string, unknown>>(
  options: TableColumnTransformPluginOptions<T>,
): TablePlugin<T, undefined> {
  return {
    id: "columnTransform",
    order: 2,
    transformColumns(columns) {
      const composed = [
        ...(options.prepend ?? []),
        ...columns,
        ...(options.append ?? []),
      ];
      return options.transform?.(composed) ?? composed;
    },
  };
}

// Hover highlight plugin
/** TableHighlight的值类型。 */
export type TableHighlightValue = boolean | CSSProperties;
/** TableHighlight的插件配置。 */
export interface TableHighlightPluginOptions {
  /** 当前行记录。 */
  row?: TableHighlightValue;
  /** 列号或当前列配置，具体含义由所在类型决定。 */
  column?: TableHighlightValue;
  /** 当前单元格的配置或状态。 */
  cell?: TableHighlightValue;
}
/** 当前高亮的行和列。 */
interface HighlightState {
  /** 当前高亮行的标识。 */
  rowKey?: TableKey;
  /** 当前高亮列的标识。 */
  columnKey?: string;
}

function highlightStyle(value: TableHighlightValue | undefined) {
  return value && typeof value === "object" ? value : undefined;
}

/** 创建表格行和单元格高亮插件。将返回值加入 Table 的 plugins 后生效。 */
export function createHighlightPlugin<T extends Record<string, unknown>>(
  options: TableHighlightPluginOptions = { row: true },
): TablePlugin<T, HighlightState> {
  const rowEnabled = options.row !== false && options.row !== undefined;
  const columnEnabled =
    options.column !== false && options.column !== undefined;
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
        ]
          .filter(Boolean)
          .join(" "),
        style: {
          ...(rowActive ? highlightStyle(options.row) : undefined),
          ...(columnActive ? highlightStyle(options.column) : undefined),
          ...(cellActive ? highlightStyle(options.cell) : undefined),
        },
      };
    },
    onCellMouseEnter(row, column, context) {
      if (!rowEnabled && !columnEnabled && !cellEnabled) return;
      if (
        context.state.rowKey === row.key &&
        context.state.columnKey === column.key
      )
        return;
      context.setState({ rowKey: row.key, columnKey: column.key });
    },
    onRowMouseLeave(row, context) {
      if (context.state.rowKey === row.key) context.setState({});
    },
  };
}

// Excel-like rectangular cell selection plugin
/** 通过行标识和列标识定位一个单元格。 */
export interface TableCellAddress {
  /** 行唯一键字段或计算函数 */
  rowKey: TableKey;
  /** 列的唯一标识，对应 TableColumn.key。 */
  columnKey: string;
}

/** 通过起止单元格定义的选区。 */
export interface TableCellRange {
  /** 单元格选区的起始锚点。 */
  anchor: TableCellAddress;
  /** 将焦点移入控件。 */
  focus: TableCellAddress;
}

/** 选区内一个单元格的值和行列上下文。 */
export interface TableSelectedCell<T> {
  /** 行唯一键字段或计算函数 */
  rowKey: TableKey;
  /** 列的唯一标识，对应 TableColumn.key。 */
  columnKey: string;
  /** 当前业务记录。 */
  record: T;
  /** 列号或当前列配置，具体含义由所在类型决定。 */
  column: TableColumn<T>;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: unknown;
  /** 行索引，从 0 开始。 */
  rowIndex: number;
  /** 列索引，从 0 开始。 */
  columnIndex: number;
}

/** TableCellSelection的插件配置。 */
export interface TableCellSelectionPluginOptions<T> {
  /** 初始化时的单元格选区。 */
  defaultRange?: TableCellRange | null;
  /** 是否包含勾选、序号等工具列。 */
  includeUtilityColumns?: boolean;
  /** 复制完整文本，可指定复制内容和成功回调 */
  copyable?: boolean;
  /** 判断指定单元格是否允许加入选区。 */
  isCellSelectable?: (
    record: T,
    column: TableColumn<T>,
    rowIndex: number,
    columnIndex: number,
  ) => boolean;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (
    range: TableCellRange | null,
    cells: readonly TableSelectedCell<T>[],
  ) => void;
  /** 复制操作触发后的回调。 */
  onCopy?: (text: string, cells: readonly TableSelectedCell<T>[]) => void;
}

/** 表格单元格选区状态。 */
interface CellSelectionState {
  /** 当前单元格选区，null 表示无选区。 */
  range: TableCellRange | null;
  /** 复制选区时是否包含表头。 */
  includeHeaders: boolean;
  /** 通过表头选择的列标识。 */
  selectedHeaderKey: string | null;
}

/** TableCellSelection的操作接口。 */
export interface TableCellSelectionApi<T> {
  /** 读取当前单元格选区。 */
  getRange: () => TableCellRange | null;
  /** 设置单元格选区，传入空值可清除选区。 */
  setRange: (range: TableCellRange | null) => void;
  /** 清空当前值或内容。 */
  clear: () => void;
  /** 读取当前选区中的单元格信息。 */
  getSelectedCells: () => readonly TableSelectedCell<T>[];
  /** 将当前选区转换为可复制文本。 */
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
  return (
    Object.is(left.rowKey, right.rowKey) && left.columnKey === right.columnKey
  );
}

function isInteractiveTableTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "button, input, textarea, select, a, [contenteditable='true'], [role='button'], [role='separator']",
      ),
    )
  );
}

/** 创建表格单元格区域选择插件。Table 默认内置；点击表格空白处或表格外部时清除单元格选区，不改变行勾选状态。显式传入 plugins 可自定义选择和复制行为。 */
export function createCellSelectionPlugin<T extends Record<string, unknown>>(
  options: TableCellSelectionPluginOptions<T> = {},
): TablePlugin<T, CellSelectionState, TableCellSelectionApi<T>> {
  let dragMode: "text" | "cells" | "rows" | "headers" | null = null;
  let dragAnchor: TableCellAddress | null = null;
  let textCell: HTMLTableCellElement | null = null;
  let headerDragAnchorKey: string | null = null;
  let snapshotCache: CellSelectionSnapshot<T> | null = null;
  let latestContext: TablePluginContext<T, CellSelectionState> | null = null;
  let activeRoot: HTMLElement | null = null;

  function selectableColumns(
    context: TablePluginContext<T, CellSelectionState>,
  ) {
    return flattenTableColumns(sortTableColumnsByFixed(context.columns)).filter(
      (column) =>
        options.includeUtilityColumns ||
        !column.meta?.plugin ||
        column.meta.plugin === "index",
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

  function findColumn(
    context: TablePluginContext<T, CellSelectionState>,
    key: string,
  ) {
    const stack = [...sortTableColumnsByFixed(context.columns)];
    while (stack.length > 0) {
      const column = stack.shift()!;
      if (column.key === key) return column;
      if (column.children?.length) stack.unshift(...column.children);
    }
    return undefined;
  }

  function findColumnPath(
    columns: readonly TableColumn<T>[],
    key: string,
    path: readonly TableColumn<T>[] = [],
  ): readonly TableColumn<T>[] | null {
    for (const column of columns) {
      if (column.hidden) continue;
      const nextPath = [...path, column];
      if (column.key === key) return nextPath;
      const childPath = column.children?.length
        ? findColumnPath(column.children, key, nextPath)
        : null;
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
    return (
      rowIndex !== undefined &&
      (options.isCellSelectable?.(row.record, column, rowIndex, columnIndex) ??
        true)
    );
  }

  function getSnapshot(
    context: TablePluginContext<T, CellSelectionState>,
  ): CellSelectionSnapshot<T> {
    rememberContext(context);
    const rows = context.rows;
    const columns = selectableColumns(context);
    const range = context.state.range;
    if (
      snapshotCache?.rows === rows &&
      snapshotCache.columns.length === columns.length &&
      snapshotCache.columns.every(
        (column, index) => column === columns[index],
      ) &&
      snapshotCache.range === range
    )
      return snapshotCache;

    const rowIndexes = new Map(rows.map((row, index) => [row.key, index]));
    const columnIndexes = new Map(
      columns.map((column, index) => [column.key, index]),
    );
    const anchorRow = range ? rowIndexes.get(range.anchor.rowKey) : undefined;
    const focusRow = range ? rowIndexes.get(range.focus.rowKey) : undefined;
    const anchorColumn = range
      ? columnIndexes.get(range.anchor.columnKey)
      : undefined;
    const focusColumn = range
      ? columnIndexes.get(range.focus.columnKey)
      : undefined;
    const valid =
      anchorRow !== undefined &&
      focusRow !== undefined &&
      anchorColumn !== undefined &&
      focusColumn !== undefined;
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
    if (!snapshot.range || snapshot.top < 0)
      return [] as TableSelectedCell<T>[];
    const cells: TableSelectedCell<T>[] = [];
    for (
      let rowIndex = snapshot.top;
      rowIndex <= snapshot.bottom;
      rowIndex += 1
    ) {
      const row = snapshot.rows[rowIndex];
      for (
        let columnIndex = snapshot.left;
        columnIndex <= snapshot.right;
        columnIndex += 1
      ) {
        const column = snapshot.columns[columnIndex];
        if (!(
          options.isCellSelectable?.(
            row.record,
            column,
            rowIndex,
            columnIndex,
          ) ?? true
        ))
          continue;
        cells.push({
          rowKey: row.key,
          columnKey: column.key,
          record: row.record,
          column,
          value: getTableValue(
            row.record,
            column.dataIndex,
            column.code ?? column.key,
          ),
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

  function clipboardCellText(
    row: TableRow<T>,
    column: TableColumn<T>,
    rowIndex: number,
  ) {
    const value = getTableValue(
      row.record,
      column.dataIndex,
      column.code ?? column.key,
    );
    const info = { row, rowIndex, column };
    const exported = column.exportRender?.(
      value,
      row.record,
      row.sourceIndex,
      info,
    );
    if (exported !== undefined) return tableExportText(exported);
    // 画布标签复制展示文本，避免只得到原始状态码。
    if (column.canvasRender) return column.canvasRender(value, row.record, row.sourceIndex, info)?.text ?? "";
    // Editable columns are wrapped with an editor React element by the editable plugin.
    // Copy their underlying value unless the consumer explicitly supplied exportRender.
    if (column.editable) return tableExportCell(value, true);
    const rendered = column.render?.(value, row.record, row.sourceIndex, info);
    return rendered !== undefined
      ? tableExportText(rendered)
      : tableExportCell(value, true);
  }

  function copyText(context: TablePluginContext<T, CellSelectionState>) {
    const snapshot = getSnapshot(context);
    if (!snapshot.range || snapshot.top < 0) return "";
    const columns = selectedColumns(context);
    const lines: string[] = [];
    if (context.state.includeHeaders && columns.length > 0) {
      const paths = columns.map(
        (column) =>
          findColumnPath(
            sortTableColumnsByFixed(context.columns),
            column.key,
          ) ?? [column],
      );
      const maximumDepth = paths.reduce(
        (maximum, path) => Math.max(maximum, path.length),
        1,
      );
      for (let depth = 0; depth < maximumDepth; depth += 1) {
        lines.push(
          paths
            .map((path) => {
              const offset = maximumDepth - path.length;
              return depth < offset
                ? ""
                : tableExportEscape(getColumnLabel(path[depth - offset]), "\t");
            })
            .join("\t"),
        );
      }
    }
    for (
      let rowIndex = snapshot.top;
      rowIndex <= snapshot.bottom;
      rowIndex += 1
    ) {
      const row = snapshot.rows[rowIndex];
      lines.push(
        columns
          .map((column, columnOffset) => {
            const columnIndex = snapshot.left + columnOffset;
            if (!(
              options.isCellSelectable?.(
                row.record,
                column,
                rowIndex,
                columnIndex,
              ) ?? true
            ))
              return "";
            return tableExportEscape(
              clipboardCellText(row, column, rowIndex),
              "\t",
            );
          })
          .join("\t"),
      );
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
    const nextState = {
      range,
      includeHeaders: Boolean(range) && includeHeaders,
      selectedHeaderKey: range ? selectedHeaderKey : null,
    };
    context.setState((previous) => {
      if (
        previous.range === range &&
        previous.includeHeaders === nextState.includeHeaders &&
        previous.selectedHeaderKey === nextState.selectedHeaderKey
      )
        return previous;
      if (
        previous.range &&
        range &&
        sameCellAddress(previous.range.anchor, range.anchor) &&
        sameCellAddress(previous.range.focus, range.focus) &&
        previous.includeHeaders === nextState.includeHeaders &&
        previous.selectedHeaderKey === nextState.selectedHeaderKey
      )
        return previous;
      return nextState;
    });
    options.onChange?.(
      range,
      range ? selectedCells({ ...context, state: nextState }) : [],
    );
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
      focus: {
        rowKey: focusRowKey,
        columnKey: columns[columns.length - 1].key,
      },
    });
  }

  function headerColumns(
    column: TableColumn<T>,
    snapshot: CellSelectionSnapshot<T>,
  ) {
    return flattenTableColumns([column]).filter((item) =>
      snapshot.columnIndexes.has(item.key),
    );
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
    setSelection(
      context,
      {
        anchor: {
          rowKey: snapshot.rows[0].key,
          columnKey: snapshot.columns[left].key,
        },
        focus: {
          rowKey: snapshot.rows[snapshot.rows.length - 1].key,
          columnKey: snapshot.columns[right].key,
        },
      },
      true,
      anchor.key,
    );
  }

  return {
    id: "cellSelection",
    order: 18,
    initialState: {
      range: options.defaultRange ?? null,
      includeHeaders: false,
      selectedHeaderKey: null,
    },
    getCellProps(row, column, context) {
      rememberContext(context);
      if (!isSelectable(row, column, context)) return undefined;
      const snapshot = getSnapshot(context);
      const rowIndex = snapshot.rowIndexes.get(row.key);
      const columnIndex = snapshot.columnIndexes.get(column.key);
      if (
        rowIndex === undefined ||
        columnIndex === undefined ||
        rowIndex < snapshot.top ||
        rowIndex > snapshot.bottom ||
        columnIndex < snapshot.left ||
        columnIndex > snapshot.right
      )
        return undefined;
      const multiple =
        snapshot.top !== snapshot.bottom || snapshot.left !== snapshot.right;
      return {
        className: [
          "sia-table__cell--range-selected",
          multiple ? "sia-table__cell--range-multiple" : "",
          rowIndex === snapshot.top ? "sia-table__cell--range-top" : "",
          rowIndex === snapshot.bottom ? "sia-table__cell--range-bottom" : "",
          columnIndex === snapshot.left ? "sia-table__cell--range-left" : "",
          columnIndex === snapshot.right ? "sia-table__cell--range-right" : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    getHeaderCellProps(column, context) {
      rememberContext(context);
      if (!context.state.includeHeaders) return undefined;
      const snapshot = getSnapshot(context);
      const columns = headerColumns(column, snapshot);
      if (columns.length === 0) return undefined;
      const indexes = columns
        .map((item) => snapshot.columnIndexes.get(item.key))
        .filter((index): index is number => index !== undefined);
      if (
        indexes.length === 0 ||
        indexes.some((index) => index < snapshot.left || index > snapshot.right)
      )
        return undefined;
      return {
        className: [
          "sia-table__header-cell--range-selected",
          column.key === context.state.selectedHeaderKey
            ? "sia-table__header-cell--range-anchor"
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    onCellPointerDown(row, column, event, context) {
      if (event.button !== 0 || isInteractiveTableTarget(event.target)) return;
      if (column.meta?.plugin === "index") {
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        focusTable(event.currentTarget);
        dragAnchor = {
          rowKey: row.key,
          columnKey: selectableColumns(context)[0]?.key ?? column.key,
        };
        dragMode = "rows";
        selectRows(context, row.key, row.key);
        return;
      }
      if (!isSelectable(row, column, context)) return;
      // Do not start the browser's HTML drag-and-drop on a previous text range.
      window.getSelection()?.removeAllRanges();
      focusTable(event.currentTarget);
      const address = { rowKey: row.key, columnKey: column.key };
      const extendRange = event.shiftKey && context.state.range;
      dragAnchor =
        extendRange
          ? extendRange.anchor
          : address;
      // Let the browser select text until the pointer enters another cell.
      dragMode = extendRange ? "cells" : "text";
      textCell = extendRange ? null : event.currentTarget;
      if (extendRange) {
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
      }
      setSelection(context, { anchor: dragAnchor, focus: address });
    },
    onCellPointerMove(row, column, event, context) {
      if (!dragMode || !dragAnchor) return;
      if ((event.buttons & 1) === 0) {
        dragMode = null;
        dragAnchor = null;
        textCell = null;
        return;
      }
      if (dragMode === "rows") {
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        selectRows(context, dragAnchor.rowKey, row.key);
        return;
      }
      if (!isSelectable(row, column, context)) return;
      if (dragMode === "text") {
        if (sameCellAddress(dragAnchor, { rowKey: row.key, columnKey: column.key })) return;
        dragMode = "cells";
        textCell = null;
        focusTable(event.currentTarget);
      }
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      setSelection(context, {
        anchor: dragAnchor,
        focus: { rowKey: row.key, columnKey: column.key },
      });
    },
    onHeaderPointerDown(column, event, context) {
      if (
        event.button !== 0 ||
        isInteractiveTableTarget(event.target) ||
        column.meta?.plugin === "selection"
      )
        return;
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
        constrainTextSelection();
        dragMode = null;
        dragAnchor = null;
        textCell = null;
        headerDragAnchorKey = null;
      };
      const constrainTextSelection = () => {
        if (!dragMode) return;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        if (dragMode !== "text" || !textCell?.contains(selection.anchorNode) || !textCell.contains(selection.focusNode)) {
          selection.removeAllRanges();
        }
      };
      const handleSelectStart = (event: Event) => {
        if (dragMode && dragMode !== "text") event.preventDefault();
      };
      const handleCopy = (event: ClipboardEvent) => {
        const context = latestContext;
        if (
          options.copyable === false ||
          !context ||
          !activeRoot ||
          !activeRoot.contains(document.activeElement) ||
          isInteractiveTableTarget(document.activeElement)
        )
          return;
        // Preserve native partial-text copying instead of replacing it with TSV.
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString()) return;
        const text = copyText(context);
        if (!text) return;
        event.preventDefault();
        event.clipboardData?.setData("text/plain", text);
        options.onCopy?.(text, selectedCells(context));
      };
      // 仅在新的主指针按下时清除，拖拽越出表格或右键菜单不应丢失当前选区。
      const clearOnOutsidePointerDown = (event: PointerEvent) => {
        const context = latestContext;
        if (event.button !== 0 || !context?.state.range || !activeRoot) return;
        const target = event.target instanceof Element ? event.target : null;
        const cell = target?.closest("td[data-column-key], th[data-column-key]");
        if (cell?.closest(".sia-table") === activeRoot) return;
        stopDragging();
        setSelection(context, null);
      };
      document.addEventListener("pointerdown", clearOnOutsidePointerDown, true);
      window.addEventListener("pointerup", stopDragging);
      window.addEventListener("pointercancel", stopDragging);
      window.addEventListener("blur", stopDragging);
      document.addEventListener("selectionchange", constrainTextSelection);
      document.addEventListener("selectstart", handleSelectStart);
      document.addEventListener("copy", handleCopy);
      return () => {
        stopDragging();
        document.removeEventListener("pointerdown", clearOnOutsidePointerDown, true);
        window.removeEventListener("pointerup", stopDragging);
        window.removeEventListener("pointercancel", stopDragging);
        window.removeEventListener("blur", stopDragging);
        document.removeEventListener("selectionchange", constrainTextSelection);
        document.removeEventListener("selectstart", handleSelectStart);
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
interface RowSpanCellMeta {
  rowSpan?: number;
  hidden?: boolean;
}
type RowSpanMeta = Record<string, RowSpanCellMeta>;
const ROW_SPAN_META_KEY = "__siaTableRowSpan";

/** TableRowSpan的插件配置。 */
export interface TableRowSpanPluginOptions<T> {
  /** 列配置或选项布局列数，具体类型见签名。 */
  columns?: readonly string[];
  /** 自定义两个值的相等性判断。 */
  equals?: (left: unknown, right: unknown, column: TableColumn<T>) => boolean;
  /** 是否禁用虚拟渲染，默认 true；仅在展示行数不超过 100 时生效，超过 100 行由表格强制启用。 */
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
  const dataIndex =
    typeof config === "boolean" || config === undefined
      ? column.dataIndex
      : config;
  return getTableValue(record, dataIndex, column.code ?? column.key);
}

/** 创建表格跨行合并插件。将返回值加入 Table 的 plugins 后生效。 */
export function createRowSpanPlugin<T extends Record<string, unknown>>(
  options: TableRowSpanPluginOptions<T> = {},
): TablePlugin<T, undefined> {
  return {
    id: "rowSpan",
    order: 65,
    disableVirtual: options.disableVirtual ?? true,
    transformRows(rows, context) {
      const configured = flattenTableColumns(context.columns).filter(
        (column) =>
          column.rowSpan &&
          (!options.columns || options.columns.includes(column.key)),
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
          const value = getRowSpanGroupValue(
            column,
            rows[start].record,
            start,
            records,
          );
          let end = start + 1;
          while (end < rows.length) {
            const nextValue = getRowSpanGroupValue(
              column,
              rows[end].record,
              end,
              records,
            );
            const equal =
              options.equals?.(value, nextValue, column) ??
              Object.is(value, nextValue);
            if (!equal) break;
            end += 1;
          }
          const span = end - start;
          const firstMeta = nextRows[start].meta[
            ROW_SPAN_META_KEY
          ] as RowSpanMeta;
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
        className: [
          "sia-table__cell--row-span",
          "sia-table__cell--merge-sticky",
          config.className,
        ]
          .filter(Boolean)
          .join(" "),
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
/** TableSelection的模式类型。 */
export type TableSelectionMode = "single" | "multiple" | "row";
/** TableSelection的插件配置。 */
export interface TableSelectionPluginOptions<T> {
  /** 是否显示多选模式的表头全选框，默认 true；false 仅隐藏全选入口，不影响行勾选、已选状态及选择 API。 */
  showSelectAll?: boolean;
  /** 展示或交互模式；可选值见类型定义。 */
  mode?: TableSelectionMode;
  /** 当前选中项目的标识集合；传入后由外部控制。 */
  selectedKeys?: readonly TableKey[];
  /** 非受控模式下初始选中的项目标识集合。 */
  defaultSelectedKeys?: readonly TableKey[];
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (keys: readonly TableKey[], rows: readonly T[]) => void;
  /** 按行判断其勾选框是否禁用。 */
  getCheckboxDisabled?: (record: T) => boolean;
  /** 是否展示已选记录数。 */
  showSelectedCount?: boolean;
  /** 切换页面或数据源时是否保留已选行标识。 */
  preserveSelectedRowKeys?: boolean;
  /** 是否显示跨页保留勾选的开关。 */
  showPreserveSelectedRowKeys?: boolean;
  /** 已选记录面板的列数。 */
  selectionPanelColumnCount?: number;
  /** 已选记录面板最多展示的条数。 */
  selectionPanelMaxCount?: number;
  /** 跨页保留勾选开关变化时调用。 */
  onPreserveSelectedRowKeysChange?: (preserve: boolean) => void;
  /** 行数据中存放子行的字段名。 */
  childrenColumnName?: string;
}
/** 行勾选和已选面板状态。 */
interface SelectionState {
  /** 当前选中的行标识。 */
  selectedKeys: readonly TableKey[];
  /** 是否跨页保留选中行。 */
  preserveSelectedRowKeys: boolean;
  /** 已选记录面板是否打开。 */
  panelOpen: boolean;
}
/** TableSelection的操作接口。 */
export interface TableSelectionApi<T> {
  /** 读取当前选中行的标识。 */
  getSelectedKeys: () => readonly TableKey[];
  /** 设置选中行标识集合。 */
  setSelectedKeys: (keys: readonly TableKey[]) => void;
  /** 清空当前值或内容。 */
  clear: () => void;
  /** 切换指定行的选中状态。 */
  toggle: (key: TableKey, checked?: boolean) => void;
  /** 读取当前选中的行数据。 */
  getSelectedRows: () => readonly T[];
  /** 读取是否跨页保留选中行。 */
  getPreserveSelectedRowKeys: () => boolean;
  /** 设置是否跨页保留选中行。 */
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
  const baseColumnMap = new Map(
    flattenTableColumns(baseColumns).map((column) => [column.key, column]),
  );

  return (
    <div className="sia-table-selection-panel">
      <div className="sia-table-selection-panel__header">
        <strong>
          已选 <span>{entries.length}</span> 项
        </strong>
        <Button
          size="small"
          variant="link"
          disabled={entries.length === 0}
          onClick={onClear}
        >
          清空
        </Button>
      </div>
      <div className="sia-table-selection-panel__body">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{getColumnLabel(column)}</th>
              ))}
              <th aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry, selectedIndex) => (
              <tr key={entry.key}>
                {columns.map((column) => {
                  if (column.meta?.plugin === "index")
                    return <td key={column.key}>{entry.sourceIndex + 1}</td>;
                  const baseColumn = baseColumnMap.get(column.key) ?? column;
                  const value = getTableValue(
                    entry.record,
                    baseColumn.dataIndex,
                    baseColumn.code ?? baseColumn.key,
                  );
                  const row: TableRow<T> = {
                    key: entry.key,
                    record: entry.record,
                    sourceIndex: entry.sourceIndex,
                    depth: 0,
                    meta: {},
                  };
                  const content =
                    baseColumn.render?.(
                      value,
                      entry.record,
                      entry.sourceIndex,
                      { row, rowIndex: entry.sourceIndex, column: baseColumn },
                    ) ?? (value as ReactNode);
                  return <td key={column.key}>{content}</td>;
                })}
                <td>
                  <Button
                    size="small"
                    variant="link"
                    onClick={() => onRemove(entry.key)}
                  >
                    取消
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 ? (
        <div className="sia-table-selection-panel__more">
          还有 {hiddenCount} 项未展示
          <Button size="small" variant="link" onClick={() => setShowAll(true)}>
            展示全部
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** 创建表格行勾选插件。将返回值加入 Table 的 plugins 后生效。 */
export function createSelectionPlugin<T extends Record<string, unknown>>(
  options: TableSelectionPluginOptions<T> = {},
): TablePlugin<T, SelectionState, TableSelectionApi<T>> {
  const { mode = "multiple", childrenColumnName = "children" } = options;
  const preservedRows = new Map<TableKey, T>();
  function selected(context: TablePluginContext<T, SelectionState>) {
    return options.selectedKeys ?? context.state.selectedKeys ?? [];
  }
  function preserving(context: TablePluginContext<T, SelectionState>) {
    return context.state.preserveSelectedRowKeys;
  }
  function allRecords(context: TablePluginContext<T, SelectionState>) {
    return flattenRecords(context.sourceData, childrenColumnName);
  }
  function entriesForKeys(
    keys: readonly TableKey[],
    context: TablePluginContext<T, SelectionState>,
  ) {
    const records = allRecords(context);
    const currentRows = new Map(
      records.map(
        (record, index) =>
          [
            context.getRowKey(record, index),
            {
              key: context.getRowKey(record, index),
              record,
              sourceIndex: index,
            },
          ] as const,
      ),
    );
    if (preserving(context)) {
      for (const key of keys) {
        const entry = currentRows.get(key);
        if (entry) preservedRows.set(key, entry.record);
      }
      for (const key of preservedRows.keys())
        if (!keys.includes(key)) preservedRows.delete(key);
      return keys
        .map(
          (key, selectedIndex) =>
            currentRows.get(key) ??
            (preservedRows.has(key)
              ? {
                  key,
                  record: preservedRows.get(key)!,
                  sourceIndex: selectedIndex,
                }
              : undefined),
        )
        .filter((entry): entry is TableSelectedEntry<T> => entry !== undefined);
    }
    return keys
      .map((key) => currentRows.get(key))
      .filter((entry): entry is TableSelectedEntry<T> => entry !== undefined);
  }
  function rowsForKeys(
    keys: readonly TableKey[],
    context: TablePluginContext<T, SelectionState>,
  ) {
    return entriesForKeys(keys, context).map((entry) => entry.record);
  }
  function setKeys(
    keys: readonly TableKey[],
    context: TablePluginContext<T, SelectionState>,
  ) {
    if (keys.length === 0) preservedRows.clear();
    context.setState((state) => ({
      ...state,
      selectedKeys: keys,
      panelOpen: keys.length > 0 && state.panelOpen,
    }));
    options.onChange?.(keys, rowsForKeys(keys, context));
  }
  function setPreserving(
    preserve: boolean,
    context: TablePluginContext<T, SelectionState>,
  ) {
    if (preserve === preserving(context)) return;
    if (!preserve) {
      const pageKeys = new Set(context.rows.map((row) => row.key));
      const currentPageKeys = selected(context).filter((key) =>
        pageKeys.has(key),
      );
      setKeys(currentPageKeys, context);
      preservedRows.clear();
    }
    context.setState((state) => ({
      ...state,
      preserveSelectedRowKeys: preserve,
    }));
    options.onPreserveSelectedRowKeysChange?.(preserve);
  }
  function toggle(
    key: TableKey,
    record: T,
    context: TablePluginContext<T, SelectionState>,
    checked?: boolean,
  ) {
    if (options.getCheckboxDisabled?.(record)) return;
    const keys = selected(context);
    if (mode === "single" || mode === "row")
      return setKeys(keys.includes(key) ? [] : [key], context);
    const nextChecked = checked ?? !keys.includes(key);
    setKeys(
      nextChecked
        ? [...new Set([...keys, key])]
        : keys.filter((item) => item !== key),
      context,
    );
  }
  return {
    id: "selection",
    order: 20,
    initialState: {
      selectedKeys: options.defaultSelectedKeys ?? [],
      preserveSelectedRowKeys: options.preserveSelectedRowKeys ?? false,
      panelOpen: false,
    },
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
          if (mode !== "multiple" || options.showSelectAll === false) return null;
          const enabledRows = context.rows.filter(
            (row) => !options.getCheckboxDisabled?.(row.record),
          );
          const keys = selected(context);
          const allChecked =
            enabledRows.length > 0 &&
            enabledRows.every((row) => keys.includes(row.key));
          const someChecked = enabledRows.some((row) => keys.includes(row.key));
          return (
            <TableCheckbox
              label="选择当前页全部行"
              checked={allChecked}
              indeterminate={!allChecked && someChecked}
              onChange={(checked) => {
                const pageKeys = enabledRows.map((row) => row.key);
                setKeys(
                  checked
                    ? [...new Set([...keys, ...pageKeys])]
                    : keys.filter((key) => !pageKeys.includes(key)),
                  context,
                );
              }}
            />
          );
        },
        render: (_value, record, _index, info) =>
          mode === "single" ? (
            <Radio
              className="sia-table__checkbox"
              value={String(info.row.key)}
              aria-label={`选择第 ${info.rowIndex + 1} 行`}
              checked={selected(context).includes(info.row.key)}
              disabled={options.getCheckboxDisabled?.(record)}
              onClick={(event) => event.stopPropagation()}
              onChange={() => toggle(info.row.key, record, context)}
            />
          ) : (
            <TableCheckbox
              label={`选择第 ${info.rowIndex + 1} 行`}
              checked={selected(context).includes(info.row.key)}
              disabled={options.getCheckboxDisabled?.(record)}
              onChange={(checked) =>
                toggle(info.row.key, record, context, checked)
              }
            />
          ),
      };
      return [selectionColumn, ...columns];
    },
    getCellProps(_row, column) {
      return column.meta?.plugin === "selection"
        ? { className: "sia-table__cell--selection-action" }
        : undefined;
    },
    onCellClick(row, column, event, context) {
      if (column.meta?.plugin !== "selection" || event.button !== 0) return;
      if (
        event.target instanceof Element &&
        event.target.closest(".sia-checkbox, .sia-radio, input")
      )
        return;
      event.stopPropagation();
      toggle(row.key, row.record, context);
    },
    onRowClick(row, context) {
      if (mode === "row") toggle(row.key, row.record, context);
    },
    getRowClassName(row, context) {
      return selected(context).includes(row.key)
        ? "sia-table__row--selected"
        : "";
    },
    onEvent(event, context) {
      if (
        (event.type === "pageChange" || event.type === "pageSizeChange") &&
        !preserving(context) &&
        selected(context).length > 0
      )
        setKeys([], context);
    },
    renderFooter(context) {
      if (!options.showSelectedCount) return null;
      const keys = selected(context);
      const entries = entriesForKeys(keys, context);
      const columns = flattenTableColumns(context.columns)
        .filter(
          (column) => !column.hidden && column.meta?.plugin !== "selection",
        )
        .slice(0, Math.max(1, options.selectionPanelColumnCount ?? 4));
      return (
        <span className="sia-table__selection-footer">
          <Popover
            placement="top-start"
            arrow={false}
            open={context.state.panelOpen && entries.length > 0}
            onOpenChange={(panelOpen) =>
              context.setState((state) => ({ ...state, panelOpen }))
            }
            overlayClassName="sia-table-selection-popover"
            content={
              <TableSelectedItemsPanel
                entries={entries}
                columns={columns}
                baseColumns={context.baseColumns}
                maxCount={Math.max(1, options.selectionPanelMaxCount ?? 100)}
                onRemove={(key) => {
                  setKeys(
                    keys.filter((item) => item !== key),
                    context,
                  );
                }}
                onClear={() => setKeys([], context)}
              />
            }
          >
            <Button
              className="sia-table__selected-trigger"
              size="small"
              variant="link"
              disabled={entries.length === 0}
            >
              已选 {entries.length} 条
            </Button>
          </Popover>
          {mode === "multiple" &&
          options.showPreserveSelectedRowKeys !== false ? (
            <Checkbox
              checked={preserving(context)}
              onChange={(checked) => setPreserving(checked, context)}
            >
              跨页保留勾选
            </Checkbox>
          ) : null}
        </span>
      );
    },
    getApi(context) {
      return {
        getSelectedKeys: () => selected(context),
        setSelectedKeys: (keys) => setKeys(keys, context),
        clear: () => setKeys([], context),
        toggle: (key, checked) => {
          const records = allRecords(context);
          const record =
            records.find((item, index) =>
              Object.is(context.getRowKey(item, index), key),
            ) ?? preservedRows.get(key);
          if (record) toggle(key, record, context, checked);
        },
        getSelectedRows: () => rowsForKeys(selected(context), context),
        getPreserveSelectedRowKeys: () => preserving(context),
        setPreserveSelectedRowKeys: (preserve) =>
          setPreserving(preserve, context),
      };
    },
  };
}

// Sort plugin
/** TableSort的插件配置。 */
export interface TableSortPluginOptions {
  /** 展示或交互模式；可选值见类型定义。 */
  mode?: "local" | "remote";
  /** 配置存储的作用域，用于隔离不同模块和业务表格。 */
  scope?: "page" | "all";
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value?: TableSortInfo | null;
  /** 非受控模式的初始值，仅在初始化时使用。 */
  defaultValue?: TableSortInfo | null;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (sort: TableSortInfo) => void;
  /** 比较两条记录的排序函数；负数表示前者排在前面。 */
  compare?: (a: unknown, b: unknown, field: string) => number;
}
/** 表格排序状态。 */
interface SortState {
  /** 当前排序配置。 */
  sort: TableSortInfo | null;
}
/** TableSort的操作接口。 */
export interface TableSortApi {
  /** 读取当前排序列及方向。 */
  getSortInfo: () => TableSortInfo | null;
  /** 设置当前排序信息。 */
  setSortInfo: (sort: TableSortInfo | null) => void;
  /** 清空当前值或内容。 */
  clear: () => void;
}

/** 创建表格列排序插件。将返回值加入 Table 的 plugins 后生效；点击列头按钮依次切换升序、降序和未排序，升序使用高亮 chevron-up，降序使用高亮 chevron-down，悬停提示当前状态及下一步操作。 */
export function createSortPlugin<T extends Record<string, unknown>>(
  options: TableSortPluginOptions = {},
): TablePlugin<T, SortState, TableSortApi> {
  const mode = options.mode ?? "local";
  const scope = options.scope ?? "all";
  const current = (context: TablePluginContext<T, SortState>) =>
    options.value === undefined ? context.state.sort : options.value;
  const update = (
    sort: TableSortInfo | null,
    context: TablePluginContext<T, SortState>,
  ) => {
    context.setState({ sort });
    options.onChange?.(sort ?? { field: "", order: null });
  };
  const cycle = (field: string, context: TablePluginContext<T, SortState>) => {
    const previous = current(context);
    const order =
      previous?.field !== field
        ? "ascend"
        : previous.order === "ascend"
          ? "descend"
          : null;
    update(order ? { field, order, scope } : null, context);
  };
  return {
    id: "sort",
    order: scope === "page" ? 55 : 40,
    initialState: { sort: options.defaultValue ?? null },
    transformColumns(columns, context) {
      return mapTableLeafColumns(columns, (column) => {
        if (!column.sortable) return column;
        const field = Array.isArray(column.dataIndex)
          ? column.dataIndex.join(".")
          : String(column.dataIndex ?? column.code ?? column.key);
        const previousHeader = column.renderHeader;
        return {
          ...column,
          renderHeader: (currentColumn, coreContext) => {
            const info = current(context);
            // 已排序时使用框架 chevron 图标和背景共同标识方向，与未排序图标保持同一风格。
            const order = info?.field === field ? info.order : null;
            const sortHint = `${getColumnLabel(currentColumn)}：${order === "ascend" ? "当前升序，点击切换为降序" : order === "descend" ? "当前降序，点击取消排序" : "未排序，点击按升序排序"}`;
            return (
              <span className="sia-table__sortable-header">
                <span>
                  {previousHeader
                    ? previousHeader(currentColumn, coreContext)
                    : (currentColumn.title ??
                      currentColumn.name ??
                      currentColumn.key)}
                </span>
                <button
                  type="button"
                  className="sia-table__sort-button"
                  data-sort-order={order ?? "none"}
                  aria-label={sortHint}
                  {...withTitleTooltip({ title: sortHint })}
                  onClick={(event) => {
                    event.stopPropagation();
                    cycle(field, context);
                  }}
                >
                  {order ? <Icon name={order === "ascend" ? "chevron-up" : "chevron-down"} size={18} /> : <>
                    <Icon name="chevron-up" size={11} />
                    <Icon name="chevron-down" size={11} />
                  </>}
                </button>
              </span>
            );
          },
        };
      });
    },
    transformRows(rows, context) {
      const info = current(context);
      if (mode === "remote" || !info?.order) return rows;
      const direction = info.order === "ascend" ? 1 : -1;
      return rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
          const aValue = getTableValue(a.row.record, info.field, info.field);
          const bValue = getTableValue(b.row.record, info.field, info.field);
          const result = options.compare
            ? options.compare(aValue, bValue, info.field)
            : aValue == null && bValue == null
              ? 0
              : aValue == null
                ? -1
                : bValue == null
                  ? 1
                  : typeof aValue === "number" && typeof bValue === "number"
                    ? aValue - bValue
                    : String(aValue).localeCompare(String(bValue), "zh-CN", {
                        numeric: true,
                      });
          return result === 0 ? a.index - b.index : result * direction;
        })
        .map((item) => item.row);
    },
    getApi: (context) => ({
      getSortInfo: () => current(context),
      setSortInfo: (sort) => update(sort, context),
      clear: () => update(null, context),
    }),
  };
}

// Column filter plugin
/** 列标识到筛选条件的映射。 */
export type TableFilterValues = Readonly<Record<string, string>>;
/** TableFilter的插件配置。 */
export interface TableFilterPluginOptions<T> {
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value?: TableFilterValues;
  /** 非受控模式的初始值，仅在初始化时使用。 */
  defaultValue?: TableFilterValues;
  /** 未填写或未选择时的提示内容。 */
  placeholder?: string | ((column: TableColumn<T>) => string);
  /** 用于判断记录是否满足条件的函数。 */
  predicate?: (
    value: unknown,
    filterValue: string,
    record: T,
    column: TableColumn<T>,
  ) => boolean;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (filters: TableFilterValues) => void;
}
/** 表格筛选条件状态。 */
interface FilterState {
  /** 按列保存的筛选条件。 */
  filters: Record<string, string>;
}
/** TableFilter的操作接口。 */
export interface TableFilterApi<T> {
  /** 读取当前筛选条件。 */
  getFilters: () => TableFilterValues;
  /** 设置指定列的筛选条件。 */
  setFilter: (columnKey: string, value: string) => void;
  /** 清空当前值或内容。 */
  clear: (columnKey?: string) => void;
  /** 读取应用筛选后的行数据。 */
  getFilteredRows: () => readonly T[];
}

function TableFilterControl<T extends Record<string, unknown>>({
  column,
  value,
  placeholder,
  onApply,
}: {
  column: TableColumn<T>;
  value: string;
  placeholder: string;
  onApply: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const label = getColumnLabel(column);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);
  const apply = (nextValue: string) => {
    onApply(nextValue.trim());
    setOpen(false);
  };
  return (
    <span className="sia-table__filter-header">
      <span>{column.title ?? column.name ?? column.key}</span>
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        overlayClassName="sia-table-filter-popover"
        content={
          <div className="sia-table-filter-panel">
            <Input
              size="small"
              value={draft}
              placeholder={placeholder}
              aria-label={`筛选${label}`}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") apply(draft);
                if (event.key === "Escape") setOpen(false);
              }}
            />
            <div className="sia-table-filter-panel__actions">
              <Button
                size="small"
                disabled={!value && !draft}
                onClick={() => {
                  setDraft("");
                  apply("");
                }}
              >
                清除
              </Button>
              <Button
                size="small"
                variant="primary"
                onClick={() => apply(draft)}
              >
                应用
              </Button>
            </div>
          </div>
        }
      >
        <button
          type="button"
          className={`sia-table__filter-button${value ? " is-active" : ""}`}
          aria-label={`筛选${label}`}
          aria-pressed={Boolean(value)}
          onClick={(event) => event.stopPropagation()}
        >
          <Icon name="search" size={13} />
        </button>
      </Popover>
    </span>
  );
}

/** 创建表格数据筛选插件。将返回值加入 Table 的 plugins 后生效。 */
export function createFilterPlugin<T extends Record<string, unknown>>(
  options: TableFilterPluginOptions<T> = {},
): TablePlugin<T, FilterState, TableFilterApi<T>> {
  const current = (context: TablePluginContext<T, FilterState>) =>
    options.value ?? context.state.filters;
  const matches = (record: T, context: TablePluginContext<T, FilterState>) => {
    const filters = current(context);
    return Object.entries(filters).every(([columnKey, filterValue]) => {
      if (!filterValue) return true;
      const column =
        flattenTableColumns(context.columns).find(
          (item) => item.key === columnKey,
        ) ??
        flattenTableColumns(context.baseColumns).find(
          (item) => item.key === columnKey,
        );
      if (!column) return true;
      const value = getTableValue(
        record,
        column.dataIndex,
        column.code ?? column.key,
      );
      if (options.predicate)
        return options.predicate(value, filterValue, record, column);
      const normalizedFilter = filterValue.toLocaleLowerCase();
      if (value === null || value === undefined)
        return normalizedFilter === "null" || normalizedFilter === "空";
      const text =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      return text.toLocaleLowerCase().includes(normalizedFilter);
    });
  };
  const update = (
    filters: TableFilterValues,
    context: TablePluginContext<T, FilterState>,
  ) => {
    const normalized = Object.fromEntries(
      Object.entries(filters)
        .filter(([, value]) => value.trim())
        .map(([key, value]) => [key, value.trim()]),
    );
    context.setState({ filters: normalized });
    const pagination = context.getState<PaginationState>("pagination");
    if (pagination)
      context.setPluginState<PaginationState>("pagination", {
        ...pagination,
        current: 1,
      });
    options.onChange?.(normalized);
  };
  return {
    id: "filter",
    order: 35,
    initialState: { filters: { ...(options.defaultValue ?? {}) } },
    transformColumns(columns, context) {
      return mapTableLeafColumns(columns, (column) => {
        if (!column.filterable) return column;
        const previousHeader = column.renderHeader;
        return {
          ...column,
          renderHeader: (currentColumn, coreContext) => {
            const renderedColumn = {
              ...currentColumn,
              title: previousHeader
                ? previousHeader(currentColumn, coreContext)
                : currentColumn.title,
            };
            const placeholder =
              typeof options.placeholder === "function"
                ? options.placeholder(currentColumn)
                : (options.placeholder ??
                  `输入${getColumnLabel(currentColumn)}筛选`);
            return (
              <TableFilterControl
                column={renderedColumn}
                value={current(context)[column.key] ?? ""}
                placeholder={placeholder}
                onApply={(value) =>
                  update({ ...current(context), [column.key]: value }, context)
                }
              />
            );
          },
        };
      });
    },
    transformRows(rows, context) {
      return rows.filter((row) => matches(row.record, context));
    },
    getApi(context) {
      return {
        getFilters: () => current(context),
        setFilter: (columnKey, value) =>
          update({ ...current(context), [columnKey]: value }, context),
        clear: (columnKey) =>
          update(
            columnKey ? { ...current(context), [columnKey]: "" } : {},
            context,
          ),
        getFilteredRows: () =>
          context.sourceData.filter((record) => matches(record, context)),
      };
    },
  };
}

// Pagination plugin
/** TablePagination的插件配置。 */
export interface TablePaginationPluginOptions {
  /** 展示或交互模式；可选值见类型定义。 */
  mode?: "local" | "server" | "auto";
  /** 记录总条数。 */
  totalCount?: number;
  /** 当前页码、步骤或播放位置，具体取值见组件类型。 */
  current?: number;
  /** 每页显示的记录数。 */
  pageSize?: number;
  /** 非受控模式的初始页码或步骤位置。 */
  defaultCurrent?: number;
  /** 非受控模式下每页默认展示的记录数。 */
  defaultPageSize?: number;
  /** 每页条数候选项 */
  pageSizeOptions?: readonly number[];
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (current: number, pageSize: number, isFirstLoad?: boolean) => void;
  /** 按分页上下文异步请求总记录数。 */
  requestTotal?: (model?: unknown) => Promise<void>;
  /** 是否为首次加载。 */
  isFirstLoad?: boolean;
}
/** 表格分页和总数请求状态。 */
interface PaginationState {
  /** 当前页码。 */
  current: number;
  /** 每页记录数。 */
  pageSize: number;
  /** 是否正在请求记录总数。 */
  requestLoading: boolean;
}
/** TablePagination的操作接口。 */
export interface TablePaginationApi {
  /** 读取当前分页状态。 */
  getPage: () => {
  /** 当前页码、步骤或播放位置，具体取值见组件类型。 */
  current: number;
  /** 每页显示的记录数。 */
  pageSize: number };
  /** 设置当前页码与分页参数。 */
  setPage: (page: Partial<{
  /** 当前页码、步骤或播放位置，具体取值见组件类型。 */
  current: number;
  /** 每页显示的记录数。 */
  pageSize: number }>) => void;
  /** 将分页状态转换为业务请求需要的参数。 */
  generatePageParams: <Model extends Record<string, unknown>>(
    model: Model,
  ) => Model & TablePageParams;
  /** 请求记录总数的函数。 */
  requestCount: (model?: unknown) => Promise<void>;
}
/** 创建表格分页插件。将返回值加入 Table 的 plugins 后生效。 */
export function createPaginationPlugin<T extends Record<string, unknown>>(
  options: TablePaginationPluginOptions = {},
): TablePlugin<T, PaginationState, TablePaginationApi> {
  const currentPage = (context: TablePluginContext<T, PaginationState>) => ({
    current: options.current ?? context.state.current,
    pageSize: options.pageSize ?? context.state.pageSize,
  });
  const setPage = (
    next: Partial<{ current: number; pageSize: number }>,
    context: TablePluginContext<T, PaginationState>,
    notify = true,
  ) => {
    const previous = currentPage(context);
    const page = {
      current: Math.max(1, next.current ?? previous.current),
      pageSize: Math.max(1, next.pageSize ?? previous.pageSize),
    };
    context.setState((state) => ({ ...state, ...page }));
    if (page.pageSize !== previous.pageSize)
      context.emit({
        type: "pageSizeChange",
        source: "pagination",
        payload: page.pageSize,
      });
    if (page.current !== previous.current)
      context.emit({ type: "pageChange", source: "pagination", payload: page });
    if (notify) options.onChange?.(page.current, page.pageSize);
  };
  const requestCount = async (
    model: unknown,
    context: TablePluginContext<T, PaginationState>,
  ) => {
    if (!options.requestTotal) return;
    context.setState((state) => ({ ...state, requestLoading: true }));
    try {
      await options.requestTotal(model);
    } finally {
      context.setState((state) => ({ ...state, requestLoading: false }));
    }
  };
  return {
    id: "pagination",
    order: 50,
    initialState: {
      current: options.defaultCurrent ?? 1,
      pageSize: options.defaultPageSize ?? 25,
      requestLoading: false,
    },
    onMount(context) {
      if (options.isFirstLoad)
        options.onChange?.(
          currentPage(context).current,
          currentPage(context).pageSize,
          true,
        );
    },
    transformRows(rows, context) {
      const page = currentPage(context);
      const mode = options.mode ?? "auto";
      const serverPagination =
        mode === "server" ||
        (mode === "auto" &&
          options.totalCount != null &&
          options.totalCount > context.sourceData.length);
      return serverPagination
        ? rows
        : rows.slice(
            (page.current - 1) * page.pageSize,
            page.current * page.pageSize,
          );
    },
    renderFooter(context) {
      const page = currentPage(context);
      const filteredCount = context
        .getPluginApi<TableFilterApi<T>>("filter")
        ?.getFilteredRows().length;
      const totalRecords =
        options.totalCount ?? filteredCount ?? context.sourceData.length;
      return (
        <Pagination
          className="sia-table__pagination"
          currentPageCount={context.rows.length}
          current={page.current}
          pageSize={page.pageSize}
          pageSizeOptions={options.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS}
          total={totalRecords}
          refreshing={context.state.requestLoading}
          onRefreshTotal={
            options.requestTotal
              ? () => requestCount(undefined, context)
              : undefined
          }
          onChange={(current, pageSize) =>
            setPage({ current, pageSize }, context)
          }
        />
      );
    },
    getApi(context) {
      return {
        getPage: () => currentPage(context),
        setPage: (page) => setPage(page, context),
        generatePageParams: (model) => {
          const page = currentPage(context);
          const next = {
            current:
              typeof model.pageIndex === "number"
                ? model.pageIndex
                : page.current,
            pageSize:
              typeof model.pageSize === "number"
                ? model.pageSize
                : page.pageSize,
          };
          setPage(next, context, false);
          return {
            ...model,
            ...toTablePageParams(next.current, next.pageSize),
          };
        },
        requestCount: (model) => requestCount(model, context),
      };
    },
  };
}

// Index plugin
/** TableIndex的插件配置。 */
export interface TableIndexPluginOptions {
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?: number;
  /** 序号列的起始编号。 */
  startIndex?: number;
}
/** 创建表格序号列插件。Table 默认内置；显式加入 plugins 可覆盖标题、宽度和起始编号，不重复加载。Table 的 showIndex=false 时禁用。序号固定在业务列之前（有勾选列时位于其后），不参与列设置。 */
export function createIndexPlugin<T extends Record<string, unknown>>(
  options: TableIndexPluginOptions = {},
): TablePlugin<T, undefined> {
  return {
    id: "index",
    order: 30,
    transformColumns(columns, context) {
      const column: TableColumn<T> = {
        key: "__index__",
        title: options.title ?? "序号",
        name: "序号",
        width: options.width ?? 60,
        minWidth: 48,
        fixed: "left",
        align: "center",
        ellipsis: false,
        meta: { plugin: "index" },
        render: (_value, _record, _index, info) => {
          const page = context.getState<PaginationState>("pagination");
          const offset = page
            ? ((page.current ?? 1) - 1) * (page.pageSize ?? 0)
            : 0;
          return (options.startIndex ?? 1) + offset + info.rowIndex;
        },
      };
      const selectionIndex = columns.findIndex(
        (item) => item.meta?.plugin === "selection",
      );
      if (selectionIndex < 0) return [column, ...columns];
      return [
        ...columns.slice(0, selectionIndex + 1),
        column,
        ...columns.slice(selectionIndex + 1),
      ];
    },
    getCellProps(_row, column, context) {
      const hasSelectionColumn = context.columns.some(
        (item) => item.meta?.plugin === "selection",
      );
      return column.meta?.plugin === "index" && hasSelectionColumn
        ? { className: "sia-table__cell--index-action" }
        : undefined;
    },
  };
}

// Tree plugin
/** TableTree的插件配置。 */
export interface TableTreePluginOptions<T> {
  /** 显示树形层级连接线；仅在 ignoreChildrenColumn=false 时生效，默认 false。 */
  showLine?: boolean;
  /** 行数据中存放子行的字段名。 */
  childrenColumnName?: string;
  /** 是否忽略数据内的子行字段。 */
  ignoreChildrenColumn?: boolean;
  /** 受控的展开行标识集合。 */
  expandedRowKeys?: readonly TableKey[];
  /** 初始化时展开的行标识集合。 */
  defaultExpandedRowKeys?: readonly TableKey[];
  /** 是否在初始化时展开全部行。 */
  defaultExpandAllRows?: boolean;
  /** 展开行集合变化时调用。 */
  onExpandedRowsChange?: (keys: readonly TableKey[]) => void;
  /** 按记录判断是否允许展开该行。 */
  canExpand?: (record: T) => boolean;
}
/** 树形行的展开状态。 */
interface TreeState {
  /** 已展开的行标识集合。 */
  expandedKeys: readonly TableKey[];
}
/** TableTree的操作接口。 */
export interface TableTreeApi {
  /** 读取展开行或节点的标识集合。 */
  getExpandedKeys: () => readonly TableKey[];
  /** 设置展开行或节点的标识集合。 */
  setExpandedKeys: (keys: readonly TableKey[]) => void;
  /** 展开全部可展开行或节点。 */
  expandAll: () => void;
  /** 收起全部已展开行或节点。 */
  collapseAll: () => void;
}

/** 创建表格树形行展开插件。将返回值加入 Table 的 plugins 后生效。 */
export function createTreePlugin<T extends Record<string, unknown>>(
  options: TableTreePluginOptions<T> = {},
): TablePlugin<T, TreeState, TableTreeApi> {
  const childKey = options.childrenColumnName ?? "children";
  const current = (context: TablePluginContext<T, TreeState>) =>
    options.expandedRowKeys ?? context.state.expandedKeys;
  const allExpandableKeys = (context: TablePluginContext<T, TreeState>) =>
    flattenRecords(context.sourceData, childKey)
      .filter(
        (record) =>
          Array.isArray(record[childKey]) &&
          (record[childKey] as unknown[]).length > 0,
      )
      .map((record, index) => context.getRowKey(record, index));
  const setKeys = (
    keys: readonly TableKey[],
    context: TablePluginContext<T, TreeState>,
  ) => {
    context.setState({ expandedKeys: keys });
    options.onExpandedRowsChange?.(keys);
  };
  const toggle = (key: TableKey, context: TablePluginContext<T, TreeState>) =>
    setKeys(
      current(context).includes(key)
        ? current(context).filter((item) => item !== key)
        : [...current(context), key],
      context,
    );
  return {
    id: "tree",
    order: 60,
    initialState: { expandedKeys: options.defaultExpandedRowKeys ?? [] },
    onMount(context) {
      if (options.defaultExpandAllRows && options.expandedRowKeys === undefined)
        setKeys(allExpandableKeys(context), context);
    },
    transformRows(rows, context) {
      if (options.ignoreChildrenColumn ?? true) return rows;
      const result: TableRow<T>[] = [];
      // 保存祖先后续兄弟信息，虚拟滚动时每行独立绘制，末级分支不会连到下一棵树。
      const walk = (items: readonly TableRow<T>[], depth: number, guides: boolean[]) => {
        for (const [rowIndex, row] of items.entries()) {
          const hasNextSibling = rowIndex < items.length - 1;
          const children = row.record[childKey];
          const hasChildren =
            Array.isArray(children) &&
            children.length > 0 &&
            (options.canExpand?.(row.record) ?? true);
          result.push({
            ...row,
            depth,
            meta: { ...row.meta, treeHasChildren: hasChildren, treeGuides: guides, treeHasNextSibling: hasNextSibling },
          });
          if (hasChildren && current(context).includes(row.key)) {
            walk(
              (children as T[]).map((record, index) => ({
                key: context.getRowKey(record, index),
                record,
                sourceIndex: index,
                depth: depth + 1,
                meta: {},
              })),
              depth + 1,
              depth > 0 ? [...guides, hasNextSibling] : guides,
            );
          }
        }
      };
      walk(rows, 0, []);
      return result;
    },
    transformColumns(columns, context) {
      if (options.ignoreChildrenColumn ?? true) return columns;
      let wrapped = false;
      return mapTableLeafColumns(columns, (column) => {
        if (wrapped || column.meta?.plugin) return column;
        wrapped = true;
        const previousRender = column.render;
        return {
          ...column,
          ...(options.showLine ? { ellipsis: false, meta: { ...column.meta, treeLines: true } } : {}),
          render: (value, record, index, info) => (
            <span
              className={`sia-table__tree-cell${options.showLine ? " sia-table__tree-cell--lines" : ""}`}
              style={options.showLine ? undefined : { paddingLeft: info.row.depth * 18 }}
            >
              {options.showLine && info.row.depth > 0 && <>
                {(info.row.meta.treeGuides as boolean[]).map((continued, level) =>
                  <span key={level} aria-hidden="true" className={`sia-table__tree-guide${continued ? " sia-table__tree-guide--continued" : ""}`} />)}
                <span aria-hidden="true" className={`sia-table__tree-guide sia-table__tree-guide--branch${info.row.meta.treeHasNextSibling ? " sia-table__tree-guide--continued" : ""}`} />
              </>}
              <span className={options.showLine ? "sia-table__tree-node" : undefined} style={options.showLine ? undefined : { display: "contents" }}>
              {options.showLine && !!info.row.meta.treeHasChildren && current(context).includes(info.row.key) &&
                <span aria-hidden="true" className="sia-table__tree-stem" />}
              {info.row.meta.treeHasChildren ? (
                <button
                  type="button"
                  className="sia-table__tree-toggle"
                  aria-label={
                    current(context).includes(info.row.key)
                      ? "收起子节点"
                      : "展开子节点"
                  }
                  aria-expanded={current(context).includes(info.row.key)}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(info.row.key, context);
                  }}
                >
                  <Icon
                    name={
                      current(context).includes(info.row.key)
                        ? "chevron-down"
                        : "chevron-right"
                    }
                    size={13}
                  />
                </button>
              ) : (
                <span className="sia-table__tree-placeholder" />
              )}
              </span>
              {previousRender
                ? previousRender(value, record, index, info)
                : (value as ReactNode)}
            </span>
          ),
        };
      });
    },
    getCellProps(_row, column) {
      // 连接线占满数据行高度，不受单元格默认上下内边距截断。
      return column.meta?.treeLines
        ? { className: "sia-table__cell--tree-lines" }
        : undefined;
    },
    getApi: (context) => ({
      getExpandedKeys: () => current(context),
      setExpandedKeys: (keys) => setKeys(keys, context),
      expandAll: () => setKeys(allExpandableKeys(context), context),
      collapseAll: () => setKeys([], context),
    }),
  };
}

// Summary plugin
/** TableSummary的插件配置。 */
export interface TableSummaryPluginOptions<T> {
  /** 当前数据范围的小计配置。 */
  subTotal?:
    | Record<string, ReactNode>
    | ((pageData: readonly T[]) => Record<string, ReactNode>);
  /** 数据总数 */
  total?: Record<string, ReactNode>;
  /** 小计行的标题文案。 */
  subTotalLabel?: ReactNode;
  /** 总计行的标题文案。 */
  totalLabel?: ReactNode;
}
/** 创建表格小计与总计插件。将返回值加入 Table 的 plugins 后生效。 */
export function createSummaryPlugin<T extends Record<string, unknown>>(
  options: TableSummaryPluginOptions<T>,
): TablePlugin<T, undefined> {
  return {
    id: "summary",
    order: 90,
    renderSummary(context) {
      const rows: TableSummaryRow[] = [];
      if (options.subTotal)
        rows.push({
          key: "subtotal",
          label: options.subTotalLabel ?? "小计",
          values:
            typeof options.subTotal === "function"
              ? options.subTotal(context.rows.map((row) => row.record))
              : options.subTotal,
        });
      if (options.total)
        rows.push({
          key: "total",
          label: options.totalLabel ?? "总计",
          values: options.total,
          className: "sia-table__summary-row--total",
        });
      return rows;
    },
  };
}

// Editable plugin
/** 表格当前编辑单元格的状态。 */
interface EditableState {
  /** 是否处于编辑状态。 */
  editing: {
  /** 行唯一键字段或计算函数 */
  rowKey: TableKey;
  /** 列的唯一标识，对应 TableColumn.key。 */
  columnKey: string } | null;
}
/** TableEditable的插件配置。 */
export interface TableEditablePluginOptions<T> {
  /** 单元格编辑值变化时调用，接收行、列及新旧值等上下文。 */
  onCellChange?: (
    columnKey: string,
    record: T,
    newValue: unknown,
  ) => boolean | Promise<boolean>;
  /** 触发显示的交互方式。 */
  trigger?: "click" | "doubleClick";
}
/** TableEditable的操作接口。 */
export interface TableEditableApi {
  /** 取消当前编辑或操作。 */
  cancel: () => void;
  /** 读取当前正在编辑的单元格。 */
  getEditingCell: () => EditableState["editing"];
}

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
  const config =
    typeof editable === "object" ? editable : { type: "input" as const };
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editValueRef = useRef(value);
  const savingRef = useRef(false);
  const saveRef = useRef<(nextValue?: unknown) => Promise<void>>(
    async () => {},
  );
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
    try {
      await onSave(nextValue);
    } finally {
      onCancel();
      savingRef.current = false;
      setSaving(false);
    }
  }
  saveRef.current = save;

  useEffect(() => {
    if (!active || config.type === "select" || config.type === "custom") return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || editorRef.current?.contains(target))
        return;
      void saveRef.current();
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () =>
      document.removeEventListener(
        "pointerdown",
        handleOutsidePointerDown,
        true,
      );
  }, [active, config.type]);

  if (!active)
    return (
      <div
        className="sia-table__editable-display"
        onClick={trigger === "click" ? onStart : undefined}
        onDoubleClick={trigger === "doubleClick" ? onStart : undefined}
      >
        <span>{content}</span>
        <Icon name="edit" size={13} />
      </div>
    );
  let editor: ReactNode;
  if (config.type === "custom" && config.editRender) {
    editor = config.editRender(record, (next) => void save(next), onCancel);
  } else if (config.type === "inputNumber") {
    editor = (
      <InputNumber
        ref={inputRef as never}
        size="small"
        value={typeof editValue === "number" ? editValue : null}
        onChange={updateEditValue}
        disabled={saving}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const rawValue = event.currentTarget.value.trim();
            const nextValue = rawValue === "" ? null : Number(rawValue);
            if (nextValue === null || Number.isFinite(nextValue))
              void save(nextValue);
          }
          if (event.key === "Escape") onCancel();
        }}
      />
    );
  } else if (config.type === "select") {
    editor = (
      <Select
        size="small"
        value={editValue as string | number | null}
        options={config.options ?? []}
        disabled={saving}
        onChange={(next) => {
          updateEditValue(next);
          void save(next);
        }}
      />
    );
  } else {
    editor = (
      <Input
        ref={inputRef}
        size="small"
        value={String(editValue ?? "")}
        disabled={saving}
        suffix={saving ? <Icon name="loader" size={13} spin /> : null}
        onChange={(event) => updateEditValue(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") onCancel();
        }}
      />
    );
  }
  return (
    <div ref={editorRef} className="sia-table__editor">
      {editor}
    </div>
  );
}

/** 创建表格单元格编辑插件。将返回值加入 Table 的 plugins 后生效。 */
export function createEditablePlugin<T extends Record<string, unknown>>(
  options: TableEditablePluginOptions<T> = {},
): TablePlugin<T, EditableState, TableEditableApi> {
  const trigger = options.trigger ?? "click";
  return {
    id: "editable",
    order: 70,
    initialState: { editing: null },
    transformColumns(columns, context) {
      return mapTableLeafColumns(columns, (column) => {
        if (!column.editable) return column;
        const previousRender = column.render;
        return {
          ...column,
          render: (value, record, index, info) => {
            const config =
              typeof column.editable === "object" ? column.editable : undefined;
            const canEdit = config?.canEdit?.(record) ?? true;
            const active =
              canEdit &&
              context.state.editing?.rowKey === info.row.key &&
              context.state.editing.columnKey === column.key;
            const content = previousRender
              ? previousRender(value, record, index, info)
              : (value as ReactNode);
            if (!canEdit) return content;
            return (
              <EditableTableCell
                active={active}
                editable={column.editable!}
                value={value}
                record={record}
                content={content}
                trigger={trigger}
                onStart={() =>
                  context.setState({
                    editing: { rowKey: info.row.key, columnKey: column.key },
                  })
                }
                onCancel={() =>
                  context.setState((state) =>
                    state.editing?.rowKey === info.row.key &&
                    state.editing.columnKey === column.key
                      ? { editing: null }
                      : state,
                  )
                }
                onSave={async (nextValue) =>
                  (await options.onCellChange?.(
                    column.key,
                    record,
                    nextValue,
                  )) !== false
                }
              />
            );
          },
        };
      });
    },
    getApi: (context) => ({
      cancel: () => context.setState({ editing: null }),
      getEditingCell: () => context.state.editing,
    }),
  };
}

// Column resize plugin
/** 已调整列宽和手动布局状态。 */
interface ResizeState {
  /** 列标识到已调整宽度的映射。 */
  widths: Record<string, number>;
  /** 是否已启用手动列宽布局。 */
  manualLayout?: boolean;
}
/** TableResize的插件配置。 */
export interface TableResizePluginOptions {
  /** 是否启用该功能。 */
  enabled?: boolean;
  /** 拖拽调整列宽结束时调用，接收 columnKey 和最终宽度（px）；拖动过程中不会逐帧触发。 */
  onResize?: (columnKey: string, width: number) => void;
}
/** TableResize的操作接口。 */
export interface TableResizeApi {
  /** 读取已调整的列宽映射，键为列标识。 */
  getWidths: () => Readonly<Record<string, number>>;
  /** 设置指定列的宽度，并通知列宽变更监听者。 */
  setWidth: (columnKey: string, width: number) => void;
}

/** 创建表格列宽拖拽调整插件。将返回值加入 Table 的 plugins 后生效。 */
export function createResizePlugin<T extends Record<string, unknown>>(
  options: TableResizePluginOptions = {},
): TablePlugin<T, ResizeState, TableResizeApi> {
  const enabled = options.enabled ?? true;
  function setWidth(
    columnKey: string,
    width: number,
    context: TablePluginContext<T, ResizeState>,
    notify = false,
  ) {
    context.setState((state) => ({
      ...state,
      widths: { ...state.widths, [columnKey]: width },
    }));
    if (notify) {
      options.onResize?.(columnKey, width);
      context.emit({
        type: "columnResize",
        source: "resize",
        payload: { columnKey, width },
      });
    }
  }
  return {
    id: "resize",
    order: 80,
    initialState: { widths: {} },
    transformColumns(columns, context) {
      if (!enabled) return columns;
      return mapTableLeafColumns(columns, (column) => {
        const autoWidth = isTableAutoWidthColumn(column);
        const configuredWidth =
          context.state.widths[column.key] ?? column.width;
        const width = configuredWidth ?? (autoWidth ? undefined : 160);
        const previousHeader = column.renderHeader;
        return {
          ...column,
          autoWidth,
          width,
          renderHeader: (currentColumn, coreContext) => (
            <span className="sia-table__resizable-header">
              <span>
                {previousHeader
                  ? previousHeader(currentColumn, coreContext)
                  : (currentColumn.title ??
                    currentColumn.name ??
                    currentColumn.key)}
              </span>
              <span
                className="sia-table__resize-handle"
                role="separator"
                aria-label={`调整${getColumnLabel(currentColumn)}列宽`}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const startX = event.clientX;
                  const header = event.currentTarget.closest("th");
                  const table = header?.closest("table");
                  const viewport = table?.closest<HTMLElement>(
                    ".sia-table__viewport",
                  );
                  // Snapshot rendered leaf widths, including space previously assigned by flex.
                  const renderedWidths: Record<string, number> = {};
                  table
                    ?.querySelectorAll<HTMLTableColElement>(
                      "colgroup > col[data-column-key]",
                    )
                    .forEach((element) => {
                      const measured = element.getBoundingClientRect().width;
                      if (measured > 0)
                        renderedWidths[element.dataset.columnKey!] = measured;
                    });
                  const startWidth =
                    header?.getBoundingClientRect().width ??
                    currentColumn.width ??
                    width ??
                    160;
                  const startScrollLeft = viewport?.scrollLeft ?? 0;
                  const minWidth = column.minWidth ?? 56;
                  const maxWidth = column.maxWidth ?? Number.POSITIVE_INFINITY;
                  let finalWidth = startWidth;
                  let moved = false;
                  const previousCursor = document.body.style.cursor;
                  const previousUserSelect = document.body.style.userSelect;
                  const move = (moveEvent: globalThis.MouseEvent) => {
                    const scrollDelta = normalizeFixed(column.fixed)
                      ? 0
                      : (viewport?.scrollLeft ?? 0) - startScrollLeft;
                    finalWidth = Math.min(
                      maxWidth,
                      Math.max(
                        minWidth,
                        startWidth + moveEvent.clientX - startX + scrollDelta,
                      ),
                    );
                    moved = true;
                    context.setState((state) => ({
                      ...state,
                      manualLayout: true,
                      widths: {
                        ...state.widths,
                        ...renderedWidths,
                        [column.key]: finalWidth,
                      },
                    }));
                  };
                  const up = () => {
                    document.removeEventListener("mousemove", move);
                    document.removeEventListener("mouseup", up);
                    window.removeEventListener("blur", up);
                    document.body.style.cursor = previousCursor;
                    document.body.style.userSelect = previousUserSelect;
                    if (moved) setWidth(column.key, finalWidth, context, true);
                  };
                  document.addEventListener("mousemove", move);
                  document.addEventListener("mouseup", up);
                  window.addEventListener("blur", up);
                  document.body.style.cursor = "ew-resize";
                  document.body.style.userSelect = "none";
                }}
              />
            </span>
          ),
        };
      });
    },
    getApi: (context) => ({
      getWidths: () => context.state.widths,
      setWidth: (columnKey, width) => setWidth(columnKey, width, context, true),
    }),
  };
}

// Column setting plugin and persistence adapter
/** TableColumnSetting的插件配置。 */
export interface TableColumnSettingPluginOptions<T> {
  /** 设置按钮的完整 Button 属性；className 合并，disabled/loading 同时禁用菜单触发。 */
  buttonProps?: ButtonProps;
  /** 追加到设置下拉菜单中的业务操作。 */
  menuItems?: readonly TableToolbarItem<T>[];
  /** 是否显示设置菜单中的导出操作，默认 true。 */
  showExport?: boolean;
  /** 未读取到保存配置时默认显示的列标识。 */
  defaultVisibleKeys?: readonly string[];
  /** 是否在工具栏显示此插件的操作按钮。 */
  showButton?: boolean;
  /** 可见列集合变化时调用。 */
  onVisibleChange?: (columns: readonly TableColumn<T>[]) => void;
  /** 列顺序变化时调用。 */
  onOrderChange?: (columns: readonly TableColumn<T>[]) => void;
  /** 配置持久化适配器，提供 load 和 save 方法对接本地或云端存储。 */
  adapter?: TableSettingsAdapter;
  /** 配置存储的作用域，用于隔离不同模块和业务表格。 */
  scope?: {
  /** 所属业务模块名称。 */
  moduleName: string;
  /** 同一模块内用于区分表格配置的业务标识。 */
  businessKey: string };
}
/** 列设置插件的加载、面板和持久化状态。 */
interface ColumnSettingState {
  /** 列设置面板是否打开。 */
  open: boolean;
  /** 当前列设置集合。 */
  items: readonly TableColumnSettingItem[];
  /** 是否已完成一次配置读取。 */
  loaded: boolean;
  /** 是否正在读取配置。 */
  loading?: boolean;
  /** 最近一次配置读取是否失败。 */
  loadError?: boolean;
  /** 用于忽略过期读取响应的请求标记。 */
  loadToken?: symbol;
  /** 每页记录数。 */
  pageSize?: number;
}
/** TableColumnSetting的操作接口。 */
export interface TableColumnSettingApi {
  /** 打开列设置面板，并通过已配置的适配器重新读取保存配置。 */
  open: () => void;
  /** 关闭当前界面或实例。 */
  close: () => void;
  /** 读取当前列设置快照。 */
  getSettings: () => readonly TableColumnSettingItem[];
  /** 应用传入的配置；是否持久化由方法参数或插件选项控制。 */
  apply: (settings: readonly TableColumnSettingItem[]) => void;
}

/** 框架附加列不参与业务列的显隐、固定位置和排序配置。 */
function isTableAuxiliaryColumn<T>(column: TableColumn<T>) {
  return column.meta?.plugin === "index" || column.meta?.plugin === "selection"
    || column.key === "__index__" || column.key === "__selection__";
}

function createColumnSettingItems<T>(
  columns: readonly TableColumn<T>[],
  visibleKeys?: readonly string[],
): TableColumnSettingItem[] {
  return flattenTableColumns(columns).filter((column) => !isTableAuxiliaryColumn(column)).map((column, order) => ({
    key: column.key,
    width: column.width,
    fixed: normalizeFixed(column.fixed),
    visible:
      !column.hidden && (!visibleKeys || visibleKeys.includes(column.key)),
    order,
  }));
}

function applyColumnSettingsToTree<T>(
  columns: readonly TableColumn<T>[],
  items: readonly TableColumnSettingItem[],
): TableColumn<T>[] {
  const itemMap = new Map(items.map((item) => [item.key, item]));
  const walk = (
    source: readonly TableColumn<T>[],
  ): Array<{ column: TableColumn<T>; order: number }> =>
    source
      .flatMap((column, sourceOrder) => {
        // 即便上游已插入附加列，也保持勾选列、序号列领先于业务列，忽略旧配置。
        if (isTableAuxiliaryColumn(column)) return [{ column, order: column.meta?.plugin === "selection" || column.key === "__selection__" ? -2 : -1 }];
        if (column.children?.length) {
          const children = walk(column.children);
          if (children.length === 0) return [];
          return [
            {
              column: {
                ...column,
                children: children.map((entry) => entry.column),
              },
              order: Math.min(...children.map((entry) => entry.order)),
            },
          ];
        }
        const item = itemMap.get(column.key);
        if (item && !item.visible) return [];
        return [
          {
            column: item
              ? {
                  ...column,
                  width: item.width ?? column.width,
                  fixed: item.fixed,
                }
              : column,
            order: item?.order ?? items.length + sourceOrder,
          },
        ];
      })
      .sort((left, right) => left.order - right.order);
  return walk(columns).map((entry) => entry.column);
}

function orderColumnSettings(items: readonly TableColumnSettingItem[]) {
  const rank = (item: TableColumnSettingItem) =>
    item.fixed === "left" ? 0 : item.fixed === "right" ? 2 : 1;
  return [...items]
    .sort((a, b) => rank(a) - rank(b))
    .map((item, order) => ({ ...item, order }));
}

function ColumnSettingPanel<T extends Record<string, unknown>>({
  open,
  items,
  columns,
  loading,
  loadError,
  onRetry,
  onClose,
  onApply,
}: {
  open: boolean;
  loading?: boolean;
  loadError?: boolean;
  onRetry: () => void;
  items: readonly TableColumnSettingItem[];
  columns: readonly TableColumn<T>[];
  onClose: () => void;
  onApply: (items: readonly TableColumnSettingItem[]) => void;
}) {
  const [draft, setDraft] = useState<readonly TableColumnSettingItem[]>(items);
  const listRef = useRef<HTMLDivElement>(null);
  const cancelDrag = useRef<(() => void) | null>(null);
  const [preview, setPreview] = useState<{
    key: string;
    fixed: TableFixed | undefined;
    offsets: Record<string, number>;
  } | null>(null);
  useEffect(() => {
    cancelDrag.current?.();
    if (open) setDraft(orderColumnSettings(items));
  }, [items, open]);
  useEffect(() => () => cancelDrag.current?.(), []);
  const labels = new Map(
    flattenTableColumns(columns).map((column) => [
      column.key,
      getColumnLabel(column),
    ]),
  );
  const visibleCount = draft.filter((item) => item.visible).length;
  function setFixed(key: string, fixed: TableFixed | undefined) {
    setDraft((previous) => {
      const item = previous.find((entry) => entry.key === key);
      if (!item) return previous;
      const next = previous.filter((entry) => entry.key !== key);
      const updated = { ...item, fixed };
      const target =
        fixed === "left"
          ? next.filter((entry) => entry.fixed === "left").length
          : fixed === "right"
            ? next.findIndex((entry) => entry.fixed === "right")
            : item.fixed === "left"
              ? next.filter((entry) => entry.fixed === "left").length
              : next.findIndex((entry) => entry.fixed === "right");
      next.splice(target < 0 ? next.length : target, 0, updated);
      return orderColumnSettings(next);
    });
  }
  function startSort(event: ReactPointerEvent<HTMLDivElement>, key: string) {
    if (
      loading ||
      loadError ||
      event.button !== 0 ||
      (event.target as Element).closest("button, input, label")
    )
      return;
    const list = listRef.current;
    if (!list) return;
    cancelDrag.current?.();
    const original = [...draft];
    const from = original.findIndex((item) => item.key === key);
    const elements = Array.from(
      list.querySelectorAll<HTMLElement>(".sia-table-settings__item"),
    );
    const rects = elements.map((element) => element.getBoundingClientRect());
    const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
    const positions = original.map((_, index) => index);
    const startY = event.clientY;
    let lastY = startY;
    let moved = false;
    let next = original;
    let frame = 0;
    let scrollParent: HTMLElement | null = list.parentElement;
    while (
      scrollParent &&
      !(
        scrollParent.scrollHeight > scrollParent.clientHeight &&
        /auto|scroll/.test(getComputedStyle(scrollParent).overflowY)
      )
    )
      scrollParent = scrollParent.parentElement;
    const initialScroll = scrollParent?.scrollTop ?? 0;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const previousUserSelect = document.body.style.userSelect;
    function update() {
      const dy =
        lastY - startY + (scrollParent?.scrollTop ?? 0) - initialScroll;
      if (!moved && Math.abs(dy) < 4) return;
      moved = true;
      document.body.style.userSelect = "none";
      const center = rects[from].top + rects[from].height / 2 + dy;
      let to = from;
      for (const index of positions) {
        if (index > from && center > rects[index].top + rects[index].height / 2)
          to = index;
        if (
          index < from &&
          center < rects[index].top + rects[index].height / 2
        ) {
          to = index;
          break;
        }
      }
      next = [...original];
      const [item] = next.splice(from, 1);
      // 跨分区拖动时继承目标项的固定状态，保证保存后顺序与预览一致。
      next.splice(to, 0, { ...item, fixed: original[to].fixed });
      const offsets: Record<string, number> = {};
      let top = rects[0].top;
      for (const entry of next) {
        const index = original.findIndex((item) => item.key === entry.key);
        offsets[entry.key] = entry.key === key ? dy : top - rects[index].top;
        top += rects[index].height + gap;
      }
      setPreview({ key, fixed: original[to].fixed, offsets });
    }
    function tick() {
      if (moved && scrollParent) {
        const bounds = scrollParent.getBoundingClientRect();
        const delta =
          lastY < bounds.top + 40 ? -10 : lastY > bounds.bottom - 40 ? 10 : 0;
        if (delta) {
          scrollParent.scrollTop += delta;
          update();
        }
      }
      frame = requestAnimationFrame(tick);
    }
    function move(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== event.pointerId) return;
      lastY = moveEvent.clientY;
      update();
    }
    function finish(commit: boolean) {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", cancel);
      cancelAnimationFrame(frame);
      if (target.hasPointerCapture(event.pointerId))
        target.releasePointerCapture(event.pointerId);
      document.body.style.userSelect = previousUserSelect;
      cancelDrag.current = null;
      setPreview(null);
      if (commit && moved) setDraft(orderColumnSettings(next));
    }
    function up(upEvent: PointerEvent) {
      if (upEvent.pointerId === event.pointerId) {
        lastY = upEvent.clientY;
        update();
        finish(true);
      }
    }
    function cancel() {
      finish(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    }
    cancelDrag.current = cancel;
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("blur", cancel);
    frame = requestAnimationFrame(tick);
  }
  return (
    <Drawer
      open={open}
      title="列设置"
      size={440}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={loading || loadError}
            onClick={() => onApply(draft)}
          >
            应用
          </Button>
        </>
      }
    >
      {loadError ? (
        <p role="alert">
          读取列配置失败。
          <Button variant="link" onClick={onRetry}>
            重试
          </Button>
        </p>
      ) : null}
      <Spin spinning={Boolean(loading)} className="sia-table-settings__loading" aria-label={loading ? "正在读取列配置" : undefined}>
      <fieldset
        disabled={loading || loadError}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        aria-busy={loading}
      >
        <label className="sia-table-settings__all">
          <TableCheckbox
            label="全选列"
            checked={visibleCount === draft.length && draft.length > 0}
            indeterminate={visibleCount > 0 && visibleCount < draft.length}
            onChange={(checked) =>
              setDraft((previous) =>
                previous.map((item) => ({ ...item, visible: checked })),
              )
            }
          />
          <span>
            全选（{visibleCount}/{draft.length}）
          </span>
        </label>
        <div
          ref={listRef}
          className={`sia-table-settings__list${preview ? " is-sorting" : ""}`}
        >
          {draft.map((item) => (
            <div
              key={item.key}
              data-column-key={item.key}
              className={`sia-table-settings__item${preview?.key === item.key ? " is-dragging" : ""}`}
              style={
                preview
                  ? {
                      transform: `translateY(${preview.offsets[item.key] ?? 0}px)`,
                    }
                  : undefined
              }
              onPointerDown={(event) => startSort(event, item.key)}
            >
              <Icon name="menu" size={15} />
              <TableCheckbox
                label={`显示${labels.get(item.key) ?? item.key}列`}
                checked={item.visible}
                onChange={(checked) =>
                  setDraft((previous) =>
                    previous.map((entry) =>
                      entry.key === item.key
                        ? { ...entry, visible: checked }
                        : entry,
                    ),
                  )
                }
              />
              <span
                className="sia-table-settings__name"
              >
                {labels.get(item.key) ?? item.key}
              </span>
              <div className="sia-table-settings__actions">
                <Button
                  size="small"
                  variant={
                    (preview?.key === item.key ? preview.fixed : item.fixed) ===
                    "left"
                      ? "primary"
                      : "text"
                  }
                  aria-label="左固定"
                  onClick={() =>
                    setFixed(
                      item.key,
                      item.fixed === "left" ? undefined : "left",
                    )
                  }
                >
                  左
                </Button>
                <Button
                  size="small"
                  variant={
                    (preview?.key === item.key ? preview.fixed : item.fixed) ===
                    "right"
                      ? "primary"
                      : "text"
                  }
                  aria-label="右固定"
                  onClick={() =>
                    setFixed(
                      item.key,
                      item.fixed === "right" ? undefined : "right",
                    )
                  }
                >
                  右
                </Button>
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      </Spin>
    </Drawer>
  );
}

const columnSettingLoadTokens = new WeakMap<object, symbol>();

/** 创建表格列设置和持久化插件。将返回值加入 Table 的 plugins 后生效；序号和勾选附加列不显示在设置中，不参与业务列排序、显隐、固定位置与宽度配置，旧存储中的附加列配置会被忽略。 */
export function createColumnSettingPlugin<T extends Record<string, unknown>>(
  options: TableColumnSettingPluginOptions<T> = {},
): TablePlugin<T, ColumnSettingState, TableColumnSettingApi> {
  const baseItems = (context: TablePluginContext<T, ColumnSettingState>) =>
    createColumnSettingItems(context.baseColumns, options.defaultVisibleKeys);
  // 历史存储和外部 apply 可能包含附加列或已移除列，只接收当前业务列的配置。
  const editableItems = (items: readonly TableColumnSettingItem[], context: TablePluginContext<T, ColumnSettingState>) => {
    const keys = new Set(baseItems(context).map((item) => item.key));
    return items.filter((item) => keys.has(item.key));
  };
  const currentItems = (context: TablePluginContext<T, ColumnSettingState>) =>
    context.state.items?.length ? editableItems(context.state.items, context) : baseItems(context);
  const save = (snapshot: TableSettingsSnapshot) =>
    options.adapter && options.scope
      ? options.adapter.save(options.scope, snapshot).catch(() => undefined)
      : Promise.resolve();
  function apply(
    items: readonly TableColumnSettingItem[],
    context: TablePluginContext<T, ColumnSettingState>,
    persist = true,
  ) {
    const normalized = orderColumnSettings(
      editableItems(items, context).sort((a, b) => a.order - b.order),
    );
    context.setState((state) => ({ ...state, items: normalized, open: false }));
    const columnMap = new Map(
      flattenTableColumns(context.baseColumns).map((column) => [
        column.key,
        column,
      ]),
    );
    options.onVisibleChange?.(
      normalized
        .filter((item) => item.visible)
        .map((item) => columnMap.get(item.key))
        .filter(Boolean) as TableColumn<T>[],
    );
    options.onOrderChange?.(
      normalized
        .map((item) => columnMap.get(item.key))
        .filter(Boolean) as TableColumn<T>[],
    );
    if (persist)
      void save({
        columns: normalized,
        pageSize: context.state.pageSize,
        version: 1,
      });
  }
  function loadSettings(
    context: TablePluginContext<T, ColumnSettingState>,
    open = false,
  ) {
    const fallback = baseItems(context);
    const token = Symbol("column-settings-load");
    columnSettingLoadTokens.set(context.setPluginState, token);
    let cancelled = false;
    const hasAdapter = Boolean(options.adapter && options.scope);
    context.setState((state) => ({
      ...state,
      open: open || state.open,
      items: state.items.length ? state.items : fallback,
      loading: hasAdapter,
      loaded: !hasAdapter,
      loadError: false,
      loadToken: token,
    }));
    if (hasAdapter)
      void Promise.resolve()
        .then(() => options.adapter!.load(options.scope!))
        .then((snapshot) => {
          if (
            cancelled ||
            columnSettingLoadTokens.get(context.setPluginState) !== token
          )
            return;
          if (snapshot?.pageSize)
            context.setPluginState<PaginationState>("pagination", (state) => ({
              ...state,
              pageSize: snapshot.pageSize!,
            }));
          context.setState((state) =>
            state.loadToken !== token
              ? state
              : {
                  ...state,
                  items: snapshot?.columns?.length
                    ? snapshot.columns
                    : fallback,
                  pageSize: snapshot?.pageSize,
                  loaded: true,
                  loading: false,
                  loadError: false,
                },
          );
        })
        .catch(() => {
          if (!cancelled)
            context.setState((state) =>
              state.loadToken !== token
                ? state
                : { ...state, loading: false, loaded: true, loadError: true },
            );
        });
    return () => {
      cancelled = true;
    };
  }
  return {
    id: "columnSetting",
    order: 10,
    initialState: { open: false, items: [], loaded: false },
    onMount(context) {
      return loadSettings(context);
    },
    transformColumns(columns, context) {
      return applyColumnSettingsToTree(columns, currentItems(context));
    },
    onEvent(event, context) {
      if (event.type === "columnResize") {
        const { columnKey, width } = event.payload as {
          columnKey: string;
          width: number;
        };
        const next = currentItems(context).map((item) =>
          item.key === columnKey ? { ...item, width } : item,
        );
        context.setState((state) => ({ ...state, items: next }));
        void save({
          columns: next,
          pageSize: context.state.pageSize,
          version: 1,
        });
      }
      if (event.type === "pageSizeChange") {
        const pageSize = event.payload as number;
        context.setState((state) => ({ ...state, pageSize }));
        void save({ columns: currentItems(context), pageSize, version: 1 });
      }
    },
    renderToolbarEnd:
      options.showButton === false
        ? undefined
        : (context) => {
            const exportApi = () =>
              context.getPluginApi<TableExportApi<T>>("export") ??
              createExportPlugin<T>().getApi!({
                ...context,
                state: undefined,
                setState: () => {},
              });
            const customItems = (options.menuItems ?? []).filter(
              (item) =>
                !(
                  item.hidden === true ||
                  (typeof item.hidden === "function" && item.hidden(context))
                ),
            );
            const items: MenuItem[] = [
              ...(options.showExport === false
                ? []
                : [
                    {
                      key: "builtin:export",
                      label: "表格导出",
                      icon: <Icon name="download" size={18} />,
                      disabled: exportApi().getRows().length === 0,
                    },
                    { key: "builtin:divider", type: "divider" as const },
                  ]),
              {
                key: "builtin:columns",
                label: "列设置",
                icon: <Icon name="settings" size={18} />,
              },
              ...customItems.map((item) => ({
                key: "custom:" + item.key,
                label: item.label,
                // 设置菜单复用菜单项提示，禁用操作也需说明不可用原因。
                title: item.title,
                icon: item.icon,
                danger: item.danger,
                disabled:
                  item.disabled === true ||
                  (typeof item.disabled === "function" &&
                    item.disabled(context)),
              })),
            ];
            return (
              <Dropdown
                disabled={
                  options.buttonProps?.disabled || options.buttonProps?.loading
                }
                trigger={["hover", "click"]}
                placement="bottomRight"
                popupClassName="sia-table__settings-dropdown"
                menu={{
                  items,
                  onClick: ({ key }) => {
                    if (key === "builtin:export") void exportApi().download();
                    else if (key === "builtin:columns")
                      loadSettings(context, true);
                    else
                      void customItems
                        .find((item) => "custom:" + item.key === key)
                        ?.onClick?.(context);
                  },
                }}
              >
                <Button
                  size="small"
                  variant="text"
                  icon={<Icon name="settings" size={16} />}
                  aria-label="表格设置"
                  {...options.buttonProps}
                  className={`sia-table__settings-button${options.buttonProps?.children == null ? " sia-table__toolbar-icon" : ""} ${options.buttonProps?.className ?? ""}`.trim()}
                />
              </Dropdown>
            );
          },
    renderOverlay: (context) => (
      <ColumnSettingPanel
        open={context.state.open}
        loading={context.state.loading}
        loadError={context.state.loadError}
        onRetry={() => loadSettings(context, true)}
        items={currentItems(context)}
        columns={context.baseColumns}
        onClose={() => context.setState((state) => ({ ...state, open: false }))}
        onApply={(items) => apply(items, context)}
      />
    ),
    getApi: (context) => ({
      open: () => {
        loadSettings(context, true);
      },
      close: () => context.setState((state) => ({ ...state, open: false })),
      getSettings: () => currentItems(context),
      apply: (items) => apply(items, context),
    }),
  };
}

/** 创建使用 localStorage 持久化表格设置的适配器，按模块及业务标识隔离配置。 */
export function createLocalStorageTableSettingsAdapter(
  prefix = "sia-table",
): TableSettingsAdapter {
  return {
    async load(scope) {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(
        `${prefix}:${scope.moduleName}:${scope.businessKey}`,
      );
      if (!raw) return null;
      try {
        return JSON.parse(raw) as TableSettingsSnapshot;
      } catch {
        return null;
      }
    },
    async save(scope, settings) {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(
        `${prefix}:${scope.moduleName}:${scope.businessKey}`,
        JSON.stringify(settings),
      );
    },
  };
}

// Toolbar plugin. Upload/export/permission actions are provided as independent items.
/** TableToolbar的项目定义。 */
export interface TableToolbarItem<T> {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: string;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 操作的悬停提示文字；普通工具栏按钮和设置菜单项均支持，禁用时仍可显示，停留 600ms 后出现。 */
  title?: string;
  /** 显示在内容旁的图标节点，建议使用 Icon 组件。 */
  icon?: ReactNode;
  /** 显示位置或定位配置。 */
  position?: "start" | "end";
  /** 是否允许该列出现在列设置面板中。 */
  inSettings?: boolean;
  /** 危险操作样式 */
  danger?: boolean;
  /** 是否禁用交互。 */
  disabled?: boolean | ((context: TablePluginContext<T, any>) => boolean);
  /** 是否隐藏此项。 */
  hidden?: boolean | ((context: TablePluginContext<T, any>) => boolean);
  /** 点击时触发，参数为当前点击事件或项目上下文。 */
  onClick?: (context: TablePluginContext<T, any>) => void | Promise<void>;
}
/** TableToolbar的插件配置。 */
export interface TableToolbarPluginOptions<T> {
  /** 范围起点。 */
  start?: ReactNode;
  /** 范围终点。 */
  end?: ReactNode;
  /** 按展示顺序排列的项目配置。 */
  items?: readonly TableToolbarItem<T>[];
  /** 按业务权限判断是否允许访问或展示。 */
  canAccess?: (item: TableToolbarItem<T>) => boolean;
}
function ToolbarItems<T extends Record<string, unknown>>({
  items,
  context,
}: {
  items: readonly TableToolbarItem<T>[];
  context: TablePluginContext<T, any>;
}) {
  return (
    <>
      {items.map((item) => {
        if (
          item.hidden === true ||
          (typeof item.hidden === "function" && item.hidden(context))
        )
          return null;
        const disabled =
          item.disabled === true ||
          (typeof item.disabled === "function" && item.disabled(context));
        return (
          <Button
            key={item.key}
            size="small"
            danger={item.danger}
            title={item.title}
            icon={item.icon}
            disabled={disabled}
            onClick={() => void item.onClick?.(context)}
          >
            {item.label}
          </Button>
        );
      })}
    </>
  );
}
/** 创建表格工具栏操作插件。将返回值加入 Table 的 plugins 后生效。 */
export function createToolbarPlugin<T extends Record<string, unknown>>(
  options: TableToolbarPluginOptions<T>,
): TablePlugin<T, undefined> {
  const allowed = (item: TableToolbarItem<T>) =>
    options.canAccess?.(item) ?? true;
  const items = (position: "start" | "end", inSettings = false) =>
    (options.items ?? []).filter(
      (item) =>
        allowed(item) &&
        (item.position ?? "start") === position &&
        Boolean(item.inSettings) === inSettings,
    );
  return {
    id: "toolbar",
    order: 5,
    renderToolbarStart: (context) => (
      <>
        {options.start}
        <ToolbarItems items={items("start")} context={context} />
      </>
    ),
    renderToolbarEnd: (context) => (
      <>
        {options.end}
        <ToolbarItems items={items("end")} context={context} />
        {items("end", true).length > 0 ? (
          <details className="sia-table__toolbar-menu">
            <summary aria-label="更多表格操作">
              <Icon name="more-horizontal" size={16} />
            </summary>
            <div>
              <ToolbarItems items={items("end", true)} context={context} />
            </div>
          </details>
        ) : null}
      </>
    ),
  };
}

// CSV export plugin
/** 表格导出的数据范围。 */
export type TableExportScope = "visible" | "all" | "selected";
/** TableExport的插件配置。 */
export interface TableExportPluginOptions<T> {
  /** 配置存储的作用域，用于隔离不同模块和业务表格。 */
  scope?: TableExportScope;
  /** 导出文件名。 */
  fileName?: string | ((context: TablePluginContext<T, undefined>) => string);
  /** CSV 字段分隔符。 */
  delimiter?: "," | "\t" | ";";
  /** 是否在导出文本前添加 UTF-8 BOM，便于表格软件识别中文。 */
  includeBom?: boolean;
  /** 是否处理可能被表格软件当作公式执行的单元格文本。 */
  sanitizeFormula?: boolean;
  /** 操作按钮的显示文案。 */
  buttonLabel?: ReactNode;
  /** 是否在工具栏显示此插件的操作按钮。 */
  showButton?: boolean;
  /** 执行导出时调用。 */
  onExport?: (csv: string, rows: readonly T[]) => void | Promise<void>;
}
/** TableExport的操作接口。 */
export interface TableExportApi<T> {
  /** 生成当前导出范围的 CSV 文本。 */
  getCsv: (scope?: TableExportScope) => string;
  /** 下载当前导出结果。 */
  download: (scope?: TableExportScope) => Promise<void>;
  /** 读取插件当前处理的行数据。 */
  getRows: (scope?: TableExportScope) => readonly T[];
}

function tableExportText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean")
    return "";
  if (
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "bigint"
  )
    return String(node);
  if (Array.isArray(node)) return node.map(tableExportText).join("");
  if (isValidElement(node))
    return tableExportText((node.props as { children?: ReactNode }).children);
  return "";
}

function tableExportCell(value: unknown, sanitizeFormula: boolean) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return sanitizeFormula && /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function tableExportEscape(value: string, delimiter: string) {
  return value.includes(delimiter) || /["\r\n]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/** 创建表格数据导出插件。将返回值加入 Table 的 plugins 后生效。 */
export function createExportPlugin<T extends Record<string, unknown>>(
  options: TableExportPluginOptions<T> = {},
): TablePlugin<T, undefined, TableExportApi<T>> {
  function getRows(
    context: TablePluginContext<T, undefined>,
    scope = options.scope ?? "visible",
  ) {
    if (scope === "all") return context.sourceData;
    if (scope === "selected")
      return (
        context
          .getPluginApi<TableSelectionApi<T>>("selection")
          ?.getSelectedRows() ?? []
      );
    return context.rows.map((row) => row.record);
  }
  function getCsv(
    context: TablePluginContext<T, undefined>,
    scope?: TableExportScope,
  ) {
    const delimiter = options.delimiter ?? ",";
    const sanitizeFormula = options.sanitizeFormula ?? true;
    const rows = getRows(context, scope);
    const columns = flattenTableColumns(context.columns).filter(
      (column) =>
        column.exportable !== false &&
        (!column.meta?.plugin || column.exportable === true),
    );
    const header = columns
      .map((column) => tableExportEscape(getColumnLabel(column), delimiter))
      .join(delimiter);
    const lines = rows.map((record, rowIndex) => {
      const row: TableRow<T> = {
        key: context.getRowKey(record, rowIndex),
        record,
        sourceIndex: rowIndex,
        depth: 0,
        meta: {},
      };
      return columns
        .map((column) => {
          const value = getTableValue(
            record,
            column.dataIndex,
            column.code ?? column.key,
          );
          const rendered = column.exportRender?.(value, record, rowIndex, {
            row,
            rowIndex,
            column,
          });
          const text =
            rendered === undefined
              ? tableExportCell(value, sanitizeFormula)
              : tableExportText(rendered);
          return tableExportEscape(text, delimiter);
        })
        .join(delimiter);
    });
    return `${options.includeBom === false ? "" : "\uFEFF"}${[header, ...lines].join("\r\n")}`;
  }
  async function download(
    context: TablePluginContext<T, undefined>,
    scope?: TableExportScope,
  ) {
    const rows = getRows(context, scope);
    const csv = getCsv(context, scope);
    if (options.onExport) {
      await options.onExport(csv, rows);
      return;
    }
    if (typeof document === "undefined") return;
    const fileName =
      typeof options.fileName === "function"
        ? options.fileName(context)
        : (options.fileName ?? "table.csv");
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
    renderToolbarEnd:
      options.showButton === false
        ? undefined
        : (context) => (
            <Button
              size="small"
              icon={<Icon name="download" size={14} />}
              disabled={getRows(context).length === 0}
              onClick={() => void download(context)}
            >
              {options.buttonLabel ?? "导出"}
            </Button>
          ),
    getApi: (context) => ({
      getCsv: (scope) => getCsv(context, scope),
      download: (scope) => download(context, scope),
      getRows: (scope) => getRows(context, scope),
    }),
  };
}

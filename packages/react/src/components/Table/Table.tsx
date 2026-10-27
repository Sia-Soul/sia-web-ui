import { withTitleTooltip } from "../titleTooltip";
import { useScrollbarProximity } from "../useScrollbarProximity";
import { TableCellContent } from "./TableCellContent";
import { useRemainingHeight } from "./useRemainingHeight";
import { TableCanvasLayer } from "./TableCanvasLayer";
import { createRowIdentity } from "./rowIdentity";
import "./canvas.css";
import "./cellFocus.css";
import { playCellFocusGlow } from "./cellFocus";
import { Fragment, forwardRef, isValidElement, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactElement, ReactNode, Ref } from "react";
import { Tooltip } from "../FloatingDisplay";
import { Icon } from "../Icon";
import type {
  AnyTablePlugin,
  TableColumn,
  TablePluginContext,
  TablePluginCellProps,
  TablePluginHeaderCellProps,
  TablePluginEvent,
  TableProps,
  TableRef,
  TableRow,
  TableSummaryRow,
} from "./types";
import { createCellSelectionPlugin, createHighlightPlugin, createIndexPlugin, createResizePlugin } from "./plugins";
import type { TableCellSelectionApi } from "./plugins";
import { createTableRows, flattenTableColumns, getTableValue, isTableAutoWidthColumn, mapTableLeafColumns, normalizeFixed, sortTableColumnsByFixed } from "./utils";

const EMPTY_DATA: readonly Record<string, unknown>[] = [];
const EMPTY_COLUMNS: readonly TableColumn<Record<string, unknown>>[] = [];
const EMPTY_PLUGINS: readonly AnyTablePlugin<Record<string, unknown>>[] = [];
const DEFAULT_WIDTH = 160;
// 与各尺寸单元格样式同步，确保虚拟滚动按实际默认行高计算占位。
const SIZE_ROW_HEIGHT = { small: 28, medium: 36, large: 46 } as const;

/** 提取声明式标题中的文本；不执行自定义组件，无法提取时由列名称或键名补充提示。 */
function getHeaderTitleText(content: ReactNode): string {
  if (typeof content === "string" || typeof content === "number") return String(content);
  if (Array.isArray(content)) return content.map(getHeaderTitleText).join("");
  if (isValidElement<{ children?: ReactNode }>(content)) return getHeaderTitleText(content.props.children);
  return "";
}

interface HeaderCell<T> {
  column: TableColumn<T>;
  colSpan: number;
  rowSpan: number;
  depth: number;
  leaf: boolean;
  fixed?: "left" | "right";
  firstLeafKey: string;
  lastLeafKey: string;
}

function getColumnDepth<T>(columns: readonly TableColumn<T>[]): number {
  let depth = 1;
  for (const column of columns) {
    if (column.hidden || !column.children?.length) continue;
    depth = Math.max(depth, 1 + getColumnDepth(column.children));
  }
  return depth;
}

function countLeaves<T>(column: TableColumn<T>): number {
  if (column.hidden) return 0;
  if (!column.children?.length) return 1;
  return column.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function buildHeaderRows<T>(columns: readonly TableColumn<T>[]): HeaderCell<T>[][] {
  const maxDepth = getColumnDepth(columns);
  const rows = Array.from({ length: maxDepth }, () => [] as HeaderCell<T>[]);
  const walk = (items: readonly TableColumn<T>[], depth: number) => {
    for (const column of items) {
      if (column.hidden) continue;
      const colSpan = countLeaves(column);
      if (colSpan === 0) continue;
      const leaf = !column.children?.length;
      const descendants = flattenTableColumns([column]);
      const segments: TableColumn<T>[][] = [];
      for (const descendant of descendants) {
        const previous = segments[segments.length - 1];
        if (previous && normalizeFixed(previous[0].fixed) === normalizeFixed(descendant.fixed)) previous.push(descendant);
        else segments.push([descendant]);
      }
      for (const segment of segments) {
        rows[depth].push({ column, colSpan: segment.length, rowSpan: leaf ? maxDepth - depth : 1, depth, leaf,
          fixed: normalizeFixed(segment[0].fixed), firstLeafKey: segment[0].key, lastLeafKey: segment[segment.length - 1].key });
      }
      if (!leaf) walk(column.children!, depth + 1);
    }
  };
  walk(columns, 0);
  return rows;
}

function resolveInitialState<T>(plugin: AnyTablePlugin<T>): unknown {
  return typeof plugin.initialState === "function" ? plugin.initialState() : plugin.initialState;
}

/** 批量准备测量节点，调用方统一写入后读取，避免每个单元格触发一次强制布局。 */
function prepareTableCellMeasurement(cell: HTMLElement): HTMLElement | undefined {
  const content = cell.querySelector<HTMLElement>(":scope > .sia-table__cell-content");
  const target = cell.classList.contains("sia-table__header-cell")
    ? cell.querySelector<HTMLElement>(".sia-table__resizable-header > span:first-child, .sia-table__header-label-content")
    : content;
  if (target) {
    const measurement = target.cloneNode(true) as HTMLElement;
    Object.assign(measurement.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "max-content",
      minWidth: "max-content",
      maxWidth: "none",
      height: "auto",
      overflow: "visible",
      visibility: "hidden",
      pointerEvents: "none",
      whiteSpace: "nowrap",
    });
    measurement.setAttribute("aria-hidden", "true");
    cell.appendChild(measurement);
    return measurement;
  }
}

function getTableHorizontalMetrics(viewport: HTMLElement, table: HTMLTableElement | null) {
  const contentWidth = Math.max(viewport.clientWidth, table?.getBoundingClientRect().width ?? viewport.clientWidth);
  return { contentWidth, maxLeft: Math.max(0, contentWidth - viewport.clientWidth) };
}

interface BodyRowProps<T> {
  canvas: boolean;
  visibleColumns: ReadonlySet<string>;
  row: TableRow<T>;
  rowIndex: number;
  columns: readonly TableColumn<T>[];
  leftOffsets: ReadonlyMap<string, number>;
  rightOffsets: ReadonlyMap<string, number>;
  leftFixedEdgeKey?: string;
  rightFixedEdgeKey?: string;
  striped: boolean;
  rowHeight: number;
  className: string;
  onClick: () => void;
  onDoubleClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  getCellProps: (column: TableColumn<T>) => TablePluginCellProps;
  onCellMouseEnter: (column: TableColumn<T>) => void;
  onCellMouseLeave: (column: TableColumn<T>) => void;
  onCellClick: (column: TableColumn<T>, event: ReactMouseEvent<HTMLTableCellElement>) => void;
  onCellContextMenu: (column: TableColumn<T>, event: ReactMouseEvent<HTMLTableCellElement>) => void;
  onCellPointerDown: (column: TableColumn<T>, event: ReactPointerEvent<HTMLTableCellElement>) => void;
  onCellPointerMove: (column: TableColumn<T>, event: ReactPointerEvent<HTMLTableCellElement>) => void;
}

const TableBodyRow = memo(function TableBodyRow<T>({
  canvas,
  visibleColumns,
  row,
  rowIndex,
  columns,
  leftOffsets,
  rightOffsets,
  leftFixedEdgeKey,
  rightFixedEdgeKey,
  striped,
  rowHeight,
  className,
  onClick,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  getCellProps,
  onCellMouseEnter,
  onCellMouseLeave,
  onCellClick,
  onCellContextMenu,
  onCellPointerDown,
  onCellPointerMove,
}: BodyRowProps<T>) {
  return (
    <tr
      // 稳定行标识用于工作表填充在虚拟滚动后定位当前可见行。
      data-row-key={String(row.key)}
      data-canvas-row-index={canvas ? rowIndex : undefined}
      className={`sia-table__row${striped && rowIndex % 2 === 1 ? " sia-table__row--striped" : ""} ${className}`.trim()}
      style={{ height: rowHeight }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {columns.map((column, columnIndex) => {
        // 离屏列合并为一个占位单元格，保留 colgroup 宽度，避免每行创建全部列的 DOM。
        if (canvas && !visibleColumns.has(column.key)) {
          if (columnIndex > 0 && !visibleColumns.has(columns[columnIndex - 1].key)) return null;
          let count = 1;
          while (columnIndex + count < columns.length && !visibleColumns.has(columns[columnIndex + count].key)) count++;
          return <td key={`spacer-${column.key}`} colSpan={count} aria-hidden="true" style={{ padding: 0 }} />;
        }
        const pluginCellProps = getCellProps(column);
        if (pluginCellProps.hidden) return null;
        const value = getTableValue(row.record, column.dataIndex, column.code ?? column.key);
        // 校验由业务提供语义，框架统一处理空值和有值错误的外观及无障碍标记。
        const invalid = typeof column.invalid === "function" ? column.invalid(row.record, row.sourceIndex) : column.invalid;
        const cellClass = typeof column.cellClassName === "function" ? column.cellClassName(row.record, rowIndex) : column.cellClassName ?? "";
        const fixed = normalizeFixed(column.fixed);
        const fixedStyle: CSSProperties | undefined = fixed === "left"
          ? { left: leftOffsets.get(column.key) }
          : fixed === "right" ? { right: rightOffsets.get(column.key) } : undefined;
        const fixedEdgeClass = fixed === "left" && column.key === leftFixedEdgeKey
          ? " sia-table__cell--fixed-left-edge"
          : fixed === "right" && column.key === rightFixedEdgeKey ? " sia-table__cell--fixed-right-edge" : "";
        const autoWidthClass = column.autoWidth ? " sia-table__cell--auto-width" : "";
        return (
          <td
            key={column.key}
            data-column-key={column.key}
            aria-invalid={invalid || undefined}
            data-canvas-dom-ready={canvas && (pluginCellProps.content !== undefined || (!column.canvasRender && column.render)) ? "true" : undefined}
            aria-label={canvas ? column.canvasRender?.(value, row.record, row.sourceIndex, { row, rowIndex, column })?.text ?? (value == null ? "" : String(value)) : undefined}
            rowSpan={pluginCellProps.rowSpan}
            colSpan={pluginCellProps.colSpan}
            className={`sia-table__cell sia-table__cell--${column.align ?? "left"}${fixed ? ` sia-table__cell--fixed sia-table__cell--fixed-${fixed}` : ""}${fixedEdgeClass}${autoWidthClass}${invalid ? " sia-table__cell--invalid" : ""}${column.ellipsis !== false ? " sia-table__cell--ellipsis" : ""} ${cellClass} ${pluginCellProps.className ?? ""}`.trim()}
            style={{ ...fixedStyle, ...pluginCellProps.style }}
            onMouseEnter={() => onCellMouseEnter(column)}
            onMouseLeave={() => onCellMouseLeave(column)}
            onClick={(event) => onCellClick(column, event)}
            onContextMenu={(event) => onCellContextMenu(column, event)}
            onPointerDown={(event) => onCellPointerDown(column, event)}
            onPointerMove={(event) => onCellPointerMove(column, event)}
          >
            {(!canvas || (visibleColumns.has(column.key) && (pluginCellProps.content !== undefined || (!column.canvasRender && column.render)))) ? <TableCellContent
              ellipsis={column.ellipsis !== false}
              title={column.showTitle === true && column.ellipsis !== false && typeof value === "string" ? value : undefined}
            >
              {pluginCellProps.content !== undefined
                ? pluginCellProps.content
                : column.render ? column.render(value, row.record, row.sourceIndex, { row, rowIndex, column }) : value as ReactNode}
            </TableCellContent> : null}
          </td>
        );
      })}
    </tr>
  );
}) as <T>(props: BodyRowProps<T>) => ReactNode;

function TableInner<T extends Record<string, unknown>>(props: TableProps<T>, ref: Ref<TableRef<T>>) {
  const {
    dataSource = EMPTY_DATA as readonly T[],
    columns: baseColumns = EMPTY_COLUMNS as readonly TableColumn<T>[],
    rowKey,
    plugins: providedPlugins = EMPTY_PLUGINS as readonly AnyTablePlugin<T>[],
    loading = false,
    emptyText = "暂无数据",
    height,
    maxBodyHeight,
    tableHeight,
    fillRemaining,
    size = "medium",
    bordered = true,
    rowBordered = true,
    columnBordered = true,
    toolbarBordered = false,
    striped = true,
    virtual,
    renderMode = "dom",
    virtualThreshold = 100,
    rowHeight = SIZE_ROW_HEIGHT[size],
    overscan = 6,
    stickyHeader = true,
    resizable = true,
    cellSelection = true,
    showIndex = true,
    onRowClick,
    onRowDoubleClick,
    onCellContextMenu,
    rowClassName,
    rowStatus,
    tableStyle,
    className = "",
    style,
    ...htmlProps
  } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  // 显式高度保持旧优先级；未指定时由框架统一测量剩余空间。
  const remainingHeight = useRemainingHeight(rootRef, height == null && tableHeight == null ? fillRemaining : false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 连续定位与卸载取消旧动效，防止异步虚拟行挂载后夺回用户焦点。
  const cellFocusRequest = useRef(0);
  const cellGlow = useRef<(() => void) | null>(null);
  useEffect(() => () => { cellFocusRequest.current++; cellGlow.current?.(); }, []);
  const tableRef = useRef<HTMLTableElement>(null);
  useScrollbarProximity();
  const scrollbarDragRef = useRef<{
    axis: "x" | "y";
    pointerId: number;
    startCoordinate: number;
    startScroll: number;
    scrollPerPixel: number;
  } | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(420);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [autoColumnWidths, setAutoColumnWidths] = useState<Record<string, number>>({});
  // 未指定或字段缺失时使用表格内部标识，不能借用可能重复的业务 id 或首列值。
  const [resolveRowIdentity] = useState(createRowIdentity);
  const getRowKey = useCallback((record: T, index: number) =>
    resolveRowIdentity(record, index, typeof rowKey === "function" ? rowKey : rowKey == null ? undefined : String(rowKey)), [rowKey, resolveRowIdentity]);
  const builtInResizePlugin = useMemo(() => createResizePlugin<T>(), []);
  const builtInHighlightPlugin = useMemo(() => createHighlightPlugin<T>(), []);
  const builtInCellSelectionPlugin = useMemo(() => createCellSelectionPlugin<T>(), []);
  const builtInIndexPlugin = useMemo(() => createIndexPlugin<T>(), []);
  const activePlugins = useMemo(() => {
    const plugins = providedPlugins.filter((plugin) => (resizable || plugin.id !== "resize") && (cellSelection || plugin.id !== "cellSelection") && (showIndex || plugin.id !== "index"));
    if (!plugins.some((plugin) => plugin.id === "highlight")) plugins.push(builtInHighlightPlugin);
    if (resizable && !plugins.some((plugin) => plugin.id === "resize")) plugins.push(builtInResizePlugin);
    if (cellSelection && !plugins.some((plugin) => plugin.id === "cellSelection")) plugins.push(builtInCellSelectionPlugin);
    if (showIndex && !plugins.some((plugin) => plugin.id === "index")) plugins.push(builtInIndexPlugin);
    return plugins;
  }, [builtInHighlightPlugin, builtInResizePlugin, builtInCellSelectionPlugin, builtInIndexPlugin, providedPlugins, resizable, cellSelection, showIndex]);
  const sortedPlugins = useMemo(() => [...activePlugins].sort((a, b) => (a.order ?? 100) - (b.order ?? 100)), [activePlugins]);
  const pluginsByIdRef = useRef<Map<string, AnyTablePlugin<T>>>(new Map());
  pluginsByIdRef.current = new Map(sortedPlugins.map((plugin) => [plugin.id, plugin]));
  const [pluginStates, setPluginStates] = useState<Record<string, unknown>>(() => Object.fromEntries(
    sortedPlugins.map((plugin) => [plugin.id, resolveInitialState(plugin)]),
  ));
  const pluginApisRef = useRef<Record<string, unknown>>({});
  const contextsRef = useRef<Map<string, TablePluginContext<T, any>>>(new Map());
  const mountedPluginsRef = useRef(new Map<string, { plugin: AnyTablePlugin<T>; cleanup?: void | (() => void) }>());
  const pipeline = { columns: baseColumns as readonly TableColumn<T>[], rows: createTableRows(dataSource, getRowKey) as readonly TableRow<T>[] };
  const nextApis: Record<string, unknown> = {};
  const contexts = new Map<string, TablePluginContext<T, any>>();

  const setPluginState = useCallback(<Value,>(pluginId: string, next: Value | ((previous: Value) => Value)) => {
    setPluginStates((previous) => {
      const plugin = pluginsByIdRef.current.get(pluginId);
      const previousValue = (previous[pluginId] !== undefined
        ? previous[pluginId]
        : plugin ? resolveInitialState(plugin) : undefined) as Value;
      const nextValue = typeof next === "function" ? (next as (value: Value) => Value)(previousValue) : next;
      return Object.is(previousValue, nextValue) ? previous : { ...previous, [pluginId]: nextValue };
    });
  }, []);

  function getContext(plugin: AnyTablePlugin<T>): TablePluginContext<T, any> {
    const existing = contexts.get(plugin.id);
    if (existing) return existing;
    const context: TablePluginContext<T, any> = {
      pluginId: plugin.id,
      sourceData: dataSource,
      baseColumns,
      get rows() { return pipeline.rows; },
      get columns() { return pipeline.columns; },
      get state() { return pluginStates[plugin.id] ?? resolveInitialState(plugin); },
      getRowKey,
      getState: (pluginId) => pluginStates[pluginId] as never,
      setState: (next) => setPluginState(plugin.id, next),
      setPluginState,
      getPluginApi: (pluginId) => nextApis[pluginId] as never,
      emit: (event) => emitPluginEvent(event),
    };
    contexts.set(plugin.id, context);
    return context;
  }

  function emitPluginEvent(event: TablePluginEvent) {
    for (const target of sortedPlugins) target.onEvent?.(event, getContext(target));
  }

  for (const plugin of sortedPlugins) {
    const context = getContext(plugin);
    if (plugin.transformColumns) pipeline.columns = plugin.transformColumns(pipeline.columns, context);
    if (plugin.transformRows) pipeline.rows = plugin.transformRows(pipeline.rows, context);
    if (plugin.getApi) nextApis[plugin.id] = plugin.getApi(context);
  }
  const resizeState = pluginStates.resize as { widths?: Record<string, number>; manualLayout?: boolean } | undefined;
  const resizedWidths = resizeState?.widths ?? {};
  const manualColumnLayout = Boolean(resizeState?.manualLayout);
  pipeline.columns = mapTableLeafColumns(pipeline.columns, (column) => {
    const autoWidth = isTableAutoWidthColumn(column);
    const measuredWidth = autoColumnWidths[column.key];
    return autoWidth
      ? { ...column, autoWidth: true, width: measuredWidth !== undefined && resizedWidths[column.key] === undefined ? measuredWidth : column.width }
      : column;
  });
  pluginApisRef.current = nextApis;
  contextsRef.current = contexts;

  useEffect(() => {
    const activePlugins = new Map(sortedPlugins.map((plugin) => [plugin.id, plugin]));
    for (const [pluginId, mounted] of mountedPluginsRef.current) {
      if (activePlugins.get(pluginId) === mounted.plugin) continue;
      mounted.cleanup?.();
      mountedPluginsRef.current.delete(pluginId);
    }
    for (const plugin of sortedPlugins) {
      if (mountedPluginsRef.current.has(plugin.id) || !plugin.onMount) continue;
      mountedPluginsRef.current.set(plugin.id, { plugin, cleanup: plugin.onMount(contextsRef.current.get(plugin.id)!) });
    }
  }, [sortedPlugins]);

  useEffect(() => () => {
    for (const mounted of mountedPluginsRef.current.values()) mounted.cleanup?.();
    mountedPluginsRef.current.clear();
  }, []);

  const updateScrollMetrics = useCallback(() => {
    const root = rootRef.current;
    const element = scrollRef.current;
    if (!root || !element) return;
    const { contentWidth: horizontalContentWidth, maxLeft } = getTableHorizontalMetrics(element, tableRef.current);
    if (element.scrollLeft > maxLeft) element.scrollLeft = maxLeft > 1 ? maxLeft : 0;
    const logicalScrollLeft = Math.min(element.scrollLeft, maxLeft);
    const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
    // 同值属性写入仍可能触发整棵表格的样式失效，仅在边界状态变化时更新。
    const setFlag = (key: string, value: boolean) => {
      const next = String(value);
      if (root.dataset[key] !== next) root.dataset[key] = next;
    };
    setFlag("overflowX", maxLeft > 1);
    setFlag("overflowY", maxTop > 1);
    const horizontalTrackElement = root.querySelector<HTMLElement>(".sia-table__scrollbar--horizontal");
    const verticalTrackElement = root.querySelector<HTMLElement>(".sia-table__scrollbar--vertical");
    const horizontalTrack = horizontalTrackElement?.clientWidth ?? 0;
    const verticalTrack = verticalTrackElement?.clientHeight ?? 0;
    const horizontalThumb = maxLeft > 1
      ? Math.min(horizontalTrack, Math.max(36, horizontalTrack * element.clientWidth / horizontalContentWidth))
      : 0;
    const verticalThumb = maxTop > 1
      ? Math.min(verticalTrack, Math.max(36, verticalTrack * element.clientHeight / element.scrollHeight))
      : 0;
    const horizontalPosition = maxLeft > 0
      ? logicalScrollLeft / maxLeft * Math.max(0, horizontalTrack - horizontalThumb)
      : 0;
    const verticalPosition = maxTop > 0
      ? element.scrollTop / maxTop * Math.max(0, verticalTrack - verticalThumb)
      : 0;

    setFlag("scrolledLeft", logicalScrollLeft > 1);
    setFlag("scrolledRight", maxLeft > 1 && logicalScrollLeft < maxLeft - 1);
    const viewportRect = element.getBoundingClientRect();
    const leftEdge = root.querySelector<HTMLElement>(".sia-table__header-cell.sia-table__cell--fixed-left-edge");
    const rightEdge = root.querySelector<HTMLElement>(".sia-table__header-cell.sia-table__cell--fixed-right-edge");
    if (leftEdge) {
      const leftEdgeRect = leftEdge.getBoundingClientRect();
      root.style.setProperty("--sia-table-fixed-left-width", `${Math.max(0, leftEdgeRect.right - viewportRect.left)}px`);
    }
    if (rightEdge) {
      const rightEdgeRect = rightEdge.getBoundingClientRect();
      root.style.setProperty("--sia-table-fixed-right-width", `${Math.max(0, viewportRect.right - rightEdgeRect.left)}px`);
    }
    // 滚动条变量只影响轨道；放在表格根节点会逐帧使所有单元格重新计算继承样式。
    horizontalTrackElement?.style.setProperty("--sia-table-scrollbar-x-size", `${horizontalThumb}px`);
    horizontalTrackElement?.style.setProperty("--sia-table-scrollbar-x-position", `${horizontalPosition}px`);
    verticalTrackElement?.style.setProperty("--sia-table-scrollbar-y-size", `${verticalThumb}px`);
    verticalTrackElement?.style.setProperty("--sia-table-scrollbar-y-position", `${verticalPosition}px`);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setViewportHeight(element.clientHeight);
      setViewportWidth(element.clientWidth);
      updateScrollMetrics();
    });
    observer.observe(element);
    if (tableRef.current) observer.observe(tableRef.current);
    updateScrollMetrics();
    return () => observer.disconnect();
  }, [updateScrollMetrics]);

  useEffect(() => {
    updateScrollMetrics();
  });

  const orderedColumns = useMemo(() => sortTableColumnsByFixed(pipeline.columns), [pipeline.columns]);
  const leafColumns = useMemo(() => flattenTableColumns(orderedColumns), [orderedColumns]);
  const headerRows = useMemo(() => buildHeaderRows(orderedColumns), [orderedColumns]);

  // 滚动和悬停不改变已有内容宽度；仅新挂载的单元格需要测量。
  const measuredCells = useRef(new WeakSet<HTMLElement>());
  const autoWidthSignature = leafColumns.map(column => `${column.key}:${column.autoWidth}:${resizedWidths[column.key] ?? ""}`).join("|");
  useEffect(() => {
    measuredCells.current = new WeakSet();
    // 换数据或列配置后重新计算，避免上一页的长内容永久撑宽当前页。
    setAutoColumnWidths({});
  }, [dataSource, baseColumns, size, autoWidthSignature]);

  useEffect(() => {
    const autoWidthColumns = leafColumns.filter((column) => column.autoWidth && resizedWidths[column.key] === undefined);
    const root = rootRef.current;
    if (!root || autoWidthColumns.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      const measurements: Record<string, number> = {};
      const columnsByKey = new Map(autoWidthColumns.map(column => [column.key, column]));
      const cells = [...root.querySelectorAll<HTMLElement>("th[data-column-key], td[data-column-key]")]
        .filter(cell => columnsByKey.has(cell.dataset.columnKey!) && !measuredCells.current.has(cell));
      if (cells.length === 0) return;
      // 先完成所有 DOM 写入，再批量读尺寸，最后统一移除临时节点。
      const prepared = cells.map(cell => ({ cell, node: prepareTableCellMeasurement(cell) }));
      for (const { cell, node } of prepared) {
        const key = cell.dataset.columnKey!;
        const style = window.getComputedStyle(cell);
        const padding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0)
          + (Number.parseFloat(style.borderLeftWidth) || 0) + (Number.parseFloat(style.borderRightWidth) || 0);
        measurements[key] = Math.max(measurements[key] ?? 0, node ? Math.max(node.scrollWidth, node.getBoundingClientRect().width) + padding : cell.scrollWidth);
        measuredCells.current.add(cell);
      }
      prepared.forEach(({ node }) => node?.remove());
      for (const column of autoWidthColumns) {
        if (measurements[column.key] === undefined) continue;
        const width = Math.max(column.minWidth ?? 56, autoColumnWidths[column.key] ?? 0, measurements[column.key]);
        measurements[column.key] = Math.ceil(Math.min(column.maxWidth ?? Number.POSITIVE_INFINITY, width));
      }
      setAutoColumnWidths((previous) => {
        let changed = false;
        const next = { ...previous };
        for (const [columnKey, width] of Object.entries(measurements)) {
          if (Math.abs((previous[columnKey] ?? 0) - width) <= 1) continue;
          next[columnKey] = width;
          changed = true;
        }
        return changed ? next : previous;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  });

  const baseColumnWidths = new Map(leafColumns.map((column) => {
    const width = column.width ?? DEFAULT_WIDTH;
    return [column.key, Math.min(column.maxWidth ?? Number.POSITIVE_INFINITY, Math.max(column.minWidth ?? 1, width))] as const;
  }));
  const baseTotalWidth = leafColumns.reduce((sum, column) => sum + (baseColumnWidths.get(column.key) ?? DEFAULT_WIDTH), 0);
  const explicitFlexColumns = leafColumns.filter((column) => (column.flex ?? 0) > 0);
  const fallbackFlexColumn = explicitFlexColumns.length === 0
    ? leafColumns.filter((column) => !normalizeFixed(column.fixed) && !column.autoWidth).sort((leftColumn, rightColumn) => (baseColumnWidths.get(rightColumn.key) ?? 0) - (baseColumnWidths.get(leftColumn.key) ?? 0))[0]
    : undefined;
  const flexColumns = explicitFlexColumns.length > 0 ? explicitFlexColumns : fallbackFlexColumn ? [fallbackFlexColumn] : [];
  const flexTotal = flexColumns.reduce((sum, column) => sum + Math.max(0, column.flex ?? 1), 0);
  const remainingWidth = !manualColumnLayout && flexTotal > 0 ? Math.max(0, viewportWidth - baseTotalWidth) : 0;
  const columnWidths = new Map(baseColumnWidths);
  for (const column of flexColumns) {
    const flex = Math.max(0, column.flex ?? 1);
    columnWidths.set(column.key, (baseColumnWidths.get(column.key) ?? DEFAULT_WIDTH) + remainingWidth * flex / flexTotal);
  }
  const totalWidth = leafColumns.reduce((sum, column) => sum + (columnWidths.get(column.key) ?? DEFAULT_WIDTH), 0);
  const leftOffsets = new Map<string, number>();
  const rightOffsets = new Map<string, number>();
  let left = 0;
  for (const column of leafColumns) {
    if (normalizeFixed(column.fixed) !== "left") continue;
    leftOffsets.set(column.key, left);
    left += columnWidths.get(column.key) ?? DEFAULT_WIDTH;
  }
  let right = 0;
  for (let index = leafColumns.length - 1; index >= 0; index -= 1) {
    const column = leafColumns[index];
    if (normalizeFixed(column.fixed) !== "right") continue;
    rightOffsets.set(column.key, right);
    right += columnWidths.get(column.key) ?? DEFAULT_WIDTH;
  }
  const leftFixedEdgeKey = [...leafColumns].reverse().find((column) => normalizeFixed(column.fixed) === "left")?.key;
  const rightFixedEdgeKey = leafColumns.find((column) => normalizeFixed(column.fixed) === "right")?.key;

  // 按筛选、分页及树展开后的实际渲染行数兜底，超过 100 行时不允许配置关闭窗口化。
  const canvas = renderMode === "canvas" && !sortedPlugins.some(plugin => plugin.disableVirtual);
  const shouldVirtualize = canvas || pipeline.rows.length > 100
    || ((virtual ?? pipeline.rows.length >= virtualThreshold) && !sortedPlugins.some((plugin) => plugin.disableVirtual));
  // 筛选或替换数据后旧滚动位置可能超过新列表；先限制窗口起点，避免占位行撑高少量结果或空表。
  const firstVisibleIndex = Math.min(Math.floor(scrollTop / rowHeight), Math.max(0, pipeline.rows.length - Math.ceil(viewportHeight / rowHeight)));
  const startIndex = shouldVirtualize ? Math.max(0, firstVisibleIndex - overscan) : 0;
  const visibleCount = shouldVirtualize ? Math.ceil(viewportHeight / rowHeight) + overscan * 2 : pipeline.rows.length;
  const endIndex = shouldVirtualize ? Math.min(pipeline.rows.length, startIndex + visibleCount) : pipeline.rows.length;
  const renderedRows = pipeline.rows.slice(startIndex, endIndex);
  // 仅为横向可见列挂载交互组件，固定列始终保留。
  const visibleColumns = new Set<string>();
  let columnLeft = 0;
  for (const column of leafColumns) {
    const width = columnWidths.get(column.key) ?? DEFAULT_WIDTH;
    if (normalizeFixed(column.fixed) || (columnLeft + width >= scrollLeft && columnLeft <= scrollLeft + viewportWidth)) visibleColumns.add(column.key);
    columnLeft += width;
  }
  const topSpacer = shouldVirtualize ? startIndex * rowHeight : 0;
  const bottomSpacer = shouldVirtualize ? Math.max(0, (pipeline.rows.length - endIndex) * rowHeight) : 0;
  // 虚拟窗口移动时复用仍可见行的元素与事件闭包；数据、插件或列布局变化必须失效。
  const rowElements = useMemo(() => new Map<React.Key, ReactElement>(), [
    dataSource, baseColumns, sortedPlugins, pluginStates, autoColumnWidths,
    viewportWidth, rowHeight, striped, rowClassName, rowStatus, getRowKey,
    canvas, scrollLeft,
    onRowClick, onRowDoubleClick, onCellContextMenu,
  ]);
  const toolbarStart = sortedPlugins.map((plugin) => {
    const content = plugin.renderToolbarStart?.(getContext(plugin));
    return content ? <Fragment key={`toolbar-start-${plugin.id}`}>{content}</Fragment> : null;
  }).filter(Boolean);
  const toolbarEnd = sortedPlugins.map((plugin) => {
    const content = plugin.renderToolbarEnd?.(getContext(plugin));
    return content ? <Fragment key={`toolbar-end-${plugin.id}`}>{content}</Fragment> : null;
  }).filter(Boolean);
  const summaries = sortedPlugins.flatMap((plugin) => plugin.renderSummary?.(getContext(plugin)) ?? []);
  const footers = sortedPlugins.map((plugin) => {
    const content = plugin.renderFooter?.(getContext(plugin));
    return content ? <Fragment key={`footer-${plugin.id}`}>{content}</Fragment> : null;
  }).filter(Boolean);
  const overlays = sortedPlugins.map((plugin) => {
    const content = plugin.renderOverlay?.(getContext(plugin));
    return content ? <Fragment key={`overlay-${plugin.id}`}>{content}</Fragment> : null;
  }).filter(Boolean);
  const hasToolbar = toolbarStart.length > 0 || toolbarEnd.length > 0;
  const effectiveHeight = height ?? tableHeight ?? remainingHeight ?? (shouldVirtualize && maxBodyHeight == null ? 420 : undefined);
  // 表头在同一滚动视口中吸顶；最大内容高度只约束数据区，保留完整表头高度。
  const viewportStyle: CSSProperties | undefined = maxBodyHeight == null ? undefined : {
    maxHeight: `calc(${typeof maxBodyHeight === "number" ? `${maxBodyHeight}px` : maxBodyHeight} + var(--sia-table-header-height))`,
  };
  const rootStyle = {
    ...style,
    height: effectiveHeight,
    "--sia-table-header-height": `${headerRows.length * rowHeight}px`,
    // 空态占位只覆盖内容区，必须给仍有业务意义的合计行留出空间。
    "--sia-table-summary-height": `${summaries.length * rowHeight}px`,
  } as CSSProperties;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    // 同一行区间内无需重新渲染整张表，横向滚动也不应重建单元格。
    if (shouldVirtualize) setScrollTop(previous => Math.floor(previous / rowHeight) === Math.floor(element.scrollTop / rowHeight) ? previous : element.scrollTop);
    if (canvas) setScrollLeft(element.scrollLeft);
    updateScrollMetrics();
  }, [canvas, shouldVirtualize, rowHeight, updateScrollMetrics]);

  const handleScrollbarPointerDown = useCallback((axis: "x" | "y", event: React.PointerEvent<HTMLDivElement>, track = event.currentTarget) => {
    const element = scrollRef.current;
    const thumb = track.firstElementChild as HTMLElement | null;
    if (!element || !thumb || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    track.setPointerCapture(event.pointerId);
    const trackLength = axis === "x" ? track.clientWidth : track.clientHeight;
    const thumbLength = axis === "x" ? thumb.offsetWidth : thumb.offsetHeight;
    const maxScroll = axis === "x"
      ? getTableHorizontalMetrics(element, tableRef.current).maxLeft
      : element.scrollHeight - element.clientHeight;
    const thumbRect = thumb.getBoundingClientRect();
    const coordinate = axis === "x" ? event.clientX : event.clientY;
    const thumbStart = axis === "x" ? thumbRect.left : thumbRect.top;
    if (coordinate < thumbStart || coordinate > thumbStart + thumbLength) {
      const trackRect = track.getBoundingClientRect();
      const trackStart = axis === "x" ? trackRect.left : trackRect.top;
      const ratio = Math.max(0, Math.min(1, (coordinate - trackStart - thumbLength / 2) / Math.max(1, trackLength - thumbLength)));
      if (axis === "x") element.scrollLeft = ratio * maxScroll;
      else element.scrollTop = ratio * maxScroll;
    }
    scrollbarDragRef.current = {
      axis,
      pointerId: event.pointerId,
      startCoordinate: axis === "x" ? event.clientX : event.clientY,
      startScroll: axis === "x" ? element.scrollLeft : element.scrollTop,
      scrollPerPixel: maxScroll / Math.max(1, trackLength - thumbLength),
    };
    if (rootRef.current) rootRef.current.dataset.scrollbarDragging = "true";
  }, []);

  const handleScrollbarPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = scrollbarDragRef.current;
    const element = scrollRef.current;
    if (!drag || !element || drag.pointerId !== event.pointerId) return;
    const coordinate = drag.axis === "x" ? event.clientX : event.clientY;
    const nextScroll = drag.startScroll + (coordinate - drag.startCoordinate) * drag.scrollPerPixel;
    if (drag.axis === "x") element.scrollLeft = nextScroll;
    else element.scrollTop = nextScroll;
  }, []);

  const handleScrollbarPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (scrollbarDragRef.current?.pointerId !== event.pointerId) return;
    scrollbarDragRef.current = null;
    if (rootRef.current) rootRef.current.dataset.scrollbarDragging = "false";
  }, []);

  useImperativeHandle(ref, () => {
    const api: TableRef<T> = {
    getRows: () => pipeline.rows.map((row) => row.record),
    getColumns: () => pipeline.columns,
    getPluginApi: (pluginId) => pluginApisRef.current[pluginId] as never,
    scrollTo: (options) => scrollRef.current?.scrollTo(options),
    scrollToRow: (key) => {
      const viewport = scrollRef.current;
      const table = tableRef.current;
      const index = pipeline.rows.findIndex(row => row.key === key);
      if (!viewport || !table || !viewport.clientHeight || index < 0) return false;
      // 已挂载行使用实际尺寸，虚拟窗口外的行使用框架自身的行高模型，业务无需猜测像素。
      const row = Array.from(table.tBodies[0]?.rows ?? []).find(element => element.dataset.rowKey === String(key));
      const headerHeight = table.tHead?.offsetHeight ?? headerRows.length * rowHeight;
      const top = row ? row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientTop + viewport.scrollTop : headerHeight + index * rowHeight;
      const height = row?.offsetHeight ?? rowHeight;
      const headerInset = stickyHeader ? headerHeight : 0;
      const footerInset = table.tFoot?.offsetHeight ?? 0;
      const visibleTop = viewport.scrollTop + headerInset;
      const visibleBottom = viewport.scrollTop + viewport.clientHeight - footerInset;
      // 只移动必要距离，避免处理速度快时动画排队，也不牵动页面和横向滚动条。
      if (top < visibleTop || height > visibleBottom - visibleTop) viewport.scrollTop = Math.max(0, top - headerInset);
      else if (top + height > visibleBottom) viewport.scrollTop = top + height - viewport.clientHeight + footerInset;
      if (shouldVirtualize) setScrollTop(viewport.scrollTop);
      updateScrollMetrics();
      return true;
    },
    focusCell: async (key, columnKey, options) => {
      const request = ++cellFocusRequest.current;
      cellGlow.current?.();
      cellGlow.current = null;
      const viewport = scrollRef.current;
      const columnIndex = leafColumns.findIndex(column => column.key === columnKey);
      if (!viewport || columnIndex < 0 || !api.scrollToRow(key)) return false;
      const column = leafColumns[columnIndex];
      // 用框架列宽模型先展开离屏列，Canvas 模式也能在下一帧生成目标单元格。
      if (!normalizeFixed(column.fixed)) {
        const start = leafColumns.slice(0, columnIndex).reduce((sum, item) => sum + (columnWidths.get(item.key) ?? DEFAULT_WIDTH), 0);
        const width = columnWidths.get(columnKey) ?? DEFAULT_WIDTH;
        const visibleWidth = viewport.clientWidth - left - right;
        if (start < viewport.scrollLeft + left || width > visibleWidth) viewport.scrollLeft = Math.max(0, start - left);
        else if (start + width > viewport.scrollLeft + viewport.clientWidth - right) viewport.scrollLeft = start + width - viewport.clientWidth + right;
        if (canvas) setScrollLeft(viewport.scrollLeft);
      }
      updateScrollMetrics();
      // React 提交虚拟行后再聚焦；按帧等待且可取消，不用固定延时猜测挂载时间。
      let previousRect: DOMRect | undefined;
      for (let frame = 0; frame < 20; frame++) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (request !== cellFocusRequest.current || !viewport.isConnected || !viewport.clientHeight) return false;
        const row = Array.from(tableRef.current?.tBodies[0]?.rows ?? []).find(item => item.dataset.rowKey === String(key));
        const cell = Array.from(row?.cells ?? []).find(item => item.dataset.columnKey === columnKey);
        if (!cell || !cell.offsetWidth) continue;
        // 工作表按钮或编辑器可撑高行；挂载后用实测尺寸校正首次虚拟估算，避免末行仍被裁切。
        api.scrollToRow(key);
        const visible = () => {
          if (!cell.isConnected || !viewport.clientHeight || !cell.offsetWidth) return false;
          const bounds = viewport.getBoundingClientRect(), rect = cell.getBoundingClientRect();
          const top = bounds.top + viewport.clientTop + (stickyHeader ? tableRef.current?.tHead?.offsetHeight ?? 0 : 0);
          const bottom = bounds.top + viewport.clientTop + viewport.clientHeight - (tableRef.current?.tFoot?.offsetHeight ?? 0);
          const fixed = normalizeFixed(column.fixed);
          return rect.top >= Math.max(0, top) - 1 && rect.bottom <= Math.min(window.innerHeight, bottom) + 1
            && rect.left >= Math.max(0, bounds.left + viewport.clientLeft + (fixed ? 0 : left)) - 1
            && rect.right <= Math.min(window.innerWidth, bounds.left + viewport.clientLeft + viewport.clientWidth - (fixed ? 0 : right)) + 1;
        };
        const rect = cell.getBoundingClientRect();
        // 连续两次绘制的实测位置一致且完整可见后才开始，不能把发出滚动命令当作定位完成。
        const stable = previousRect && Math.abs(rect.top - previousRect.top) < .5 && Math.abs(rect.left - previousRect.left) < .5 && Math.abs(rect.width - previousRect.width) < .5 && Math.abs(rect.height - previousRect.height) < .5;
        previousRect = rect;
        if (!visible() || !stable) continue;
        const address = { rowKey: key, columnKey };
        (pluginApisRef.current.cellSelection as TableCellSelectionApi<T> | undefined)?.setRange({ anchor: address, focus: address });
        cell.tabIndex = -1;
        cell.focus({ preventScroll: true });
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (request !== cellFocusRequest.current || !visible()) return false;
        if (options?.highlight !== false) {
          // 页面独立顶层描边避开固定列与祖先裁剪；结束、取消和卸载均清理。
          // 定位效果由公开配置选择，统一交给框架绘制描边与柔光。
          const cleanup = playCellFocusGlow(cell, visible, () => { cellGlow.current = null; }, options);
          cellGlow.current = cleanup;
        }
        return true;
      }
      return false;
    },
    setLoading: setInternalLoading,
    getPage: () => (pluginApisRef.current.pagination as any)?.getPage?.() ?? { current: 1, pageSize: dataSource.length || 25 },
    setPage: (page) => (pluginApisRef.current.pagination as any)?.setPage?.(page),
    clearSelection: () => (pluginApisRef.current.selection as any)?.clear?.(),
    setSelectedKeys: (keys) => (pluginApisRef.current.selection as any)?.setSelectedKeys?.(keys),
    getSelectedRows: () => (pluginApisRef.current.selection as any)?.getSelectedRows?.() ?? [],
    getSortInfo: () => (pluginApisRef.current.sort as any)?.getSortInfo?.() ?? null,
    getColumnSettings: () => (pluginApisRef.current.columnSetting as any)?.getSettings?.() ?? [],
    openColumnSetting: () => (pluginApisRef.current.columnSetting as any)?.open?.(),
    generatePageParams: (model) => (pluginApisRef.current.pagination as any)?.generatePageParams?.(model) ?? model,
    requestCount: async (model) => { await (pluginApisRef.current.pagination as any)?.requestCount?.(model); },
    };
    return api;
  }, [dataSource.length, pipeline.columns, pipeline.rows, headerRows.length, rowHeight, stickyHeader, shouldVirtualize, updateScrollMetrics, leafColumns, columnWidths, left, right, canvas]);

  const coreContext: TablePluginContext<T, undefined> = {
    pluginId: "core",
    sourceData: dataSource,
    baseColumns,
    rows: pipeline.rows,
    columns: pipeline.columns,
    state: undefined,
    getRowKey,
    getState: (pluginId) => pluginStates[pluginId] as never,
    setState: () => undefined,
    setPluginState,
    getPluginApi: (pluginId) => nextApis[pluginId] as never,
    emit: emitPluginEvent,
  };

  function getFixedStyle(column: TableColumn<T>): CSSProperties | undefined {
    const fixed = normalizeFixed(column.fixed);
    return fixed === "left" ? { left: leftOffsets.get(column.key) } : fixed === "right" ? { right: rightOffsets.get(column.key) } : undefined;
  }

  /** 在各表头插件外统一约束文字宽度；仅文案实际省略时提示原始标题，避免混入排序、筛选操作文案。 */
  function renderHeaderContent(column: TableColumn<T>, content: ReactNode) {
    const title = getHeaderTitleText(column.title ?? column.name) || column.name || column.key;
    return <span className={`sia-table__header-label${column.required ? " sia-table__header-label--required" : ""}`}>
      {/* 星号仅用于必填提示，不混入原始标题及导出列名。 */}
      {column.required && <span className="sia-table__required-mark" aria-hidden="true">*</span>}
      <span className="sia-table__header-label-content" data-sia-title-overflow-only {...withTitleTooltip({ title })}>{content}</span>
      {column.description != null && <Tooltip title={column.description} placement="top" trigger={["hover", "focus"]}>
        <button type="button" className="sia-table__header-description" aria-label={`${column.name ?? column.key}列说明`} onClick={(event) => event.stopPropagation()}>
          <Icon name="info" size={14} />
        </button>
      </Tooltip>}
    </span>;
  }

  function getPluginCellProps(row: TableRow<T>, column: TableColumn<T>): TablePluginCellProps {
    return sortedPlugins.reduce<TablePluginCellProps>((result, plugin) => {
      const next = plugin.getCellProps?.(row, column, getContext(plugin));
      if (!next) return result;
      return {
        ...result,
        ...next,
        hidden: result.hidden || next.hidden,
        className: [result.className, next.className].filter(Boolean).join(" "),
        style: { ...result.style, ...next.style },
      };
    }, {});
  }

  function getPluginHeaderCellProps(column: TableColumn<T>): TablePluginHeaderCellProps {
    return sortedPlugins.reduce<TablePluginHeaderCellProps>((result, plugin) => {
      const next = plugin.getHeaderCellProps?.(column, getContext(plugin));
      if (!next) return result;
      return {
        ...result,
        ...next,
        className: [result.className, next.className].filter(Boolean).join(" "),
        style: { ...result.style, ...next.style },
      };
    }, {});
  }

  function scrollbarAtPoint(event: { clientX: number; clientY: number }) {
    const tracks = rootRef.current?.querySelectorAll<HTMLDivElement>(".sia-table__scrollbar");
    for (const track of tracks ?? []) {
      if (track.closest(".sia-table") !== rootRef.current) continue;
      const rect = track.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom) {
        return { track, axis: track.classList.contains("sia-table__scrollbar--vertical") ? "y" as const : "x" as const };
      }
    }
  }

  function renderSummaryRow(summary: TableSummaryRow) {
    let labelRendered = false;
    return <tr key={summary.key} className={`sia-table__summary-row ${summary.className ?? ""}`.trim()}>{leafColumns.map((column) => {
      const value = summary.values[column.key];
      const isLabel = value === undefined && !labelRendered && summary.label !== undefined;
      const content = value !== undefined ? value : isLabel ? (labelRendered = true, summary.label) : null;
      const fixed = normalizeFixed(column.fixed);
      const fixedEdgeClass = fixed === "left" && column.key === leftFixedEdgeKey
        ? " sia-table__cell--fixed-left-edge"
        : fixed === "right" && column.key === rightFixedEdgeKey ? " sia-table__cell--fixed-right-edge" : "";
      const autoWidthClass = column.autoWidth ? " sia-table__cell--auto-width" : "";
      return <td key={column.key} data-column-key={column.key} className={`sia-table__cell sia-table__cell--${column.align ?? "left"} sia-table__summary-cell${isLabel ? " sia-table__summary-cell--label" : ""}${fixed ? ` sia-table__cell--fixed sia-table__cell--fixed-${fixed}` : ""}${fixedEdgeClass}${autoWidthClass}`} style={getFixedStyle(column)}>{isLabel ? <span className="sia-table__summary-label">{content}</span> : content}</td>;
    })}</tr>;
  }

  return (
    <div
      ref={rootRef}
      className={`sia-table sia-table--${size}${bordered ? " sia-table--bordered" : ""}${!rowBordered ? " sia-table--no-row-borders" : ""}${!columnBordered ? " sia-table--no-column-borders" : ""}${hasToolbar && !toolbarBordered ? " sia-table--borderless-toolbar" : ""} ${className}`.trim()}
      style={rootStyle}
      data-has-fixed-left={left > 0}
      data-render-mode={canvas ? "canvas" : "dom"}
      data-has-fixed-right={right > 0}
      data-scrolled-left="false"
      data-scrolled-right="true"
      {...withTitleTooltip(htmlProps)}
      onPointerDownCapture={(event) => {
        htmlProps.onPointerDownCapture?.(event);
        if (event.defaultPrevented || loading || internalLoading) return;
        const hit = scrollbarAtPoint(event);
        if (hit) handleScrollbarPointerDown(hit.axis, event, hit.track);
      }}
      onPointerMoveCapture={(event) => {
        htmlProps.onPointerMoveCapture?.(event);
        const hit = scrollbarAtPoint(event);
        rootRef.current?.querySelectorAll<HTMLElement>(".sia-table__scrollbar").forEach(track => {
          const hovered = track === hit?.track;
          if (hovered !== track.hasAttribute("data-pointer-hover")) track.toggleAttribute("data-pointer-hover", hovered);
        });
        if (hit || scrollbarDragRef.current) {
          handleScrollbarPointerMove(event);
          event.stopPropagation();
        }
      }}
      onPointerLeave={(event) => {
        htmlProps.onPointerLeave?.(event);
        rootRef.current?.querySelectorAll("[data-pointer-hover]").forEach(track => track.removeAttribute("data-pointer-hover"));
      }}
      onClickCapture={(event) => {
        if (scrollbarAtPoint(event)) { event.preventDefault(); event.stopPropagation(); return; }
        htmlProps.onClickCapture?.(event);
      }}
      onDoubleClickCapture={(event) => {
        if (scrollbarAtPoint(event)) { event.preventDefault(); event.stopPropagation(); return; }
        htmlProps.onDoubleClickCapture?.(event);
      }}
    >
      {hasToolbar ? <div className="sia-table__toolbar"><div>{toolbarStart}</div><div>{toolbarEnd}</div></div> : null}
      {/* 最大内容高度保留表头空间，工具栏与分页继续留在滚动区之外。 */}
      <div className="sia-table__viewport-wrap" style={viewportStyle}>
        <div className="sia-table__viewport" ref={scrollRef} onScroll={handleScroll}>
        <table ref={tableRef} className="sia-table__element" style={{ width: Math.max(totalWidth, 1), ...(manualColumnLayout ? { minWidth: 0 } : {}), ...tableStyle }}>
          <colgroup>{leafColumns.map((column) => <col key={column.key} data-column-key={column.key} style={{ width: columnWidths.get(column.key) ?? DEFAULT_WIDTH }} />)}</colgroup>
          <thead className={stickyHeader ? "sia-table__head sia-table__head--sticky" : "sia-table__head"}>
            {headerRows.map((headerRow, depth) => <tr key={depth}>{headerRow.map((cell) => {
              const fixed = cell.fixed;
              const pluginHeaderProps = getPluginHeaderCellProps(cell.column);
              const fixedEdgeClass = fixed === "left" && cell.column.key === leftFixedEdgeKey
                ? " sia-table__cell--fixed-left-edge"
                : fixed === "right" && cell.column.key === rightFixedEdgeKey ? " sia-table__cell--fixed-right-edge" : "";
              const autoWidthClass = cell.column.autoWidth ? " sia-table__cell--auto-width" : "";
              return <th
                key={`${cell.column.key}-${depth}-${cell.firstLeafKey}`}
                data-column-key={cell.column.key}
                data-last-leaf-column={cell.leaf && cell.column.key === leafColumns[leafColumns.length - 1]?.key || undefined}
                colSpan={cell.colSpan}
                rowSpan={cell.rowSpan}
                className={`sia-table__header-cell sia-table__cell--${cell.column.align ?? "left"}${fixed ? ` sia-table__cell--fixed sia-table__cell--fixed-${fixed}` : ""}${fixedEdgeClass}${autoWidthClass} ${cell.column.headerClassName ?? ""} ${pluginHeaderProps.className ?? ""}`.trim()}
                style={{ ...(fixed === "left" ? { left: leftOffsets.get(cell.firstLeafKey) } : fixed === "right" ? { right: rightOffsets.get(cell.lastLeafKey) } : {}), top: stickyHeader ? depth * rowHeight : undefined, ...pluginHeaderProps.style }}
                scope="col"
                onPointerDown={(event) => {
                  for (const plugin of sortedPlugins) plugin.onHeaderPointerDown?.(cell.column, event, getContext(plugin));
                }}
                onPointerMove={(event) => {
                  for (const plugin of sortedPlugins) plugin.onHeaderPointerMove?.(cell.column, event, getContext(plugin));
                }}
              >
                {renderHeaderContent(cell.column, cell.column.renderHeader ? cell.column.renderHeader(cell.column, coreContext) : cell.column.title ?? cell.column.name ?? cell.column.key)}
              </th>;
            })}</tr>)}
          </thead>
          <tbody>
            {/* 自然高度结果表的空态也需保留可见区域，最大高度仍由外层视口约束。 */}
            {maxBodyHeight != null && pipeline.rows.length === 0 ? <tr aria-hidden="true"><td colSpan={leafColumns.length} style={{ height: 120, padding: 0, border: 0 }} /></tr> : null}
            {/* 无数据时撑开正文，将合计留在视口底部，避免与空态遮罩重叠。 */}
            {pipeline.rows.length === 0 && summaries.length > 0 ? <tr aria-hidden="true"><td colSpan={leafColumns.length} style={{ height: Math.max(0, viewportHeight - (headerRows.length + summaries.length) * rowHeight), padding: 0, border: 0 }} /></tr> : null}
            {topSpacer > 0 ? <tr aria-hidden="true"><td colSpan={leafColumns.length} style={{ height: topSpacer, padding: 0, border: 0 }} /></tr> : null}
            {renderedRows.map((row, offset) => {
              const cached = rowElements.get(row.key);
              if (cached) return cached;
              const rowIndex = startIndex + offset;
              const pluginClasses = sortedPlugins.map((plugin) => plugin.getRowClassName?.(row, getContext(plugin))).filter(Boolean).join(" ");
              // 业务只提供状态，DOM 和 Canvas 共用的行背景交由框架主题处理。
              const status = typeof rowStatus === "function" ? rowStatus(row.record, row.sourceIndex) : rowStatus;
              const statusClass = status ? `sia-table__row--${status}` : "";
              const customClass = typeof rowClassName === "function" ? rowClassName(row.record, row.sourceIndex) : rowClassName ?? "";
              const element = <TableBodyRow
                canvas={canvas}
                visibleColumns={visibleColumns}
                key={row.key}
                row={row}
                rowIndex={rowIndex}
                columns={leafColumns}
                leftOffsets={leftOffsets}
                rightOffsets={rightOffsets}
                leftFixedEdgeKey={leftFixedEdgeKey}
                rightFixedEdgeKey={rightFixedEdgeKey}
                striped={striped}
                rowHeight={rowHeight}
                className={`${statusClass} ${pluginClasses} ${customClass}`.trim()}
                onClick={() => {
                  for (const plugin of sortedPlugins) plugin.onRowClick?.(row, getContext(plugin));
                  onRowClick?.(row.record, row.sourceIndex);
                }}
                onDoubleClick={() => onRowDoubleClick?.(row.record, row.sourceIndex)}
                onMouseEnter={() => {
                  for (const plugin of sortedPlugins) plugin.onRowMouseEnter?.(row, getContext(plugin));
                }}
                onMouseLeave={() => {
                  for (const plugin of sortedPlugins) plugin.onRowMouseLeave?.(row, getContext(plugin));
                }}
                getCellProps={(column) => getPluginCellProps(row, column)}
                onCellMouseEnter={(column) => {
                  for (const plugin of sortedPlugins) plugin.onCellMouseEnter?.(row, column, getContext(plugin));
                }}
                onCellMouseLeave={(column) => {
                  for (const plugin of sortedPlugins) plugin.onCellMouseLeave?.(row, column, getContext(plugin));
                }}
                onCellClick={(column, event) => {
                  for (const plugin of sortedPlugins) plugin.onCellClick?.(row, column, event, getContext(plugin));
                }}
                onCellContextMenu={(column, event) => {
                  onCellContextMenu?.(row.record, column, row.sourceIndex, event);
                }}
                onCellPointerDown={(column, event) => {
                  for (const plugin of sortedPlugins) plugin.onCellPointerDown?.(row, column, event, getContext(plugin));
                }}
                onCellPointerMove={(column, event) => {
                  for (const plugin of sortedPlugins) plugin.onCellPointerMove?.(row, column, event, getContext(plugin));
                }}
              />;
              rowElements.set(row.key, element);
              return element;
            })}
            {bottomSpacer > 0 ? <tr aria-hidden="true"><td colSpan={leafColumns.length} style={{ height: bottomSpacer, padding: 0, border: 0 }} /></tr> : null}
          </tbody>
          {summaries.length > 0 ? <tfoot className="sia-table__summary">{summaries.map(renderSummaryRow)}</tfoot> : null}
        </table>
        </div>
        {pipeline.rows.length === 0 ? <div className="sia-table__empty" role="status">{emptyText}</div> : null}
        {canvas ? <TableCanvasLayer viewport={scrollRef} rows={pipeline.rows} columns={leafColumns} widths={columnWidths} rowHeight={rowHeight} headerHeight={headerRows.length * rowHeight} /> : null}
        <div className="sia-scrollbar-track sia-table__scrollbar sia-table__scrollbar--horizontal" aria-hidden="true"
          onPointerDown={(event) => handleScrollbarPointerDown("x", event)}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerMove={handleScrollbarPointerMove}
          onPointerUp={handleScrollbarPointerEnd}
          onPointerCancel={handleScrollbarPointerEnd}
        >
          <div className="sia-table__scrollbar-thumb" />
        </div>
        <div className="sia-scrollbar-track sia-table__scrollbar sia-table__scrollbar--vertical" aria-hidden="true"
          onPointerDown={(event) => handleScrollbarPointerDown("y", event)}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerMove={handleScrollbarPointerMove}
          onPointerUp={handleScrollbarPointerEnd}
          onPointerCancel={handleScrollbarPointerEnd}
        >
          <div className="sia-table__scrollbar-thumb" />
        </div>
      </div>
      {footers.length > 0 ? <div className="sia-table__footer">{footers}</div> : null}
      {loading || internalLoading ? <div className="sia-table__loading" role="status"><Icon name="loader" size={22} spin /><span>加载中</span></div> : null}
      {overlays}
    </div>
  );
}

/** 表格组件。 */
export const Table = forwardRef(TableInner) as <T extends Record<string, unknown> = Record<string, unknown>>(
  props: TableProps<T> & { ref?: Ref<TableRef<T>> },
) => ReactElement | null;

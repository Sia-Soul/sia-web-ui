import { Fragment, forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
import { createResizePlugin } from "./plugins";
import { createTableRows, flattenTableColumns, getTableValue, isTableAutoWidthColumn, mapTableLeafColumns, normalizeFixed, sortTableColumnsByFixed } from "./utils";

const EMPTY_DATA: readonly Record<string, unknown>[] = [];
const EMPTY_COLUMNS: readonly TableColumn<Record<string, unknown>>[] = [];
const EMPTY_PLUGINS: readonly AnyTablePlugin<Record<string, unknown>>[] = [];
const DEFAULT_WIDTH = 160;
const SIZE_ROW_HEIGHT = { small: 32, medium: 38, large: 46 } as const;

interface HeaderCell<T> {
  column: TableColumn<T>;
  colSpan: number;
  rowSpan: number;
  depth: number;
  leaf: boolean;
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
      rows[depth].push({ column, colSpan, rowSpan: leaf ? maxDepth - depth : 1, depth, leaf });
      if (!leaf) walk(column.children!, depth + 1);
    }
  };
  walk(columns, 0);
  return rows;
}

function resolveInitialState<T>(plugin: AnyTablePlugin<T>): unknown {
  return typeof plugin.initialState === "function" ? plugin.initialState() : plugin.initialState;
}

function measureTableCellContentWidth(cell: HTMLElement): number {
  const content = cell.querySelector<HTMLElement>(":scope > .sia-table__cell-content");
  const target = cell.classList.contains("sia-table__header-cell")
    ? cell.querySelector<HTMLElement>(".sia-table__resizable-header > span:first-child, .sia-table__header-label-content")
    : content;
  let contentWidth = cell.scrollWidth;
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
    contentWidth = Math.max(measurement.scrollWidth, measurement.getBoundingClientRect().width);
    measurement.remove();
  }
  const style = window.getComputedStyle(cell);
  return contentWidth
    + (Number.parseFloat(style.paddingLeft) || 0)
    + (Number.parseFloat(style.paddingRight) || 0)
    + (Number.parseFloat(style.borderLeftWidth) || 0)
    + (Number.parseFloat(style.borderRightWidth) || 0);
}

function getTableHorizontalMetrics(viewport: HTMLElement, table: HTMLTableElement | null) {
  const contentWidth = Math.max(viewport.clientWidth, table?.getBoundingClientRect().width ?? viewport.clientWidth);
  return { contentWidth, maxLeft: Math.max(0, contentWidth - viewport.clientWidth) };
}

interface BodyRowProps<T> {
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
      className={`sia-table__row${striped && rowIndex % 2 === 1 ? " sia-table__row--striped" : ""} ${className}`.trim()}
      style={{ height: rowHeight }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {columns.map((column) => {
        const pluginCellProps = getCellProps(column);
        if (pluginCellProps.hidden) return null;
        const value = getTableValue(row.record, column.dataIndex, column.code ?? column.key);
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
            rowSpan={pluginCellProps.rowSpan}
            colSpan={pluginCellProps.colSpan}
            className={`sia-table__cell sia-table__cell--${column.align ?? "left"}${fixed ? ` sia-table__cell--fixed sia-table__cell--fixed-${fixed}` : ""}${fixedEdgeClass}${autoWidthClass}${column.ellipsis !== false ? " sia-table__cell--ellipsis" : ""} ${cellClass} ${pluginCellProps.className ?? ""}`.trim()}
            style={{ ...fixedStyle, ...pluginCellProps.style }}
            onMouseEnter={() => onCellMouseEnter(column)}
            onMouseLeave={() => onCellMouseLeave(column)}
            onClick={(event) => onCellClick(column, event)}
            onContextMenu={(event) => onCellContextMenu(column, event)}
            onPointerDown={(event) => onCellPointerDown(column, event)}
            onPointerMove={(event) => onCellPointerMove(column, event)}
          >
            <div
              className="sia-table__cell-content"
              title={column.showTitle !== false && column.ellipsis !== false && typeof value === "string" ? value : undefined}
            >
              {pluginCellProps.content !== undefined
                ? pluginCellProps.content
                : column.render ? column.render(value, row.record, row.sourceIndex, { row, rowIndex, column }) : value as ReactNode}
            </div>
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
    rowKey = "id",
    plugins: providedPlugins = EMPTY_PLUGINS as readonly AnyTablePlugin<T>[],
    loading = false,
    emptyText = "暂无数据",
    height,
    tableHeight,
    size = "medium",
    bordered = true,
    striped = true,
    virtual,
    virtualThreshold = 100,
    rowHeight = SIZE_ROW_HEIGHT[size],
    overscan = 6,
    stickyHeader = true,
    resizable = true,
    onRowClick,
    onRowDoubleClick,
    onCellContextMenu,
    rowClassName,
    tableStyle,
    className = "",
    style,
    ...htmlProps
  } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollbarDragRef = useRef<{
    axis: "x" | "y";
    pointerId: number;
    startCoordinate: number;
    startScroll: number;
    scrollPerPixel: number;
  } | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(420);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [autoColumnWidths, setAutoColumnWidths] = useState<Record<string, number>>({});
  const getRowKey = useCallback((record: T, index: number) => typeof rowKey === "function"
    ? rowKey(record, index)
    : (record[String(rowKey)] as React.Key | undefined) ?? index, [rowKey]);
  const builtInResizePlugin = useMemo(() => createResizePlugin<T>(), []);
  const activePlugins = useMemo(() => {
    const plugins = providedPlugins.filter((plugin) => resizable || plugin.id !== "resize");
    return resizable && !plugins.some((plugin) => plugin.id === "resize")
      ? [...plugins, builtInResizePlugin]
      : plugins;
  }, [builtInResizePlugin, providedPlugins, resizable]);
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
    const horizontalTrack = Math.max(0, element.clientWidth - 8);
    const verticalTrack = Math.max(0, element.clientHeight - 8);
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

    root.dataset.scrolledLeft = String(logicalScrollLeft > 1);
    root.dataset.scrolledRight = String(maxLeft > 1 && logicalScrollLeft < maxLeft - 1);
    root.dataset.overflowX = String(maxLeft > 1);
    root.dataset.overflowY = String(maxTop > 1);
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
    root.style.setProperty("--sia-table-scrollbar-x-size", `${horizontalThumb}px`);
    root.style.setProperty("--sia-table-scrollbar-x-position", `${horizontalPosition}px`);
    root.style.setProperty("--sia-table-scrollbar-y-size", `${verticalThumb}px`);
    root.style.setProperty("--sia-table-scrollbar-y-position", `${verticalPosition}px`);
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

  useEffect(() => {
    const autoWidthColumns = leafColumns.filter((column) => column.autoWidth && resizedWidths[column.key] === undefined);
    const root = rootRef.current;
    if (!root || autoWidthColumns.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      const measurements: Record<string, number> = {};
      const cells = root.querySelectorAll<HTMLElement>("[data-column-key]");
      for (const column of autoWidthColumns) {
        let width = column.minWidth ?? 56;
        for (const cell of cells) {
          if (cell.dataset.columnKey !== column.key) continue;
          width = Math.max(width, measureTableCellContentWidth(cell));
        }
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

  const shouldVirtualize = (virtual ?? pipeline.rows.length >= virtualThreshold) && !sortedPlugins.some((plugin) => plugin.disableVirtual);
  const startIndex = shouldVirtualize ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan) : 0;
  const visibleCount = shouldVirtualize ? Math.ceil(viewportHeight / rowHeight) + overscan * 2 : pipeline.rows.length;
  const endIndex = shouldVirtualize ? Math.min(pipeline.rows.length, startIndex + visibleCount) : pipeline.rows.length;
  const renderedRows = pipeline.rows.slice(startIndex, endIndex);
  const topSpacer = shouldVirtualize ? startIndex * rowHeight : 0;
  const bottomSpacer = shouldVirtualize ? Math.max(0, (pipeline.rows.length - endIndex) * rowHeight) : 0;
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
  const effectiveHeight = height ?? tableHeight ?? (shouldVirtualize ? 420 : undefined);
  const rootStyle = {
    ...style,
    height: effectiveHeight,
    "--sia-table-header-height": `${headerRows.length * rowHeight}px`,
  } as CSSProperties;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (shouldVirtualize) setScrollTop(element.scrollTop);
    updateScrollMetrics();
  }, [shouldVirtualize, updateScrollMetrics]);

  const handleScrollbarPointerDown = useCallback((axis: "x" | "y", event: React.PointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    const track = event.currentTarget.parentElement;
    if (!element || !track) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const trackLength = axis === "x" ? track.clientWidth : track.clientHeight;
    const thumbLength = axis === "x" ? event.currentTarget.offsetWidth : event.currentTarget.offsetHeight;
    const maxScroll = axis === "x"
      ? getTableHorizontalMetrics(element, tableRef.current).maxLeft
      : element.scrollHeight - element.clientHeight;
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

  useImperativeHandle(ref, () => ({
    getRows: () => pipeline.rows.map((row) => row.record),
    getColumns: () => pipeline.columns,
    getPluginApi: (pluginId) => pluginApisRef.current[pluginId] as never,
    scrollTo: (options) => scrollRef.current?.scrollTo(options),
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
  }), [dataSource.length, pipeline.columns, pipeline.rows]);

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

  function renderHeaderContent(column: TableColumn<T>, content: ReactNode) {
    if (column.description === undefined || column.description === null) return content;
    return <span className="sia-table__header-label">
      <span className="sia-table__header-label-content">{content}</span>
      <Tooltip title={column.description} placement="top" trigger={["hover", "focus"]}>
        <button type="button" className="sia-table__header-description" aria-label={`${column.name ?? column.key}列说明`} onClick={(event) => event.stopPropagation()}>
          <Icon name="info" size={14} />
        </button>
      </Tooltip>
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

  function renderSummaryRow(summary: TableSummaryRow) {
    let labelRendered = false;
    return <tr key={summary.key} className={`sia-table__summary-row ${summary.className ?? ""}`.trim()}>{leafColumns.map((column) => {
      const value = summary.values[column.key];
      const content = value !== undefined ? value : !labelRendered && summary.label !== undefined ? (labelRendered = true, summary.label) : null;
      const fixed = normalizeFixed(column.fixed);
      const fixedEdgeClass = fixed === "left" && column.key === leftFixedEdgeKey
        ? " sia-table__cell--fixed-left-edge"
        : fixed === "right" && column.key === rightFixedEdgeKey ? " sia-table__cell--fixed-right-edge" : "";
      const autoWidthClass = column.autoWidth ? " sia-table__cell--auto-width" : "";
      return <td key={column.key} data-column-key={column.key} className={`sia-table__cell sia-table__summary-cell${fixed ? ` sia-table__cell--fixed sia-table__cell--fixed-${fixed}` : ""}${fixedEdgeClass}${autoWidthClass}`} style={getFixedStyle(column)}>{content}</td>;
    })}</tr>;
  }

  return (
    <div
      ref={rootRef}
      className={`sia-table sia-table--${size}${bordered ? " sia-table--bordered" : ""} ${className}`.trim()}
      style={rootStyle}
      data-has-fixed-left={left > 0}
      data-has-fixed-right={right > 0}
      data-scrolled-left="false"
      data-scrolled-right="true"
      {...htmlProps}
    >
      {hasToolbar ? <div className="sia-table__toolbar"><div>{toolbarStart}</div><div>{toolbarEnd}</div></div> : null}
      <div className="sia-table__viewport-wrap">
        <div className="sia-table__viewport" ref={scrollRef} onScroll={handleScroll}>
        <table ref={tableRef} className="sia-table__element" style={{ width: Math.max(totalWidth, 1), ...(manualColumnLayout ? { minWidth: 0 } : {}), ...tableStyle }}>
          <colgroup>{leafColumns.map((column) => <col key={column.key} data-column-key={column.key} style={{ width: columnWidths.get(column.key) ?? DEFAULT_WIDTH }} />)}</colgroup>
          <thead className={stickyHeader ? "sia-table__head sia-table__head--sticky" : "sia-table__head"}>
            {headerRows.map((headerRow, depth) => <tr key={depth}>{headerRow.map((cell) => {
              const fixed = cell.leaf ? normalizeFixed(cell.column.fixed) : undefined;
              const pluginHeaderProps = getPluginHeaderCellProps(cell.column);
              const fixedEdgeClass = fixed === "left" && cell.column.key === leftFixedEdgeKey
                ? " sia-table__cell--fixed-left-edge"
                : fixed === "right" && cell.column.key === rightFixedEdgeKey ? " sia-table__cell--fixed-right-edge" : "";
              const autoWidthClass = cell.column.autoWidth ? " sia-table__cell--auto-width" : "";
              return <th
                key={`${cell.column.key}-${depth}`}
                data-column-key={cell.column.key}
                colSpan={cell.colSpan}
                rowSpan={cell.rowSpan}
                className={`sia-table__header-cell sia-table__cell--${cell.column.align ?? "left"}${fixed ? ` sia-table__cell--fixed sia-table__cell--fixed-${fixed}` : ""}${fixedEdgeClass}${autoWidthClass} ${cell.column.headerClassName ?? ""} ${pluginHeaderProps.className ?? ""}`.trim()}
                style={{ ...getFixedStyle(cell.column), top: stickyHeader ? depth * rowHeight : undefined, ...pluginHeaderProps.style }}
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
            {topSpacer > 0 ? <tr aria-hidden="true"><td colSpan={leafColumns.length} style={{ height: topSpacer, padding: 0, border: 0 }} /></tr> : null}
            {renderedRows.map((row, offset) => {
              const rowIndex = startIndex + offset;
              const pluginClasses = sortedPlugins.map((plugin) => plugin.getRowClassName?.(row, getContext(plugin))).filter(Boolean).join(" ");
              const customClass = typeof rowClassName === "function" ? rowClassName(row.record, row.sourceIndex) : rowClassName ?? "";
              return <TableBodyRow
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
                className={`${pluginClasses} ${customClass}`.trim()}
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
            })}
            {bottomSpacer > 0 ? <tr aria-hidden="true"><td colSpan={leafColumns.length} style={{ height: bottomSpacer, padding: 0, border: 0 }} /></tr> : null}
          </tbody>
          {summaries.length > 0 ? <tfoot className="sia-table__summary">{summaries.map(renderSummaryRow)}</tfoot> : null}
        </table>
        </div>
        {pipeline.rows.length === 0 ? <div className="sia-table__empty" role="status">{emptyText}</div> : null}
        <div className="sia-table__scrollbar sia-table__scrollbar--horizontal" aria-hidden="true">
          <div
            className="sia-table__scrollbar-thumb"
            onPointerDown={(event) => handleScrollbarPointerDown("x", event)}
            onPointerMove={handleScrollbarPointerMove}
            onPointerUp={handleScrollbarPointerEnd}
            onPointerCancel={handleScrollbarPointerEnd}
          />
        </div>
        <div className="sia-table__scrollbar sia-table__scrollbar--vertical" aria-hidden="true">
          <div
            className="sia-table__scrollbar-thumb"
            onPointerDown={(event) => handleScrollbarPointerDown("y", event)}
            onPointerMove={handleScrollbarPointerMove}
            onPointerUp={handleScrollbarPointerEnd}
            onPointerCancel={handleScrollbarPointerEnd}
          />
        </div>
      </div>
      {footers.length > 0 ? <div className="sia-table__footer">{footers}</div> : null}
      {loading || internalLoading ? <div className="sia-table__loading" role="status"><Icon name="loader" size={22} spin /><span>加载中</span></div> : null}
      {overlays}
    </div>
  );
}

export const Table = forwardRef(TableInner) as <T extends Record<string, unknown> = Record<string, unknown>>(
  props: TableProps<T> & { ref?: Ref<TableRef<T>> },
) => ReactElement | null;

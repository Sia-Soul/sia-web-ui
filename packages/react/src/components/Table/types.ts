import type { CSSProperties, HTMLAttributes, Key, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";

export type TableKey = Key;
export type TableFixed = "left" | "right";
export type TableAlign = "left" | "center" | "right";
export type TableSize = "small" | "medium" | "large";

export interface TableRow<T> {
  key: TableKey;
  record: T;
  sourceIndex: number;
  depth: number;
  meta: Record<string, unknown>;
}

export interface TableCellRenderInfo<T> {
  row: TableRow<T>;
  rowIndex: number;
  column: TableColumn<T>;
}

export interface TableMergeStickyConfig<T> {
  inset?: number;
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
  align?: TableAlign;
  getValue?: (record: T, index: number, rows: readonly T[]) => ReactNode;
}

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  code?: string;
  name?: string;
  title?: ReactNode;
  description?: ReactNode;
  dataIndex?: keyof T | string | readonly string[];
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: TableAlign;
  fixed?: TableFixed | boolean;
  hidden?: boolean;
  ellipsis?: boolean;
  sortable?: boolean;
  editable?: boolean | TableEditableCellConfig<T>;
  exportable?: boolean;
  exportRender?: (value: unknown, record: T, index: number, info: TableCellRenderInfo<T>) => ReactNode;
  rowSpan?: boolean | keyof T | string | readonly string[] | ((record: T, index: number, rows: readonly T[]) => unknown);
  mergeSticky?: boolean | TableMergeStickyConfig<T>;
  sum?: boolean;
  children?: readonly TableColumn<T>[];
  render?: (value: unknown, record: T, index: number, info: TableCellRenderInfo<T>) => ReactNode;
  renderHeader?: (column: TableColumn<T>, context: TablePluginContext<T, any>) => ReactNode;
  cellClassName?: string | ((record: T, index: number) => string);
  headerClassName?: string;
  meta?: Record<string, unknown>;
}

export type TableEditableCellType = "input" | "inputNumber" | "select" | "custom";

export interface TableEditableCellConfig<T> {
  type?: TableEditableCellType;
  options?: readonly { label: ReactNode; value: string | number }[];
  editRender?: (record: T, save: (value: unknown) => void, cancel: () => void) => ReactNode;
  canEdit?: (record: T) => boolean;
}

export interface TablePluginContext<T, S = unknown> {
  readonly pluginId: string;
  readonly sourceData: readonly T[];
  readonly baseColumns: readonly TableColumn<T>[];
  readonly rows: readonly TableRow<T>[];
  readonly columns: readonly TableColumn<T>[];
  readonly state: S;
  getRowKey: (record: T, index: number) => TableKey;
  getState: <Value = unknown>(pluginId: string) => Value | undefined;
  setState: (next: S | ((previous: S) => S)) => void;
  setPluginState: <Value>(pluginId: string, next: Value | ((previous: Value) => Value)) => void;
  getPluginApi: <Api = unknown>(pluginId: string) => Api | undefined;
  emit: (event: TablePluginEvent) => void;
}

export interface TablePluginEvent {
  type: string;
  source: string;
  payload?: unknown;
}

export interface TablePluginCellProps {
  rowSpan?: number;
  colSpan?: number;
  hidden?: boolean;
  className?: string;
  style?: CSSProperties;
  content?: ReactNode;
}

export interface TablePluginHeaderCellProps {
  className?: string;
  style?: CSSProperties;
}

export interface TablePlugin<T, S = unknown, Api = unknown> {
  id: string;
  order?: number;
  disableVirtual?: boolean;
  initialState?: S | (() => S);
  transformColumns?: (columns: readonly TableColumn<T>[], context: TablePluginContext<T, S>) => readonly TableColumn<T>[];
  transformRows?: (rows: readonly TableRow<T>[], context: TablePluginContext<T, S>) => readonly TableRow<T>[];
  renderToolbarStart?: (context: TablePluginContext<T, S>) => ReactNode;
  renderToolbarEnd?: (context: TablePluginContext<T, S>) => ReactNode;
  renderSummary?: (context: TablePluginContext<T, S>) => readonly TableSummaryRow[] | null;
  renderFooter?: (context: TablePluginContext<T, S>) => ReactNode;
  renderOverlay?: (context: TablePluginContext<T, S>) => ReactNode;
  getRowClassName?: (row: TableRow<T>, context: TablePluginContext<T, S>) => string;
  getCellProps?: (row: TableRow<T>, column: TableColumn<T>, context: TablePluginContext<T, S>) => TablePluginCellProps | void;
  getHeaderCellProps?: (column: TableColumn<T>, context: TablePluginContext<T, S>) => TablePluginHeaderCellProps | void;
  onRowClick?: (row: TableRow<T>, context: TablePluginContext<T, S>) => void;
  onRowMouseEnter?: (row: TableRow<T>, context: TablePluginContext<T, S>) => void;
  onRowMouseLeave?: (row: TableRow<T>, context: TablePluginContext<T, S>) => void;
  onCellMouseEnter?: (row: TableRow<T>, column: TableColumn<T>, context: TablePluginContext<T, S>) => void;
  onCellMouseLeave?: (row: TableRow<T>, column: TableColumn<T>, context: TablePluginContext<T, S>) => void;
  onCellClick?: (row: TableRow<T>, column: TableColumn<T>, event: ReactMouseEvent<HTMLTableCellElement>, context: TablePluginContext<T, S>) => void;
  onCellPointerDown?: (row: TableRow<T>, column: TableColumn<T>, event: ReactPointerEvent<HTMLTableCellElement>, context: TablePluginContext<T, S>) => void;
  onCellPointerMove?: (row: TableRow<T>, column: TableColumn<T>, event: ReactPointerEvent<HTMLTableCellElement>, context: TablePluginContext<T, S>) => void;
  onHeaderPointerDown?: (column: TableColumn<T>, event: ReactPointerEvent<HTMLTableCellElement>, context: TablePluginContext<T, S>) => void;
  onHeaderPointerMove?: (column: TableColumn<T>, event: ReactPointerEvent<HTMLTableCellElement>, context: TablePluginContext<T, S>) => void;
  onMount?: (context: TablePluginContext<T, S>) => void | (() => void);
  onEvent?: (event: TablePluginEvent, context: TablePluginContext<T, S>) => void;
  getApi?: (context: TablePluginContext<T, S>) => Api;
}

export type AnyTablePlugin<T> = TablePlugin<T, any, any>;

export interface TableSummaryRow {
  key: string;
  label?: ReactNode;
  values: Record<string, ReactNode>;
  className?: string;
}

export interface TableProps<T extends Record<string, unknown> = Record<string, unknown>>
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  dataSource?: readonly T[];
  columns?: readonly TableColumn<T>[];
  rowKey?: keyof T | string | ((record: T, index: number) => TableKey);
  plugins?: readonly AnyTablePlugin<T>[];
  loading?: boolean;
  emptyText?: ReactNode;
  height?: number | string;
  tableHeight?: number | string;
  size?: TableSize;
  bordered?: boolean;
  striped?: boolean;
  virtual?: boolean;
  virtualThreshold?: number;
  rowHeight?: number;
  overscan?: number;
  stickyHeader?: boolean;
  onRowClick?: (record: T, index: number) => void;
  onRowDoubleClick?: (record: T, index: number) => void;
  rowClassName?: string | ((record: T, index: number) => string);
  tableStyle?: CSSProperties;
}

export interface TableRef<T> {
  getRows: () => readonly T[];
  getColumns: () => readonly TableColumn<T>[];
  getPluginApi: <Api = unknown>(pluginId: string) => Api | undefined;
  scrollTo: (options: ScrollToOptions) => void;
  setLoading: (loading: boolean) => void;
  getPage: () => { current: number; pageSize: number };
  setPage: (page: Partial<{ current: number; pageSize: number }>) => void;
  clearSelection: () => void;
  setSelectedKeys: (keys: readonly TableKey[]) => void;
  getSelectedRows: () => readonly T[];
  getSortInfo: () => TableSortInfo | null;
  getColumnSettings: () => readonly TableColumnSettingItem[];
  openColumnSetting: () => void;
  generatePageParams: <Model extends Record<string, unknown>>(model: Model) => Model & TablePageParams;
  requestCount: (model?: unknown) => Promise<void>;
}

export interface TableSortInfo {
  field: string;
  order: "ascend" | "descend" | null;
  scope?: "page" | "all";
}

export interface TablePageParams {
  current: number;
  pageIndex: number;
  pageSize: number;
  skipCount: number;
  maxResultCount: number;
}

export interface TableColumnSettingItem {
  key: string;
  width?: number;
  fixed?: TableFixed;
  visible: boolean;
  order: number;
}

export interface TableSettingsSnapshot {
  columns?: readonly TableColumnSettingItem[];
  pageSize?: number;
  version?: number;
}

export interface TableSettingsAdapter {
  load: (scope: { moduleName: string; businessKey: string }) => Promise<TableSettingsSnapshot | null>;
  save: (scope: { moduleName: string; businessKey: string }, settings: TableSettingsSnapshot) => Promise<void>;
}

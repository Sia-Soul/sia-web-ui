import type { CSSProperties, HTMLAttributes, Key, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";

/** 表格行或列的唯一标识类型。 */
export type TableKey = Key;
/** 表格列的固定方向。 */
export type TableFixed = "left" | "right";
/** 表格单元格的水平对齐方式。 */
export type TableAlign = "left" | "center" | "right";
/** 表格行高和字号的尺寸等级。 */
export type TableSize = "small" | "medium" | "large";

/** 经过表格插件处理的行数据及其层级和索引信息。 */
export interface TableRow<T> {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: TableKey;
  /** 当前业务记录。 */
  record: T;
  /** 记录在原始数据中的索引。 */
  sourceIndex: number;
  /** 当前节点或行的嵌套深度。 */
  depth: number;
  /** 附加的业务元数据。 */
  meta: Record<string, unknown>;
}

/** 单元格渲染和事件回调的上下文，包含行、列和索引。 */
export interface TableCellRenderInfo<T> {
  /** 当前行记录。 */
  row: TableRow<T>;
  /** 行索引，从 0 开始。 */
  rowIndex: number;
  /** 当前单元格对应的完整列配置。 */
  column: TableColumn<T>;
}

/** TableMergeSticky的配置。 */
export interface TableMergeStickyConfig<T> {
  /** 内容或选区与外边缘之间的内缩距离。 */
  inset?: number;
  /** 组件或浮层的堆叠层级。 */
  zIndex?: number;
  /** 附加到组件根节点的 CSS 类名。 */
  className?: string;
  /** 组件根节点的内联样式。 */
  style?: CSSProperties;
  /** 交叉轴对齐 */
  align?: TableAlign;
  /** 读取当前内容。 */
  getValue?: (record: T, index: number, rows: readonly T[]) => ReactNode;
}

/** 表格的列定义，支持取值、渲染、固定、排序和分组表头。 */
export interface TableColumn<T = Record<string, unknown>> {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: string;
  /** 代码内容或按键代码。 */
  code?: string;
  /** 名称或字段标识。 */
  name?: string;
  /** 标题内容，可传入文本或 React 节点。 */
  title?: ReactNode;
  /** 补充说明内容。 */
  description?: ReactNode;
  /** 读取单元格值的字段名或嵌套路径。 */
  dataIndex?: keyof T | string | readonly string[];
  /** 列宽，单位为像素；拖拽调整后可由列设置插件持久化。 */
  width?: number;
  /** 弹性布局的伸缩权重或 CSS flex 配置。 */
  flex?: number;
  /** 是否根据单元格内容自动计算列宽。 */
  autoWidth?: boolean;
  /** 允许的最小宽度。 */
  minWidth?: number;
  /** 允许的最大宽度。 */
  maxWidth?: number;
  /** 交叉轴对齐 */
  align?: TableAlign;
  /** 固定列位置：left 固定在左侧，right 固定在右侧；未设置时随横向滚动。 */
  fixed?: TableFixed | boolean;
  /** 是否隐藏此项。 */
  hidden?: boolean;
  /** 默认单行显示并省略溢出内容（含 Space 标签组）；设为 false 允许多行。 */
  ellipsis?: boolean;
  /** 是否使用 Sia Tooltip 显示完整文本；默认 false，不生成浏览器原生 title。 */
  showTitle?: boolean;
  /** 是否允许该列排序。 */
  sortable?: boolean;
  /** 是否允许该列筛选。 */
  filterable?: boolean;
  /** 纯文本编辑；text 用于受控内容，onChange 在保存时触发 */
  editable?: boolean | TableEditableCellConfig<T>;
  /** 是否将该列包含在导出结果中。 */
  exportable?: boolean;
  /** 将单元格值转换为导出内容的函数。 */
  exportRender?: (value: unknown, record: T, index: number, info: TableCellRenderInfo<T>) => ReactNode;
  /** 单元格跨越的行数，或按行计算跨行数量。 */
  rowSpan?: boolean | keyof T | string | readonly string[] | ((record: T, index: number, rows: readonly T[]) => unknown);
  /** 合并单元格是否随滚动保持粘性定位。 */
  mergeSticky?: boolean | TableMergeStickyConfig<T>;
  /** 合计行对此列的求和方式或求和值。 */
  sum?: boolean;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: readonly TableColumn<T>[];
  /** 自定义数据单元格内容，接收该列的值、行数据和单元格上下文。 */
  render?: (value: unknown, record: T, index: number, info: TableCellRenderInfo<T>) => ReactNode;
  /** 自定义列头内容。 */
  renderHeader?: (column: TableColumn<T>, context: TablePluginContext<T, any>) => ReactNode;
  /** 数据单元格的 CSS 类名，也可按单元格计算。 */
  cellClassName?: string | ((record: T, index: number) => string);
  /** 表头单元格的附加 CSS 类名。 */
  headerClassName?: string;
  /** 附加的业务元数据。 */
  meta?: Record<string, unknown>;
}

/** TableEditableCell的类型标识。 */
export type TableEditableCellType = "input" | "inputNumber" | "select" | "custom";

/** TableEditableCell的配置。 */
export interface TableEditableCellConfig<T> {
  /** 类型标识，用于选择对应的表现形式。 */
  type?: TableEditableCellType;
  /** 可供用户选择的候选项列表。 */
  options?: readonly {
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: string | number }[];
  /** 自定义单元格编辑控件。 */
  editRender?: (record: T, save: (value: unknown) => void, cancel: () => void) => ReactNode;
  /** 判断当前单元格是否允许编辑。 */
  canEdit?: (record: T) => boolean;
}

/** 表格插件执行时的上下文，提供数据、列、状态和事件操作。 */
export interface TablePluginContext<T, S = unknown> {
  /** 插件唯一标识。 */
  readonly pluginId: string;
  /** 未经插件处理的原始数据。 */
  readonly sourceData: readonly T[];
  /** 未经插件转换的基础列配置。 */
  readonly baseColumns: readonly TableColumn<T>[];
  /** 默认可见行数 */
  readonly rows: readonly TableRow<T>[];
  /** 列配置或选项布局列数，具体类型见签名。 */
  readonly columns: readonly TableColumn<T>[];
  /** 当前状态快照。 */
  readonly state: S;
  /** 读取记录的唯一标识。 */
  getRowKey: (record: T, index: number) => TableKey;
  /** 读取当前状态。 */
  getState: <Value = unknown>(pluginId: string) => Value | undefined;
  /** 更新当前状态，可传入基于旧状态的更新函数。 */
  setState: (next: S | ((previous: S) => S)) => void;
  /** 更新指定插件的状态。 */
  setPluginState: <Value>(pluginId: string, next: Value | ((previous: Value) => Value)) => void;
  /** 按插件标识获取该插件暴露的 API。 */
  getPluginApi: <Api = unknown>(pluginId: string) => Api | undefined;
  /** 发出事件，通知已注册的插件监听者。 */
  emit: (event: TablePluginEvent) => void;
}

/** 表格插件间传递的事件，包含类型、来源和负载。 */
export interface TablePluginEvent {
  /** 类型标识，用于选择对应的表现形式。 */
  type: string;
  /** 触发来源，用于区分不同入口的操作。 */
  source: string;
  /** 事件携带的数据。 */
  payload?: unknown;
}

/** TablePluginCell的属性配置。 */
export interface TablePluginCellProps {
  /** 单元格跨越的行数，或按行计算跨行数量。 */
  rowSpan?: number;
  /** 单元格跨越的列数。 */
  colSpan?: number;
  /** 是否隐藏此项。 */
  hidden?: boolean;
  /** 附加到组件根节点的 CSS 类名。 */
  className?: string;
  /** 组件根节点的内联样式。 */
  style?: CSSProperties;
  /** 需要显示的内容，支持文本或 React 节点。 */
  content?: ReactNode;
}

/** TablePluginHeaderCell的属性配置。 */
export interface TablePluginHeaderCellProps {
  /** 附加到组件根节点的 CSS 类名。 */
  className?: string;
  /** 组件根节点的内联样式。 */
  style?: CSSProperties;
}

/** 表格插件契约，提供数据转换、渲染扩展、事件监听和对外 API。 */
export interface TablePlugin<T, S = unknown, Api = unknown> {
  /** 唯一标识，用于关联实例或插件。 */
  id: string;
  /** 排序位置或排序方向。 */
  order?: number;
  /** 是否禁用虚拟渲染。 */
  disableVirtual?: boolean;
  /** 插件或功能初始化时的状态。 */
  initialState?: S | (() => S);
  /** 转换列配置；返回值传递给后续插件和表格渲染。 */
  transformColumns?: (columns: readonly TableColumn<T>[], context: TablePluginContext<T, S>) => readonly TableColumn<T>[];
  /** 转换行数据；返回值传递给后续插件和表格渲染。 */
  transformRows?: (rows: readonly TableRow<T>[], context: TablePluginContext<T, S>) => readonly TableRow<T>[];
  /** 渲染表格工具栏起始区域。 */
  renderToolbarStart?: (context: TablePluginContext<T, S>) => ReactNode;
  /** 渲染表格工具栏末尾区域。 */
  renderToolbarEnd?: (context: TablePluginContext<T, S>) => ReactNode;
  /** 渲染表格合计区域。 */
  renderSummary?: (context: TablePluginContext<T, S>) => readonly TableSummaryRow[] | null;
  /** 渲染底部内容。 */
  renderFooter?: (context: TablePluginContext<T, S>) => ReactNode;
  /** 渲染覆盖层或弹出面板。 */
  renderOverlay?: (context: TablePluginContext<T, S>) => ReactNode;
  /** 根据行信息生成 CSS 类名。 */
  getRowClassName?: (row: TableRow<T>, context: TablePluginContext<T, S>) => string;
  /** 根据单元格上下文生成附加属性。 */
  getCellProps?: (row: TableRow<T>, column: TableColumn<T>, context: TablePluginContext<T, S>) => TablePluginCellProps | void;
  /** 根据列信息生成表头附加属性。 */
  getHeaderCellProps?: (column: TableColumn<T>, context: TablePluginContext<T, S>) => TablePluginHeaderCellProps | void;
  /** 点击行时调用。 */
  onRowClick?: (row: TableRow<T>, context: TablePluginContext<T, S>) => void;
  /** 鼠标进入行时调用。 */
  onRowMouseEnter?: (row: TableRow<T>, context: TablePluginContext<T, S>) => void;
  /** 鼠标离开行时调用。 */
  onRowMouseLeave?: (row: TableRow<T>, context: TablePluginContext<T, S>) => void;
  /** 鼠标进入单元格时调用。 */
  onCellMouseEnter?: (row: TableRow<T>, column: TableColumn<T>, context: TablePluginContext<T, S>) => void;
  /** 鼠标离开单元格时调用。 */
  onCellMouseLeave?: (row: TableRow<T>, column: TableColumn<T>, context: TablePluginContext<T, S>) => void;
  /** 点击单元格时调用。 */
  onCellClick?: (row: TableRow<T>, column: TableColumn<T>, event: ReactMouseEvent<HTMLTableCellElement>, context: TablePluginContext<T, S>) => void;
  /** 指针在单元格按下时调用。 */
  onCellPointerDown?: (row: TableRow<T>, column: TableColumn<T>, event: ReactPointerEvent<HTMLTableCellElement>, context: TablePluginContext<T, S>) => void;
  /** 指针在单元格移动时调用。 */
  onCellPointerMove?: (row: TableRow<T>, column: TableColumn<T>, event: ReactPointerEvent<HTMLTableCellElement>, context: TablePluginContext<T, S>) => void;
  /** 指针在表头按下时调用。 */
  onHeaderPointerDown?: (column: TableColumn<T>, event: ReactPointerEvent<HTMLTableCellElement>, context: TablePluginContext<T, S>) => void;
  /** 指针在表头移动时调用。 */
  onHeaderPointerMove?: (column: TableColumn<T>, event: ReactPointerEvent<HTMLTableCellElement>, context: TablePluginContext<T, S>) => void;
  /** 插件挂载时调用；可返回清理函数，在卸载时执行。 */
  onMount?: (context: TablePluginContext<T, S>) => void | (() => void);
  /** 接收其他插件或表格发出的事件。 */
  onEvent?: (event: TablePluginEvent, context: TablePluginContext<T, S>) => void;
  /** 创建插件对外暴露的操作 API。 */
  getApi?: (context: TablePluginContext<T, S>) => Api;
}

/** 可组合到 Table.plugins 中的表格插件类型。 */
export type AnyTablePlugin<T> = TablePlugin<T, any, any>;

/** 一条小计或总计行的标签和单元格内容。 */
export interface TableSummaryRow {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: string;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: ReactNode;
  /** 字段值或选中值的集合。 */
  values: Record<string, ReactNode>;
  /** 附加到组件根节点的 CSS 类名。 */
  className?: string;
}

/** 表格的属性配置。 */
export interface TableProps<T extends Record<string, unknown> = Record<string, unknown>>
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** 表格或列表的原始数据集合。 */
  dataSource?: readonly T[];
  /** 表格列定义；支持 children 构建分组表头。 */
  columns?: readonly TableColumn<T>[];
  /** 行唯一键字段或计算函数 */
  rowKey?: keyof T | string | ((record: T, index: number) => TableKey);
  /** 默认启用行悬停高亮；传入 createHighlightPlugin({ row: false }) 可关闭。 */
  plugins?: readonly AnyTablePlugin<T>[];
  /** 是否处于加载状态。 */
  loading?: boolean;
  /** 内容为空时显示的占位内容 */
  emptyText?: ReactNode;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height?: number | string;
  /** 表格滚动区域的高度。 */
  tableHeight?: number | string;
  /** 表格密度 */
  size?: TableSize;
  /** 是否显示边框。 */
  bordered?: boolean;
  /** 是否显示行分隔线（含表头和汇总行），默认 true。 */
  rowBordered?: boolean;
  /** 是否显示列分隔线，默认 true。 */
  columnBordered?: boolean;
  /** 是否将工具栏纳入表格边框，默认 false；表格主体边框仍由 bordered 控制。 */
  toolbarBordered?: boolean;
  /** 是否显示隔行背景。 */
  striped?: boolean;
  /** 长列表启用窗口化渲染 */
  virtual?: boolean;
  /** 启用虚拟滚动的选项数量 */
  virtualThreshold?: number;
  /** 行高度，虚拟滚动用其计算行位置。 */
  rowHeight?: number;
  /** 虚拟列表在可视区域前后额外渲染的数量。 */
  overscan?: number;
  /** 滚动时是否固定表头。 */
  stickyHeader?: boolean;
  /** 是否允许拖拽表头边界调整列宽；默认启用内置列宽调整插件。 */
  resizable?: boolean;
  /** 点击行时调用。 */
  onRowClick?: (record: T, index: number) => void;
  /** 双击行时调用。 */
  onRowDoubleClick?: (record: T, index: number) => void;
  /** 单元格右键事件，可用于业务上下文菜单 */
  onCellContextMenu?: (
    record: T,
    column: TableColumn<T>,
    index: number,
    event: ReactMouseEvent<HTMLTableCellElement>,
  ) => void;
  /** 行的 CSS 类名或计算函数。 */
  rowClassName?: string | ((record: T, index: number) => string);
  /** 表格元素的内联样式。 */
  tableStyle?: CSSProperties;
}

/** 表格的实例引用接口。 */
export interface TableRef<T> {
  /** 读取插件当前处理的行数据。 */
  getRows: () => readonly T[];
  /** 读取当前表格列配置。 */
  getColumns: () => readonly TableColumn<T>[];
  /** 按插件标识获取该插件暴露的 API。 */
  getPluginApi: <Api = unknown>(pluginId: string) => Api | undefined;
  /** 滚动到指定位置。 */
  scrollTo: (options: ScrollToOptions) => void;
  /** 切换加载状态。 */
  setLoading: (loading: boolean) => void;
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
  /** 清空当前选择。 */
  clearSelection: () => void;
  /** 设置选中行标识集合。 */
  setSelectedKeys: (keys: readonly TableKey[]) => void;
  /** 读取当前选中的行数据。 */
  getSelectedRows: () => readonly T[];
  /** 读取当前排序列及方向。 */
  getSortInfo: () => TableSortInfo | null;
  /** 读取当前列设置。 */
  getColumnSettings: () => readonly TableColumnSettingItem[];
  /** 打开列设置面板。 */
  openColumnSetting: () => void;
  /** 将分页状态转换为业务请求需要的参数。 */
  generatePageParams: <Model extends Record<string, unknown>>(model: Model) => Model & TablePageParams;
  /** 请求记录总数的函数。 */
  requestCount: (model?: unknown) => Promise<void>;
}

/** 当前排序列和排序方向。 */
export interface TableSortInfo {
  /** 字段名或字段路径。 */
  field: string;
  /** 排序位置或排序方向。 */
  order: "ascend" | "descend" | null;
  /** 配置存储的作用域，用于隔离不同模块和业务表格。 */
  scope?: "page" | "all";
}

/** 传递给业务数据请求的分页参数。 */
export interface TablePageParams {
  /** 当前页码、步骤或播放位置，具体取值见组件类型。 */
  current: number;
  /** 当前页索引。 */
  pageIndex: number;
  /** 每页显示的记录数。 */
  pageSize: number;
  /** 请求数据时跳过的记录数。 */
  skipCount: number;
  /** 请求数据时最多返回的记录数。 */
  maxResultCount: number;
}

/** TableColumnSetting的项目定义。 */
export interface TableColumnSettingItem {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: string;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?: number;
  /** 列固定位置，left 固定左侧，right 固定右侧。 */
  fixed?: TableFixed;
  /** 是否可见。 */
  visible: boolean;
  /** 排序位置或排序方向。 */
  order: number;
}

/** 可持久化的表格列设置和分页大小快照。 */
export interface TableSettingsSnapshot {
  /** 列配置或选项布局列数，具体类型见签名。 */
  columns?: readonly TableColumnSettingItem[];
  /** 每页显示的记录数。 */
  pageSize?: number;
  /** 配置格式版本号，用于兼容历史数据。 */
  version?: number;
}

/** 读取与保存表格设置的适配器契约。 */
export interface TableSettingsAdapter {
  /** 按 scope 读取表格配置；首次挂载及打开列设置时调用。无已保存配置时返回 null 或 undefined。 */
  load: (scope: {
  /** 所属业务模块名称。 */
  moduleName: string;
  /** 同一模块内用于区分表格配置的业务标识。 */
  businessKey: string }) => Promise<TableSettingsSnapshot | null>;
  /** 按 scope 保存完整的列设置快照。用于列设置应用、拖拽列宽结束或分页大小变化后的持久化，可返回 Promise。 */
  save: (scope: {
  /** 所属业务模块名称。 */
  moduleName: string;
  /** 同一模块内用于区分表格配置的业务标识。 */
  businessKey: string }, settings: TableSettingsSnapshot) => Promise<void>;
}

import type { CSSProperties, HTMLAttributes, Key, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";

/** 表格行或列的唯一标识类型。 */
export type TableKey = Key;
/** 表格列的固定方向。 */
export type TableFixed = "left" | "right";
/** 表格单元格的水平对齐方式。 */
export type TableAlign = "left" | "center" | "right";
/** 表格行高和字号的尺寸等级。 */
export type TableSize = "small" | "medium" | "large";

/** Canvas 单元格的绘制内容，不创建 React 子树。 */
export interface TableCanvasCell {
  /** 单行显示文本；超出列宽时自动省略。 */
  text: string;
  /** 文本颜色；默认使用表格主题文字色。 */
  color?: string;
  /** 标签背景色；设置后以圆角标签绘制，未设置时绘制普通文本。 */
  background?: string;
}

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
  /** 列头内容，可传入文本或 React 节点；默认单行显示，仅文字实际超宽省略时通过框架 title 提示展示完整文本，完整显示时不提示。节点无法提取文本时使用 name 或 key。 */
  title?: ReactNode;
  /** 是否以红色列名和前置红色星号标识必填列，默认 false；仅表达列头语义，不自动校验单元格。 */
  required?: boolean;
  /** 单元格是否校验失败，默认 false；可按行数据和源数据索引返回布尔值。失败时显示淡红斜纹和 3px 红色底线，不插入图标、不改变行高；业务负责判断空值、格式或其他错误。 */
  invalid?: boolean | ((record: T, index: number) => boolean);
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
  /** 数据单元格默认单行显示并省略溢出内容（含 Space 标签组）；设为 false 允许多行，不影响列头始终单行省略。 */
  ellipsis?: boolean;
  /** 数据单元格是否使用 Sia Tooltip 显示完整文本；默认 false，不生成浏览器原生 title。列头仅在文字实际省略时提示完整标题，不受此属性影响。 */
  showTitle?: boolean;
  /** 是否允许该列排序；配合排序插件显示按钮，依次切换升序、降序、未排序，当前排序方向以高亮单箭头显示。 */
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
  /** Canvas 模式的纯绘制回调；返回 null 不绘制内容。未提供时，普通值直接绘制，自定义 render 仍以可见区域内的 Sia/React 组件显示。 */
  canvasRender?: (value: unknown, record: T, index: number, info: TableCellRenderInfo<T>) => TableCanvasCell | null;
  /** 自定义列头内容，接收当前列及插件上下文；外层保持单行省略，悬停提示从 title 提取文本，无法提取时回退到 name 或 key。 */
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
  /** 是否禁用虚拟渲染；仅在实际展示行数不超过 100 时生效，超过 100 行由表格强制启用。 */
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
  /** 行唯一键字段或计算函数，显式提供的值应唯一。未设置、字段不存在或值为 null/undefined 时按数据对象生成内部唯一键，不读取首列或默认 id。同一对象在排序、筛选后保留内部键；重新请求得到的新对象会生成新键，跨请求保留选择须显式设置业务主键。 */
  rowKey?: keyof T | string | ((record: T, index: number) => TableKey);
  /** 默认启用行悬停高亮；传入 createHighlightPlugin({ row: false }) 可关闭。 */
  plugins?: readonly AnyTablePlugin<T>[];
  /** 是否处于加载状态。 */
  loading?: boolean;
  /** 内容为空时显示的占位内容 */
  emptyText?: ReactNode;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height?: number | string;
  /** 数据内容区的最大高度（不含表头、工具栏和分页）；数值为 px，字符串为 CSS 长度。少量行按自然高度展示，超出后内部滚动；不设置则不额外限制。与 height 同时使用时两者共同约束。 */
  maxBodyHeight?: number | string;
  /**
   * 自动填充从表格顶部到可视区域底部的剩余高度，包含工具栏和分页；true 使用当前窗口视口。
   * 查询区尺寸、祖先布局、窗口尺寸及隐藏页签显示后自动重测。height / tableHeight 显式设置时优先。
   * 默认关闭；不要同时使用依赖表格自身高度的容器或垂直居中布局。
   */
  fillRemaining?: boolean | {
    /** 返回具有独立确定高度的容器，按其内边距内侧底边计算；默认使用窗口视口，返回 null 时等待容器就绪。 */
    container?: () => HTMLElement | null;
    /** 从可用高度中额外扣除的底部留白，单位 px，默认 0；不自动预留表格之后的兄弟内容。 */
    bottomOffset?: number;
    /** 最小总高度，单位 px，默认 0；超过可用空间时允许溢出，以保证最低可操作区域。 */
    minHeight?: number;
  };
  /** 表格滚动区域的高度。 */
  tableHeight?: number | string;
  /**
   * 表格密度；省略时与显式传 medium 相同。small、medium、large 默认行高分别为 28、36、46px。
   * 单元格使用各尺寸字号和 1.5 倍文字行高，不继承宿主页面的文字行高。
   * small / medium 数据单元格内的链接按钮高度分别为 20 / 24px，以适配行高；工具栏不受影响，其他自定义内容仍可能撑高单元格。
   * @defaultValue "medium"
   */
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
  /** 是否启用窗口化渲染；未指定时按 virtualThreshold 判断。筛选、分页及树展开后的实际展示行数超过 100 时强制启用，优先于 false 和插件的 disableVirtual。 */
  virtual?: boolean;
  /** 内容渲染方式，默认 dom；canvas 使用画布绘制文本，并保留可见交互组件及 DOM 单元格语义。Canvas 强制固定行高和行虚拟化；不支持虚拟化的插件自动回退 DOM。 */
  renderMode?: "dom" | "canvas";
  /** 自动启用虚拟滚动的展示行数阈值（含该值），默认 100；仅在未指定 virtual 时使用，实际展示超过 100 行始终强制启用。 */
  virtualThreshold?: number;
  /** 行高度，单位为 px，虚拟滚动用其计算行位置；默认随 size 取 small 28、medium 36、large 46。自定义内容应适配行高，避免撑高后导致虚拟滚动位置偏差。 */
  rowHeight?: number;
  /** 虚拟列表在可视区域前后额外渲染的数量。 */
  overscan?: number;
  /** 滚动时是否固定表头。 */
  stickyHeader?: boolean;
  /** 是否允许拖拽表头边界调整列宽；默认启用内置列宽调整插件。 */
  resizable?: boolean;
  /** 是否启用单元格选择；点击表格空白处或表格外部清除单元格选区，不影响行勾选。滚动时保留选区，正文选区描边由吸顶表头和固定列遮挡。false 时禁用（包括显式传入的插件）。启用时显式传入的单元格选择插件优先于内置默认插件。
   * @defaultValue true */
  cellSelection?: boolean;
  /**
   * 是否显示序号列，默认从 1 开始；搭配分页插件时按页码连续编号，存在勾选列时放在其后。
   * 序号列固定在业务列之前（勾选列之后），不参与列设置中的排序、显隐和固定位置调整。
   * 显式传入 createIndexPlugin 可自定义标题、宽度和起始编号，不会重复生成序号列；false 时禁用序号插件（包括显式传入的插件）。
   * @defaultValue true
   */
  showIndex?: boolean;
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
  /**
   * 行的语义状态，info 使用主题蓝色表示进行中或提示，success / warning / error 分别使用成功、警告、错误背景色；默认不设置。
   * 可传固定状态或计算函数，函数参数为当前记录和原始数据索引，返回 undefined 时沿用普通行背景。
   * 状态背景覆盖斑马纹，悬停和勾选反馈优先；普通列、固定列及 Canvas 模式行为一致。
   */
  rowStatus?: "info" | "success" | "warning" | "error" | ((record: T, index: number) => "info" | "success" | "warning" | "error" | undefined);
  /** 行的 CSS 类名或计算函数。 */
  rowClassName?: string | ((record: T, index: number) => string);
  /** 表格元素的内联样式。 */
  tableStyle?: CSSProperties;
}

/** 单元格定位时的一次性视觉反馈配置；每次调用独立生效，不改变表格数据或全局默认值。 */
export interface TableCellFocusOptions {
  /** 是否在目标可见后播放先增长一圈、再由尾部收拢消失的边框光线，默认 true；false 仅滚动、选中和聚焦。 */
  highlight?: boolean;
  /** 描边和柔光共用的 CSS 颜色，默认红色 #ff303b；例如 #fa8c16 为橙色。无效颜色回退默认值；CSS 变量需在页面根层可用。 */
  color?: string;
  /** 动效速度倍率，默认 1，即增长 300ms、收缩 300ms；2 为双倍速度、0.5 为半速。有限正数限制在 0.1～10，零、负数或非有限值回退 1；减少动态效果时忽略此倍率，统一 200ms 淡出。 */
  speed?: number;
  /** 描边线宽，单位 CSS px，默认 4；有限正数限制在 1～12，零、负数或非有限值回退 4。极窄单元格会按可容纳宽度缩小，柔光颜色跟随 color。 */
  lineWidth?: number;
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
  /** 按 rowKey 定位当前筛选、排序、分页及树展开后列表中的行，仅在该行被遮挡时立即纵向滚动，使其避开吸顶表头和合计行；支持虚拟列表，不改变横向位置或焦点。返回是否找到目标且视口可见；目标被筛掉、位于其他页、表格隐藏或未挂载时返回 false，不自动切页。应在数据提交和弹框显示后调用。 */
  scrollToRow: (key: TableKey) => boolean;
  /** 按稳定行键和叶子列键定位单元格，横纵滚动避开吸顶表头、固定列及合计行，选中并聚焦但不进入编辑。等待虚拟行挂载、位置稳定且整格在可视区后返回成功，再由顶层浮层从左上角沿边框顺时针增长光线：尾端固定，默认速度下 300 毫秒围满一圈，再用 300 毫秒从尾部收拢至头部后消失；不拦截操作，减少动态效果时仅同色边框淡出。隐藏列、其它页、无法完整显示的单元格、不可见表格或被后续定位取代时返回 false，不自动切页或显示隐藏列。应在数据更新及弹框关闭动画完成后调用；再次定位、目标滚出可视区或卸载会清理动效。 */
  focusCell: (rowKey: TableKey, columnKey: string, options?: TableCellFocusOptions) => Promise<boolean>;
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

/** 表格与查询区共用的持久化快照；分别使用 columns/pageSize 和 queryForm 保存各自设置。 */
export interface TableSettingsSnapshot {
  /** 查询条件的显隐、排序及默认收起设置；保存列设置时保留该属性。 */
  queryForm?: import("../queryFormSettingsTypes").QueryFormSettingsSnapshot;
  /** 列配置或选项布局列数，具体类型见签名。 */
  columns?: readonly TableColumnSettingItem[];
  /** 每页显示的记录数。 */
  pageSize?: number;
  /** 配置格式版本号，用于兼容历史数据。 */
  version?: number;
}

/** 读取与保存表格设置的适配器契约。 */
export interface TableSettingsAdapter {
  /** 按 scope 读取共用配置；挂载、打开设置及合并保存前调用。无配置时返回 null；应保留 queryForm、columns、pageSize 等完整属性。 */
  load: (scope: {
  /** 所属业务模块名称。 */
  moduleName: string;
  /** 同一模块内用于区分表格配置的业务标识。 */
  businessKey: string }) => Promise<TableSettingsSnapshot | null>;
  /** 按 scope 保存完整配置；用于查询设置、列设置、列宽或分页变化。框架保存前合并最新记录，同页共用适配器实例时串行写入；失败应拒绝 Promise。 */
  save: (scope: {
  /** 所属业务模块名称。 */
  moduleName: string;
  /** 同一模块内用于区分表格配置的业务标识。 */
  businessKey: string }, settings: TableSettingsSnapshot) => Promise<void>;
}

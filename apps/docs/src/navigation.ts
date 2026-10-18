import type { IconName } from "@sia.soul/sia-react-ui";
import {chartCategories} from "./pages/chartCategories";

export type NavItem = {
  children?: readonly NavItem[];
  label: string;
  path: string;
  eyebrow: string;
  title: string;
  description: string;
};

export type NavGroup = {
  title: string;
  items: readonly NavItem[];
  defaultOpen?: boolean;
};

const navItemIcons: Readonly<Record<string, IconName>> = {
  "/introduction": "book",
  "/getting-started": "rocket",
  "/design/tokens": "token",
  "/design/icons": "appstore",
  "/components/button": "square-plus",
  "/components/float-button": "circle-plus",
  "/components/icon": "component",
  "/components/typography": "bold",
  "/components/flex": "columns",
  "/components/grid": "appstore",
  "/components/space": "move",
  "/components/splitter": "columns",
  "/components/tool-panel": "tool",
  "/components/floating-scrollbar": "swap-vertical",
  "/components/window-frame": "desktop",
  "/components/divider": "minus",
  "/components/breadcrumb": "branches",
  "/components/dropdown": "chevron-down",
  "/components/menu": "list-unordered",
  "/components/pagination": "step-forward",
  "/components/steps": "clipboard-check",
  "/components/tabs": "tab-plus",
  "/components/input": "edit",
  "/components/textarea": "align-left",
  "/components/editor": "code",
  "/components/rich-text-editor": "bold",
  "/components/markdown-editor": "file",
  "/components/number-range": "calculator",
  "/components/input-number": "calculator",
  "/components/select": "chevron-down",
  "/components/cascader": "branches",
  "/components/checkbox": "square-check",
  "/components/radio": "circle-check",
  "/components/rate": "star",
  "/components/switch": "swap-horizontal",
  "/components/slider": "activity",
  "/components/color-picker": "highlighter",
  "/components/date-picker": "calendar",
  "/components/select-date-range": "calendar",
  "/components/time-picker": "clock",
  "/components/tree-select": "partition",
  "/components/upload": "upload",
  "/components/form": "clipboard",
  "/components/query-form": "search",
  "/components/chart": "bar-chart",
  "/components/badge": "bell",
  "/components/calendar": "calendar",
  "/components/card": "clipboard",
  "/components/carousel": "play",
  "/components/collapse": "menu-fold",
  "/components/image": "image",
  "/components/markdown": "file",
  "/components/popover": "message",
  "/components/segmented": "columns",
  "/components/table": "table",
  "/components/tag": "tag",
  "/components/timeline": "clock",
  "/components/tooltip": "info",
  "/components/tour": "compass",
  "/components/tree": "partition",
  "/components/treemap": "appstore",
  "/components/alert": "warning",
  "/components/message": "message",
  "/components/modal": "appstore",
  "/components/drawer": "menu-unfold",
  "/components/notification": "bell",
  "/components/popconfirm": "circle-check",
  "/components/progress": "trending-up",
  "/components/spin": "loader",
  "/components/watermark": "highlighter",
};

const chartCategoryIcons: Readonly<Record<string, IconName>> = {
  line: "line-chart",
  bar: "bar-chart",
  scatter: "activity",
  k: "trending-up",
  pie: "pie-chart",
  radar: "target",
  chord: "share",
  force: "branches",
  map: "location",
  gauge: "activity",
  funnel: "filter",
  heatmap: "appstore",
  eventriver: "area-chart",
  venn: "comments",
  treemap: "appstore",
  tree: "partition",
  wordcloud: "bold",
  mix: "area-chart",
  components: "settings",
  dynamic: "refresh",
  topics: "bulb",
};

export function navIconForPath(path: string): IconName {
  const chartCategory = path.startsWith("/components/chart/") ? path.split("/").at(-1) : undefined;
  return navItemIcons[path] ?? (chartCategory ? chartCategoryIcons[chartCategory] : undefined) ?? "component";
}

export const navGroups: readonly NavGroup[] = [
  {
    title: "开始",
    defaultOpen: true,
    items: [
      { label: "介绍 / Introduction", path: "/introduction", eyebrow: "开始", title: "Sia Web UI", description: "一套统一组件、样式和工程约定的 Web UI 框架。" },
      { label: "快速开始 / Get Started", path: "/getting-started", eyebrow: "开始", title: "快速开始", description: "安装组件库并创建第一个 Sia Web UI 页面。" },
      // 将完整属性索引放在常驻导航中，覆盖没有独立文档页的框架组件。
      { label: "组件属性样例", path: "/components/property-examples", eyebrow: "组件 / 属性样例", title: "组件属性样例索引", description: "查询全部自有属性的实际样例，并体验补充交互。" },
    ],
  },
  {
    title: "设计系统",
    defaultOpen: true,
    items: [
      { label: "设计令牌 / Tokens", path: "/design/tokens", eyebrow: "设计系统", title: "设计令牌", description: "用统一变量管理颜色、尺寸、圆角与阴影。" },
      { label: "图标规范 / Icons", path: "/design/icons", eyebrow: "设计系统", title: "图标规范", description: "了解 Sia 图标的圆角、描边和使用原则。" },
    ],
  },
  {
    title: "通用",
    defaultOpen: true,
    items: [
      { label: "Button 按钮", path: "/components/button", eyebrow: "组件 / 通用", title: "Button 按钮", description: "用于触发一个即时操作。" },
      { label: "FloatButton 悬浮按钮", path: "/components/float-button", eyebrow: "组件 / 通用", title: "FloatButton 悬浮按钮", description: "固定在页面上方的快捷操作入口。" },
      { label: "Icon 图标", path: "/components/icon", eyebrow: "组件 / 通用", title: "Icon 图标", description: "语义清晰、转角柔和的通用线性图标。" },
      { label: "Typography 排版", path: "/components/typography", eyebrow: "组件 / 通用", title: "Typography 排版", description: "统一标题、正文和辅助文本的视觉层级。" },
    ],
  },
  {
    title: "布局",
    items: [
      { label: "Flex 弹性布局", path: "/components/flex", eyebrow: "组件 / 布局", title: "Flex 弹性布局", description: "用简洁的属性完成一维页面布局。" },
      { label: "Grid 栅格", path: "/components/grid", eyebrow: "组件 / 布局", title: "Grid 栅格", description: "建立稳定、响应式的页面栅格。" },
      { label: "Space 间距", path: "/components/space", eyebrow: "组件 / 布局", title: "Space 间距", description: "为一组元素提供一致的水平或垂直间距。" },
      { label: "Splitter 分隔面板", path: "/components/splitter", eyebrow: "组件 / 布局", title: "Splitter 分隔面板", description: "通过拖拽调整相邻内容面板的尺寸。" },
      { label: "ToolPanel 工具面板", path: "/components/tool-panel", eyebrow: "组件 / 布局", title: "ToolPanel 工具面板", description: "提供可折叠、可调整尺寸的左右工具面板。" },
      { label: "FloatingScrollbar 浮动滚动条", path: "/components/floating-scrollbar", eyebrow: "组件 / 布局", title: "FloatingScrollbarProvider 浮动滚动条", description: "为滚动容器提供离开后自动隐藏的浮动滚动条。" },
      { label: "WindowFrame 自定义窗口", path: "/components/window-frame", eyebrow: "组件 / 布局", title: "WindowFrame 自定义窗口", description: "为无系统装饰的桌面应用提供统一窗口外框和标题栏。" },
      { label: "Divider 分割线", path: "/components/divider", eyebrow: "组件 / 布局", title: "Divider 分割线", description: "分隔不同内容区域，建立清晰的信息层次。" },
    ],
  },
  {
    title: "导航",
    items: [
      { label: "Breadcrumb 面包屑", path: "/components/breadcrumb", eyebrow: "组件 / 导航", title: "Breadcrumb 面包屑", description: "显示当前页面在信息层级中的位置。" },
      { label: "Dropdown 下拉菜单", path: "/components/dropdown", eyebrow: "组件 / 导航", title: "Dropdown 下拉菜单", description: "从触发器展开操作菜单。" },
      { label: "Menu 菜单", path: "/components/menu", eyebrow: "组件 / 导航", title: "Menu 菜单", description: "组织并呈现页面或功能入口。" },
      { label: "Pagination 分页", path: "/components/pagination", eyebrow: "组件 / 导航", title: "Pagination 分页", description: "在大量数据的不同页之间切换。" },
      { label: "Steps 步骤条", path: "/components/steps", eyebrow: "组件 / 导航", title: "Steps 步骤条", description: "展示任务流程和当前进度。" },
      { label: "Tabs 标签页", path: "/components/tabs", eyebrow: "组件 / 导航", title: "Tabs 标签页", description: "在同一上下文中切换不同内容。" },
    ],
  },
  {
    title: "数据录入",
    items: [
      { label: "Input 输入框", path: "/components/input", eyebrow: "组件 / 数据录入", title: "Input 输入框", description: "接收用户输入的基础表单控件。" },
      { label: "TextArea 多行输入框", path: "/components/textarea", eyebrow: "组件 / 数据录入", title: "TextArea 多行输入框", description: "录入项目说明、备注等多行文本。" },
      { label: "Editor 编辑器", path: "/components/editor", eyebrow: "组件 / 数据录入", title: "Editor 编辑器", description: "基于 Monaco 封装的通用文本与代码编辑器。" },
      { label: "RichTextEditor 富文本", path: "/components/rich-text-editor", eyebrow: "组件 / 数据录入", title: "RichTextEditor 富文本编辑器", description: "编辑 HTML 或 Markdown 富文本内容。" },
      { label: "MarkdownEditor 编辑器", path: "/components/markdown-editor", eyebrow: "组件 / 数据录入", title: "MarkdownEditor Markdown 编辑器", description: "支持所见即所得、即时渲染和源码模式的 Markdown 编辑器。" },
      // 与数字输入相邻展示区间组件。
      { label: "NumberRange 数字区间", path: "/components/number-range", eyebrow: "组件 / 数据录入", title: "NumberRange 数字区间", description: "以波浪线分隔的双数字输入。" },
      { label: "InputNumber 数字输入框", path: "/components/input-number", eyebrow: "组件 / 数据录入", title: "InputNumber 数字输入框", description: "通过输入或步进按钮录入有边界的数值。" },
      { label: "Select 选择器", path: "/components/select", eyebrow: "组件 / 数据录入", title: "Select 选择器", description: "从候选项中选择一个或多个值。" },
      { label: "Cascader 级联选择", path: "/components/cascader", eyebrow: "组件 / 数据录入", title: "Cascader 级联选择", description: "从关联的多级选项中选择路径。" },
      { label: "Checkbox 多选框", path: "/components/checkbox", eyebrow: "组件 / 数据录入", title: "Checkbox 多选框", description: "在一组选项中选择零项或多项。" },
      { label: "Radio 单选框", path: "/components/radio", eyebrow: "组件 / 数据录入", title: "Radio 单选框", description: "在一组互斥选项中选择一个值。" },
      { label: "Rate 评分", path: "/components/rate", eyebrow: "组件 / 数据录入", title: "Rate 评分", description: "对内容进行等级评价。" },
      { label: "Switch 开关", path: "/components/switch", eyebrow: "组件 / 数据录入", title: "Switch 开关", description: "在两个互斥状态之间即时切换。" },
      { label: "Slider 滑动输入条", path: "/components/slider", eyebrow: "组件 / 数据录入", title: "Slider 滑动输入条", description: "在连续或离散范围中选择数值。" },
      { label: "ColorPicker 颜色选择器", path: "/components/color-picker", eyebrow: "组件 / 数据录入", title: "ColorPicker 颜色选择器", description: "选择颜色、透明度或预设色。" },
      { label: "DatePicker 日期选择器", path: "/components/date-picker", eyebrow: "组件 / 数据录入", title: "DatePicker 日期选择器", description: "选择日期、月份或日期范围。" },
      { label: "SelectDateRange 组合范围", path: "/components/select-date-range", eyebrow: "组件 / 数据录入", title: "SelectDateRange 组合日期范围", description: "紧凑组合类型选择与日期范围。" },
      { label: "TimePicker 时间选择器", path: "/components/time-picker", eyebrow: "组件 / 数据录入", title: "TimePicker 时间选择器", description: "选择时间或时间范围。" },
      { label: "TreeSelect 树选择", path: "/components/tree-select", eyebrow: "组件 / 数据录入", title: "TreeSelect 树选择", description: "从层级结构中搜索并选择节点。" },
      { label: "Upload 上传", path: "/components/upload", eyebrow: "组件 / 数据录入", title: "Upload 上传", description: "选择或拖拽文件并管理上传列表。" },
      { label: "QueryForm 查询表单", path: "/components/query-form", eyebrow: "组件 / 数据录入", title: "QueryForm 查询表单", description: "统一查询字段、展开收起和快捷查询。" },
      { label: "Form 表单", path: "/components/form", eyebrow: "组件 / 数据录入", title: "Form 表单", description: "统一管理字段、校验、提交和动态表单。" },
    ],
  },
  {
    title: "数据展示",
    items: [
      { label: "Chart 图表", path: "/components/chart", eyebrow: "组件 / 数据可视化", title: "Chart 图表", description: "按分类浏览自研图表示例。", children: [
        {label:"全部图表",path:"/components/chart",eyebrow:"组件 / 数据可视化",title:"Chart 图表",description:"浏览全部图表示例。"},
        ...chartCategories.map(category=>({label:category.title,path:category.path,eyebrow:"组件 / 数据可视化 / Chart",title:category.title,description:`浏览${category.title}分类下的全部示例。`})),
      ] },
      { label: "Badge 徽标数", path: "/components/badge", eyebrow: "组件 / 数据展示", title: "Badge 徽标数", description: "展示数量、红点或状态标记。" },
      { label: "Calendar 日历", path: "/components/calendar", eyebrow: "组件 / 数据展示", title: "Calendar 日历", description: "以月历或年面板展示日期。" },
      { label: "Card 卡片", path: "/components/card", eyebrow: "组件 / 数据展示", title: "Card 卡片", description: "承载单一主题相关的内容和操作。" },
      { label: "Carousel 走马灯", path: "/components/carousel", eyebrow: "组件 / 数据展示", title: "Carousel 走马灯", description: "轮播一组同级内容。" },
      { label: "Collapse 折叠面板", path: "/components/collapse", eyebrow: "组件 / 数据展示", title: "Collapse 折叠面板", description: "分组收纳可展开内容。" },
      { label: "Image 图片", path: "/components/image", eyebrow: "组件 / 数据展示", title: "Image 图片", description: "展示、回退和预览图片。" },
      { label: "Markdown 内容渲染", path: "/components/markdown", eyebrow: "组件 / 数据展示", title: "Markdown 内容渲染", description: "安全渲染 GFM Markdown 内容并支持图片预览。" },
      { label: "Popover 气泡卡片", path: "/components/popover", eyebrow: "组件 / 数据展示", title: "Popover 气泡卡片", description: "展示结构化的补充内容。" },
      { label: "Segmented 分段控制器", path: "/components/segmented", eyebrow: "组件 / 数据展示", title: "Segmented 分段控制器", description: "在少量互斥视图中即时切换。" },
      { label: "Table 表格", path: "/components/table", eyebrow: "组件 / 数据展示", title: "Table 表格", description: "以结构化行列展示复杂数据。" },
      { label: "Tag 标签", path: "/components/tag", eyebrow: "组件 / 数据展示", title: "Tag 标签", description: "标记对象的属性、分类或状态。" },
      { label: "Timeline 时间轴", path: "/components/timeline", eyebrow: "组件 / 数据展示", title: "Timeline 时间轴", description: "按时间顺序展示事件和状态。" },
      { label: "Tooltip 文字提示", path: "/components/tooltip", eyebrow: "组件 / 数据展示", title: "Tooltip 文字提示", description: "为控件提供简短补充说明。" },
      { label: "Tour 漫游式引导", path: "/components/tour", eyebrow: "组件 / 数据展示", title: "Tour 漫游式引导", description: "逐步聚焦页面功能并提供指引。" },
      { label: "Tree 树形控件", path: "/components/tree", eyebrow: "组件 / 数据展示", title: "Tree 树形控件", description: "展示和操作层级数据。" },
      { label: "Treemap 矩形树图", path: "/components/treemap", eyebrow: "组件 / 数据展示", title: "Treemap 矩形树图", description: "按权重用嵌套矩形展示层级数据。" },
    ],
  },
  {
    title: "反馈",
    items: [
      { label: "Alert 警告提示", path: "/components/alert", eyebrow: "组件 / 反馈", title: "Alert 警告提示", description: "展示需要用户关注的重要信息。" },
      { label: "Message 全局提示", path: "/components/message", eyebrow: "组件 / 反馈", title: "Message 全局提示", description: "轻量反馈当前操作结果。" },
      { label: "Modal 对话框", path: "/components/modal", eyebrow: "组件 / 反馈", title: "Modal 对话框", description: "在当前流程上方承载重要任务。" },
      { label: "Drawer 抽屉", path: "/components/drawer", eyebrow: "组件 / 反馈", title: "Drawer 抽屉", description: "从屏幕边缘展开任务面板。" },
      { label: "Notification 通知提醒框", path: "/components/notification", eyebrow: "组件 / 反馈", title: "Notification 通知提醒框", description: "从页面角落展示全局通知。" },
      { label: "Popconfirm 气泡确认框", path: "/components/popconfirm", eyebrow: "组件 / 反馈", title: "Popconfirm 气泡确认框", description: "在操作附近请求二次确认。" },
      { label: "Progress 进度条", path: "/components/progress", eyebrow: "组件 / 反馈", title: "Progress 进度条", description: "展示操作或任务的当前进度。" },
      { label: "Spin 加载中", path: "/components/spin", eyebrow: "组件 / 反馈", title: "Spin 加载中", description: "表示区域或任务正在加载。" },
      { label: "Watermark 水印", path: "/components/watermark", eyebrow: "组件 / 反馈", title: "Watermark 水印", description: "为页面或局部内容叠加水印。" },
    ],
  },
];

export const navItems = navGroups.flatMap((group) => group.items.flatMap(item=>[item,...(item.children??[])]));

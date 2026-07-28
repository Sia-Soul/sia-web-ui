import { useMemo, useState } from "react";
import {
  Button,
  Icon,
  Space,
  Table,
  Tag,
  createCellSelectionPlugin,
  createColumnSettingPlugin,
  createColumnTransformPlugin,
  createEditablePlugin,
  createExportPlugin,
  createFilterPlugin,
  createHighlightPlugin,
  createIndexPlugin,
  createLocalStorageTableSettingsAdapter,
  createPaginationPlugin,
  createResizePlugin,
  createRowSpanPlugin,
  createSelectionPlugin,
  createSortPlugin,
  createSummaryPlugin,
  createToolbarPlugin,
  createTreePlugin,
  message,
} from "@sia-ui/react";
import type { AnyTablePlugin, TableColumn } from "@sia-ui/react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

interface ProductRow extends Record<string, unknown> {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: "在售" | "缺货" | "下架";
  owner: string;
  children?: ProductRow[];
}

const categories = ["办公用品", "数码设备", "家具", "耗材"];
const owners = ["张敏", "李华", "王强", "陈晨"];
const createProducts = (count: number): ProductRow[] => Array.from({ length: count }, (_, index) => ({
  id: index + 1,
  name: `商品 ${String(index + 1).padStart(4, "0")}`,
  category: categories[index % categories.length],
  price: 39 + index % 17 * 12,
  stock: index * 7 % 160,
  status: index % 11 === 0 ? "下架" : index % 7 === 0 ? "缺货" : "在售",
  owner: owners[index % owners.length],
}));

const basicData = createProducts(8);
const virtualData = createProducts(5000);
const groupedData: ProductRow[] = categories.flatMap((category, categoryIndex) =>
  Array.from({ length: 3 }, (_, itemIndex) => {
    const index = categoryIndex * 3 + itemIndex;
    return {
      id: 20001 + index,
      name: `${category}商品 ${itemIndex + 1}`,
      category,
      price: 99 + index * 26,
      stock: 18 + index * 7,
      status: index % 5 === 0 ? "缺货" : "在售",
      owner: owners[categoryIndex],
    };
  }),
);
const treeData: ProductRow[] = [
  { id: 10001, name: "办公设备", category: "目录", price: 0, stock: 0, status: "在售", owner: "张敏", children: [
    { id: 10002, name: "打印设备", category: "二级目录", price: 0, stock: 0, status: "在售", owner: "张敏", children: [
      { id: 10003, name: "激光打印机", category: "商品", price: 1699, stock: 23, status: "在售", owner: "李华" },
      { id: 10004, name: "热敏打印机", category: "商品", price: 499, stock: 11, status: "在售", owner: "李华" },
    ] },
    { id: 10005, name: "扫描仪", category: "商品", price: 899, stock: 8, status: "缺货", owner: "王强" },
  ] },
  { id: 10006, name: "办公家具", category: "目录", price: 0, stock: 0, status: "在售", owner: "陈晨", children: [
    { id: 10007, name: "人体工学椅", category: "商品", price: 1299, stock: 16, status: "在售", owner: "陈晨" },
  ] },
];

const statusTag = (status: ProductRow["status"]) => <Tag compact status={status === "在售" ? "success" : status === "缺货" ? "warning" : "default"}>{status}</Tag>;

const basicColumns: readonly TableColumn<ProductRow>[] = [
  { key: "name", name: "商品名称", width: 190, fixed: "left" },
  { key: "productInfo", title: "商品信息", children: [
    { key: "category", name: "分类", width: 130 },
    { key: "owner", name: "负责人", width: 110 },
  ] },
  { key: "price", name: "价格", width: 110, align: "right", render: (value) => `¥ ${Number(value).toFixed(2)}` },
  { key: "stock", name: "库存", width: 100, align: "right" },
  { key: "status", name: "状态", width: 100, fixed: "right", align: "center", render: (value) => statusTag(value as ProductRow["status"]) },
];

const advancedColumns: readonly TableColumn<ProductRow>[] = [
  { key: "name", name: "商品名称", width: 180, fixed: "left", sortable: true, editable: true },
  { key: "category", name: "分类", width: 130, sortable: true },
  { key: "price", name: "价格", width: 120, align: "right", sortable: true, editable: { type: "inputNumber" }, render: (value) => `¥ ${Number(value).toFixed(2)}` },
  { key: "stock", name: "库存", width: 100, align: "right", sortable: true, editable: { type: "inputNumber" } },
  { key: "status", name: "状态", width: 110, align: "center", editable: { type: "select", options: [{ label: "在售", value: "在售" }, { label: "缺货", value: "缺货" }, { label: "下架", value: "下架" }] }, render: (value) => statusTag(value as ProductRow["status"]) },
  { key: "owner", name: "负责人", width: 120 },
];

const fullFeatureColumns: readonly TableColumn<ProductRow>[] = [
  { key: "productInfo", name: "商品信息", children: [
    { key: "name", name: "商品名称", description: "商品在当前业务中的展示名称，单击单元格可进入编辑。", width: 220, fixed: "left", sortable: true, editable: true },
    { key: "category", name: "分类", description: "商品所属分类，用于筛选、分组和统计。", width: 150, sortable: true },
  ] },
  { key: "salesInfo", name: "销售数据", children: [
    { key: "price", name: "价格", description: "商品当前销售单价，单位为人民币。", width: 140, align: "right", sortable: true, editable: { type: "inputNumber" }, render: (value) => `¥ ${Number(value).toFixed(2)}`, exportRender: (value) => Number(value).toFixed(2) },
    { key: "stock", name: "库存", description: "当前可售库存数量。", width: 120, align: "right", sortable: true, editable: { type: "inputNumber" } },
    { key: "status", name: "状态", description: "商品当前的销售状态，可在单元格内切换。", width: 130, align: "center", editable: { type: "select", options: [{ label: "在售", value: "在售" }, { label: "缺货", value: "缺货" }, { label: "下架", value: "下架" }] }, render: (value) => statusTag(value as ProductRow["status"]), exportRender: (value) => String(value) },
  ] },
  { key: "owner", name: "负责人", description: "负责维护该商品资料的成员。", width: 160, fixed: "right" },
];

const enhancedColumns: readonly TableColumn<ProductRow>[] = [
  { key: "category", name: "分类", width: 130, fixed: "left", rowSpan: true, mergeSticky: true },
  { key: "name", name: "商品名称", width: 200 },
  { key: "price", name: "价格", width: 120, align: "right", render: (value) => `¥ ${Number(value).toFixed(2)}`, exportRender: (value) => Number(value).toFixed(2) },
  { key: "stock", name: "库存", width: 100, align: "right" },
  { key: "status", name: "状态", width: 100, align: "center", render: (value) => statusTag(value as ProductRow["status"]), exportRender: (value) => String(value) },
];

const basicCode = `import { Table, Tag } from "@sia-ui/react";

const columns = [
  { key: "name", name: "商品名称", width: 190, fixed: "left" },
  { key: "productInfo", title: "商品信息", children: [
    { key: "category", name: "分类", width: 130 },
    { key: "owner", name: "负责人", width: 110 },
  ] },
  { key: "price", name: "价格", width: 110, align: "right" },
  { key: "status", name: "状态", width: 100, fixed: "right" },
];

export default function Demo() {
  return <Table rowKey="id" columns={columns} dataSource={data} />;
}`;

const pluginCode = `import { useMemo } from "react";
import { Table, createSelectionPlugin, createSortPlugin, createPaginationPlugin,
  createEditablePlugin, createResizePlugin, createColumnSettingPlugin } from "@sia-ui/react";

export default function Demo() {
  const plugins = useMemo(() => [
    createSelectionPlugin({ showSelectedCount: true }),
    createSortPlugin(),
    createPaginationPlugin({ defaultPageSize: 25 }),
    createEditablePlugin({ onCellChange: saveCell }),
    createResizePlugin(),
    createColumnSettingPlugin(),
  ], []);
  return <Table rowKey="id" columns={columns} dataSource={data} plugins={plugins} height={430} />;
}`;

const fullFeatureCode = `import { useMemo, useState } from "react";
import {
  Icon,
  Table,
  Tag,
  createCellSelectionPlugin,
  createColumnSettingPlugin,
  createEditablePlugin,
  createExportPlugin,
  createHighlightPlugin,
  createIndexPlugin,
  createLocalStorageTableSettingsAdapter,
  createPaginationPlugin,
  createResizePlugin,
  createSelectionPlugin,
  createSortPlugin,
  createSummaryPlugin,
  createToolbarPlugin,
  message,
} from "@sia-ui/react";

const statusTag = (status) => (
  <Tag compact status={status === "在售" ? "success" : status === "缺货" ? "warning" : "default"}>
    {status}
  </Tag>
);

const columns = [
  { key: "productInfo", name: "商品信息", children: [
    { key: "name", name: "商品名称", description: "商品在当前业务中的展示名称，单击单元格可进入编辑。", width: 220, fixed: "left", sortable: true, editable: true },
    { key: "category", name: "分类", description: "商品所属分类，用于筛选、分组和统计。", width: 150, sortable: true },
  ] },
  { key: "salesInfo", name: "销售数据", children: [
    { key: "price", name: "价格", description: "商品当前销售单价，单位为人民币。", width: 140, align: "right", sortable: true, editable: { type: "inputNumber" }, render: (value) => "¥ " + Number(value).toFixed(2), exportRender: (value) => Number(value).toFixed(2) },
    { key: "stock", name: "库存", description: "当前可售库存数量。", width: 120, align: "right", sortable: true, editable: { type: "inputNumber" } },
    { key: "status", name: "状态", description: "商品当前的销售状态，可在单元格内切换。", width: 130, align: "center", editable: { type: "select", options: [{ label: "在售", value: "在售" }, { label: "缺货", value: "缺货" }, { label: "下架", value: "下架" }] }, render: (value) => statusTag(value), exportRender: (value) => String(value) },
  ] },
  { key: "owner", name: "负责人", description: "负责维护该商品资料的成员。", width: 160, fixed: "right" },
];

export default function Demo() {
  const [data, setData] = useState(() => createProducts(60));
  const [selectedCellCount, setSelectedCellCount] = useState(0);
  const settingsAdapter = useMemo(
    () => createLocalStorageTableSettingsAdapter("sia-docs-table"),
    [],
  );
  const plugins = useMemo(() => [
    createToolbarPlugin({
      start: <strong>全功能商品表</strong>,
      items: [{
        key: "add",
        label: "新增商品",
        icon: <Icon name="plus" size={14} />,
        onClick: () => {
          setData((rows) => {
            const nextId = rows.reduce((maximum, row) => Math.max(maximum, row.id), 0) + 1;
            return [{ ...createProducts(1)[0], id: nextId, name: "新增商品 " + nextId }, ...rows];
          });
          message.success("已新增一条商品数据");
        },
      }],
    }),
    createColumnSettingPlugin({
      adapter: settingsAdapter,
      scope: { moduleName: "docs", businessKey: "full-feature-table" },
    }),
    createSelectionPlugin({ mode: "multiple", showSelectedCount: true }),
    createIndexPlugin(),
    createHighlightPlugin({ row: true, column: true, cell: true }),
    createCellSelectionPlugin({
      onChange: (_range, cells) => setSelectedCellCount(cells.length),
    }),
    createSortPlugin({ scope: "all" }),
    createPaginationPlugin({ defaultPageSize: 10, pageSizeOptions: [10, 25, 50] }),
    createEditablePlugin({
      onCellChange: async (columnKey, record, value) => {
        setData((rows) => rows.map((row) =>
          row.id === record.id ? { ...row, [columnKey]: value } : row,
        ));
        message.success(record.name + " 已更新");
        return true;
      },
    }),
    createResizePlugin(),
    createSummaryPlugin({
      subTotal: (pageRows) => ({
        price: "¥ " + pageRows.reduce((sum, row) => sum + row.price, 0).toFixed(2),
        stock: pageRows.reduce((sum, row) => sum + row.stock, 0),
      }),
    }),
    createExportPlugin({ scope: "visible", fileName: "商品列表.csv" }),
  ], [settingsAdapter]);

  return (
    <>
      <p style={{ marginTop: 0 }}>当前框选 {selectedCellCount} 个单元格</p>
      <Table
        className="table-demo full-feature-table-demo"
        rowKey="id"
        columns={columns}
        dataSource={data}
        plugins={plugins}
        height={500}
      />
    </>
  );
}`;

const treeCode = `import { Table, createTreePlugin } from "@sia-ui/react";

const plugins = [createTreePlugin({
  ignoreChildrenColumn: false,
  defaultExpandAllRows: true,
})];

export default function Demo() {
  return <Table rowKey="id" columns={columns} dataSource={treeData} plugins={plugins} />;
}`;

const virtualCode = `import { Table, createIndexPlugin } from "@sia-ui/react";

export default function Demo() {
  return <Table
    rowKey="id"
    columns={columns}
    dataSource={fiveThousandRows}
    plugins={[createIndexPlugin()]}
    virtual
    height={360}
    rowHeight={38}
    overscan={6}
  />;
}`;

const cellSelectionCode = `import { useMemo, useState } from "react";
import { Table, createCellSelectionPlugin } from "@sia-ui/react";

export default function Demo() {
  const [selectedCount, setSelectedCount] = useState(0);
  const plugins = useMemo(() => [
    createCellSelectionPlugin({
      onChange: (_range, cells) => setSelectedCount(cells.length),
    }),
  ], []);

  return (
    <>
      <p style={{ marginTop: 0 }}>当前已选 {selectedCount} 个单元格</p>
      <Table
        className="table-demo cell-selection-table-demo"
        rowKey="id"
        columns={basicColumns}
        dataSource={basicData}
        plugins={plugins}
        height={350}
      />
    </>
  );
}`;

const enhancedCode = `import {
  Table,
  Tag,
  createColumnTransformPlugin,
  createExportPlugin,
  createHighlightPlugin,
  createRowSpanPlugin,
} from "@sia-ui/react";

const statusTag = (status) => (
  <Tag status={status === "在售" ? "success" : status === "缺货" ? "warning" : "default"}>
    {status}
  </Tag>
);

const columns = [
  { key: "category", name: "分类", width: 130, fixed: "left", rowSpan: true, mergeSticky: true },
  { key: "name", name: "商品名称", width: 200 },
  {
    key: "price",
    name: "价格",
    width: 120,
    align: "right",
    render: (value) => \`¥ \${Number(value).toFixed(2)}\`,
    exportRender: (value) => Number(value).toFixed(2),
  },
  { key: "stock", name: "库存", width: 100, align: "right" },
  {
    key: "status",
    name: "状态",
    width: 100,
    align: "center",
    render: (value) => statusTag(value),
    exportRender: (value) => String(value),
  },
];

const plugins = [
  createColumnTransformPlugin({
    append: [{ key: "owner", name: "负责人", width: 110 }],
  }),
  createHighlightPlugin({ row: true, column: true, cell: true }),
  createRowSpanPlugin(),
  createExportPlugin({ scope: "visible", fileName: "商品分组.csv" }),
];

export default function Demo() {
  return <Table rowKey="id" columns={columns} dataSource={data} plugins={plugins} />;
}`;

const apiRows = [
  { property: "dataSource / columns", description: "基础数据和列定义，支持嵌套字段与分组表头", type: "T[] / TableColumn<T>[]", defaultValue: "[]" },
  { property: "rowKey", description: "行唯一键字段或计算函数", type: "string | (record, index) => Key", defaultValue: "'id'" },
  { property: "plugins", description: "按需加载的表格功能模块", type: "TablePlugin<T>[]", defaultValue: "[]" },
  { property: "TableColumn.rowSpan", description: "加载 RowSpan 插件后合并连续相同值的单元格", type: "boolean / data path / function", defaultValue: "false" },
  { property: "TableColumn.mergeSticky", description: "合并单元格滚动越过表头时保持内容可见", type: "boolean / config", defaultValue: "false" },
  { property: "TableColumn.description", description: "列头说明；悬停说明图标后以页面级 Tooltip 展示", type: "ReactNode", defaultValue: "-" },
  { property: "TableColumn.showTitle", description: "文本截断时是否保留浏览器原生 title；使用自定义 Tooltip 时可关闭", type: "boolean", defaultValue: "true" },
  { property: "TableColumn.exportable / exportRender", description: "控制导出列及自定义导出内容", type: "boolean / function", defaultValue: "true / 原始值" },
  { property: "TableColumn.filterable / createFilterPlugin", description: "为列头增加文本筛选面板，支持自定义匹配函数和受控筛选值", type: "boolean / TableFilterPluginOptions<T>", defaultValue: "false / -" },
  { property: "createCellSelectionPlugin", description: "支持单元格拖拽框选、序号整行选择、父子列头整列选择及 Ctrl+C 复制", type: "TableCellSelectionPluginOptions<T>", defaultValue: "-" },
  { property: "createColumnSettingPlugin.showButton", description: "控制是否显示表格内置列设置按钮；外部工具栏可通过 TableRef 打开", type: "boolean", defaultValue: "true" },
  { property: "createSelectionPlugin.showSelectedCount", description: "显示可点击的已选数量、已选项面板和跨页保留勾选开关", type: "boolean", defaultValue: "false" },
  { property: "createSelectionPlugin.preserveSelectedRowKeys", description: "初始开启跨页保留勾选；未开启时翻页会清空上一页选择", type: "boolean", defaultValue: "false" },
  { property: "createSelectionPlugin.selectionPanelColumnCount", description: "已选项面板默认展示表格最前面的列数（不含勾选列）", type: "number", defaultValue: "4" },
  { property: "createSelectionPlugin.selectionPanelMaxCount", description: "已选项面板点击“展示全部”前最多渲染的记录数", type: "number", defaultValue: "100" },
  { property: "virtual / virtualThreshold", description: "虚拟滚动开关与自动启用阈值", type: "boolean / number", defaultValue: "行数 ≥ 100" },
  { property: "height / rowHeight / overscan", description: "滚动视口、固定行高和预渲染行数", type: "number | string / number / number", defaultValue: "- / 按尺寸 / 6" },
  { property: "size", description: "表格密度", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
  { property: "bordered / striped / stickyHeader", description: "边框、斑马纹和粘性表头", type: "boolean", defaultValue: "true" },
  { property: "onCellContextMenu", description: "单元格右键事件，可用于业务上下文菜单", type: "(record, column, index, event) => void", defaultValue: "-" },
  { property: "TableSettingsAdapter", description: "列设置持久化适配器，可接云端或本地存储", type: "{ load(scope), save(scope, settings) }", defaultValue: "-" },
] as const;

export function TablePage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [products, setProducts] = useState(() => createProducts(125));
  const [fullFeatureProducts, setFullFeatureProducts] = useState(() => createProducts(60));
  const [fullFeatureSelectedCellCount, setFullFeatureSelectedCellCount] = useState(0);
  const [selectedCellCount, setSelectedCellCount] = useState(0);
  const storageAdapter = useMemo(() => createLocalStorageTableSettingsAdapter("sia-docs-table"), []);
  const advancedPlugins = useMemo<readonly AnyTablePlugin<ProductRow>[]>(() => [
    createToolbarPlugin<ProductRow>({
      start: <strong>商品列表</strong>,
      items: [
        { key: "add", label: "新增", icon: <Icon name="plus" size={14} />, onClick: () => { message.info("这里接入新增商品流程"); } },
        { key: "export", label: "导出", icon: <Icon name="download" size={14} />, position: "end", inSettings: true, onClick: () => { message.success("导出任务已创建"); } },
      ],
    }),
    createColumnSettingPlugin<ProductRow>({ adapter: storageAdapter, scope: { moduleName: "docs", businessKey: "product-table" } }),
    createSelectionPlugin<ProductRow>({ mode: "multiple", showSelectedCount: true }),
    createIndexPlugin<ProductRow>(),
    createSortPlugin<ProductRow>(),
    createPaginationPlugin<ProductRow>({ defaultPageSize: 25, pageSizeOptions: [10, 25, 50, 100] }),
    createEditablePlugin<ProductRow>({ onCellChange: async (columnKey, record, value) => {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      setProducts((rows) => rows.map((row) => row.id === record.id ? { ...row, [columnKey]: value } : row));
      message.success(`${record.name} 已更新`);
      return true;
    } }),
    createResizePlugin<ProductRow>(),
    createSummaryPlugin<ProductRow>({
      subTotal: (pageRows) => ({ price: `¥ ${pageRows.reduce((sum, row) => sum + row.price, 0).toFixed(2)}`, stock: pageRows.reduce((sum, row) => sum + row.stock, 0) }),
      total: { stock: products.reduce((sum, row) => sum + row.stock, 0) },
    }),
  ], [products, storageAdapter]);
  const fullFeaturePlugins = useMemo<readonly AnyTablePlugin<ProductRow>[]>(() => [
    createToolbarPlugin<ProductRow>({
      start: <strong>全功能商品表</strong>,
      items: [{
        key: "add",
        label: "新增商品",
        icon: <Icon name="plus" size={14} />,
        onClick: () => {
          setFullFeatureProducts((rows) => {
            const nextId = rows.reduce((maximum, row) => Math.max(maximum, row.id), 0) + 1;
            return [{ ...createProducts(1)[0], id: nextId, name: `新增商品 ${nextId}` }, ...rows];
          });
          message.success("已新增一条商品数据");
        },
      }],
    }),
    createColumnSettingPlugin<ProductRow>({ adapter: storageAdapter, scope: { moduleName: "docs", businessKey: "full-feature-table" } }),
    createSelectionPlugin<ProductRow>({ mode: "multiple", showSelectedCount: true }),
    createIndexPlugin<ProductRow>(),
    createHighlightPlugin<ProductRow>({ row: true, column: true, cell: true }),
    createCellSelectionPlugin<ProductRow>({
      onChange: (_range, cells) => setFullFeatureSelectedCellCount(cells.length),
    }),
    createFilterPlugin<ProductRow>(),
    createSortPlugin<ProductRow>({ scope: "all" }),
    createPaginationPlugin<ProductRow>({ defaultPageSize: 10, pageSizeOptions: [10, 25, 50] }),
    createEditablePlugin<ProductRow>({
      onCellChange: async (columnKey, record, value) => {
        setFullFeatureProducts((rows) => rows.map((row) => row.id === record.id ? { ...row, [columnKey]: value } : row));
        message.success(`${record.name} 已更新`);
        return true;
      },
    }),
    createResizePlugin<ProductRow>(),
    createSummaryPlugin<ProductRow>({
      subTotal: (pageRows) => ({
        price: `¥ ${pageRows.reduce((sum, row) => sum + row.price, 0).toFixed(2)}`,
        stock: pageRows.reduce((sum, row) => sum + row.stock, 0),
      }),
    }),
    createExportPlugin<ProductRow>({ scope: "visible", fileName: "商品列表.csv" }),
  ], [storageAdapter]);
  const treePlugins = useMemo<readonly AnyTablePlugin<ProductRow>[]>(() => [createTreePlugin<ProductRow>({ ignoreChildrenColumn: false, defaultExpandAllRows: true }), createResizePlugin<ProductRow>()], []);
  const virtualPlugins = useMemo<readonly AnyTablePlugin<ProductRow>[]>(() => [createSelectionPlugin<ProductRow>({ mode: "row" }), createIndexPlugin<ProductRow>(), createSortPlugin<ProductRow>(), createResizePlugin<ProductRow>()], []);
  const cellSelectionPlugins = useMemo<readonly AnyTablePlugin<ProductRow>[]>(() => [
    createCellSelectionPlugin<ProductRow>({
      onChange: (_range, cells) => setSelectedCellCount(cells.length),
    }),
  ], []);
  const enhancedPlugins = useMemo<readonly AnyTablePlugin<ProductRow>[]>(() => [
    createColumnTransformPlugin<ProductRow>({
      append: [{ key: "owner", name: "负责人", width: 110 }],
    }),
    createHighlightPlugin<ProductRow>({ row: true, column: true, cell: true }),
    createRowSpanPlugin<ProductRow>(),
    createExportPlugin<ProductRow>({ scope: "visible", fileName: "商品分组.csv" }),
  ], []);

  return <>
    <PageHeader eyebrow="组件 / 数据展示 / Table" title="Table 表格" description="高性能基础表格，通过插件按需组合选择、排序、分页、编辑、树形、列设置等能力。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="基础表格" description="核心只负责数据、列、分组表头、固定列、滚动和渲染，不携带业务功能。" code={basicCode}>
        <Table className="table-demo" rowKey="id" columns={basicColumns} dataSource={basicData} height={350} />
      </DemoCard>
      <DemoCard title="插件组合" description="选择、序号、排序、分页、编辑、拖拽列宽、列设置、汇总和工具栏均由独立插件加载。" code={pluginCode}>
        <Table className="table-demo" rowKey="id" columns={advancedColumns} dataSource={products} plugins={advancedPlugins} height={470} />
      </DemoCard>
      <DemoCard title="全功能表格" description="组合父子级列头、列头拖拽框选、工具栏、跨页保留选择、序号整行选择、单元格框选、列头说明、排序、分页、编辑、列宽调整、固定列、列设置、汇总、高亮和导出。" code={fullFeatureCode}>
        <p style={{ marginTop: 0 }}>当前框选 {fullFeatureSelectedCellCount} 个单元格</p>
        <Table className="table-demo full-feature-table-demo" rowKey="id" columns={fullFeatureColumns} dataSource={fullFeatureProducts} plugins={fullFeaturePlugins} height={500} />
      </DemoCard>
      <DemoCard title="树形数据" description="树形能力默认不解析 children；加载 Tree 插件并显式开启后才处理层级。" code={treeCode}>
        <Table className="table-demo" rowKey="id" columns={basicColumns} dataSource={treeData} plugins={treePlugins} height={330} />
      </DemoCard>
      <DemoCard title="Excel 式单元格选择" description="单击或拖拽形成矩形选区；点击列头选择整列，Ctrl+C 可直接复制选区内容。" code={cellSelectionCode}>
        <p style={{ marginTop: 0 }}>当前已选 {selectedCellCount} 个单元格</p>
        <Table className="table-demo cell-selection-table-demo" rowKey="id" columns={basicColumns} dataSource={basicData} plugins={cellSelectionPlugins} height={350} />
      </DemoCard>
      <DemoCard title="合并、高亮与导出" description="连续分类单元格自动合并；行、列、单元格高亮和 CSV 导出均由独立插件加载。" code={enhancedCode}>
        <Table className="table-demo" rowKey="id" columns={enhancedColumns} dataSource={groupedData} plugins={enhancedPlugins} height={420} />
      </DemoCard>
      <DemoCard title="5000 行虚拟滚动" description="只渲染视口附近的行；排序和行选择仍可作为独立插件组合使用。" code={virtualCode}>
        <Table className="table-demo virtual-table-demo" rowKey="id" columns={advancedColumns} dataSource={virtualData} plugins={virtualPlugins} virtual height={360} rowHeight={38} overscan={6} />
      </DemoCard>
      <section className="token-section"><h2>已迁移功能</h2><p>旧表格能力全部对应到独立模块，业务项目只加载需要的插件。</p><Space wrap>{["固定列", "分组表头", "列头说明", "虚拟滚动", "选择", "跨页保留选择", "Excel 式单元格框选", "排序", "分页", "行内编辑", "树形", "汇总", "列设置", "列宽拖拽", "工具栏", "连续单元格合并", "行列单元格高亮", "CSV 导出", "动态列转换", "权限过滤", "设置持久化", "Ref API"].map((name) => <Tag key={name} status="processing" variant="outlined">{name}</Tag>)}</Space></section>
    </div> : <ApiTable name="Table" rows={apiRows} />}
  </>;
}

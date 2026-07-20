import { useMemo, useState } from "react";
import {
  Button,
  Icon,
  Space,
  Table,
  Tag,
  createColumnSettingPlugin,
  createEditablePlugin,
  createIndexPlugin,
  createLocalStorageTableSettingsAdapter,
  createPaginationPlugin,
  createResizePlugin,
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

const apiRows = [
  { property: "dataSource / columns", description: "基础数据和列定义，支持嵌套字段与分组表头", type: "T[] / TableColumn<T>[]", defaultValue: "[]" },
  { property: "rowKey", description: "行唯一键字段或计算函数", type: "string | (record, index) => Key", defaultValue: "'id'" },
  { property: "plugins", description: "按需加载的表格功能模块", type: "TablePlugin<T>[]", defaultValue: "[]" },
  { property: "virtual / virtualThreshold", description: "虚拟滚动开关与自动启用阈值", type: "boolean / number", defaultValue: "行数 ≥ 100" },
  { property: "height / rowHeight / overscan", description: "滚动视口、固定行高和预渲染行数", type: "number | string / number / number", defaultValue: "- / 按尺寸 / 6" },
  { property: "size", description: "表格密度", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
  { property: "bordered / striped / stickyHeader", description: "边框、斑马纹和粘性表头", type: "boolean", defaultValue: "true" },
  { property: "TableSettingsAdapter", description: "列设置持久化适配器，可接云端或本地存储", type: "{ load(scope), save(scope, settings) }", defaultValue: "-" },
] as const;

export function TablePage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [products, setProducts] = useState(() => createProducts(125));
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
  const treePlugins = useMemo<readonly AnyTablePlugin<ProductRow>[]>(() => [createTreePlugin<ProductRow>({ ignoreChildrenColumn: false, defaultExpandAllRows: true }), createResizePlugin<ProductRow>()], []);
  const virtualPlugins = useMemo<readonly AnyTablePlugin<ProductRow>[]>(() => [createSelectionPlugin<ProductRow>({ mode: "row" }), createIndexPlugin<ProductRow>(), createSortPlugin<ProductRow>(), createResizePlugin<ProductRow>()], []);

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
      <DemoCard title="树形数据" description="树形能力默认不解析 children；加载 Tree 插件并显式开启后才处理层级。" code={treeCode}>
        <Table className="table-demo" rowKey="id" columns={basicColumns} dataSource={treeData} plugins={treePlugins} height={330} />
      </DemoCard>
      <DemoCard title="5000 行虚拟滚动" description="只渲染视口附近的行；排序和行选择仍可作为独立插件组合使用。" code={virtualCode}>
        <Table className="table-demo virtual-table-demo" rowKey="id" columns={advancedColumns} dataSource={virtualData} plugins={virtualPlugins} virtual height={360} rowHeight={38} overscan={6} />
      </DemoCard>
      <section className="token-section"><h2>已迁移功能</h2><p>旧表格能力全部对应到独立模块，业务项目只加载需要的插件。</p><Space wrap>{["固定列", "分组表头", "虚拟滚动", "选择", "排序", "分页", "行内编辑", "树形", "汇总", "列设置", "列宽拖拽", "工具栏", "权限过滤", "设置持久化", "Ref API"].map((name) => <Tag key={name} status="processing" variant="outlined">{name}</Tag>)}</Space></section>
    </div> : <ApiTable name="Table" rows={apiRows} />}
  </>;
}

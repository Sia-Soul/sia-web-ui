import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  createRowSpanPlugin,
  createSelectionPlugin,
  createSortPlugin,
  createSummaryPlugin,
  createToolbarPlugin,
  createTreePlugin,
  message,
} from "@sia.soul/sia-react-ui";
import type { AnyTablePlugin, TableColumn } from "@sia.soul/sia-react-ui";
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

interface BenchmarkRow extends Record<string, unknown> {
  id: number;
  settings?: Record<string, unknown>;
}

type BenchmarkRenderKind = "stage" | "bool" | "boolText" | "queueMode" | "json" | "deleted" | "runningMode" | "dataSyncMode" | "seconds" | "dateTime" | "job20Status";

interface BenchmarkColumnDefinition {
  code: string;
  name: string;
  width?: number;
  sort?: boolean;
  render?: BenchmarkRenderKind;
  trueText?: string;
  falseText?: string;
}

const benchmarkColumnDefinitions: readonly BenchmarkColumnDefinition[] = [
  { code: "id", name: "id", width: 40 },
  { code: "coId", name: "公司编号", sort: true },
  { code: "coName", name: "公司名称", sort: true, width: 220 },
  { code: "stage", name: "阶段", render: "stage", sort: true },
  { code: "definitionId", name: "作业定义编号" },
  { code: "isAllowDuplicates", name: "是否允许重复", render: "boolText", trueText: "可重复", falseText: "不可重复" },
  { code: "isQueued", name: "是否使用队列", render: "boolText", trueText: "使用", falseText: "不使用" },
  { code: "queueMode", name: "队列模式", render: "queueMode" },
  { code: "status", name: "运行状态", render: "boolText", trueText: "运行中", falseText: "已停止" },
  { code: "limitCount", name: "限定写入次数", sort: true },
  { code: "name", name: "作业名称", width: 220 },
  { code: "entityType", name: "业务单据类型" },
  { code: "states", name: "实例状态", render: "json", width: 230 },
  { code: "parameters", name: "参数", render: "json", width: 230 },
  { code: "settings", name: "设置", render: "json", width: 260 },
  { code: "remark", name: "备注", width: 180 },
  { code: "group", name: "分组" },
  { code: "isIntelligentModeEnabled", name: "是否启用智能模式", render: "bool" },
  { code: "version", name: "执行器版本" },
  { code: "isAllowNullableTask", name: "是否允许空任务", render: "bool" },
  { code: "trigger", name: "触发器", render: "boolText", trueText: "KA", falseText: "标品" },
  { code: "isEnabled", name: "是否启用", render: "boolText", trueText: "启用", falseText: "禁用" },
  { code: "isDeleted", name: "是否已删除", render: "deleted" },
  { code: "runningMode", name: "运行模式", render: "runningMode" },
  { code: "dataSyncMode", name: "数据同步模式", render: "dataSyncMode" },
  { code: "active", name: "是否激活", render: "bool" },
  { code: "host", name: "执行环境", width: 180 },
  { code: "ess", name: "急停信号", render: "bool" },
  { code: "interval", name: "运行间隔", sort: true, render: "seconds" },
  { code: "timeout", name: "超时时间", sort: true },
  { code: "job20JobId", name: "JOB2.0作业编号" },
  { code: "job20SplitId", name: "JOB2.0拆分ID", width: 180 },
  { code: "job20NextRunTime", name: "JOB2.0下次运行时间", render: "dateTime", width: 180 },
  { code: "job20Status", name: "JOB2.0状态", render: "job20Status" },
  { code: "job20Enabled", name: "JOB2.0是否启用", render: "bool" },
  { code: "job20GroupIndex", name: "JOB2.0分组号" },
  { code: "job20JobTakeHost", name: "JOB2.0运行主机", width: 180 },
  { code: "job20ApiInterval", name: "JOB2.0间隔时间", render: "seconds" },
  { code: "job20ApiIntervalBase", name: "JOB2.0间隔时间基数" },
  { code: "job20ApiTimeout", name: "JOB2.0超时时间" },
  { code: "lastRunStartTime", name: "上次运行开始时间", render: "dateTime", width: 180 },
  { code: "lastRunTotalDuration", name: "上次运行总耗时(ms)", sort: true },
  { code: "lastFailureTime", name: "上次失败时间", render: "dateTime", width: 180 },
  { code: "lastFailureMessage", name: "上次失败信息", width: 220 },
  { code: "totalRuns", name: "总运行次数", sort: true },
  { code: "totalSuccessRuns", name: "总运行成功次数", sort: true },
  { code: "totalFailureRuns", name: "总运行失败次数", sort: true },
  { code: "consecutiveFailureRuns", name: "连续失败次数", sort: true },
  { code: "ts", name: "时间戳" },
  { code: "responsibleUserId", name: "责任人用户编号" },
  { code: "responsibleUserName", name: "责任人用户名" },
  { code: "created", name: "创建时间", render: "dateTime", width: 180 },
  { code: "creatorUserId", name: "创建人用户编号" },
  { code: "creatorUserName", name: "创建人用户名称" },
  { code: "modified", name: "修改时间", render: "dateTime", width: 180 },
  { code: "modifierUserId", name: "修改人用户编号" },
  { code: "modifierUserName", name: "修改人用户名称" },
];

const stageLabels: Record<number, string> = { 1: "历史", 2: "未来" };
const queueModeLabels: Record<number, string> = { 1: "无队列模式", 2: "有队列模式", 4: "智能模式" };
const runningModeLabels: Record<number, string> = { 1: "点动模式", 2: "常动模式" };
const dataSyncModeLabels: Record<number, string> = { 1: "增量", 2: "全量", 4: "补拉" };
const job20StatusLabels: Record<number, string> = { 0: "未授权", 1: "已过期", 2: "已授权" };

function benchmarkBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "启用" || value === "有效";
}

function benchmarkBooleanTag(value: unknown, trueText = "是", falseText = "否") {
  const active = benchmarkBoolean(value);
  return <Tag compact status={active ? "success" : "default"}>{active ? trueText : falseText}</Tag>;
}

function benchmarkDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

function benchmarkSeconds(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 0) return "0秒";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const rest = Math.floor(seconds % 60);
  return `${days ? `${days}天` : ""}${hours ? `${hours}小时` : ""}${minutes ? `${minutes}分` : ""}${rest || (!days && !hours && !minutes) ? `${rest}秒` : ""}`;
}

function benchmarkRender(definition: BenchmarkColumnDefinition, value: unknown, record: BenchmarkRow) {
  switch (definition.render) {
    case "stage": return stageLabels[Number(value)] ?? "";
    case "bool": return benchmarkBooleanTag(value);
    case "boolText": return benchmarkBooleanTag(value, definition.trueText, definition.falseText);
    case "queueMode": return queueModeLabels[Number(value)] ?? "";
    case "json": {
      const json = value == null ? "" : JSON.stringify(value);
      return <span className="table-benchmark__json" title={json}>{json}</span>;
    }
    case "deleted": return benchmarkBoolean(value)
      ? <Tag compact status="error">已删除</Tag>
      : <Tag compact status="default">未删除</Tag>;
    case "runningMode": return runningModeLabels[Number(record.settings?.runningMode)] ?? "";
    case "dataSyncMode": return dataSyncModeLabels[Number(record.settings?.dataSyncMode)] ?? "";
    case "seconds": return benchmarkSeconds(value);
    case "dateTime": return benchmarkDateTime(value);
    case "job20Status": return value == null ? "" : <Tag compact status="processing">{job20StatusLabels[Number(value)] ?? String(value)}</Tag>;
    default: return value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

const benchmarkColumns: readonly TableColumn<BenchmarkRow>[] = benchmarkColumnDefinitions.map((definition) => ({
  key: definition.code,
  code: definition.code,
  name: definition.name,
  width: definition.width ?? Math.max(120, Math.min(220, Math.max(definition.name.length * 18 + 36, definition.code.length * 8 + 28))),
  sortable: definition.sort,
  ellipsis: true,
  render: (value, record) => benchmarkRender(definition, value, record),
}));

const benchmarkCode = `import { useEffect, useState } from "react";
import { Table, Tag, createSortPlugin } from "@sia.soul/sia-react-ui";

const definitions = ${JSON.stringify(benchmarkColumnDefinitions, null, 2)};
const labels = {
  stage: { 1: "历史", 2: "未来" },
  queueMode: { 1: "无队列模式", 2: "有队列模式", 4: "智能模式" },
  runningMode: { 1: "点动模式", 2: "常动模式" },
  dataSyncMode: { 1: "增量", 2: "全量", 4: "补拉" },
  job20Status: { 0: "未授权", 1: "已过期", 2: "已授权" },
};
const isTrue = (value) => value === true || value === 1 || value === "1" || value === "启用" || value === "有效";
const boolTag = (value, yes = "是", no = "否") => (
  <Tag compact status={isTrue(value) ? "success" : "default"}>
    {isTrue(value) ? yes : no}
  </Tag>
);
const formatSeconds = (value) => {
  const seconds = Number(value);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const rest = Math.floor(seconds % 60);
  return (days ? days + "天" : "") + (hours ? hours + "小时" : "")
    + (minutes ? minutes + "分" : "") + (rest || (!days && !hours && !minutes) ? rest + "秒" : "");
};
function renderCell(column, value, record) {
  if (column.render === "stage") return labels.stage[value] ?? "";
  if (column.render === "queueMode") return labels.queueMode[value] ?? "";
  if (column.render === "runningMode") return labels.runningMode[record.settings?.runningMode] ?? "";
  if (column.render === "dataSyncMode") return labels.dataSyncMode[record.settings?.dataSyncMode] ?? "";
  if (column.render === "bool") return boolTag(value);
  if (column.render === "boolText") return boolTag(value, column.trueText, column.falseText);
  if (column.render === "deleted") return isTrue(value)
    ? <Tag compact status="error">已删除</Tag>
    : <Tag compact status="default">未删除</Tag>;
  if (column.render === "json") return value == null ? "" : JSON.stringify(value);
  if (column.render === "seconds") return formatSeconds(value);
  if (column.render === "dateTime") return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "";
  if (column.render === "job20Status") return value == null ? "" : <Tag compact status="processing">{labels.job20Status[value] ?? value}</Tag>;
  return value == null ? "" : String(value);
}
const columns = definitions.map((definition) => ({
  key: definition.code,
  code: definition.code,
  name: definition.name,
  width: definition.width,
  sortable: definition.sort,
  ellipsis: true,
  render: (value, record) => renderCell(definition, value, record),
}));

export default function Demo() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    fetch("/data/table-benchmark.json")
      .then((response) => response.json())
      .then((result) => setRows(result.data.items));
  }, []);
  return <Table rowKey="id" columns={columns} dataSource={rows}
    plugins={[createSortPlugin()]} virtual height={420} rowHeight={38} />;
}`;

function JsonTableBenchmark() {
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [virtual, setVirtual] = useState(true);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [parseMs, setParseMs] = useState<number | null>(null);
  const [error, setError] = useState("");
  const renderStartedAt = useRef(0);
  const resultRef = useRef<HTMLSpanElement>(null);
  const tableHostRef = useRef<HTMLDivElement>(null);
  const plugins = useMemo<readonly AnyTablePlugin<BenchmarkRow>[]>(() => [createSortPlugin<BenchmarkRow>()], []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const loadStartedAt = performance.now();
      try {
        const response = await fetch("/data/table-benchmark.json", { signal: controller.signal });
        if (!response.ok) throw new Error(`数据文件加载失败（${response.status}）`);
        const text = await response.text();
        setLoadMs(performance.now() - loadStartedAt);
        const parseStartedAt = performance.now();
        const result = JSON.parse(text) as { data?: { items?: BenchmarkRow[] } };
        setParseMs(performance.now() - parseStartedAt);
        const items = result.data?.items;
        if (!Array.isArray(items)) throw new Error("JSON 中没有找到 data.items 数组");
        renderStartedAt.current = performance.now();
        setRows(items);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "JSON 读取失败");
      }
    })();
    return () => controller.abort();
  }, []);

  useLayoutEffect(() => {
    if (!rows.length || !renderStartedAt.current) return;
    const elapsed = performance.now() - renderStartedAt.current;
    const renderedRows = tableHostRef.current?.querySelectorAll("tbody tr").length ?? 0;
    const renderedCells = tableHostRef.current?.querySelectorAll("tbody td").length ?? 0;
    if (resultRef.current) resultRef.current.textContent = `${elapsed.toFixed(1)} ms（DOM 行 ${renderedRows}，单元格 ${renderedCells}）`;
    renderStartedAt.current = 0;
  }, [rows, virtual]);

  function changeMode(nextVirtual: boolean) {
    if (nextVirtual === virtual) return;
    if (resultRef.current) resultRef.current.textContent = "测量中…";
    renderStartedAt.current = performance.now();
    setVirtual(nextVirtual);
  }

  return <div className="table-benchmark">
    <div className="table-benchmark__toolbar">
      <span>数据源：<code>/data/table-benchmark.json</code></span>
      <Space wrap>
        <Button variant={virtual ? "default" : "primary"} onClick={() => changeMode(false)}>完整 DOM</Button>
        <Button variant={virtual ? "primary" : "default"} onClick={() => changeMode(true)}>虚拟滚动</Button>
      </Space>
    </div>
    <div className="table-benchmark__metrics">
      <span>数据：{rows.length} 行 × {benchmarkColumnDefinitions.length} 列</span>
      <span>加载：{loadMs == null ? "—" : `${loadMs.toFixed(1)} ms`}</span>
      <span>解析：{parseMs == null ? "—" : `${parseMs.toFixed(1)} ms`}</span>
      <span>渲染：<strong ref={resultRef}>{rows.length ? "测量中…" : "—"}</strong></span>
      <span>模式：{virtual ? "无分页 + 虚拟滚动" : "无分页 + 完整 DOM"}</span>
    </div>
    {error ? <p className="table-benchmark__error">{error}</p> : null}
    {rows.length ? <div className="table-benchmark__host" ref={tableHostRef}>
      <Table
        className="table-demo table-benchmark__table"
        rowKey="id"
        columns={benchmarkColumns}
        dataSource={rows}
        plugins={plugins}
        virtual={virtual}
        height={420}
        rowHeight={38}
        overscan={8}
      />
    </div> : <div className="table-benchmark__empty">{error ? "数据加载失败" : "正在加载测试数据…"}</div>}
  </div>;
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

const basicCode = `import { Table, Tag } from "@sia.soul/sia-react-ui";

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
  createEditablePlugin, createColumnSettingPlugin } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const plugins = useMemo(() => [
    createSelectionPlugin({ showSelectedCount: true }),
    createSortPlugin(),
    createPaginationPlugin({ defaultPageSize: 25 }),
    createEditablePlugin({ onCellChange: saveCell }),
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
  createSelectionPlugin,
  createSortPlugin,
  createSummaryPlugin,
  createToolbarPlugin,
  message,
} from "@sia.soul/sia-react-ui";

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

const treeCode = `import { Table, createTreePlugin } from "@sia.soul/sia-react-ui";

const plugins = [createTreePlugin({
  ignoreChildrenColumn: false,
  defaultExpandAllRows: true,
})];

export default function Demo() {
  return <Table rowKey="id" columns={columns} dataSource={treeData} plugins={plugins} />;
}`;

const virtualCode = `import { Table, createIndexPlugin } from "@sia.soul/sia-react-ui";

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
import { Table, createCellSelectionPlugin } from "@sia.soul/sia-react-ui";

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
} from "@sia.soul/sia-react-ui";

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
  { property: "plugins", description: "按需加载的表格功能模块；默认启用行悬停高亮，可用 createHighlightPlugin({ row: false }) 关闭", type: "TablePlugin<T>[]", defaultValue: "[]" },
  { property: "resizable", description: "是否允许拖拽表头边界调整列宽；默认内置启用，可传 false 关闭", type: "boolean", defaultValue: "true" },
  { property: "TableColumn.autoWidth", description: "按渲染内容自动测量列宽；未指定 width 的操作列会自动开启", type: "boolean", defaultValue: "操作列 true，其他列 false" },
  { property: "TableColumn.flex", description: "按权重承接表格剩余宽度，固定列和操作列不会被意外拉伸；未设置时由最宽的非固定普通列承接", type: "number", defaultValue: "自动" },
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
    createSummaryPlugin<ProductRow>({
      subTotal: (pageRows) => ({
        price: `¥ ${pageRows.reduce((sum, row) => sum + row.price, 0).toFixed(2)}`,
        stock: pageRows.reduce((sum, row) => sum + row.stock, 0),
      }),
    }),
    createExportPlugin<ProductRow>({ scope: "visible", fileName: "商品列表.csv" }),
  ], [storageAdapter]);
  const treePlugins = useMemo<readonly AnyTablePlugin<ProductRow>[]>(() => [createTreePlugin<ProductRow>({ ignoreChildrenColumn: false, defaultExpandAllRows: true })], []);
  const virtualPlugins = useMemo<readonly AnyTablePlugin<ProductRow>[]>(() => [createSelectionPlugin<ProductRow>({ mode: "row" }), createIndexPlugin<ProductRow>(), createSortPlugin<ProductRow>()], []);
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
      <DemoCard title="基础表格" description="核心负责数据、列、分组表头、固定列、滚动和渲染，并默认支持行悬停高亮和拖拽调整列宽。" code={basicCode}>
        <Table className="table-demo" rowKey="id" columns={basicColumns} dataSource={basicData} height={350} />
      </DemoCard>
      <DemoCard title="插件组合" description="选择、序号、排序、分页、编辑、列设置、汇总和工具栏均可按需加载；拖拽列宽已默认启用。" code={pluginCode}>
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
      <DemoCard title="合并、高亮与导出" description="连续分类单元格自动合并；行悬停高亮默认启用；可通过插件自定义行、列、单元格高亮，并加载 CSV 导出。" code={enhancedCode}>
        <Table className="table-demo" rowKey="id" columns={enhancedColumns} dataSource={groupedData} plugins={enhancedPlugins} height={420} />
      </DemoCard>
      <DemoCard title="5000 行虚拟滚动" description="只渲染视口附近的行；排序和行选择仍可作为独立插件组合使用。" code={virtualCode}>
        <Table className="table-demo virtual-table-demo" rowKey="id" columns={advancedColumns} dataSource={virtualData} plugins={virtualPlugins} virtual height={360} rowHeight={38} overscan={6} />
      </DemoCard>
      <DemoCard title="真实 JSON 无分页压测" description="直接加载测试数据的 data.items，并按给定的 57 个业务列、中文列名、排序和格式化规则展示；可对比完整 DOM 与无分页虚拟滚动的实际开销。" code={benchmarkCode}>
        <JsonTableBenchmark />
      </DemoCard>
      <section className="token-section"><h2>已迁移功能</h2><p>旧表格能力全部对应到独立模块，业务项目只加载需要的插件。</p><Space wrap>{["固定列", "分组表头", "列头说明", "虚拟滚动", "选择", "跨页保留选择", "Excel 式单元格框选", "排序", "分页", "行内编辑", "树形", "汇总", "列设置", "列宽拖拽", "工具栏", "连续单元格合并", "行列单元格高亮", "CSV 导出", "动态列转换", "权限过滤", "设置持久化", "Ref API"].map((name) => <Tag key={name} status="processing" variant="outlined">{name}</Tag>)}</Space></section>
    </div> : <ApiTable name="Table" rows={apiRows} />}
  </>;
}

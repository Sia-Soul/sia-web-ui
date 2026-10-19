import { ResultExamples } from "./examples/ResultExamples";
/// <reference types="vite/client" />
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Select, Space, Table, Typography } from "@sia.soul/sia-react-ui";
import { DemoCard } from "./DemoCard";
import { PageHeader } from "./PageHeader";
import coverage from "./examples/coverage.json";
import { BasicExamples } from "./examples/BasicExamples";
import { NavigationExamples } from "./examples/NavigationExamples";
import { FeedbackExamples } from "./examples/FeedbackExamples";
import { SelectionExamples } from "./examples/SelectionExamples";
import { DateExamples } from "./examples/DateExamples";
import { DisplayExamples } from "./examples/DisplayExamples";
import { FormExamples } from "./examples/FormExamples";
import { OverlayExamples } from "./examples/OverlayExamples";
import { EditorExamples } from "./examples/EditorExamples";
import { UploadExamples } from "./examples/UploadExamples";
import { ChartExamples } from "./examples/ChartExamples";
import { ChartPrimitiveExamples } from "./examples/ChartPrimitiveExamples";
import { TransferExamples } from "./examples/TransferExamples";

/** 源码按需读取，与预览使用同一文件，避免展示代码和运行样例长期漂移。 */
const sources = import.meta.glob<string>(["./*.tsx", "./examples/*.tsx"], { query: "?raw", import: "default" });
/** 每次只挂载一组样例，避免多个浮层和图表同时初始化。 */
const groups = [
  { value: "BasicExamples", label: "基础、布局、文字与工具栏", component: BasicExamples },
  { value: "NavigationExamples", label: "菜单、下拉与分页", component: NavigationExamples },
  { value: "ResultExamples", label: "操作结果", component: ResultExamples },
  { value: "FeedbackExamples", label: "提示、反馈与引导", component: FeedbackExamples },
  { value: "SelectionExamples", label: "输入、选择与选择面板", component: SelectionExamples },
  { value: "DateExamples", label: "日期、时间与日历", component: DateExamples },
  { value: "DisplayExamples", label: "展示、树、面板与窗口", component: DisplayExamples },
  { value: "FormExamples", label: "表单、查询与表格", component: FormExamples },
  { value: "OverlayExamples", label: "弹框与抽屉", component: OverlayExamples },
  { value: "EditorExamples", label: "代码、富文本与 Markdown", component: EditorExamples },
  { value: "UploadExamples", label: "上传、目录与文件列表", component: UploadExamples },
  { value: "ChartExamples", label: "图表公共配置与专属属性", component: ChartExamples },
  { value: "ChartPrimitiveExamples", label: "图表图层与地图宿主", component: ChartPrimitiveExamples },
  { value: "TransferExamples", label: "柱形与折线数据转移", component: TransferExamples },
];

/** 汇总属性到实际 JSX 的索引，并提供可复制的补充交互样例。 */
export function PropertyExamplesPage() {
  const [params] = useSearchParams();
  const initialComponent = coverage.find(item => item.name === params.get("component"))?.name ?? "Button";
  /** 根据真实补充样例路径定位预览分组，不另外维护一份组件映射。 */
  const groupFor = (name: string) => coverage.find(item => item.name === name)?.props.find(prop => prop.supplement)?.supplement?.match(/examples\/(\w+)\.tsx/)?.[1];
  const [group, setGroup] = useState(groups.find(item => item.value === params.get("group"))?.value ?? groupFor(initialComponent) ?? groups[0].value);
  const [component, setComponent] = useState(initialComponent);
  const [filter, setFilter] = useState("");
  const [sourcePath, setSourcePath] = useState("./examples/BasicExamples.tsx");
  const [code, setCode] = useState("");
  const selected = groups.find(item => item.value === group) ?? groups[0];
  const Preview = selected.component;
  const [previewCode, setPreviewCode] = useState("");
  useEffect(() => {
    let active = true;
    setCode("");
    void sources[sourcePath]?.().then(text => { if (active) setCode(text); }).catch(() => { if (active) setCode("// 源码加载失败，请重新选择。"); });
    return () => { active = false; };
  }, [sourcePath]);
  useEffect(() => {
    let active = true;
    setPreviewCode("");
    void sources[`./examples/${group}.tsx`]?.().then(text => { if (active) setPreviewCode(text); });
    return () => { active = false; };
  }, [group]);
  const rows = (coverage.find(item => item.name === component)?.props ?? []).filter(prop => prop.name.toLowerCase().includes(filter.toLowerCase()));
  return <>
    <PageHeader eyebrow="组件 / 属性样例" title="组件属性样例索引" description="从公开源码核对每个框架自有属性，定位实际 JSX；API 表和代码字符串不计作运行样例。React / DOM 继承属性沿用原生用法。" />
    <Space direction="vertical" style={{ width: "100%" }}>
      <Typography.Text>当前索引：{coverage.length} 个组件及子组件，{coverage.reduce((count, item) => count + item.props.length, 0)} 个属性。可在下方查看源文件，或体验补充交互样例。</Typography.Text>
      <Space wrap><Select aria-label="查找组件" showSearch value={component} options={coverage.map(item => ({ value: item.name, label: item.name }))} onChange={value => { const name = String(value); setComponent(name); setFilter(""); const next = groupFor(name); if (next) setGroup(next); }} /><Input aria-label="筛选属性" placeholder="输入属性名，例如 onChange" value={filter} onChange={event => setFilter(event.target.value)} /></Space>
      <Table dataSource={rows} rowKey="name" height={260} columns={[
        { key: "name", dataIndex: "name", title: "属性", width: 180 },
        { key: "example", title: "实际使用位置", render: (_value, row) => row.example ?? "缺少样例" },
        { key: "view", title: "源码", width: 100, render: (_value, row) => <Button variant="link" disabled={!row.example} onClick={() => { const path = row.example?.replace(/^apps\/docs\/src\/pages\//, "./").replace(/:\d+$/, ""); if (path && sources[path]) setSourcePath(path); }}>查看源码</Button> },
        { key: "preview", title: "补充交互", width: 100, render: (_value, row) => row.supplement ? <Button variant="link" onClick={() => { const next = row.supplement?.match(/examples\/(\w+)\.tsx/)?.[1]; if (next) setGroup(next); document.getElementById("property-example-preview")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>查看演示</Button> : "原有样例" },
      ]} />
      <DemoCard title={`属性样例源码：${sourcePath}`} description="展开代码可查看完整文件及其导入、状态和数据定义；位置行号见上方索引。" code={code}><Typography.Text>选中属性对应的源文件，可展开或复制代码。</Typography.Text></DemoCard>
      <Select aria-label="补充样例分组" value={group} options={groups} onChange={value => setGroup(String(value))} />
      <DemoCard id="property-example-preview" title={selected.label} description="使用开关、输入或点击操作观察效果；事件结果显示在样例底部。代码直接取自正在运行的样例文件。" code={previewCode}><Preview key={group} /></DemoCard>
    </Space>
  </>;
}

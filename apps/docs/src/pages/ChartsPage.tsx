import { Navigate, useParams } from "react-router-dom";
import { chartCategories } from "./chartCategories";
import { Children, isValidElement, useRef, useState } from "react";
import {
  BarChart,
  CandlestickChart,
  Card,
  ChordChart,
  ForceGraphChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  MapChart,
  MixedChart,
  PieChart,
  RadarChart,
  ScatterChart,
  ThemeRiverChart,
  TreeChart,
  TreemapChart,
  VennChart,
  WordCloudChart,
  registerChartMap,
} from "@sia.soul/sia-react-ui";
import type { GeoJsonFeatureCollection, SiaChartRef } from "@sia.soul/sia-react-ui";
import type { ReactNode } from "react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";
import { ChartParityPanel } from "./ChartParityPanel";
import { ChartReferenceGallery } from "./ChartReferenceGallery";

const demoMapName = "sia-native-chart-demo";
const demoMap: GeoJsonFeatureCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { name: "西区" }, geometry: { type: "Polygon", coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] } },
    { type: "Feature", properties: { name: "东区" }, geometry: { type: "Polygon", coordinates: [[[4, 0], [8, 0], [8, 4], [4, 4], [4, 0]]] } },
    { type: "Feature", properties: { name: "北区" }, geometry: { type: "Polygon", coordinates: [[[0, 4], [8, 4], [7, 8], [1, 8], [0, 4]]] } },
  ],
};
registerChartMap(demoMapName, demoMap);

const overviewCode = `import { LineChart } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <LineChart
    categories={["周一", "周二", "周三", "周四", "周五"]}
    series={[
      { name: "访问量", curve: "smooth", markAverage: true, data: [120, 182, 191, 234, 290] },
      { name: "转化量", curve: "smooth", area: true, data: [60, 92, 101, 134, 160] },
    ]}
    dataZoom
    calculable
    tooltipTrigger="axis"
    toolbox={{ magicTypes: ["折线", "柱状"] }}
    height={360}
  />;
}`;

const mapCode = `import { MapChart, registerChartMap } from "@sia.soul/sia-react-ui";
import china from "./china.json";

registerChartMap("china", china);

export default function Demo() {
  return <MapChart
    map="china"
    data={regionData}
    colors={["#e6f4ff", "#1677ff"]}
  />;
}`;

const apiRows = [
  { property: "width / height", description: "响应式容器宽高，支持数字像素值或 CSS 长度", type: "number | string", defaultValue: '"100%" / 320' },
  { property: "title / description", description: "图表内部标题与补充说明", type: "ReactNode", defaultValue: "-" },
  { property: "ariaLabel", description: "SVG 图表可访问名称；数据标记支持键盘聚焦", type: "string", defaultValue: '"数据图表"' },
  { property: "palette", description: "系列颜色；默认使用 Sia 数据可视化色板", type: "readonly string[]", defaultValue: "Sia 默认色板" },
  { property: "loading", description: "显示组件自有的绘制中遮罩", type: "boolean", defaultValue: "false" },
  { property: "empty / emptyContent", description: "无数据状态及自定义内容", type: "boolean / ReactNode", defaultValue: "false / 暂无图表数据" },
  { property: "animation / animationDuration", description: "图形入场与更新过渡；自动尊重减少动态效果设置", type: "boolean / number", defaultValue: "true / 700" },
  { property: "toolbox", description: "标线、数据视图、形态切换、还原与 SVG 图片保存", type: "boolean | ChartToolboxOptions", defaultValue: "false" },
  { property: "svgProps", description: "传给原生 SVG 根节点的属性", type: "SVGAttributes<SVGSVGElement>", defaultValue: "-" },
  { property: "ref", description: "访问 SVG、聚焦、序列化或生成 data URL", type: "SiaChartRef", defaultValue: "-" },
] as const;

const componentRows = [
  { property: "SiaChart / ChartMark", description: "SVG 容器、可访问数据标记、空状态、加载态与导出能力", type: "Sia 基础组件", defaultValue: "-" },
  { property: "ChartAxis / ChartLegend", description: "数值或类目坐标轴、网格线和系列图例", type: "Sia 基础组件", defaultValue: "-" },
  { property: "ChartTooltip / ChartVisualMap / ChartDataZoom", description: "交互提示、连续值域图例与双手柄数据窗口", type: "Sia 基础组件", defaultValue: "-" },
  { property: "ChartToolbox / ChartTimeline / ChartComposite", description: "图表工具箱、可播放时间轴与多图层组合容器", type: "Sia 基础组件", defaultValue: "-" },
  { property: "LineChart", description: "折线、面积、堆积、平滑、阶梯、均值标线和数据缩放", type: "Sia 原生 SVG", defaultValue: "-" },
  { property: "BarChart", description: "柱状、条形、分组、堆积、正负值和圆角", type: "Sia 原生 SVG", defaultValue: "-" },
  { property: "ScatterChart", description: "散点、气泡、分类与多维尺寸", type: "Sia 原生 SVG", defaultValue: "-" },
  { property: "CandlestickChart / KLineChart", description: "K 线开收低高数据", type: "Sia 原生 SVG", defaultValue: "兼容旧名称" },
  { property: "PieChart", description: "饼图、环图、南丁格尔玫瑰图", type: "Sia 原生 SVG", defaultValue: "-" },
  { property: "RadarChart", description: "多指标、多系列填充雷达", type: "Sia 原生 SVG", defaultValue: "-" },
  { property: "ChordChart", description: "节点弧段、关系流和权重", type: "Sia 原生 SVG", defaultValue: "-" },
  { property: "GraphChart / ForceGraphChart / ForceChart", description: "圆形布局与自有力导向迭代布局", type: "Sia 原生算法", defaultValue: "-" },
  { property: "MapChart", description: "GeoJSON 投影、区域值域与标签", type: "Sia 原生 SVG", defaultValue: "registerChartMap" },
  { property: "GaugeChart", description: "单/多仪表、分段、进度和指针", type: "Sia 原生 SVG", defaultValue: "-" },
  { property: "FunnelChart", description: "漏斗排序、间距与对齐", type: "Sia 原生 SVG", defaultValue: "-" },
  { property: "HeatmapChart", description: "二维矩阵、颜色插值和值域图例", type: "Sia 原生 SVG", defaultValue: "-" },
  { property: "ThemeRiverChart / EventRiverChart", description: "当前为主题流图；EventRiverChart 仅为名称别名，尚未实现原站事件河流布局", type: "Sia 原生算法（开发中）", defaultValue: "-" },
  { property: "VennChart", description: "按集合与交集面积求解圆心距离", type: "Sia 原生算法", defaultValue: "-" },
  { property: "TreemapChart", description: "层级矩形布局与多层展示", type: "Sia 原生算法", defaultValue: "-" },
  { property: "TreeChart", description: "正交、纵向和径向树布局", type: "Sia 原生算法", defaultValue: "-" },
  { property: "WordCloudChart", description: "螺旋搜索、碰撞检测、字号与旋转映射", type: "Sia 原生算法", defaultValue: "-" },
  { property: "MixedChart", description: "折线、面积和柱状系列混搭", type: "Sia 原生 SVG", defaultValue: "-" },
] as const;

interface ChartExampleProps { title: string; description: string; children: ReactNode }

function ChartExample({ title, description, children }: ChartExampleProps) {
  return <Card className="chart-example" title={title} description={description}><div className="chart-example__canvas">{children}</div></Card>;
}

function TimelineChartExample() {
  const [yearIndex, setYearIndex] = useState(0);
  const labels = ["2023", "2024", "2025", "2026"];
  const snapshots = [
    [32, 41, 28, 54],
    [48, 57, 43, 68],
    [61, 73, 58, 82],
    [76, 88, 71, 96],
  ];
  return <ChartExample title="Timeline 时间轴" description="播放、暂停、循环或拖动，图形随时间快照重绘。">
    <BarChart
      height={280}
      categories={["华北", "华东", "华南", "西部"]}
      series={[{ name: "指数", data: snapshots[yearIndex]! }]}
      timeline={{ labels, value: yearIndex, onChange: setYearIndex, playInterval: 1200 }}
    />
  </ChartExample>;
}

function AllChartExamples({category}:{category?:string}) {
  const heatmap = Array.from({ length: 7 }, (_, day) => Array.from({ length: 12 }, (_, hour) => ((hour * 7 + day * 5 + 11) % 17) + 1));
  const examples=<>
    <ChartExample title="Line 折线与面积" description="折线、面积、均值标线和提示。">
      <LineChart height={280} categories={["一", "二", "三", "四", "五", "六", "日"]} series={[
        { name: "访问", curve: "smooth", markAverage: true, data: [120, 132, 101, 164, 190, 230, 210] },
        { name: "转化", curve: "smooth", area: true, data: [62, 78, 71, 94, 110, 142, 128] },
      ]} />
    </ChartExample>

    <ChartExample title="Bar 柱状与堆积" description="分组、堆积、条形和圆角。">
      <BarChart height={280} categories={["Q1", "Q2", "Q3", "Q4"]} stacked series={[
        { name: "新增", data: [32, 45, 58, 72] }, { name: "续费", data: [18, 26, 35, 41] },
      ]} />
    </ChartExample>

    <ChartExample title="Scatter 散点与气泡" description="双数值轴、分类和气泡大小。">
      <ScatterChart height={280} xLabel="成本" yLabel="收益" data={[
        { name: "A", x: 12, y: 18, size: 9, category: "探索" }, { name: "B", x: 22, y: 34, size: 15, category: "探索" },
        { name: "C", x: 34, y: 28, size: 11, category: "增长" }, { name: "D", x: 45, y: 51, size: 20, category: "增长" },
        { name: "E", x: 58, y: 44, size: 14, category: "成熟" }, { name: "F", x: 67, y: 72, size: 24, category: "成熟" },
      ]} />
    </ChartExample>

    <ChartExample title="Candlestick K 线" description="开盘、收盘、最低与最高。">
      <CandlestickChart height={280} data={[
        { name: "09-01", open: 20, close: 24, low: 18, high: 26 }, { name: "09-02", open: 24, close: 22, low: 21, high: 27 },
        { name: "09-03", open: 22, close: 28, low: 20, high: 30 }, { name: "09-04", open: 28, close: 31, low: 26, high: 33 },
        { name: "09-05", open: 31, close: 29, low: 27, high: 34 }, { name: "09-06", open: 29, close: 35, low: 28, high: 37 },
      ]} />
    </ChartExample>

    <ChartExample title="Pie 饼图与环图" description="占比、环形半径和中心内容。">
      <PieChart height={280} innerRadius={54} centerLabel={<><strong>100%</strong><small>流量</small></>} data={[
        { value: 42, name: "搜索" }, { value: 28, name: "推荐" }, { value: 18, name: "直接" }, { value: 12, name: "其他" },
      ]} />
    </ChartExample>

    <ChartExample title="Radar 雷达图" description="多维指标与双系列对比。">
      <RadarChart height={280} indicators={[
        { name: "性能", max: 100 }, { name: "稳定", max: 100 }, { name: "易用", max: 100 }, { name: "扩展", max: 100 }, { name: "生态", max: 100 },
      ]} series={[
        { name: "方案 A", data: [92, 86, 74, 88, 80], areaOpacity: 0.18 },
        { name: "方案 B", data: [78, 92, 88, 70, 90], areaOpacity: 0.12 },
      ]} />
    </ChartExample>

    <ChartExample title="Chord 和弦图" description="节点权重与关系流。">
      <ChordChart height={280} nodes={[
        { id: "dev", name: "研发" }, { id: "product", name: "产品" }, { id: "design", name: "设计" }, { id: "market", name: "市场" },
      ]} links={[
        { source: "dev", target: "product", value: 28 }, { source: "product", target: "design", value: 20 },
        { source: "design", target: "market", value: 16 }, { source: "market", target: "product", value: 12 }, { source: "dev", target: "design", value: 10 },
      ]} />
    </ChartExample>

    <ChartExample title="Force 力导向图" description="自有迭代布局、节点和边。">
      <ForceGraphChart height={280} nodes={[
        { id: "portal", name: "门户", value: 32, category: "核心" }, { id: "user", name: "用户", value: 20, category: "服务" },
        { id: "order", name: "订单", value: 24, category: "服务" }, { id: "pay", name: "支付", value: 18, category: "服务" }, { id: "msg", name: "消息", value: 14, category: "服务" },
      ]} links={[
        { source: "portal", target: "user" }, { source: "portal", target: "order" }, { source: "order", target: "pay" }, { source: "order", target: "msg" },
      ]} />
    </ChartExample>

    <ChartExample title="Map 地图" description="GeoJSON 投影、可计算值域、漫游、选择与迁徙特效。">
      <MapChart height={280} map={demoMapName} roam selectedMode="multiple" calculableVisualMap toolbox={{ features: ["restore"] }} markPoints={[{ name: "枢纽", coordinate: [4, 4], value: 96, effect: true }]} markLines={[{ name: "西区至东区", source: [2, 2], target: [6, 2], effect: true }]} data={[{ name: "西区", value: 68 }, { name: "东区", value: 92 }, { name: "北区", value: 46 }]} />
    </ChartExample>

    <ChartExample title="Gauge 仪表盘" description="环形进度、刻度和指针。">
      <GaugeChart height={280} data={[{ name: "完成率", value: 76 }]} valueFormatter={(value) => `${value}%`} />
    </ChartExample>

    <ChartExample title="Funnel 漏斗图" description="流程转化、排序与标签。">
      <FunnelChart height={280} data={[{ value: 100, name: "访问" }, { value: 78, name: "注册" }, { value: 54, name: "试用" }, { value: 31, name: "购买" }]} />
    </ChartExample>

    <ChartExample title="Heatmap 热力图" description="二维密度、颜色插值和值域图例。">
      <HeatmapChart height={280} xLabels={Array.from({ length: 12 }, (_, index) => `${index + 8}:00`)} yLabels={["一", "二", "三", "四", "五", "六", "日"]} data={heatmap} />
    </ChartExample>

    <ChartExample title="ThemeRiver 主题河流" description="主题随时间变化；尚不等同于原站 EventRiver 事件河流。">
      <ThemeRiverChart height={280} categories={["一月", "二月", "三月", "四月"]} series={[
        { name: "搜索", data: [12, 18, 15, 24] }, { name: "推荐", data: [8, 14, 22, 19] }, { name: "直接", data: [6, 9, 12, 14] },
      ]} />
    </ChartExample>

    <ChartExample title="Venn 韦恩图" description="根据面积求解半径和圆距。">
      <VennChart height={280} sets={[{ name: "前端", value: 120 }, { name: "数据", value: 92 }]} intersection={{ name: "交叉能力", value: 42 }} />
    </ChartExample>

    <ChartExample title="Treemap 矩形树图" description="层级权重与多层矩形布局。">
      <TreemapChart height={280} data={[
        { name: "应用", children: [{ name: "桌面", value: 28 }, { name: "浏览器", value: 20 }] },
        { name: "数据", children: [{ name: "表格", value: 18 }, { name: "图表", value: 16 }] },
        { name: "基础", children: [{ name: "令牌", value: 14 }, { name: "图标", value: 10 }] },
      ]} />
    </ChartExample>

    <ChartExample title="Tree 树图" description="正交层级和曲线连接。">
      <TreeChart height={280} data={{ name: "Sia", children: [
        { name: "基础", children: [{ name: "颜色" }, { name: "排版" }] },
        { name: "组件", children: [{ name: "录入" }, { name: "展示" }, { name: "图表" }] },
      ] }} />
    </ChartExample>

    <ChartExample title="WordCloud 字符云" description="螺旋布局、碰撞检测与旋转。">
      <WordCloudChart height={280} data={[
        { name: "SiaWebUI", value: 100 }, { name: "Chart", value: 82 }, { name: "React", value: 76 }, { name: "原生", value: 74 },
        { name: "TypeScript", value: 64 }, { name: "主题", value: 52 }, { name: "组件", value: 48 }, { name: "可视化", value: 44 },
        { name: "交互", value: 38 }, { name: "数据", value: 34 }, { name: "自适应", value: 28 }, { name: "无障碍", value: 24 },
      ]} />
    </ChartExample>

    <ChartExample title="Mixed 混搭图" description="同坐标系内组合柱、线与面积。">
      <MixedChart height={280} categories={["一月", "二月", "三月", "四月", "五月"]} series={[
        { name: "订单", type: "bar", data: [120, 180, 156, 240, 286] },
        { name: "趋势", type: "line", curve: "smooth", data: [102, 164, 170, 218, 276] },
      ]} />
    </ChartExample>
    <TimelineChartExample />
  </>;
  const aliases:Record<string,string>={candlestick:"k",mixed:"mix",themeriver:"eventriver"};
  const visible=Children.toArray(examples.props.children).filter(child=>{
    if(!category)return true;
    if(!isValidElement<{title?:string}>(child))return false;
    const kind=(child.props.title?.split(" ")[0]??"dynamic").toLowerCase();
    return (aliases[kind]??kind)===category;
  });
  return visible.length?<div className="chart-gallery">{visible}</div>:null;
}

export function ChartsPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [lastEvent, setLastEvent] = useState("点击折线上的数据点试试");
  const chartRef = useRef<SiaChartRef>(null);
  return <>
    <PageHeader eyebrow="组件 / 数据可视化 / Chart" title="Chart 图表" description="由 SiaWebUI 自行实现的 SVG 图表系统，不依赖第三方图表运行时。目前正在按 ECharts 2.2.7 原站示例逐项实现和核对，尚未完成全量功能与动画一致性验收。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack chart-docs">
      <ChartParityPanel />
      <DemoCard title="统一原生图表能力" description="自动跟随 Sia 明暗主题；内置坐标轴、图例、提示、可拖拽数据点、均值标线和双手柄数据缩放。" code={overviewCode}>
        <div className="chart-demo-toolbar"><span>Sia 原生 SVG</span><span>{lastEvent}</span></div>
        <LineChart ref={chartRef} height={360} ariaLabel="最近七日访问与转化趋势" dataZoom calculable tooltipTrigger="axis" toolbox={{ magicTypes: ["折线", "柱状"], dataView: <pre>{`日期\t访问量\t转化量\n周一\t120\t60\n周二\t182\t92\n周三\t191\t101\n周四\t234\t134\n周五\t290\t160\n周六\t330\t188\n周日\t310\t176`}</pre> }} categories={["周一", "周二", "周三", "周四", "周五", "周六", "周日"]} series={[
          { name: "访问量", curve: "smooth", markAverage: true, markMin: true, markMax: true, data: [120, 182, 191, 234, 290, 330, 310] },
          { name: "转化量", curve: "smooth", area: true, data: [60, 92, 101, 134, 160, 188, 176] },
        ]} onDataClick={(info) => setLastEvent(`已点击：${info.seriesName} / ${info.name} / ${info.value}`)} />
      </DemoCard>

      <ChartReferenceGallery />
      <section className="chart-catalog-heading"><div><h2>通用图表能力演示</h2><p>以下仅展示框架基础能力，不计入上方原站对应示例数量。</p></div><span>开发中 · 零图表运行时依赖</span></section>
      <AllChartExamples />

      <DemoCard title="地图数据注册" description="地图按需注册 GeoJSON，不内置外部地图服务或密钥。" code={mapCode}>
        <p className="chart-map-note">本页地图使用本地内嵌 GeoJSON。业务项目可用 <code>registerChartMap</code> 注册中国、省市、世界或自定义室内空间；投影、色彩插值、标签与交互均由 SiaWebUI 完成。</p>
      </DemoCard>
    </div> : <div className="demo-stack">
      <ApiTable name="SiaChart 基础容器" rows={apiRows} />
      <ApiTable name="原生图表组件清单" rows={componentRows} />
      <Card title="原生 Ref" description="不暴露第三方实例，只提供稳定的 SVG 能力。">
        <div className="code-block chart-ref-code"><pre><code>{`type SiaChartRef = {
  getElement(): SVGSVGElement | null;
  focus(): void;
  toSvgString(): string | null;
  toDataUrl(): string | null;
};`}</code></pre></div>
      </Card>
    </div>}
  </>;
}


/** Category routes intentionally exclude the all-family overview and selector. */
export function ChartCategoryPage(){
 const {category}=useParams();
 const selected=chartCategories.find(item=>item.id===category);
 if(!selected)return <Navigate to="/components/chart" replace/>;
 return <div key={category}>
  <PageHeader eyebrow={`组件 / 数据可视化 / Chart / ${selected.title}`} title={selected.title} description={`本页仅展示${selected.title}分类。原站对应示例、通用能力演示和待实现清单分别列出。`}/>
  <div className="demo-stack chart-docs">
   <ChartReferenceGallery category={category}/>
   {!["components","topics"].includes(category!)?<><section className="chart-catalog-heading"><div><h2>本分类通用能力演示</h2><p>以下为框架基础能力，不计入原站对应示例数量。</p></div></section><AllChartExamples category={category}/></>:null}
  </div>
 </div>;
}

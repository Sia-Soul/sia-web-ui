import { useState } from "react";
import { BarChart, CandlestickChart, ChordChart, EventRiverChart, ForceChart, ForceGraphChart, FunnelChart, GaugeChart, GraphChart, HeatmapChart, KLineChart, LineChart, LineShareChart, MapChart, MixedChart, PieChart, RadarChart, ScatterChart, Select, Space, Switch, ThemeRiverChart, TreeChart, TreemapChart, Typography, VennChart, WordCloudChart, XYChart } from "@sia.soul/sia-react-ui";
import type { BarSeries, CandlestickChartProps, GraphChartProps, SiaChartProps, XYSeries } from "@sia.soul/sia-react-ui";

/** 图表公共配置实际应用到每一种图表；通过选择器逐个查看，避免同时绘制大量图表。 */
export function ChartExamples() {
  const [kind, setKind] = useState("BarChart");
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [animation, setAnimation] = useState(true);
  const [brush, setBrush] = useState(false);
  const [tooltip, setTooltip] = useState(false);
  const [event, setEvent] = useState("点击数据、图例或时间轴查看回调");
  const [frame, setFrame] = useState(0);
  const [zoom, setZoom] = useState<readonly [number, number]>([0, 100]);
  const [legend, setLegend] = useState<Record<string, boolean>>({ 样例: true });
  const [selected, setSelected] = useState<string[]>(["甲"]);
  const [active, setActive] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const [series, setSeries] = useState<readonly BarSeries[]>([{ name: "样例", data: [20, 40, 30] }]);
  const [xy, setXY] = useState<readonly XYSeries[]>([{ name: "样例", data: [[1, 20], [2, 40], [3, 30]] }]);
  const categories = ["甲", "乙", "丙"];
  // 显式对象保留每个属性的实际值，覆盖检查不会将 Partial 类型误当作样例。
  const common = {
    title: `${kind} 属性配置`, description: "切换加载、空数据、动画、框选和受控提示观察变化",
    width: "100%", height: 360, viewBoxSize: [720, 360], titleAlign: "center", titleVerticalAlign: "bottom",
    svgOverlay: <text x={680} y={30} textAnchor="end" fill="#0e7490">示例</text>, ariaLabel: `${kind} 完整配置样例`,
    palette: ["#0e7490", "#16a34a", "#f59e0b"], loading, empty, emptyContent: "没有可展示的数据", animation, animationDuration: 600,
    toolbox: { features: ["dataView", "restore", "saveAsImage"], filename: "属性样例" },
    timeline: { labels: ["第一期", "第二期"], value: frame, onChange: setFrame },
    brush: brush ? { bounds: { x: 70, y: 60, width: 570, height: 220 }, onSelect: (range: readonly [number, number]) => setEvent(`框选比例：${range.join(" 至 ")}`), onCancel: () => setBrush(false) } : undefined,
    tooltipProps: { placement: "above", enterable: true, inheritTextStyle: true },
    controlledTooltip: tooltip ? { content: "外部控制提示内容", point: [250, 100] } : null,
    svgProps: { className: "chart-properties", onDoubleClick: () => setEvent("双击 SVG") },
  } satisfies SiaChartProps;
  // 回调包含原生事件，只展示业务字段，避免序列化 DOM 的循环引用。
  const interactions = { legendInteractive: true, legendSelected: legend, onLegendSelectionChange: setLegend, valueFormatter: (value: number) => `${value} 件`, onDataClick: (info: { name: string; value: unknown }) => setEvent(`${info.name}：${JSON.stringify(info.value)}`) };
  const data = empty ? [] : [{ name: "甲", value: 20 + frame * 10 }, { name: "乙", value: 40 }, { name: "丙", value: 30 }];
  const cartesian = empty ? [] : series;
  const candles = {
    ...common, data: empty ? [] : [{ name: "2026-10-01", open: 20, close: 30, low: 10, high: 40 }, { name: "2026-10-02", open: 30, close: 25, low: 20, high: 35 }],
    showAxes: true, valueDomain: [0, 50, 10], axisLabelFormatter: (value: number) => `${value}元`, activeIndex: active, onActiveIndexChange: setActive,
    seriesVisible: visible, onSeriesVisibilityChange: setVisible, showLegend: true, showCategoryLabels: true, plotBounds: { x: 70, y: 60, width: 570, height: 220 },
    markPoints: [{ name: "最高点", date: "2026-10-01", value: 40, y: 40 }], seriesName: "样例", risingBorderColor: "#dc2626", fallingBorderColor: "#16a34a", borderWidth: 2,
    risingEmphasisColor: "#fca5a5", fallingEmphasisColor: "#86efac", maxBarWidth: 36, appearance: "sia", risingColor: "#ef4444", fallingColor: "#22c55e", hollowRising: true,
    dataZoom: true, zoom, onZoomChange: setZoom, markExtremes: true, onDataClick: interactions.onDataClick,
  } satisfies CandlestickChartProps;
  const graph = {
    ...common, nodes: empty ? [] : [{ id: "a", name: "甲", category: "样例", value: 20 }, { id: "b", name: "乙", category: "样例", value: 30 }], links: empty ? [] : [{ source: "a", target: "b", value: 10 }],
    layout: "force", showLabels: true, draggable: true, progressiveForce: true, chordOptions: { ribbon: true }, roam: true, forceOptions: { gravity: 0.1 },
    legendInteractive: true, legendSelected: legend, onLegendSelectionChange: setLegend, onNodeClick: interactions.onDataClick,
  } satisfies GraphChartProps;
  const views: Record<string, React.ReactNode> = {
    BarChart: <BarChart {...common} {...interactions} categories={categories} series={cartesian} onDataChange={setSeries} calculable onTransferError={setEvent} legendLayout={{ x: 360, y: 30, itemGap: 20, rows: 1 }} barCategoryGap={0.3} valuePadding={0.1} valueAxisPosition="top" valueDomain={[0, 100, 20]} axisLabelFormatter={value => `${value}件`} showValueAxis showCategoryAxis showCategorySplitLine tooltipFormatter={(name, values) => `${name}：${values.map(value => value.value).join(", ")}`} orientation="horizontal" minBarSize={5} showLegend />,
    LineChart: <LineChart {...common} {...interactions} categories={categories} series={empty ? [] : [{ name: "样例", data: [20, 40 + frame * 10, 30] }]} calculable onTransferError={setEvent} xAxisType="category" valueAxisInverse dataZoom zoom={zoom} onZoomChange={setZoom} />,
    CandlestickChart: <CandlestickChart {...candles} />,
    KLineChart: <KLineChart {...candles} />,
    ChordChart: <ChordChart {...common} nodes={data.map(item => ({ id: item.name, name: item.name }))} links={empty ? [] : [{ source: "甲", target: "乙", value: 20 }]} onNodeClick={interactions.onDataClick} onLinkClick={interactions.onDataClick} />,
    ForceChart: <ForceChart {...graph} />,
    ForceGraphChart: <ForceGraphChart {...graph} />,
    GraphChart: <GraphChart {...graph} />,
    FunnelChart: <FunnelChart {...common} {...interactions} data={data} onDataChange={next => setEvent(`漏斗数据：${JSON.stringify(next)}`)} sort="ascending" gap={5} align="left" orientation="horizontal" showLegend />,
    GaugeChart: <GaugeChart {...common} data={data.slice(0, 1)} min={0} max={100} segments={[{ until: 0.6, color: "#16a34a" }, { until: 1, color: "#dc2626" }]} splitNumber={5} showAxisLabels showProgress detailOffset={45} onDataClick={interactions.onDataClick} />,
    HeatmapChart: <HeatmapChart {...common} xLabels={categories} yLabels={["上周", "本周"]} data={empty ? [] : [[10, 20, 30], [20, 30, 40]]} colors={["#e0f2fe", "#0369a1"]} showValues pointRadius={20} blur={0.8} minAlpha={0.2} maxAlpha={0.9} valueFormatter={interactions.valueFormatter} onDataClick={interactions.onDataClick} />,
    MapChart: <MapChart {...common} geoJson={{ type: "FeatureCollection", features: [{ type: "Feature", properties: { region: "甲" }, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } }] }} data={data.slice(0, 1)} nameProperty="region" defaultSelected={["甲"]} selectedMode="multiple" defaultVisualRange={[0, 80]} calculableVisualMap overlayProjection={{ project: ([x, y]) => [70 + x * 200, 260 - y * 200], offset: [0, 0] }} onRegionClick={interactions.onDataClick} />,
    MixedChart: <MixedChart {...common} {...interactions} categories={categories} series={empty ? [] : [{ name: "样例", type: "bar", data: [20, 40, 30] }]} stacked />,
    PieChart: <PieChart {...common} {...interactions} data={data} animationDurationUpdate={500} outerRadius={90} rose="area" startAngle={45} clockwise={false} padAngle={2} selectedMode="multiple" selected={selected} onSelectionChange={setSelected} />,
    RadarChart: <RadarChart {...common} {...interactions} indicators={categories.map(name => ({ name, max: 100 }))} series={empty ? [] : [{ name: "样例", data: [40, 70, 60] }]} levels={4} />,
    ScatterChart: <ScatterChart {...common} {...interactions} data={empty ? [] : [{ name: "甲", x: 10, y: 20, category: "样例" }, { name: "乙", x: 30, y: 40, category: "样例" }]} animationDurationUpdate={500} showXSplitLine dataZoom zoom={zoom} onZoomChange={setZoom} />,
    ThemeRiverChart: <ThemeRiverChart {...common} {...interactions} categories={categories} series={empty ? [] : [{ name: "样例", data: [20, 40, 30] }]} />,
    EventRiverChart: <EventRiverChart {...common} {...interactions} series={empty ? [] : [{ name: "样例", data: [{ name: "事件", evolution: [{ time: "2026-10-01", value: 20 }, { time: "2026-10-02", value: 50 }, { time: "2026-10-03", value: 10 }] }] }]} draggable animationProgress={1} boundaryGap={[0.1, 0.1]} />,
    TreeChart: <TreeChart {...common} data={{ name: "根", children: empty ? [] : [{ name: "甲", value: 20 }, { name: "乙", value: 30 }] }} radial layerPadding={90} showLabels emphasisShowLabels nodeColor="#0e7490" edgeShadow={{ color: "#94a3b8", blur: 3, offsetX: 1, offsetY: 1 }} roam hoverable labelFontSize={14} labelColor="#0e7490" collapsible onToggle={(node, collapsed) => setEvent(`${node.name} 收起：${collapsed}`)} onDataClick={interactions.onDataClick} />,
    TreemapChart: <TreemapChart {...common} data={data} itemStyle={{ borderColor: "#ffffff", borderWidth: 2 }} emphasis={{ color: "#f59e0b" }} valueFormatter={interactions.valueFormatter} onDataClick={interactions.onDataClick} />,
    VennChart: <VennChart {...common} sets={[{ name: "甲", value: empty ? 0 : 50 }, { name: "乙", value: empty ? 0 : 40 }]} intersection={{ value: empty ? 0 : 20 }} onDataClick={interactions.onDataClick} />,
    WordCloudChart: <WordCloudChart {...common} data={data} maxFontSize={60} spiralStep={0.6} onDataClick={interactions.onDataClick} />,
    LineShareChart: <LineShareChart {...common} data={data} lineColor="#0e7490" shareColor="#16a34a" />,
    XYChart: <XYChart {...common} series={empty ? [] : xy} calculable dataZoom onZoomChange={value => setEvent(`XY 缩放 ${value.join(" 至 ")}`)} onDataChange={setXY} />,
  };
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Select aria-label="图表组件" popupMode="dropdown" showSearch value={kind} options={Object.keys(views).map(value => ({ value, label: value }))} onChange={value => setKind(String(value))} />
    <Space wrap><Switch checked={loading} onCheckedChange={setLoading} label="加载" /><Switch checked={empty} onCheckedChange={setEmpty} label="空数据" /><Switch checked={animation} onCheckedChange={setAnimation} label="动画" /><Switch checked={brush} onCheckedChange={setBrush} label="框选" /><Switch checked={tooltip} onCheckedChange={setTooltip} label="受控提示" /></Space>
    {views[kind]}
    <Typography.Text role="status">{event}</Typography.Text>
    {/* default 值与受控值分开，避免初始值被当前值覆盖而无法观察。 */}
    <CandlestickChart data={candles.data} defaultZoom={[10, 90]} dataZoom height={180} />
    <KLineChart data={candles.data} defaultZoom={[10, 90]} dataZoom height={180} />
    <PieChart data={data} defaultSelected={["乙"]} selectedMode="single" height={180} />
  </Space>;
}

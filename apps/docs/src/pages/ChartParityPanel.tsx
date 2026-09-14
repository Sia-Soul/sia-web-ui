import { useState } from "react";
import {DataZoomReferencePreview} from './DataZoomReferencePreview';
import {LegendReferencePreview} from './LegendReferencePreview';
import {BodyMapReferencePreview} from './BodyMapReferencePreview';
import {FootballMapReferencePreview} from './FootballMapReferencePreview';
import {BuildingMapReferencePreview} from './BuildingMapReferencePreview';
import {FootballTimelineReferencePreview} from './FootballTimelineReferencePreview';
import {CityCycleReferencePreview} from './CityCycleReferencePreview';
import {CurvedMigrationReferencePreview} from './CurvedMigrationReferencePreview';
import {BundledMigrationReferencePreview} from './BundledMigrationReferencePreview';
import {PersonalizedMapReferencePreview} from './PersonalizedMapReferencePreview';
import {PersonalizedBarReferencePreview} from './PersonalizedBarReferencePreview';
import {PersonalizedLineReferencePreview} from './PersonalizedLineReferencePreview';
import {RainFlowReferencePreview} from './RainFlowReferencePreview';
import {PersonalizedScatterReferencePreview} from './PersonalizedScatterReferencePreview';
import {LargeMapPointReferencePreview} from './LargeMapPointReferencePreview';
import {MapTimelineReferencePreview} from './MapTimelineReferencePreview';
import {ContinentTravelReferencePreview} from './ContinentTravelReferencePreview';
import {MapSalesReferencePreview} from './MapSalesReferencePreview';
import {MapSelectionReferencePreview} from './MapSelectionReferencePreview';
import {MapSwitchReferencePreview} from './MapSwitchReferencePreview';
import {WorldPopulationReferencePreview} from './WorldPopulationReferencePreview';
import {WorldNamesReferencePreview} from './WorldNamesReferencePreview';
import {HongKongDensityReferencePreview} from './HongKongDensityReferencePreview';
import {UsaPopulationReferencePreview} from './UsaPopulationReferencePreview';
import {WorldGdpReferencePreview} from './WorldGdpReferencePreview';
import {AirQualityReferencePreview} from './AirQualityReferencePreview';
import {AirRoutesReferencePreview} from './AirRoutesReferencePreview';
import {MigrationReferencePreview} from './MigrationReferencePreview';
import {RailwayReferencePreview} from './RailwayReferencePreview';
import {MixedShareReferencePreview} from './MixedShareReferencePreview';
import {MixedBusinessReferencePreview} from './MixedBusinessReferencePreview';
import {MixedIndexReferencePreview} from './MixedIndexReferencePreview';
import {ProvinceSelectorReferencePreview} from './ProvinceSelectorReferencePreview';
import {MixedScatterReferencePreview} from './MixedScatterReferencePreview';
import {MixedGdpReferencePreview} from './MixedGdpReferencePreview';
import { useSearchParams } from "react-router-dom";
import { Button, Card, LineChart, Select, Slider } from "@sia.soul/sia-react-ui";
import type { LineSeries, LineChartProps } from "@sia.soul/sia-react-ui";
import { chartReferenceExamples } from "./chartReferenceExamples";
import { chartBarFixtures } from "./chartBarFixtures";
import { BarReferencePreview } from "./BarReferencePreview";
import { XYReferencePreview, xyReferenceIds } from "./XYReferencePreview";
import { chartPieFixtures } from "./chartPieFixtures";
import { PieReferencePreview } from "./PieReferencePreview";
import { PersonalizedPieReferencePreview } from "./PersonalizedPieReferencePreview";
import { LasagnaReferencePreview } from "./LasagnaReferencePreview";
import { PhoneTreeReferencePreview } from "./PhoneTreeReferencePreview";
import { EventRiverReferencePreview } from "./EventRiverReferencePreview";
import { LargeEventRiverReferencePreview } from "./LargeEventRiverReferencePreview";
import { AxisReferencePreview } from "./AxisReferencePreview";
import { chartAdditionalFixtures } from "./chartAdditionalFixtures";
import { AdditionalReferencePreview } from "./AdditionalReferencePreview";
import { chartGaugeFixtures } from "./chartGaugeFixtures";
import { GaugeReferencePreview } from "./GaugeReferencePreview";
import { chartTreemapFixtures } from "./chartTreemapFixtures";
import { TreemapReferencePreview } from "./TreemapReferencePreview";
import { TreeReferencePreview } from "./TreeReferencePreview";
import { chartTreeFixtures } from "./chartTreeFixtures";
import {VennReferencePreview} from './VennReferencePreview';
import {WordCloudReferencePreview} from './WordCloudReferencePreview';
import {CandlestickReferencePreview} from './CandlestickReferencePreview';
import {ScatterWaveReferencePreview} from './ScatterWaveReferencePreview';
import {ScatterBubbleReferencePreview} from './ScatterBubbleReferencePreview';
import {ScatterCategoryReferencePreview} from './ScatterCategoryReferencePreview';
import {ScatterTimeReferencePreview} from './ScatterTimeReferencePreview';
import {ScatterRangeReferencePreview} from './ScatterRangeReferencePreview';
import {HeatmapReferencePreview} from './HeatmapReferencePreview';
import {ChordReferencePreview} from './ChordReferencePreview';
import {ChordRelationsReferencePreview} from './ChordRelationsReferencePreview';
import {ChordPlayersReferencePreview} from './ChordPlayersReferencePreview';
import {ChordNodesReferencePreview} from './ChordNodesReferencePreview';
import {ChordStyledReferencePreview} from './ChordStyledReferencePreview';
import {ForceJobsReferencePreview} from './ForceJobsReferencePreview';
import {ForceTreeReferencePreview} from './ForceTreeReferencePreview';
import {ForceLayeredReferencePreview} from './ForceLayeredReferencePreview';
import {WormholeReferencePreview} from './WormholeReferencePreview';
import {LineTimeReferencePreview} from './LineTimeReferencePreview';
import {ScatterTimelineReferencePreview} from './ScatterTimelineReferencePreview';
import {BarTimelineReferencePreview} from './BarTimelineReferencePreview';
import {MixedWaterReferencePreview} from './MixedWaterReferencePreview';
import {MixedSalesReferencePreview} from './MixedSalesReferencePreview';
import {MixedPieScatterReferencePreview} from './MixedPieScatterReferencePreview';
import {MixedMarketReferencePreview} from './MixedMarketReferencePreview';
import {MixedVisitorsReferencePreview} from './MixedVisitorsReferencePreview';
import {MixedTrafficReferencePreview} from './MixedTrafficReferencePreview';
import {RadarStyledReferencePreview} from './RadarStyledReferencePreview';
import {ScatterDistributionReferencePreview} from './ScatterDistributionReferencePreview';

const categories = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const palette = ["#2ec7c9", "#b6a2de", "#5ab1ef", "#ffb980", "#d87a80"];
const traffic: LineSeries[] = [
  { name: "邮件营销", data: [120, 132, 101, 134, 90, 230, 210] },
  { name: "联盟广告", data: [220, 182, 191, 234, 290, 330, 310] },
  { name: "视频广告", data: [150, 232, 201, 154, 190, 330, 410] },
  { name: "直接访问", data: [320, 332, 301, 334, 390, 330, 320] },
  { name: "搜索引擎", data: [820, 932, 901, 934, 1290, 1330, 1320] },
];
const fixtures: Record<string, { title?: string; stacked?: boolean; series: LineSeries[]; categories?: string[]; orientation?: LineChartProps["orientation"]; valueAxisType?: LineChartProps["valueAxisType"]; logBase?: number; logExponentStep?: number }> = {
  line1: { title: "未来一周气温变化", series: [
    { name: "最高气温", data: [11, 11, 15, 13, 12, 13, 10], markMin: true, markMax: true, markAverage: true },
    { name: "最低气温", data: [1, -2, 2, 5, 3, 2, 0], markAverage: true, markPoints: [{ name: "周最低", index: 1, value: -1.5, label: "-2" }] },
  ] },
  line2: { stacked: true, series: traffic },
  line3: { title: "某楼盘销售情况", series: [
    { name: "意向", area: true, data: [1320, 1132, 601, 234, 120, 90, 20] },
    { name: "预购", area: true, data: [30, 182, 434, 791, 390, 30, 10] },
    { name: "成交", area: true, data: [10, 12, 21, 54, 260, 830, 710] },
  ] },
  line4: { stacked: true, series: traffic.map((series) => ({ ...series, area: true })) },
  line5: { categories:["0","10","20","30","40","50","60","70","80"],orientation:"horizontal",series:[{name:"高度(km)与气温(°C)变化关系",data:[15,-50,-56.5,-46.5,-22.1,-2.5,-27.7,-55.7,-76.5]}] },
  line9: { title:"对数轴示例",categories:["一","二","三","四","五","六","七","八","九"],valueAxisType:"log",series:[{name:"2的指数",data:[1,2,4,8,16,32,64,128,256]},{name:"3的指数",data:[1,3,9,27,81,247,741,2223,6669]}] },
};
fixtures.line10 = {...fixtures.line9!,logBase:3,logExponentStep:3};
fixtures.line11 = {...fixtures.line9!,logBase:2,series:[{name:"2的指数",data:[-2,-4,-8,-16,-32,-64,-128]}]};

function exponentLabel(value: number, base: number) {
  const superscript:Record<string,string>={"-":"⁻","0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹"};
  return `${value<0?"−":""}${base}${String(Math.round(Math.log(Math.abs(value))/Math.log(base))).split("").map(character=>superscript[character]).join("")}`;
}


export const implementedChartReferenceIds = ['dataZoom', 'legend', 'axis', 'eventRiver2', 'eventRiver1', 'lasagna', 'pie', 'scatter', 'line6', 'line', 'bar', 'map', 'map22', 'map21', 'map20', 'map19', 'map18', 'map17', 'map16', 'map15', 'map14', 'map13', 'map12', 'map11', 'map10', 'map9', 'map8', 'map7', 'map6', 'map5', 'map4', 'map3', 'map2', 'map1', 'mix12', 'mix11', 'mix10', 'mix9', 'mix8', 'mix7', 'mix6', 'mix5', 'mix4', 'mix3', 'mix2', 'mix1', 'bar11', 'scatter4', 'line8', 'radar', 'wormhole', 'force4', 'force2', 'force1', 'chord', 'chord4', 'chord3', 'chord2', 'chord1', 'heatmap', 'heatmap2', 'dataRange1', 'scatter6', 'scatter5', 'scatter2', 'scatter1', 'scatter3', 'k', 'k1', 'wordCloud', 'venn', ...Object.keys(fixtures), ...Object.keys(chartBarFixtures), ...xyReferenceIds, ...Object.keys(chartPieFixtures), ...Object.keys(chartAdditionalFixtures), ...Object.keys(chartGaugeFixtures), ...Object.keys(chartTreemapFixtures), ...Object.keys(chartTreeFixtures)];

export function ChartReferencePreview({id,onNavigate}:{id:string;onNavigate?:(url:string)=>void}) {
  if(id==='line8')return <LineTimeReferencePreview/>;
  if(id==='pie')return <PersonalizedPieReferencePreview/>;
  if(id==='lasagna')return <LasagnaReferencePreview/>;
  if(id==='tree1')return <PhoneTreeReferencePreview/>;
  if(id==='eventRiver1')return <EventRiverReferencePreview/>;
  if(id==='eventRiver2')return <LargeEventRiverReferencePreview/>;
  if(id==='axis')return <AxisReferencePreview/>;
  if(id==='legend')return <LegendReferencePreview/>;
  if(id==='dataZoom')return <DataZoomReferencePreview/>;
  if(id==='scatter4')return <ScatterTimelineReferencePreview/>;
  if(id==='bar11')return <BarTimelineReferencePreview/>;
  if(id==='mix1')return <MixedWaterReferencePreview/>;
  if(id==='mix2')return <MixedTrafficReferencePreview/>;
  if(id==='mix3')return <MixedGdpReferencePreview/>;
  if(id==='mix4')return <MixedScatterReferencePreview/>;
  if(id==='mix5')return <ProvinceSelectorReferencePreview/>;
  if(id==='mix6')return <MixedSalesReferencePreview/>;
  if(id==='mix7')return <MixedPieScatterReferencePreview/>;
  if(id==='mix8')return <MixedMarketReferencePreview/>;
  if(id==='mix9')return <MixedVisitorsReferencePreview/>;
  if(id==='mix10')return <MixedIndexReferencePreview/>;
  if(id==='mix11')return <MixedBusinessReferencePreview/>;
  if(id==='mix12')return <MixedShareReferencePreview/>;
  if(id==='map1')return <MapSalesReferencePreview/>;
  if(id==='map2')return <MapSelectionReferencePreview/>;
  if(id==='map3')return <MapSwitchReferencePreview/>;
  if(id==='map4')return <WorldPopulationReferencePreview/>;
  if(id==='map5')return <WorldNamesReferencePreview/>;
  if(id==='map6')return <HongKongDensityReferencePreview/>;
  if(id==='map7')return <UsaPopulationReferencePreview/>;
  if(id==='map8')return <WorldGdpReferencePreview/>;
  if(id==='map9')return <AirQualityReferencePreview/>;
  if(id==='map10')return <AirRoutesReferencePreview/>;
  if(id==='map11')return <MigrationReferencePreview/>;
  if(id==='map12')return <RailwayReferencePreview/>;
  if(id==='map13')return <ContinentTravelReferencePreview/>;
  if(id==='map14')return <MapTimelineReferencePreview/>;
  if(id==='map15')return <LargeMapPointReferencePreview/>;
  if(id==='map16')return <BodyMapReferencePreview/>;
  if(id==='map17')return <FootballMapReferencePreview/>;
  if(id==='map18')return <BuildingMapReferencePreview/>;
  if(id==='map19')return <FootballTimelineReferencePreview/>;
  if(id==='map20')return <CityCycleReferencePreview/>;
  if(id==='map21')return <CurvedMigrationReferencePreview/>;
  if(id==='map22')return <BundledMigrationReferencePreview/>;
  if(id==='map')return <PersonalizedMapReferencePreview/>;
  if(id==='bar')return <PersonalizedBarReferencePreview/>;
  if(id==='line')return <PersonalizedLineReferencePreview/>;
  if(id==='line6')return <RainFlowReferencePreview/>;
  if(id==='scatter')return <PersonalizedScatterReferencePreview/>;
  if(id==='scatter2')return <ScatterBubbleReferencePreview/>;
  if(id==='scatter5')return <ScatterCategoryReferencePreview/>;
  if(id==='scatter6')return <ScatterTimeReferencePreview/>;
  if(id==='dataRange1')return <ScatterRangeReferencePreview/>;
  if(id==='chord2')return <ChordRelationsReferencePreview/>;
  if(id==='chord3')return <ChordPlayersReferencePreview/>;
  if(id==='chord4')return <ChordNodesReferencePreview/>;
  if(id==='chord')return <ChordStyledReferencePreview/>;
  if(id==='force1')return <ForceJobsReferencePreview/>;
  if(id==='force2')return <ForceTreeReferencePreview/>;
  if(id==='force4')return <ForceLayeredReferencePreview/>;
  if(id==='wormhole')return <WormholeReferencePreview/>;
  if(id==='radar')return <RadarStyledReferencePreview/>;
  if(id==='chord1')return <ChordReferencePreview/>;
  if(id==='heatmap'||id==='heatmap2')return <HeatmapReferencePreview id={id}/>;
  if(id==='scatter1')return <ScatterDistributionReferencePreview/>;
  if(id==='scatter3')return <ScatterWaveReferencePreview/>;
  if(id==='k'||id==='k1')return <CandlestickReferencePreview id={id}/>;
  if(id==='wordCloud')return <WordCloudReferencePreview/>;
  if(id==='venn')return <VennReferencePreview/>;
  if(chartTreeFixtures[id])return <TreeReferencePreview key={id} id={id}/>;
  if(chartTreemapFixtures[id])return <TreemapReferencePreview key={id} id={id}/>;
  if(chartGaugeFixtures[id])return <GaugeReferencePreview key={id} id={id}/>;
  if(chartAdditionalFixtures[id])return <AdditionalReferencePreview key={id} id={id}/>;
  return <ExistingReferencePreview key={id} id={id} onNavigate={onNavigate}/>;
}

function ExistingReferencePreview({id,onNavigate}:{id:string;onNavigate?:(url:string)=>void}) {
  const fixture = fixtures[id];
  const barFixture = chartBarFixtures[id];
  const isLog = fixture?.valueAxisType === "log";
  const [replay, setReplay] = useState(0);
  const [progress, setProgress] = useState<number | undefined>();
  const [stackedOverride, setStackedOverride] = useState<boolean | undefined>();
  const [lineKind, setLineKind] = useState("line");
  return <>
    {chartPieFixtures[id] ? <PieReferencePreview key={id} id={id} fixture={chartPieFixtures[id]!} /> : xyReferenceIds.some(value=>value===id) ? <XYReferencePreview key={id} id={id} /> : barFixture ? <BarReferencePreview key={id} fixture={barFixture} id={id} /> : fixture ? <>
      <div className="chart-parity__controls">
        <Button onClick={() => { setProgress(undefined); setReplay((value) => value + 1); }}>重播入场动画</Button>
        <Button onClick={() => setProgress(1)}>查看最终帧</Button>
        {["line2","line3","line4"].includes(id) ? <><Button onClick={() => setStackedOverride(true)}>堆积</Button><Button onClick={() => setStackedOverride(false)}>平铺</Button></> : null}
        <span>{progress == null ? "实时播放" : `${Math.round(progress * 2000)} ms / 2000 ms`}</span>
      </div>
      <Slider aria-label="入场动画时间定位" min={0} max={2000} step={20} value={(progress ?? 1) * 2000} onChange={(value) => setProgress(Number(value) / 2000)} tooltip={{ formatter: (value) => `${value} ms` }} />
      <div className="chart-parity__viewport">
        <LineChart key={`${id}-${replay}`} width={663} height={379} viewBoxSize={[663, 379]} appearance="macarons" title={fixture.title} description={["line1","line3"].includes(id) ? "纯属虚构" : undefined}
          titleAlign={isLog ? "center" : "left"} boundaryGap={isLog} showCategorySplitLine={!isLog} categoryAxisName={isLog ? "x" : undefined} valueAxisName={isLog ? "y" : undefined} legendLayout={isLog ? {x:5,align:"start"} : undefined} logBase={fixture.logBase} logExponentStep={fixture.logExponentStep}
          ariaLabel={`${id} 原始数据对照图`} categories={id === "line5" ? fixture.categories!.map(value=>`${value} km`) : fixture.categories ?? categories} orientation={fixture.orientation} valueAxisType={fixture.valueAxisType} palette={palette} stacked={stackedOverride ?? fixture.stacked}
          valueDomain={id === "line1" ? [-5, 15, 5] : undefined} axisLabelFormatter={fixture.logBase ? value=>exponentLabel(value,fixture.logBase!) : ["line1","line5"].includes(id) ? (value) => `${value} °C` : undefined}
          series={fixture.series.map((series) => ({ ...series, curve: "smooth", hollowSymbol: true, symbolSize: 6 }))}
          tooltipTrigger={isLog ? "item" : "axis"} calculable animationDuration={2000} animationProgress={progress} animationDurationUpdate={500}
          toolbox={{ features: ["mark", "dataView", "restore", "saveAsImage"], dataViewReadOnly:isLog, activeMagicType:lineKind, magicTypes:isLog ? [] : ["line","bar",...(["line2","line3","line4"].includes(id)?["stack","tiled"]:[])], onMagicTypeChange:type=>{if(type==="line"||type==="bar")setLineKind(type);else setStackedOverride(type==="stack");}, onRestore: () => { setLineKind("line"); setStackedOverride(undefined); setProgress(undefined); setReplay((value) => value + 1); } }}
        />
      </div>
      {isLog && onNavigate ? <div className="chart-parity__controls">{[["line9","普通对数标签"],["line10","指数形式标签"],["line11","负值对数轴"]].map(([target,label])=><Button key={target} onClick={()=>{onNavigate?.(`http://static.dtws110.com/echarts-2.2.7/doc/example/${target}.html`);setProgress(undefined);setReplay(value=>value+1);}}>{label}</Button>)}</div> : null}
      <p className="chart-parity__status">进行中：原始数据、Macarons 配色、空心符号、分隔区与折线坐标动画已接入。待验收：标点动画、曲线细节、工具箱完整行为、数据拖拽重计算，以及逐帧视觉差异。</p>
    </> : <p className="chart-parity__pending">{id}尚未建立对应实现。当前不会用通用图表替代该示例，也不会计入通过数量。</p>}
  </>;
}

export function ChartParityPanel() {
  const [params, setParams] = useSearchParams();
  const defaultEntry = chartReferenceExamples.find(item=>item.url.endsWith("/line1.html"))!;
  const selectedUrl = params.get("reference") ?? defaultEntry.url;
  const entry = chartReferenceExamples.find((item) => item.url === selectedUrl) ?? defaultEntry;
  const id = entry.url.split("/").at(-1)!.replace(".html", "");
  return <Card title="原站示例逐项对照" description="每个入口保留原站名称与链接。已接入原始数据的示例仍需逐项验收；未实现的示例会明确显示待实现。">
    <div className="chart-parity__controls">
      <Select aria-label="选择原站示例" showSearch value={entry.url} options={chartReferenceExamples.map((item) => ({ value: item.url, label: `${item.url.split("/").at(-1)} · ${item.title}` }))} onChange={(value) => {
        if (typeof value !== "string") return;
        setParams((current) => { current.set("reference", value); return current; });
      }} />
      <a href={entry.url} target="_blank" rel="noreferrer">打开原站对照 ↗</a>
    </div>
    <p className="chart-parity__status">目录 {chartReferenceExamples.length} 个入口 · 原始数据对应实现 {implementedChartReferenceIds.length} 个（开发中） · 完整一致性验收通过 0 个</p>
    <ChartReferencePreview key={id} id={id} onNavigate={url=>setParams(current=>{current.set("reference",url);return current;})} />
  </Card>;
}

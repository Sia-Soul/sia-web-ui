import { useState } from "react";
import { BarChart, Button, LineChart, Slider } from "@sia.soul/sia-react-ui";
import type { BarReferenceFixture } from "./chartBarFixtures";

export function BarReferencePreview({ fixture, id }: { fixture: BarReferenceFixture; id: string }) {
  const [replay, setReplay] = useState(0);
  const [progress, setProgress] = useState<number>();
  const [kind, setKind] = useState("bar");
  const [stack, setStack] = useState<boolean>();
  const [editedSeries, setEditedSeries] = useState(fixture.series);
  const { magicTypes, gaps, ...chartProps } = fixture;
  const legendOrder = id === "bar5" ? ["利润","支出","收入"] : id === "bar6" ? ["支出","收入"] : fixture.legendOrder;
  const series = stack === false ? editedSeries.map(item=>({...item,stack:undefined})) : editedSeries;
  function restore() {setEditedSeries(fixture.series);setKind("bar");setStack(undefined);setProgress(undefined);setReplay(value=>value+1);}
  const toolbox = {
    orientation: ["bar2","bar15"].includes(id) ? "vertical" as const : "horizontal" as const,
    features: id === "bar14" ? ["dataView", "restore", "saveAsImage"] as const : ["mark", "dataView", "restore", "saveAsImage"] as const,
    magicTypes, activeMagicType:kind,
    onMagicTypeChange: (type: string) => {if(type === "line" || type === "bar") setKind(type); else if(type === "stack" || type === "tiled") setStack(type === "stack");},
    onRestore:restore,
  };
  const shared = {width:663,height:379,viewBoxSize:[663,379] as const,appearance:"macarons" as const,animationDuration:2000,animationDurationUpdate:500,animationProgress:progress,toolbox,calculable:true,tooltipTrigger:fixture.tooltipTrigger??"axis" as const};
  return <>
    <div className="chart-parity__controls"><Button onClick={()=>{setProgress(undefined);setReplay(value=>value+1);}}>重播入场动画</Button><Button onClick={()=>setProgress(1)}>查看最终帧</Button><span>{progress == null ? "实时播放" : `${Math.round(progress*2000)} ms / 2000 ms`}</span></div>
    <Slider aria-label="入场动画时间定位" min={0} max={2000} step={20} value={(progress??1)*2000} onChange={value=>setProgress(Number(value)/2000)} />
    <div className="chart-parity__viewport">
      {kind === "bar" ? <BarChart {...chartProps} {...shared} legendOrder={legendOrder} key={`${id}-${replay}`} series={series} onDataChange={setEditedSeries} stacked={stack} /> : <LineChart {...shared} key={`${id}-${replay}-line`} title={fixture.title} description={fixture.description} categories={fixture.categories} orientation={fixture.orientation} showLegend={fixture.showLegend} stacked={stack} series={series.map(item=>({name:item.name,color:item.color,stack:item.stack,curve:"smooth",hollowSymbol:true,data:item.data.map(datum=>typeof datum === "number" ? datum : datum.value)}))} onDataChange={next=>setEditedSeries(current=>current.map((item,index)=>({...item,data:item.data.map((datum,j)=>{const nextDatum=next[index]!.data[j]!;const value=typeof nextDatum === "number" ? nextDatum : nextDatum[1];return typeof datum === "number" ? value : {...datum,value};})})))} />}
    </div>
    <p className="chart-parity__status">待验收与差异：{gaps.join("；")}。当前不计入完整一致性通过数量。</p>
  </>;
}

import {useMemo,useState} from "react";
import {Button,FunnelChart,RadarChart,Slider} from "@sia-ui/react";
import {chartAdditionalFixtures} from "./chartAdditionalFixtures";
const palette=["#2ec7c9","#b6a2de","#5ab1ef","#ffb980","#d87a80","#8d98b3","#e5cf0d","#97b552","#95706d","#dc69aa"];
export function AdditionalReferencePreview({id}:{id:string}) {
 const fixture=chartAdditionalFixtures[id]!;
 const [replay,setReplay]=useState(0),[progress,setProgress]=useState<number>();
 const series=useMemo(()=>fixture.series?.map(({labelTemplate,...s})=>({...s,labelFormatter:labelTemplate?(item:{name:string;value:number})=>labelTemplate.replaceAll("{b}",item.name).replaceAll("{c}",String(item.value)):undefined})),[fixture]);
 const common={titleVerticalAlign:(id==="funnel3"||id==="funnel4"?"bottom":"top") as "top"|"bottom",title:fixture.title,description:fixture.description,width:663,height:379,viewBoxSize:[663,379] as [number,number],appearance:"macarons" as const,palette:fixture.palette??palette,legendOrder:fixture.legendOrder,legendLayout:fixture.legendLayout,animationDuration:2000,animationProgress:progress,toolbox:{orientation:(id==="funnel3"||id==="funnel4"?"vertical":"horizontal") as "vertical"|"horizontal",features:["mark","dataView","restore","saveAsImage"] as const,magicTypes:id==="funnel4"?["pie","funnel"]:[],onRestore:()=>{setProgress(undefined);setReplay(v=>v+1);}}};
 return <>
  <div className="chart-parity__controls"><Button onClick={()=>{setProgress(undefined);setReplay(v=>v+1);}}>重播入场动画</Button><Button onClick={()=>setProgress(1)}>查看最终帧</Button><span>{progress==null?"实时播放":`${Math.round(progress*2000)} ms / 2000 ms`}</span></div>
  <Slider aria-label="入场动画时间定位" min={0} max={2000} step={20} value={(progress??1)*2000} onChange={v=>setProgress(Number(v)/2000)}/>
  <div className="chart-parity__viewport">{fixture.kind==="funnel"?<FunnelChart key={replay} {...common} series={series}/>:<RadarChart key={replay} {...common} radars={fixture.radars}/>}</div>
  <p className="chart-parity__status">待验收与差异：{fixture.gaps.join("；")}。当前不计入完整一致性通过数量。</p>
 </>;
}

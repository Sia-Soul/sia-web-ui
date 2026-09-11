import { useState } from "react";
import { Button, ChartTimeline, PieChart, Slider } from "@sia-ui/react";
import type { PieReferenceFixture } from "./chartPieFixtures";

const palette=["#2ec7c9","#b6a2de","#5ab1ef","#ffb980","#d87a80","#8d98b3","#e5cf0d","#97b552","#95706d","#dc69aa"];
export function PieReferencePreview({id,fixture}:{id:string;fixture:PieReferenceFixture}) {
  const [replay,setReplay]=useState(0);
  const [progress,setProgress]=useState<number>();
  const [edited,setEdited]=useState(fixture.series!);
  const [month,setMonth]=useState(0);
  const {magicTypes,gaps,frames,...chartProps}=fixture;
  const series=id==="pie5"?edited.map((ring,index)=>({...ring,centerLabel:<><strong style={{fontSize:12,fontWeight:400,color:palette[index%palette.length]}}>{ring.data[1]!.name}</strong><span style={{fontSize:12,color:palette[0]}}>{100-ring.data[0]!.value}%</span></>})):edited;
  return <>
    <div className="chart-parity__controls"><Button onClick={()=>{setProgress(undefined);setReplay(value=>value+1);}}>重播入场动画</Button><Button onClick={()=>setProgress(1)}>查看最终帧</Button><span>{progress==null?"实时播放":`${Math.round(progress*2000)} ms / 2000 ms`}</span></div>
    <Slider aria-label="入场动画时间定位" min={0} max={2000} step={20} value={(progress??1)*2000} onChange={value=>setProgress(Number(value)/2000)} />
    <div className="chart-parity__viewport"><PieChart {...chartProps} key={`${id}-${replay}`} series={series} onDataChange={setEdited} legendLayout={{...fixture.legendLayout,itemGap:fixture.legendLayout?.orientation==="vertical"?(id==="pie6"?12:10):fixture.legendLayout?.itemGap}}
      ariaLabel={`${id} 原始数据对照图`} width={663} height={379} viewBoxSize={[663,379]} appearance="macarons" palette={palette} animationDuration={2000} animationProgress={progress} showGuideRings={["pie1","pie2","pie4"].includes(id)} selectedOffset={10}
      centerLabel={id==="pie6"?<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20}}><strong style={{fontSize:35,color:"rgba(30,144,255,.8)"}}>你幸福吗？</strong><span style={{fontSize:12,color:"#999"}}>From ExcelHome</span></div>:undefined}
      toolbox={{features:id==="pie5"?["dataView","restore","saveAsImage"]:["mark","dataView","restore","saveAsImage"],magicTypes,onRestore:()=>{setEdited(fixture.series!);setMonth(0);setProgress(undefined);setReplay(value=>value+1);}}} /></div>
    {frames?<ChartTimeline key={`timeline-${replay}`} labels={frames.map(frame=>frame.label)} value={month} onChange={index=>{setMonth(index);setEdited(frames[index]!.series);}} playInterval={2000}/>:null}
    <p className="chart-parity__status">待验收与差异：{gaps.join("；")}。当前不计入完整一致性通过数量。</p>
  </>;
}

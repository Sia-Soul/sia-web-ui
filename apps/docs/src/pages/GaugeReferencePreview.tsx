import {useEffect,useMemo,useState} from "react";
import {Button,GaugeChart,Slider} from "@sia-ui/react";
import {chartGaugeFixtures} from "./chartGaugeFixtures";
export function GaugeReferencePreview({id}:{id:string}){
 const fixture=chartGaugeFixtures[id]!;
 const [replay,setReplay]=useState(0),[progress,setProgress]=useState<number>(),[playing,setPlaying]=useState(false),[values,setValues]=useState(fixture.data.map(d=>d.value));
 useEffect(()=>{if(!playing)return;const timer=window.setInterval(()=>setValues(fixture.data.map(item=>Number(((item.min??0)+Math.random()*((item.max??100)-(item.min??0))).toFixed(2)))),2000);return()=>window.clearInterval(timer);},[playing,fixture]);
 const data=useMemo(()=>fixture.data.map(({labelMap,...item},i)=>({...item,value:values[i]!,labelFormatter:labelMap?(v:number)=>labelMap[String(v)]??"":undefined})),[fixture,values]);
 return <>
  <div className="chart-parity__controls"><Button onClick={()=>{setReplay(v=>v+1);setProgress(undefined);}}>重播入场动画</Button><Button onClick={()=>{setPlaying(false);setProgress(1);}}>查看最终帧</Button><Button onClick={()=>{setProgress(undefined);setPlaying(v=>!v);}}>{playing?"暂停动态数据":"播放动态数据"}</Button><span>{progress==null?"实时播放":`${Math.round(progress*2000)} ms / 2000 ms`}</span></div>
  <Slider aria-label="入场动画时间定位" min={0} max={2000} step={20} value={(progress??1)*2000} onChange={v=>{setPlaying(false);setProgress(Number(v)/2000);}}/>
  <div className="chart-parity__viewport"><GaugeChart key={replay} data={data} width={663} height={379} viewBoxSize={[663,379]} appearance="macarons" animationDuration={2000} animationProgress={progress} style={{background:fixture.background}} toolbox={{features:["mark","restore","saveAsImage"],onRestore:()=>{setPlaying(false);setValues(fixture.data.map(d=>d.value));setProgress(undefined);setReplay(v=>v+1);}}}/></div>
  <p className="chart-parity__status">待验收与差异：刻度文字、指针轮廓、发光及数值面板布局仍需校正；动态数据默认暂停以便对照，更新和入场特效尚未逐帧验收。当前不计入完整一致性通过数量。</p>
 </>;
}

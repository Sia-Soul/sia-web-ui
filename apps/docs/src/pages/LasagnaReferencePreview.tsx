import {useState} from 'react';
import {Button,PieChart} from '@sia-ui/react';
import type {PieSeries} from '@sia-ui/react';
import source from './chartLasagnaSource.json';

const names=['Chrome','Firefox','Safari','IE9+','IE8-'];
const factors=[128,64,32,16,8],initial=[80,160,320,640,1280];
// Reproduce the original finite data-generating rule without executing its callback.
export const lasagnaSeries:PieSeries[]=Array.from({length:30},(_,index)=>({
 name:'浏览器（数据纯属虚构）',center:[497.5,189],innerRadius:index*4+40,outerRadius:index*4+43,
 showLabels:index>28,labelLine:{show:index>28,length:20},
 data:names.map((name,column)=>({name,value:index*factors[column]!+initial[column]!})),
}));
export function LasagnaReferencePreview(){
 const [series,setSeries]=useState<readonly PieSeries[]>(lasagnaSeries),[replay,setReplay]=useState(0),[progress,setProgress]=useState<number>();
 const [pulseProgress,setPulseProgress]=useState<number>();
 return <div className="chart-lasagna">
  <div className="chart-parity__controls"><Button onClick={()=>{setReplay(value=>value+1);setProgress(undefined);setPulseProgress(undefined);}}>重播入场动画</Button><Button onClick={()=>setProgress(1)}>查看最终帧</Button><Button onClick={()=>setPulseProgress(.1)}>定格发光特效</Button><Button onClick={()=>setPulseProgress(undefined)}>播放发光特效</Button></div>
  <PieChart pulseRing={{progress:pulseProgress,center:[497.5,189],radius:40,scaleSize:12,color:"rgba(250,225,50,0.8)",shadowBlur:10,period:30}} key={replay} width={995} height={378} viewBoxSize={[995,378]} series={series} onDataChange={setSeries} appearance="macarons" animationProgress={progress} animationDuration={2000} title={source[0]!.option.title.text} description={source[0]!.option.title.subtext} titleAlign="right" titleVerticalAlign="bottom" legendLayout={{x:5,y:14,orientation:'vertical',align:'start'}} palette={['#2ec7c9','#b6a2de','#5ab1ef','#ffb980','#d87a80']} toolbox={{features:['mark','dataView','restore','saveAsImage'],onRestore:()=>setSeries(lasagnaSeries)}}/>
  <p className="chart-parity__status">已接入 · 开发中：原始30层150项数据、最外层标签、图例筛选、编辑还原、标线、循环发光及PNG导出已验证运行。待一致性验收：原站Canvas光晕栅格扩边与SVG模糊差异、特效层级和循环边界、扇区更新动画及精细字体布局。</p>
 </div>;
}

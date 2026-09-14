import {useState} from 'react';
import {Button,PieChart} from '@sia.soul/sia-react-ui';
import type {PieSeries} from '@sia.soul/sia-react-ui';
import source from './chartPersonalizedPieSource.json';

const option=source[0]!.option;
const datumLabel=(name:string,index:number)=>index!==1?{}:name==='必应'?{showLabel:false,showEmphasisLabel:true,labelLine:{show:false},emphasisLabelLine:{show:true,length:50}}:name==='百度'?{labelStyle:{fill:'rgba(30,144,255,0.8)',textAnchor:'middle' as const,dominantBaseline:'middle' as const,fontFamily:'微软雅黑',fontSize:30,fontWeight:'bolder'},labelLine:{length:40,style:{stroke:'#f0f',strokeWidth:3,strokeDasharray:'1 3'}}}:{};
export const personalizedPieSeries:PieSeries[]=option.series.map((series,index)=>({
 name:series.name,data:series.data.map(item=>({name:item.name,value:item.value,...datumLabel(item.name,index),...(index===1&&item.name==='百度'?{gradient:{center:[300,200] as const,innerRadius:110,outerRadius:140,stops:[{offset:0,color:'rgba(255,255,0,1)'},{offset:1,color:'rgba(30,144,250,1)'}]}}:{})})),
 labelFormatter:index===0?(_item,percent)=>`${percent.toFixed(0)}%`:undefined,
 emphasisLabelFormatter:index===0?(item,percent)=>`${item.name}\n${percent}%`:index===2?(_item,percent)=>`${percent}%`:undefined,
 emphasisLabelStyle:index===2?{fill:'red',fontSize:30,fontFamily:'微软雅黑',fontWeight:'bold'}:undefined,
 emphasisGradient:index===2?{center:[650,200],innerRadius:80,outerRadius:120,stops:[{offset:0,color:'rgba(255,255,0,1)'},{offset:1,color:'rgba(255,0,0,1)'}]}:undefined,
 center:[995*parseFloat(String(series.center[0]))/100,Number(series.center[1])],
 innerRadius:Array.isArray(series.radius)?series.radius[0]:0,
 outerRadius:Array.isArray(series.radius)?series.radius[1]:series.radius,
 startAngle:-(series.startAngle??90),clockwise:series.clockWise??true,
 labelPosition:index===0?'inside':'outside',showLabels:index!==2,emphasisLabel:index===2?'center':undefined,
}));
export function PersonalizedPieReferencePreview(){
 const [series,setSeries]=useState<readonly PieSeries[]>(personalizedPieSeries);
 const [replay,setReplay]=useState(0),[progress,setProgress]=useState<number>();
 return <div className="chart-personalized-pie">
  <div className="chart-parity__controls"><Button onClick={()=>{setReplay(value=>value+1);setProgress(undefined);}}>重播入场动画</Button><Button onClick={()=>setProgress(1)}>查看最终帧</Button></div>
  <PieChart calculable markPoints={[{name:"最大",value:1548,x:"80%",y:50,radius:32,color:"#dc69aa"}]} key={replay} width={995} height={378} viewBoxSize={[995,378]} series={series} onDataChange={setSeries} appearance="macarons" animationProgress={progress} animationDuration={2000} legendLayout={{x:5,y:14,orientation:'vertical',align:'start'}} palette={['#2ec7c9','#b6a2de','#5ab1ef','#ffb980','#d87a80','#8d98b3','#e5cf0d','#97b552','#95706d','#dc69aa']} toolbox={{features:['mark','dataView','restore','saveAsImage'],onRestore:()=>setSeries(personalizedPieSeries)}}/>
  <p className="chart-parity__status">已接入 · 开发中：原始三组数据、双中心、渐变与高亮标签、星形标注、扇区合并/容纳区域追加/孤岛回填、工具箱与动画已验证运行。待一致性验收：孤岛合并与滚轮调值、原站动画中间帧和更新过渡、合并后颜色/图例、长按时机与精细标签布局。</p>
 </div>;
}

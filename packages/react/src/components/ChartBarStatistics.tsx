import {useId,useState} from 'react';
import {ChartMark} from './Chart';
import type {BarLinearGradient} from './Charts';
export function ChartBarStatistics({values,kinds,project,plot,horizontal,color,gradient,seriesName}:{values:{average:number;min:number;max:number};kinds:readonly ('average'|'min'|'max')[];project:(value:number)=>number;plot:{x:number;y:number;width:number;height:number};horizontal:boolean;color:string;gradient?:BarLinearGradient;seriesName:string}){
 const id=useId().replaceAll(':','');const [active,setActive]=useState<string>();
 const paint=gradient?`url(#${id})`:color;
 return <g>
  {gradient?<defs><linearGradient id={id} gradientUnits="userSpaceOnUse" x1={gradient.start[0]} y1={gradient.start[1]} x2={gradient.end[0]} y2={gradient.end[1]}>{gradient.stops.map((stop,i)=><stop key={i} offset={stop.offset} stopColor={stop.color}/>)}</linearGradient></defs>:null}
  {kinds.map(kind=>{
   const value=values[kind],position=project(value),label=String(Number(value.toFixed(2))),name={average:'平均值',max:'最大值',min:'最小值'}[kind];
   const start=horizontal?[position,plot.y]:[plot.x,position],end=horizontal?[position,plot.y+plot.height]:[plot.x+plot.width,position];
   const width=active===kind?3.5:1.5;
   return <ChartMark key={kind} data-bar-statistic={kind} data-bar-statistic-value={value} label={`${seriesName} ${name} ${label}`} tooltip={<>{seriesName}<br/>{name}：{label}</>} tooltipPoint={[end[0]!,end[1]!]} onPointerMove={()=>setActive(kind)} onPointerLeave={()=>setActive(undefined)} onFocus={()=>setActive(kind)} onBlur={()=>setActive(undefined)}>
    <line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} stroke={paint} strokeWidth={width} strokeDasharray="5 5"/>
    <circle cx={start[0]} cy={start[1]} r={2} fill={paint} stroke={paint} strokeWidth={width}/>
    <path transform={`translate(${end[0]} ${end[1]})${horizontal?' rotate(90)':''}`} d="M0 0 L-8 -4 L-6 0 L-8 4 Z" fill={paint} stroke={paint} strokeWidth={width}/>
    <text x={end[0]!+6} y={end[1]!+4} fill={paint} style={{fontSize:12,fontFamily:'微软雅黑, Arial, Verdana, sans-serif'}}>{label}</text>
   </ChartMark>;
  })}
 </g>;
}

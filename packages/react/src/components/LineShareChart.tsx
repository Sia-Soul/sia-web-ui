import {forwardRef,useState} from 'react';
import {ChartLegend,ChartMark,SiaChart,svgArcPath} from './Chart';
import type {SiaChartProps,SiaChartRef} from './Chart';
import {linePath} from './Charts';
import {ChartPointMotion} from './ChartPointMotion';

/** 分时图的属性配置。 */
export interface LineShareChartProps extends Omit<SiaChartProps,'children'> {
 /** 用于渲染的数据集合。 */
 data:readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value:number}[];
 /**
  * 线条颜色。
  * @defaultValue '#2ec7c9'
  */
 lineColor?:string;
 /**
  * 分时图或共享数据区域的颜色。
  * @defaultValue '#b6a2de'
  */
 shareColor?:string;
}
/** A shifted area line and a masked share ring retain distinct displayed/raw values. */
export const LineShareChart=forwardRef<SiaChartRef,LineShareChartProps>(function LineShareChart({data,lineColor='#2ec7c9',shareColor='#b6a2de',...props},ref){
 const [selected,setSelected]=useState<number|null>(null);
 const [maskHovered,setMaskHovered]=useState(false);
 const width=props.viewBoxSize?.[0]??900,height=props.viewBoxSize?.[1]??450;
 const total=data.reduce((sum,item)=>sum+item.value,0),gap=data.length?Math.round(Math.max(...data.map(item=>item.value))-Math.min(...data.map(item=>item.value))):0;
 const maximum=data.reduce((best,item,i)=>item.value>=data[best]!.value?i:best,0);
 const active=selected!=null&&data[selected]?selected:maximum,item=data[active];
 const display=data.map(item=>item.value+gap),padded=display.length?[display[0]!,...display,display.at(-1)!]:[];
 const top=60,bottom=height-60,left=80,right=width-80,domainMax=Math.max(1,...display)*1.5;
 const points=padded.map((value,i)=>[left+i*(right-left)/Math.max(1,padded.length-1),bottom-value/domainMax*(bottom-top)] as const);
 const path=linePath(points,'smooth'),center=[width/2,height/2] as const;
 const ratio=item&&total?item.value/total:0,angle=ratio*Math.PI*2;
 const percent=Number((ratio*100).toFixed(2));
 return <SiaChart {...props} ref={ref} width={width} height={height} viewBoxSize={[width,height]} animation={false} empty={!data.length}>
  <ChartLegend x={10} y={20} align="start" orientation="vertical" items={[{name:'销量',color:lineColor},{name:'占比',color:shareColor}]}/>
  <rect x={left} y={top} width={right-left} height={bottom-top} fill="#ccc"/>
  {points.length?<><path d={`${path} L ${right} ${bottom} L ${left} ${bottom} Z`} fill={lineColor} fillOpacity={.5}/><path d={path} fill="none" stroke={lineColor} strokeWidth={2}/></>:null}
  {data.map((datum,i)=>{const point=points[i+1]!;return <ChartMark key={datum.name} label={`销量，${datum.name}，${display[i]}`} tooltip={<><strong>销量</strong><span>{datum.name} : {display[i]}</span></>} tooltipPoint={point} onPointerMove={()=>setSelected(i)} onFocus={()=>setSelected(i)}>
   {i===active?<path data-share-active={datum.name} d={`M ${point[0]} ${point[1]-10} l 10 10 -10 10 -10 -10 Z`} fill="#fff" stroke={lineColor} strokeWidth={2}/>:<circle cx={point[0]} cy={point[1]} r={6} fill="#fff" stroke={lineColor} strokeWidth={2}/>}
  </ChartMark>;})}
  <path data-share-mask="" d={svgArcPath(center[0],center[1],180,0,Math.PI*2,100)} fill={maskHovered?'rgba(0,0,0,0)':'#fff'} pointerEvents="all" onPointerEnter={()=>setMaskHovered(true)} onPointerLeave={()=>setMaskHovered(false)}/>
  <path d={svgArcPath(center[0],center[1],125,0,Math.PI*2,110)} fill="#fff" pointerEvents="none"/>
  {item?<><ChartMark label={`占比，${item.name}，${item.value}`} tooltip={<><span>总量 : {total}</span><span>{item.name} : {item.value}</span><span>占比 : {percent}%</span></>} tooltipPoint={[center[0],center[1]+120]}>
   <ChartPointMotion points={[[0,angle]]} enabled={props.animation!==false} animateInitial={false} duration={0} updateDuration={500}>{frame=>{
    const shownAngle=frame[0]?.[1]??angle;
    return <path data-share-ring="" data-share-angle={shownAngle} d={svgArcPath(center[0],center[1],125,Math.PI/2-shownAngle/2,Math.PI/2+shownAngle/2,110)} fill={shareColor}/>;
   }}</ChartPointMotion>
  </ChartMark><text data-share-label="" x={center[0]} y={center[1]+145} textAnchor="middle" fontSize={15} fill="#1e90ff" pointerEvents="none"><tspan x={center[0]}>{item.name} : {item.value}</tspan><tspan x={center[0]} dy={26}>( {percent}% )</tspan></text></>:null}
 </SiaChart>;
});

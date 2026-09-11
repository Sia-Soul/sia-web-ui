import {useCallback,useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,SiaChart,SvgMapPlot} from '@sia-ui/react';
import type {ChartCompositeRef} from '@sia-ui/react';
import source from './chartFootballTimelineSource.json';
import pitch from './chartFootball.svg?raw';
import {createFootballTimelineData,footballTimelineLabel} from './chartFootballTimelineData';
const option=source[0]!.option,base=option.options[0]!,labels=option.timeline.data.map(footballTimelineLabel);
const height=430,width=841.89*height/595.275,left=Math.floor((1000-width)/2);
export function FootballTimelineReferencePreview(){
 const [frames]=useState(()=>createFootballTimelineData(option.options)),[index,setIndex]=useState(0),[error,setError]=useState('');
 const [grassValue,setGrassValue]=useState<number|null>(null);
 const changeFrame=useCallback((next:number)=>{setIndex(next);setGrassValue(null);},[]);
 const frame=frames[index]!,chart=useRef<ChartCompositeRef>(null);
 return <div className="chart-football-timeline" data-frame={index}><ChartComposite ref={chart} width={1000} height={600} style={{background:base.backgroundColor}} ariaLabel="map19 足球战术时间轴" layers={[
  {key:'pitch',content:<SiaChart width={1000} height={600} viewBoxSize={[1000,600]} title={base.title!.text} description={<a href={base.title!.sublink} target="_blank" rel="noreferrer">{base.title!.subtext}</a>} animation={false}
   timeline={{renderer:'nodes',labels,value:index,onChange:changeFrame,autoPlay:true,playInterval:500,x:80,y:540,width:840}}
   toolbox={{features:['mark','dataView','restore','saveAsImage'],dataView:<ChartDataEditor allowNull series={[{name:'草地',data:[grassValue]}]} onApply={rows=>setGrassValue(rows[0]![0]!)}/>,onRestore:()=>{setGrassValue(null);setError('');},onSaveAsImage:()=>chart.current?.saveAsImage('map19').catch(reason=>setError(String(reason)))}}>
   <SvgMapPlot source={pitch} name={base.title!.text} data={[{name:'草地',value:grassValue??undefined,hoverable:false,showLabel:false}]} x={left} y={30} width={width} height={height} domain={[0,100]} colors={['blue','red']} roam={false} showLabels={false} lineAnimation pointAnimation pointEntrance pointAnimationEasing="exponential-out"
    markPoints={frame.points.map(point=>({id:point.name,name:point.name,value:point.value,coordinate:point.coordinate,color:point.color,symbol:'circle',size:point.size,borderWidth:point.borderWidth,effect:false,label:point.label.show===false?undefined:point.value,labelColor:point.label.textStyle?.color??'#fff',fontSize:Number(point.label.textStyle?.fontSize??12)}))}
    markLines={frame.lines.map(line=>({id:'pass',name:line.name,source:line.source,target:line.target,color:line.color,effectColor:line.effect.color,period:line.effect.period,effectRadius:line.effect.scaleSize,shadowBlur:line.effect.scaleSize}))}/>
  </SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：12 帧原始球员与传球数据、500ms 时间轴、球员缩放入场与位置更新、线路逐段绘制、数据视图及还原已接入。SVG 光点拖尾与原站 Canvas 模糊合成、初始自动播放调度及完整视觉一致性仍未通过验收。</p></div>;
}

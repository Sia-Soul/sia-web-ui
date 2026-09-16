import { withTitleTooltip } from "./titleTooltip";
import {useEffect,useRef,useState} from 'react';
import type {ChartTimelineProps} from './Chart';
import {nearestTimelineIndex,timelineRatios} from './timelinePositions';
import {ChartPointMotion} from './ChartPointMotion';
/** SVG timeline shares the chart coordinate space and is preserved by SVG/PNG export. */
export function ChartNodeTimeline({labels,dates,value,onChange,autoPlay=false,playInterval=2000,loop=true,x=80,y=520,width=840}:ChartTimelineProps){
 const [playing,setPlaying]=useState(autoPlay),dragging=useRef<number>();
 const [draft,setDraft]=useState<number>(),pending=useRef<ReturnType<typeof setTimeout>>(),draftRef=useRef<number>();
 const shown=draft??value;
 const cancelPending=()=>{clearTimeout(pending.current);pending.current=undefined;draftRef.current=undefined;setDraft(undefined);};
 useEffect(()=>()=>clearTimeout(pending.current),[]);
 useEffect(()=>{cancelPending();},[value]);
 const preview=(index:number)=>{if(index===(draftRef.current??value))return;clearTimeout(pending.current);draftRef.current=index;setDraft(index);pending.current=setTimeout(()=>{pending.current=undefined;onChange(index);setDraft(undefined);draftRef.current=undefined;},200);};
 useEffect(()=>setPlaying(autoPlay),[autoPlay]);
 useEffect(()=>{if(!playing||labels.length<2)return;const timer=window.setTimeout(()=>{
  if(value+1<labels.length)onChange(value+1);else if(loop)onChange(0);else setPlaying(false);
 },Math.max(120,playInterval));return ()=>window.clearTimeout(timer);},[playing,value,labels.length,playInterval,loop,onChange]);
 const select=(index:number)=>{cancelPending();if(index===value)return;setPlaying(false);onChange(index);};
 const step=(delta:number)=>{cancelPending();setPlaying(false);onChange((shown+delta+labels.length)%labels.length);};
 const start=x+100,end=x+width,ratios=timelineRatios(labels.length,dates),position=(index:number)=>start+(end-start)*(ratios[index]??0);
 const activate=(action:()=>void)=>({onClick:action,onKeyDown:(event:React.KeyboardEvent<SVGGElement>)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action();}}});
 const find=(clientX:number,clientY:number,element:SVGElement)=>{const matrix=element.ownerSVGElement?.getScreenCTM();if(!matrix)return value;const p=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());return nearestTimelineIndex(ratios,(p.x-start)/(end-start));};
 return <g data-chart-node-timeline="" aria-label="图表时间轴" fontSize={12} fill="#666">
  <g role="button" tabIndex={0} aria-label="上一年" {...withTitleTooltip(activate(()=>step(-1)))}><rect x={x} y={y-14} width={24} height={28} fill="transparent"/><path d={`M${x+17} ${y-7} L${x+7} ${y} L${x+17} ${y+7}`} fill="none" stroke="#666" strokeWidth={2}/></g>
  <g role="button" tabIndex={0} aria-label={playing?'暂停时间轴':'播放时间轴'} {...withTitleTooltip(activate(()=>{cancelPending();if(playing)setPlaying(false);else{onChange((shown+1)%labels.length);setPlaying(true);}}))}><rect x={x+30} y={y-14} width={24} height={28} fill="transparent"/>{playing?<path d={`M${x+37} ${y-7} V${y+7} M${x+47} ${y-7} V${y+7}`} fill="none" stroke="#666" strokeWidth={3}/>:<path d={`M${x+36} ${y-8} L${x+50} ${y} L${x+36} ${y+8} Z`}/>}</g>
  <g role="button" tabIndex={0} aria-label="下一年" {...withTitleTooltip(activate(()=>step(1)))}><rect x={x+60} y={y-14} width={24} height={28} fill="transparent"/><path d={`M${x+67} ${y-7} L${x+77} ${y} L${x+67} ${y+7}`} fill="none" stroke="#666" strokeWidth={2}/></g>
  <line x1={start} x2={end} y1={y} y2={y} stroke="#666" strokeWidth={1} strokeDasharray="5 5"/>
  {labels.map((label,index)=><g key={index} role="button" tabIndex={0} aria-label={`年份 ${label}`} aria-pressed={value===index} {...withTitleTooltip(activate(()=>select(index)))}><rect x={position(index)-20} y={y-12} width={40} height={40} fill="transparent"/><path data-timeline-node={index} d={`M${position(index)} ${y-4} L${position(index)+4} ${y} L${position(index)} ${y+4} L${position(index)-4} ${y} Z`} fill="#fff" stroke="#666"/><text x={position(index)} y={y+24} textAnchor="middle">{label}</text></g>)}
  <g role="slider" tabIndex={0} aria-label="图表时间轴" aria-valuemin={0} aria-valuemax={Math.max(0,labels.length-1)} aria-valuenow={shown} aria-valuetext={labels[shown]} style={{cursor:'ew-resize',touchAction:'none'}}
   onKeyDown={event=>{const next=event.key==='Home'?0:event.key==='End'?labels.length-1:event.key==='ArrowLeft'?Math.max(0,value-1):event.key==='ArrowRight'?Math.min(labels.length-1,value+1):undefined;if(next!==undefined){event.preventDefault();select(next);}}}
   onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();setPlaying(false);dragging.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);}}
   onPointerMove={event=>{if(dragging.current===event.pointerId)preview(find(event.clientX,event.clientY,event.currentTarget));}}
   onPointerUp={event=>{dragging.current=undefined;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
   onPointerCancel={()=>{dragging.current=undefined;cancelPending();}} onLostPointerCapture={()=>{if(dragging.current!==undefined)cancelPending();dragging.current=undefined;}}>
   <ChartPointMotion points={[[position(shown),y]]} enabled={draft===undefined} duration={500} updateDuration={500} animateInitial={false} easing="exponential-out">{points=>{const [px,py]=points[0]!;return <path data-timeline-checkpoint="" data-timeline-target={position(shown)} data-timeline-position={px} d={`M${px} ${py-6} L${px+6} ${py} L${px} ${py+6} L${px-6} ${py} Z`} fill="#1e90ff" stroke="#fff" strokeWidth={0}/>;}}</ChartPointMotion>
  </g>
 </g>;
}

import { withTitleTooltip } from "./titleTooltip";
import {useEffect,useId,useRef,useState} from 'react';
import {chartColorRamp} from './chartColorRamp';
import type {PointerEvent} from 'react';
import type {ChartVerticalRangeProps} from './ChartVerticalRange';
/** High-to-low horizontal SVG range, with independently draggable bounds and interval. */
export function ChartHorizontalRange({min,max,x,y,length,thickness,colors,range,endLabels,onChange,indicatorValue,onHoverRange,realtime=true}:ChartVerticalRangeProps){
 const id=useId().replaceAll(':',''),span=max-min;
 const drag=useRef<{id:number;kind:0|1|2;x:number;range:[number,number]}>();
 const [draft,setDraft]=useState<[number,number]>(),pending=useRef<[number,number]>();
 const cancel=()=>{drag.current=undefined;pending.current=undefined;setDraft(undefined);};
 useEffect(()=>{if(!realtime)cancel();},[range[0],range[1],min,max,realtime]);
 const shown=draft??range,low=Math.max(min,Math.min(max,shown[0])),high=Math.max(low,Math.min(max,shown[1]));
 const position=(value:number)=>x+(span>0?(max-value)/span:0)*length;
 const color=(value:number)=>chartColorRamp(colors,span>0?(value-min)/span:0);
 const preview=(next:[number,number])=>{if(realtime)onChange?.(next);else{pending.current=next;setDraft(next);}};
 const localX=(event:PointerEvent<SVGElement>)=>{const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();return matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()).x:event.clientX;};
 const handlers=(kind:0|1|2)=>({
  onPointerDown:(event:PointerEvent<SVGElement>)=>{if(event.button!==0||span<=0||length<=0)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,kind,x:localX(event),range:[low,high]};},
  onPointerLeave:()=>onHoverRange?.(undefined),
  onPointerMove:(event:PointerEvent<SVGElement>)=>{
   if(kind===2){const value=max-(localX(event)-x)/length*span;onHoverRange?.([value-.05*span,value+.05*span]);}
   const start=drag.current;if(!start||start.id!==event.pointerId)return;
   const delta=-(localX(event)-start.x)/length*span;
   if(start.kind===2){const shift=Math.max(min-start.range[0],Math.min(max-start.range[1],delta));preview([start.range[0]+shift,start.range[1]+shift]);}
   else if(start.kind===0)preview([Math.max(min,Math.min(start.range[1],start.range[0]+delta)),start.range[1]]);
   else preview([start.range[0],Math.min(max,Math.max(start.range[0],start.range[1]+delta))]);
  },
  onPointerUp:(event:PointerEvent<SVGElement>)=>{const next=pending.current;cancel();if(next&&!realtime)onChange?.(next);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);},
  onPointerCancel:cancel,onLostPointerCapture:cancel,
 });
 return <g className="sia-chart__visual-map" aria-label={'值域 '+min+' 至 '+max} style={{touchAction:'none'}}>
  <defs><linearGradient id={id} x1="1" y1="0" x2="0" y2="0">{colors.map((color,index)=><stop key={index} offset={index/Math.max(1,colors.length-1)} stopColor={color}/>)}</linearGradient></defs>
  <rect data-range-track="" x={x} y={y} width={length} height={thickness} fill={'url(#'+id+')'}/>
  <text x={x-10} y={y+thickness/2} dominantBaseline="central" textAnchor="end">{endLabels?.[1]??max}</text><text x={x+length+10} y={y+thickness/2} dominantBaseline="central">{endLabels?.[0]??min}</text>
  <rect x={x} y={y} width={Math.max(0,position(high)-x)} height={thickness} fill="#ccc" pointerEvents="none"/>
  <rect x={position(low)} y={y} width={Math.max(0,x+length-position(low))} height={thickness} fill="#ccc" pointerEvents="none"/>
  <rect data-range-selection="" x={position(high)} y={y} width={Math.max(0,position(low)-position(high))} height={thickness} fill="transparent" style={{cursor:'move'}} {...withTitleTooltip(handlers(2))}/>
  {([0,1] as const).map(index=>{const value=index===0?low:high,px=position(value),direction=index===0?1:-1;
   return <g key={index} role="slider" aria-label={'值域'+(index===0?'下限':'上限')} aria-valuemin={index===0?min:low} aria-valuemax={index===0?high:max} aria-valuenow={value} aria-orientation="horizontal" tabIndex={0} style={{cursor:'ew-resize',pointerEvents:'all'}} {...withTitleTooltip(handlers(index))} onKeyDown={event=>{
    const step=span/100,next=event.key==='Home'?min:event.key==='End'?max:['ArrowUp','ArrowLeft'].includes(event.key)?value+step:['ArrowDown','ArrowRight'].includes(event.key)?value-step:undefined;
    if(next!==undefined){event.preventDefault();onChange?.(index===0?[Math.max(min,Math.min(high,next)),high]:[low,Math.min(max,Math.max(low,next))]);}
   }}>
    <path d={'M'+px+' '+y+' L'+px+' '+(y+thickness+12)+' L'+(px+direction*12)+' '+(y+thickness+12)+' L'+(px+direction)+' '+(y+thickness)+' L'+(px+direction)+' '+y+' Z'} fill={color(value)}/>
    <text x={px+direction*6} y={y+thickness+26} textAnchor="middle" fill="#333" pointerEvents="none">{Math.round(value)}</text>
   </g>;
  })}
  {indicatorValue!==undefined&&Number.isFinite(indicatorValue)?<g data-range-indicator={indicatorValue} transform={'translate('+position(Math.max(min,Math.min(max,indicatorValue)))+' '+y+')'} pointerEvents="none">
   <path d="M0 0 L-5 -5 L5 -5 Z" fill={color(Math.max(min,Math.min(max,indicatorValue)))}/><text y={-10} textAnchor="middle" fill="#333">{indicatorValue.toFixed(0)}</text>
  </g>:null}
 </g>;
}

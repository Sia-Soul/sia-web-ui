import {useEffect,useId,useRef,useState} from 'react';
import {chartColorRamp} from './chartColorRamp';
import type {PointerEvent} from 'react';

export interface ChartVerticalRangeProps {
 min:number;max:number;x:number;y:number;length:number;thickness:number;
 colors:readonly string[];range:readonly [number,number];
 indicatorValue?:number;
 realtime?:boolean;
 readOnly?:boolean;
 onHoverRange?:(range:readonly [number,number]|undefined)=>void;
 endLabels?:readonly [string,string];onChange?:(range:[number,number])=>void;
}
/** SVG-only value handles and draggable interval, also retained in image exports. */
export function ChartVerticalRange({min,max,x,y,length,thickness,colors,range,endLabels,onChange,indicatorValue,onHoverRange,realtime=true,readOnly=false}:ChartVerticalRangeProps){
 const id=useId().replaceAll(':','');
 const drag=useRef<{id:number;kind:0|1|2;y:number;range:[number,number]}>();
 const [draft,setDraft]=useState<[number,number]>();
 const pending=useRef<[number,number]>();
 const cancel=()=>{drag.current=undefined;pending.current=undefined;setDraft(undefined);};
 useEffect(()=>{if(!realtime)cancel();},[range[0],range[1],min,max,realtime]);
 const shown=draft??range;
 const low=Math.max(min,Math.min(max,shown[0])),high=Math.max(low,Math.min(max,shown[1]));
 const preview=(next:[number,number])=>{if(realtime)onChange?.(next);else{pending.current=next;setDraft(next);}};
 const span=max-min,position=(value:number)=>y+(span>0?(max-value)/span:0)*length;
 const localY=(event:PointerEvent<SVGElement>)=>{
  const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();
  return matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()).y:event.clientY;
 };
 const setValue=(index:0|1,value:number)=>onChange?.(index===0?[Math.max(min,Math.min(high,value)),high]:[low,Math.min(max,Math.max(low,value))]);
 const handlers=(kind:0|1|2)=>({
  onPointerDown:(event:PointerEvent<SVGElement>)=>{if(readOnly||event.button!==0||span<=0)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,kind,y:localY(event),range:[low,high]};},
  onPointerLeave:()=>onHoverRange?.(undefined),
  onPointerMove:(event:PointerEvent<SVGElement>)=>{
   if(kind===2){const value=max-(localY(event)-y)/length*span;onHoverRange?.([value-.05*span,value+.05*span]);}
   const start=drag.current;if(!start||start.id!==event.pointerId)return;
   const delta=-(localY(event)-start.y)/length*span;
   if(start.kind===2){const shift=Math.max(min-start.range[0],Math.min(max-start.range[1],delta));preview([start.range[0]+shift,start.range[1]+shift]);}
   else if(start.kind===0)preview([Math.max(min,Math.min(start.range[1],start.range[0]+delta)),start.range[1]]);
   else preview([start.range[0],Math.min(max,Math.max(start.range[0],start.range[1]+delta))]);
  },
  onPointerUp:(event:PointerEvent<SVGElement>)=>{const next=pending.current;cancel();if(next&&!realtime)onChange?.(next);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);},
  onPointerCancel:cancel,onLostPointerCapture:cancel,
 });
 const color=(value:number)=>chartColorRamp(colors,span>0?(value-min)/span:0);
 return <g className="sia-chart__visual-map" aria-label={`值域 ${min} 至 ${max}`} style={{touchAction:'none'}}>
  <defs><linearGradient id={id} x1="0" y1="1" x2="0" y2="0">{colors.map((color,index)=><stop key={index} offset={index/Math.max(1,colors.length-1)} stopColor={color}/>)}</linearGradient></defs>
  <rect data-range-track="" x={x} y={y} width={thickness} height={length} fill={`url(#${id})`}/>
  <text x={x} y={y+length+16}>{endLabels?.[0]??min}</text><text x={x} y={y-5}>{endLabels?.[1]??max}</text>
  <rect x={x} y={y} width={thickness} height={Math.max(0,position(high)-y)} fill="#ccc" pointerEvents="none"/>
  <rect x={x} y={position(low)} width={thickness} height={Math.max(0,y+length-position(low))} fill="#ccc" pointerEvents="none"/>
  <rect data-range-selection="" x={x} y={position(high)} width={thickness} height={Math.max(0,position(low)-position(high))} fill="transparent" style={{cursor:readOnly?'default':'move'}} {...handlers(2)}/>
  {!readOnly&&([0,1] as const).map(index=>{const value=index===0?low:high,py=position(value),direction=index===0?1:-1;
   return <g key={index} role="slider" aria-label={`值域${index===0?'下限':'上限'}`} aria-valuemin={index===0?min:low} aria-valuemax={index===0?high:max} aria-valuenow={value} aria-orientation="vertical" tabIndex={0} style={{cursor:'ns-resize',pointerEvents:'all'}} {...handlers(index)} onKeyDown={event=>{
    const step=span/100;const next=event.key==='Home'?min:event.key==='End'?max:['ArrowUp','ArrowRight'].includes(event.key)?value+step:['ArrowDown','ArrowLeft'].includes(event.key)?value-step:undefined;
    if(next!==undefined){event.preventDefault();setValue(index,next);}
   }}>
    <path d={`M${x} ${py} L${x+thickness+12} ${py} L${x+thickness+12} ${py+direction*12} L${x+thickness} ${py+direction} L${x} ${py+direction} Z`} fill={color(value)}/>
    <text x={x+thickness+18} y={py+direction*6} dominantBaseline="central" fill="#333" pointerEvents="none">{Math.round(value)}</text>
   </g>;
  })}
  {indicatorValue!==undefined&&Number.isFinite(indicatorValue)?<g data-range-indicator={indicatorValue} transform={`translate(${x+thickness} ${position(Math.max(min,Math.min(max,indicatorValue)))})`} pointerEvents="none">
   <path d="M0 0 L5 -5 L5 5 Z" fill={color(Math.max(min,Math.min(max,indicatorValue)))}/>
   <text x={10} dominantBaseline="central" fill="#333">{indicatorValue.toFixed(0)}</text>
  </g>:null}
 </g>;
}

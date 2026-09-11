import {useEffect,useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import {ChartMark,type ChartMarkProps} from './Chart';

/** Vertical translation leaves the event's time coordinates and values intact. */
export function EventRiverBubble({resetKey,draggable=true,tooltipPoint,onPointerUp,...props}:ChartMarkProps&{resetKey:string;draggable?:boolean}){
 const [offset,setOffset]=useState(0);
 const drag=useRef<{id:number;start:number;offset:number;moved:boolean}>();
 useEffect(()=>{setOffset(0);drag.current=undefined;},[resetKey]);
 const coordinate=(event:PointerEvent<SVGGElement>)=>{
  const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();
  return matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()).y:event.clientY;
 };
 return <ChartMark {...props} transform={`translate(0 ${offset})`} data-event-offset={offset}
  style={{...props.style,cursor:draggable?'ns-resize':props.style?.cursor,touchAction:draggable?'none':props.style?.touchAction}}
  tooltipPoint={tooltipPoint?[tooltipPoint[0],tooltipPoint[1]+offset]:undefined}
  onPointerDown={event=>{props.onPointerDown?.(event);if(!draggable||event.button!==0||event.defaultPrevented)return;drag.current={id:event.pointerId,start:coordinate(event),offset,moved:false};event.currentTarget.setPointerCapture(event.pointerId);}}
  onPointerMove={event=>{const active=drag.current;if(active?.id===event.pointerId){const delta=coordinate(event)-active.start;if(Math.abs(delta)>3)active.moved=true;if(active.moved)setOffset(active.offset+delta);}props.onPointerMove?.(event);}}
  onPointerUp={event=>{const active=drag.current;drag.current=undefined;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(!active?.moved)onPointerUp?.(event);}}
  onPointerCancel={event=>{if(drag.current)setOffset(drag.current.offset);drag.current=undefined;props.onPointerCancel?.(event);}}
  onLostPointerCapture={event=>{drag.current=undefined;props.onLostPointerCapture?.(event);}}
 />;
}

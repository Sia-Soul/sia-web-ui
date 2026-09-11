import {useRef,useState} from 'react';
import type {PointerEvent,CSSProperties} from 'react';
export interface ChartBrushProps{
 selectionShape?:'band'|'rectangle';
 selectionStyle?:CSSProperties;
 /** Minimum accepted width and height in SVG coordinates. Omitted preserves the 4px horizontal gesture threshold. */
 minSelectionSize?:readonly [number,number];
 bounds:{x:number;y:number;width:number;height:number};
 onSelect:(range:readonly [number,number])=>void;
 onCancel?:()=>void;
}
/** Horizontal category brush. Output fractions are relative to the current plot. */
export function ChartBrush({bounds,onSelect,onCancel,selectionShape='band',selectionStyle,minSelectionSize}:ChartBrushProps){
 const [vertical,setVertical]=useState<readonly [number,number]|null>(null);
 const startY=useRef(0);
 const y=(event:PointerEvent<SVGRectElement>)=>{const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();return matrix?Math.max(bounds.y,Math.min(bounds.y+bounds.height,new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()).y)):bounds.y;};
 const drag=useRef<{id:number;start:number;clientX:number}|null>(null);
 const [selection,setSelection]=useState<readonly [number,number]|null>(null);
 const x=(event:PointerEvent<SVGRectElement>)=>{
  const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();
  if(!matrix)return null;
  return Math.max(bounds.x,Math.min(bounds.x+bounds.width,new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()).x));
 };
 const cancel=()=>{drag.current=null;setSelection(null);setVertical(null);};
 return <g>
  <rect data-chart-brush="" tabIndex={0} role="group" aria-label="拖动框选缩放，Escape取消" {...bounds} fill="transparent" style={{cursor:'crosshair',touchAction:'none',pointerEvents:'all'}}
   onKeyDown={event=>{if(event.key==='Escape'){cancel();onCancel?.();}}}
   onPointerDown={event=>{if(event.button!==0)return;const start=x(event);if(start===null)return;event.stopPropagation();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,start,clientX:event.clientX};startY.current=y(event);setVertical([startY.current,startY.current]);setSelection([start,start]);}}
   onPointerMove={event=>{if(drag.current?.id!==event.pointerId)return;const end=x(event);if(end!==null){setSelection([drag.current.start,end]);setVertical([startY.current,y(event)]);}}}
   onPointerCancel={cancel}
   onLostPointerCapture={cancel}
   onPointerUp={event=>{const current=drag.current,end=x(event),endY=y(event);cancel();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(!current||current.id!==event.pointerId||end===null||bounds.width<=0)return;if(minSelectionSize?(Math.abs(end-current.start)<minSelectionSize[0]||Math.abs(endY-startY.current)<minSelectionSize[1]):Math.abs(event.clientX-current.clientX)<4)return;onSelect([(Math.min(current.start,end)-bounds.x)/bounds.width,(Math.max(current.start,end)-bounds.x)/bounds.width]);}}/>
  {selection?<rect data-chart-brush-selection="" style={selectionStyle} x={Math.min(...selection)} y={selectionShape==='rectangle'&&vertical?Math.min(...vertical):bounds.y} width={Math.abs(selection[1]-selection[0])} height={selectionShape==='rectangle'&&vertical?Math.abs(vertical[1]-vertical[0]):bounds.height} fill="#1677ff" fillOpacity={.15} stroke="#1677ff" pointerEvents="none"/>:null}
 </g>;
}

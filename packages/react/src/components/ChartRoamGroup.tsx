import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {zoomChartViewport} from './chartRoam';
const initial={x:0,y:0,scale:1};
export function ChartRoamGroup({children,enabled,width,height,zoomEnabled=true,ariaLabel,resetSignal=0}:{children:ReactNode;enabled:boolean;width:number;height:number;zoomEnabled?:boolean;ariaLabel?:string;resetSignal?:number}) {
 const group=useRef<SVGGElement>(null),drag=useRef<{id:number;x:number;y:number}>();
 const [view,setView]=useState(initial);
 useEffect(()=>{setView(initial);drag.current=undefined;},[resetSignal]);
 const point=(clientX:number,clientY:number):readonly [number,number]=>{
  const matrix=group.current?.ownerSVGElement?.getScreenCTM();
  if(!matrix)return [clientX,clientY];
  const local=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());return [local.x,local.y];
 };
 useEffect(()=>{
  const target=group.current;if(!target||!enabled||!zoomEnabled)return;
  const wheel=(event:WheelEvent)=>{event.preventDefault();const at=point(event.clientX,event.clientY);setView(current=>zoomChartViewport(current,Math.exp(-event.deltaY*.0015),at));};
  target.addEventListener('wheel',wheel,{passive:false});return ()=>target.removeEventListener('wheel',wheel);
 },[enabled,zoomEnabled]);
 if(!enabled)return <>{children}</>;
 return <g ref={group} role="group" aria-label={ariaLabel??"树图漫游画布：方向键平移，加减键缩放，Home 还原"} tabIndex={0} style={{touchAction:'none',cursor:drag.current?'grabbing':'grab'}}
  onPointerDown={event=>{if(event.button!==0)return;const p=point(event.clientX,event.clientY);drag.current={id:event.pointerId,x:p[0],y:p[1]};event.currentTarget.setPointerCapture(event.pointerId);}}
  onPointerMove={event=>{const previous=drag.current;if(!previous||previous.id!==event.pointerId)return;const p=point(event.clientX,event.clientY);setView(v=>({...v,x:v.x+p[0]-previous.x,y:v.y+p[1]-previous.y}));drag.current={id:event.pointerId,x:p[0],y:p[1]};}}
  onPointerUp={event=>{drag.current=undefined;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
  onPointerCancel={()=>{drag.current=undefined;}}
  onKeyDown={event=>{if(event.target!==event.currentTarget)return;const steps:Record<string,readonly [number,number]>={ArrowLeft:[-40,0],ArrowRight:[40,0],ArrowUp:[0,-40],ArrowDown:[0,40]};const step=steps[event.key];if(step){event.preventDefault();setView(v=>({...v,x:v.x+step[0],y:v.y+step[1]}));}else if(event.key==='Home'||(zoomEnabled&&['+','=','-'].includes(event.key))){event.preventDefault();setView(v=>event.key==='Home'?initial:zoomChartViewport(v,event.key==='-'?1/1.2:1.2,[width/2,height/2]));}}}>
  <rect width={width} height={height} fill="transparent"/>
  <g className="sia-chart__roam-content" transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>{children}</g>
 </g>;
}

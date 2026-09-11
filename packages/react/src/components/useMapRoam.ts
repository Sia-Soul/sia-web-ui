import {useEffect,useRef,useState} from 'react';
import type {KeyboardEvent,PointerEvent} from 'react';
import {zoomChartViewport} from './chartRoam';
import type {ChartScaleLimit} from './chartRoam';

const initial={x:0,y:0,scale:1};
export function useMapRoam(mode:boolean|'move'|'scale',scaleLimit:ChartScaleLimit|null={min:.65,max:5},wheelFactors:readonly [number,number]=[1.12,.9]){
 const [zoomIn,zoomOut]=wheelFactors;
 const min=scaleLimit?.min,max=scaleLimit?.max,unlimited=scaleLimit===null;
 const host=useRef<SVGGElement>(null);
 const [view,setView]=useState(initial);
 const drag=useRef<{id:number;x:number;y:number;clientX:number;clientY:number;viewX:number;viewY:number;moved:boolean}>();
 const local=(x:number,y:number)=>{
  const matrix=host.current?.ownerSVGElement?.getScreenCTM();
  return matrix?new DOMPoint(x,y).matrixTransform(matrix.inverse()):new DOMPoint(x,y);
 };
 useEffect(()=>{
  const node=host.current;if(!node||!mode||mode==='move')return;
  const wheel=(event:WheelEvent)=>{
   event.preventDefault();event.stopPropagation();const point=local(event.clientX,event.clientY);
   setView(current=>zoomChartViewport(current,event.deltaY<0?zoomIn:zoomOut,[point.x,point.y],unlimited?null:{min,max}));
  };
  node.addEventListener('wheel',wheel,{passive:false});
  return ()=>node.removeEventListener('wheel',wheel);
 },[mode,min,max,unlimited,zoomIn,zoomOut]);
 const finish=(event:PointerEvent<SVGGElement>)=>{
  const previous=drag.current;drag.current=undefined;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(previous?.moved)event.stopPropagation();
 };
 return {host,view,pan:(x:number,y:number)=>{drag.current=undefined;setView(current=>({...current,x:current.x+x,y:current.y+y}));},zoom:(factor:number,center:readonly [number,number])=>{drag.current=undefined;setView(current=>zoomChartViewport(current,factor,center,scaleLimit));},reset:()=>{drag.current=undefined;setView(initial);},handlers:{
  onPointerDown:(event:PointerEvent<SVGGElement>)=>{if(!mode||mode==='scale'||event.button!==0)return;const p=local(event.clientX,event.clientY);drag.current={id:event.pointerId,x:p.x,y:p.y,clientX:event.clientX,clientY:event.clientY,viewX:view.x,viewY:view.y,moved:false};},
  onPointerMove:(event:PointerEvent<SVGGElement>)=>{
   const previous=drag.current;if(!previous||previous.id!==event.pointerId)return;
   if(!previous.moved&&Math.hypot(event.clientX-previous.clientX,event.clientY-previous.clientY)<4)return;
   previous.moved=true;event.currentTarget.setPointerCapture(event.pointerId);
   const p=local(event.clientX,event.clientY);setView(current=>({...current,x:previous.viewX+p.x-previous.x,y:previous.viewY+p.y-previous.y}));
  },
  onPointerUpCapture:finish,
  onPointerCancel:finish,
  onKeyDown:(event:KeyboardEvent<SVGGElement>)=>{
   if(!mode||event.target!==event.currentTarget)return;
   if(event.key==='Home'){event.preventDefault();setView(initial);return;}
   const shifts:Record<string,readonly [number,number]>={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};
   const shift=shifts[event.key];if(shift&&mode!=='scale'){event.preventDefault();setView(current=>({...current,x:current.x+shift[0],y:current.y+shift[1]}));}
  },
 }};
}

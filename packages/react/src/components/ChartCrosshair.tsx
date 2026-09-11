import {useEffect,useRef,useState} from 'react';

interface ChartCrosshairProps {
 bounds:{x:number;y:number;width:number;height:number};
 xDomain:readonly [number,number];
 yDomain:readonly [number,number];
 formatX?:(value:number)=>string;
 formatY?:(value:number)=>string;
}

/** Listen on the SVG, without placing an event-catching layer above data marks. */
export function ChartCrosshair({bounds,xDomain,yDomain,formatX=decimal,formatY=decimal}:ChartCrosshairProps){
 const ref=useRef<SVGGElement>(null);
 const [point,setPoint]=useState<{x:number;y:number}|null>(null);
 useEffect(()=>{
  const svg=ref.current?.ownerSVGElement;
  if(!svg)return;
  const clear=()=>setPoint(null);
  const move=(event:PointerEvent)=>{
   const matrix=svg.getScreenCTM();
   if(!matrix)return clear();
   const cursor=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
   if(cursor.x<bounds.x||cursor.x>bounds.x+bounds.width||cursor.y<bounds.y||cursor.y>bounds.y+bounds.height)return clear();
   setPoint({x:cursor.x,y:cursor.y});
  };
  svg.addEventListener('pointermove',move);
  svg.addEventListener('pointerleave',clear);
  svg.addEventListener('pointercancel',clear);
  return ()=>{svg.removeEventListener('pointermove',move);svg.removeEventListener('pointerleave',clear);svg.removeEventListener('pointercancel',clear);};
 },[bounds.x,bounds.y,bounds.width,bounds.height]);
 // A zoom or legend change invalidates coordinates from the previous plot.
 useEffect(()=>setPoint(null),[xDomain[0],xDomain[1],yDomain[0],yDomain[1]]);
 const x=point?xDomain[0]+(point.x-bounds.x)/bounds.width*(xDomain[1]-xDomain[0]):0;
 const y=point?yDomain[1]-(point.y-bounds.y)/bounds.height*(yDomain[1]-yDomain[0]):0;
 return <g ref={ref} className="sia-chart__crosshair" aria-hidden="true">
  <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="transparent"/>
  {point?<g pointerEvents="none" style={{color:'var(--sia-color-text-secondary, #666)'}}>
   <path d={`M ${bounds.x} ${point.y} H ${bounds.x+bounds.width} M ${point.x} ${bounds.y} V ${bounds.y+bounds.height}`} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="5 5"/>
   <text x={point.x} y={bounds.y+bounds.height+30} textAnchor="middle" fill="currentColor" fontSize={11}>{formatX(x)}</text>
   <text x={bounds.x-8} y={point.y-6} textAnchor="end" fill="currentColor" fontSize={11}>{formatY(y)}</text>
  </g>:null}
 </g>;
}
function decimal(value:number){return String(Number(value.toFixed(2)));}

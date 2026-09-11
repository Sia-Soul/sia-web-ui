import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
interface RiverGeometry {y:number;tailX:number;points:readonly {x:number;thickness:number}[]}
interface RiverFrame extends RiverGeometry {scale:number}
/** Entrance scales the bubble; updates interpolate its actual envelope coordinates. */
export function EventRiverMotion({geometry,enabled=true,duration=2000,updateDuration=500,progress,children}:{geometry:RiverGeometry;enabled?:boolean;duration?:number;updateDuration?:number;progress?:number;children:(frame:RiverFrame)=>ReactNode}){
 const [frame,setFrame]=useState<RiverFrame>(()=>({...geometry,scale:enabled?.1:1}));
 const displayed=useRef(frame),started=useRef(false);
 const signature=JSON.stringify(geometry);
 useEffect(()=>{
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)'),target={...geometry,scale:1};
  const from=started.current?displayed.current:{...geometry,scale:.1};
  let request=0;
  const publish=(value:RiverFrame)=>{displayed.current=value;setFrame(value);};
  const finish=()=>{cancelAnimationFrame(request);publish(target);started.current=true;};
  const sample=(amount:number)=>{
   const mix=(a:number,b:number)=>a+(b-a)*amount;
   publish({y:mix(from.y,target.y),tailX:mix(from.tailX,target.tailX),scale:mix(from.scale,1),points:target.points.map((point,index)=>({x:mix(from.points[index]?.x??point.x,point.x),thickness:mix(from.points[index]?.thickness??point.thickness,point.thickness)}))});
  };
  if(!enabled||preference.matches){finish();return;}
  if(progress!==undefined){sample(Math.max(0,Math.min(1,progress)));return;}
  const milliseconds=started.current?updateDuration:duration,begin=performance.now();
  const tick=(now:number)=>{started.current=true;const t=milliseconds<=0?1:Math.min(1,(now-begin)/milliseconds);sample(t===1?1:1-2**(-10*t));if(t<1)request=requestAnimationFrame(tick);};
  request=requestAnimationFrame(tick);preference.addEventListener('change',finish);
  return ()=>{cancelAnimationFrame(request);preference.removeEventListener('change',finish);};
 },[signature,enabled,duration,updateDuration,progress]);
 return <>{children(enabled?frame:{...geometry,scale:1})}</>;
}

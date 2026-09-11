import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {mapLineSample} from './mapLineGeometry';
type Point=readonly [number,number];
/** Draw the leading segment of a quadratic curve, rather than morphing the previous route. */
export function ChartMapLineReveal({source,control,target,enabled,initialDuration=2000,updateDuration=500,children}:{source:Point;control:Point;target:Point;enabled:boolean;initialDuration?:number;updateDuration?:number;children:(control:Point,target:Point,progress:number)=>ReactNode}){
 const signature=JSON.stringify([source,control,target]),initialized=useRef(false);
 const [frame,setFrame]=useState({signature,progress:enabled?0:1});
 useEffect(()=>{
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const duration=Math.max(1,initialized.current?updateDuration:initialDuration);
  if(!enabled||reduced.matches){setFrame({signature,progress:1});return;}
  const started=performance.now();let request=0;
  const tick=(now:number)=>{initialized.current=true;const t=Math.max(0,Math.min(1,(now-started)/duration));setFrame({signature,progress:t===1?1:1-2**(-10*t)});if(t<1)request=requestAnimationFrame(tick);};
  const finish=()=>{cancelAnimationFrame(request);setFrame({signature,progress:1});};
  request=requestAnimationFrame(tick);reduced.addEventListener('change',finish);
  return ()=>{cancelAnimationFrame(request);reduced.removeEventListener('change',finish);};
 },[signature,enabled,initialDuration,updateDuration]);
 const progress=!enabled?1:frame.signature===signature?frame.progress:0;
 const bend:Point=[source[0]+(control[0]-source[0])*progress,source[1]+(control[1]-source[1])*progress];
 if(!enabled)return <>{children(control,target,1)}</>;
 return <g data-map-line-reveal={progress}>{children(bend,mapLineSample(source,control,target,progress),progress)}</g>;
}

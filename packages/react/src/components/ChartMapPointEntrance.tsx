import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
/** Map marks are icons in the reference: scale from .01 around the point on entry. */
export function ChartMapPointEntrance({enabled,x,y,children}:{enabled:boolean;x:number;y:number;children:ReactNode}){
 const [progress,setProgress]=useState(enabled ? .01 : 1);
 useEffect(()=>{
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(!enabled||reduced.matches){setProgress(1);return;}
  const start=performance.now();let request=0;
  const tick=(now:number)=>{const t=Math.max(0,Math.min(1,(now-start)/2000));setProgress(.01+.99*(t===1?1:1-2**(-10*t)));if(t<1)request=requestAnimationFrame(tick);};
  const finish=()=>{cancelAnimationFrame(request);setProgress(1);};
  request=requestAnimationFrame(tick);reduced.addEventListener('change',finish);
  return ()=>{cancelAnimationFrame(request);reduced.removeEventListener('change',finish);};
 },[enabled]);
 if(!enabled)return <>{children}</>;
 return <g data-map-point-entrance={progress} transform={`translate(${x} ${y}) scale(${progress}) translate(${-x} ${-y})`}>{children}</g>;
}

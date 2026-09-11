import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {scatterMotionEase} from './scatterMotion';

/** Scatter icons grow about their own anchor; updates retain the displayed geometry. */
export function ChartScatterMotion({x,y,radius,enabled,duration=2000,updateDuration=500,progress,children}:{x:number;y:number;radius:number;enabled:boolean;duration?:number;updateDuration?:number;progress?:number;children:ReactNode}){
 const target={x,y,radius};
 const [frame,setFrame]=useState(()=>({...target,radius:enabled?radius*.01:radius}));
 const displayed=useRef(frame),started=useRef(false);
 useEffect(()=>{
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let request=0;
  const publish=(next:typeof target)=>{displayed.current=next;setFrame(next);};
  const finish=()=>{cancelAnimationFrame(request);publish(target);};
  if(!enabled||reduced.matches||progress!==undefined){finish();return;}
  const from=started.current?displayed.current:{...target,radius:radius*.01};
  const milliseconds=started.current?updateDuration:duration,begin=performance.now();
  const tick=(now:number)=>{started.current=true;const t=milliseconds<=0?1:Math.min(1,(now-begin)/milliseconds),eased=scatterMotionEase(t);publish({x:from.x+(x-from.x)*eased,y:from.y+(y-from.y)*eased,radius:from.radius+(radius-from.radius)*eased});if(t<1)request=requestAnimationFrame(tick);};
  request=requestAnimationFrame(tick);reduced.addEventListener('change',finish);
  return()=>{cancelAnimationFrame(request);reduced.removeEventListener('change',finish);};
 },[x,y,radius,enabled,duration,updateDuration,progress]);
 const shown=progress!==undefined?{...target,radius:radius*(.01+.99*scatterMotionEase(progress))}:enabled?frame:target;
 const scale=radius>0?shown.radius/radius:1;
 return <g data-scatter-motion="" transform={`matrix(${scale} 0 0 ${scale} ${shown.x-scale*x} ${shown.y-scale*y})`}>{children}</g>;
}

import {useEffect,useRef} from 'react';
import {mapLineDuration,mapLineSample} from './mapLineGeometry';
export function ChartMapLineEffect({source,control,target,period=30,color='#fff',radius=1,shadowBlur=10,shadowColor=color,trailAlpha}:{source:readonly [number,number];control:readonly [number,number];target:readonly [number,number];period?:number;color?:string;radius?:number;shadowBlur?:number;shadowColor?:string;trailAlpha?:number}){
 const ref=useRef<SVGCircleElement>(null);
 const trails=useRef<Array<SVGCircleElement|null>>([]);
 const alpha=trailAlpha===undefined?0:Math.max(0,Math.min(.999,trailAlpha));
 const count=alpha>0?Math.min(240,Math.ceil(Math.log(.005)/Math.log(alpha))):0;
 const duration=mapLineDuration(source,target,period);
 useEffect(()=>{
  const started=performance.now();let frame=0;const history:Array<readonly [number,number]>=[];
  trails.current.forEach(circle=>circle?.setAttribute('opacity','0'));
  const tick=(now:number)=>{
   for(let i=0;i<count;i++){const circle=trails.current[i],old=history[i];if(circle&&old){circle.setAttribute('cx',String(old[0]));circle.setAttribute('cy',String(old[1]));circle.setAttribute('opacity',String(alpha**(i+1)));}}
   const point=mapLineSample(source,control,target,((now-started)%duration)/duration);ref.current?.setAttribute('cx',String(point[0]));ref.current?.setAttribute('cy',String(point[1]));
   history.unshift(point);if(history.length>count)history.pop();frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame);
 },[source[0],source[1],control[0],control[1],target[0],target[1],duration,count,alpha]);
 return <g pointerEvents="none" data-map-effect-layer="" style={{filter:shadowBlur?'drop-shadow(0 0 '+shadowBlur+'px '+shadowColor+')':undefined}}>
  {Array.from({length:count},(_,i)=><circle key={i} ref={node=>{trails.current[i]=node;}} data-map-trail={i} cx={source[0]} cy={source[1]} r={radius} fill={color} opacity={0}/>)}
  <circle ref={ref} data-map-moving-effect={duration} cx={source[0]} cy={source[1]} r={radius} fill={color}/>
 </g>;
}

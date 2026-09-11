import {useEffect,useId,useState} from 'react';
export interface ChartPulseRingProps {center:readonly [number,number];radius:number;scaleSize?:number;color?:string;shadowBlur?:number;period?:number;progress?:number;enabled?:boolean}
/** Looping scaled ring. Keep its stroke and blur in the same local coordinate space. */
export function ChartPulseRing({center,radius,scaleSize=2,color='gold',shadowBlur=10,period=15,progress,enabled=true}:ChartPulseRingProps){
 const id=useId().replace(/:/g,''),[phase,setPhase]=useState(0);
 const [reduced,setReduced]=useState(false);
 useEffect(()=>{const preference=window.matchMedia('(prefers-reduced-motion: reduce)');setReduced(preference.matches);let frame=0;const duration=(period+Math.random()*10)*100,begin=performance.now();const tick=(now:number)=>{setPhase(((now-begin)%duration)/duration);frame=requestAnimationFrame(tick);};const sync=()=>{setReduced(preference.matches);cancelAnimationFrame(frame);if(enabled&&progress===undefined&&!preference.matches)frame=requestAnimationFrame(tick);};sync();preference.addEventListener('change',sync);return()=>{cancelAnimationFrame(frame);preference.removeEventListener('change',sync);};},[enabled,period,progress]);
 const scale=!enabled||reduced?1/scaleSize:.1+.9*Math.max(0,Math.min(1,progress??phase));
 return <g data-chart-pulse-ring="" pointerEvents="none" transform={`translate(${center[0]} ${center[1]}) scale(${scale})`}>
  <defs><filter id={id} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={shadowBlur/2}/></filter></defs>
  <circle r={radius*scaleSize} fill="none" stroke={color} strokeWidth={1} filter={`url(#${id})`}/>
  <circle r={radius*scaleSize} fill="none" stroke={color} strokeWidth={1}/>
 </g>;
}

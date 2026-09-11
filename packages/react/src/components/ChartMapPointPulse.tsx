import {useState} from 'react';
import {mapPointPulseDuration} from './mapPointPulse';
/** The effect replaces the original glyph; it is not a second ring around a static point. */
export function ChartMapPointPulse({x,y,size,color,period=15,scaleSize=2}:{x:number;y:number;size:number;color:string;period?:number;scaleSize?:number}){
 const [duration]=useState(()=>mapPointPulseDuration(period));
 return <circle data-svg-map-pulse={duration} cx={x} cy={y} r={size*scaleSize*.1} fill="none" stroke={color} strokeWidth={.1} pointerEvents="none" style={{filter:`drop-shadow(0 0 2px ${color})`}}>
  <animate attributeName="r" values={`${size*scaleSize*.1};${size*scaleSize}`} dur={`${duration}ms`} repeatCount="indefinite" calcMode="linear"/>
  <animate attributeName="stroke-width" values=".1;1" dur={`${duration}ms`} repeatCount="indefinite" calcMode="linear"/>
 </circle>;
}

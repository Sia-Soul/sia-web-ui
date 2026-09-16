import {useEffect,useId,useState} from 'react';
/** ChartPulseRing的属性配置。 */
export interface ChartPulseRingProps {
  /** 中心位置。 */
  center:readonly [number,number];
  /** 图形半径或圆角配置。 */
  radius:number;
  /**
   * 缩放后的尺寸比例。
   * @defaultValue 2
   */
  scaleSize?:number;
  /**
   * 显示颜色，可使用 CSS 颜色值。
   * @defaultValue 'gold'
   */
  color?:string;
  /**
   * 阴影模糊半径。
   * @defaultValue 10
   */
  shadowBlur?:number;
  /**
   * 周期动画的周期时长。
   * @defaultValue 15
   */
  period?:number;
  /** 当前进度。 */
  progress?:number;
  /**
   * 是否启用该功能。
   * @defaultValue true
   */
  enabled?:boolean}
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

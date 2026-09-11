/** ECharts 2 reference uses the global ExponentialOut, overriding icon's fallback. */
export function scatterMotionEase(progress:number):number {
 const t=Math.max(0,Math.min(1,progress));
 return t===1?1:1-2**(-10*t);
}

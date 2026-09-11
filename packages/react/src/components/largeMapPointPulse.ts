/** Four linear keyframe segments in the original large-point effect. */
export function largeMapPointPulse(elapsed:number,period:number,initial:number,delay:number):number{
 const start=Math.max(0,Math.min(1,initial)),duration=Math.max(1,Math.round(period*100));
 if(elapsed<delay)return start;
 const t=((elapsed-delay)%(duration*4))/duration;
 return t<1?start+(1-start)*t:t<2?2-t:t<3?t-2:1;
}
export function largeMapPointSize(size:number,pulse:number):number{return size*pulse*pulse;}

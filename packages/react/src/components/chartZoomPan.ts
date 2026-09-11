/** Translate a range while keeping its span and stopping at either boundary. */
export function chartZoomPan(value:readonly [number,number],delta:number,min=0,max=100):[number,number]{
 const low=Math.min(min,max),high=Math.max(min,max);
 const span=Math.min(high-low,Math.abs(value[1]-value[0]));
 const start=Math.max(low,Math.min(high-span,Math.min(...value)+(Number.isFinite(delta)?delta:0)));
 return [start,start+span];
}

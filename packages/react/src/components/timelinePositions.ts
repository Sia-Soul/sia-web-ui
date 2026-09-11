/** Date-proportional timeline placement; invalid/non-monotone input falls back to equal spacing. */
export function timelineRatios(count:number,dates?:readonly string[]):number[]{
 if(count<=0)return [];
 if(count===1)return [.5];
 const times=dates?.map(date=>Date.parse(date));
 if(times?.length===count&&times.every((value,index)=>Number.isFinite(value)&&(index===0||value>=times[index-1]!))&&times[count-1]!>times[0]!){
  const first=times[0]!,span=times[count-1]!-first;
  return times.map(value=>(value-first)/span);
 }
 return Array.from({length:count},(_,index)=>index/(count-1));
}
export function nearestTimelineIndex(ratios:readonly number[],ratio:number):number{
 let selected=0,distance=Infinity;
 ratios.forEach((value,index)=>{const next=Math.abs(value-ratio);if(next<distance){distance=next;selected=index;}});
 return selected;
}

/** Estimate a readable interval without removing category positions or hit targets. */
export function categoryLabelStep(labels:readonly string[],length:number,interval:number|'auto'=0,vertical=false,boundaryGap=false):number{
 if(interval!=='auto')return Number.isFinite(interval)?Math.max(1,Math.floor(interval)+1):1;
 if(labels.length<2)return 1;
 const spacing=Math.max(0,length)/Math.max(1,labels.length-(boundaryGap?0:1));
 const size=vertical?18:Math.max(0,...labels.map(label=>Math.max(...label.split('\n').map(line=>Array.from(line).reduce((sum,char)=>sum+(char.charCodeAt(0)>255?12:7),0)))))+14;
 return spacing>0?Math.max(1,Math.ceil(size/spacing)):labels.length;
}

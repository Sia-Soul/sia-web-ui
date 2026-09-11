export interface RiverLayoutPoint {x:number;value:number}
export interface RiverLayoutEvent {weight?:number;evolution:readonly RiverLayoutPoint[]}
export interface RiverLayoutSeries {weight?:number;data:readonly RiverLayoutEvent[]}

/** Symmetric envelope: midpoint thicknesses, pointed start, and a decaying tail. */
export function eventRiverOutline(points:readonly {x:number;thickness:number}[],y:number,tailX:number,sampled=false){
 if(!points.length)return '';
 const controls:[number,number][]=[[points[0]!.x,y]];
 for(let i=0;i<points.length;i++)controls.push([(points[i]!.x+(points[i+1]?.x??tailX))/2,y-points[i]!.thickness/2]);
 controls.push([tailX,y]);
 for(let i=points.length-1;i>=0;i--)controls.push([(points[i]!.x+(points[i+1]?.x??tailX))/2,y+points[i]!.thickness/2]);
 if(sampled)return sampleClosedRiverSpline(controls).map((point,index)=>`${index?'L':'M'}${point[0]},${point[1]}`).join(' ')+' Z';
 let path=`M${controls[0]![0]},${controls[0]![1]}`;
 // Closed uniform Catmull–Rom spline expressed directly as SVG cubic segments.
 for(let i=0;i<controls.length;i++){
  const a=controls[(i+controls.length-1)%controls.length]!,b=controls[i]!,c=controls[(i+1)%controls.length]!,d=controls[(i+2)%controls.length]!;
  path+=` C${b[0]+(c[0]-a[0])/6},${b[1]+(c[1]-a[1])/6} ${c[0]-(d[0]-b[0])/6},${c[1]-(d[1]-b[1])/6} ${c[0]},${c[1]}`;
 }
 return path+' Z';
}

/** Reference spline sampling uses an unrounded distance/5 count and a closed parameter range. */
export function sampleClosedRiverSpline(points:readonly (readonly [number,number])[]):[number,number][]{
 if(points.length<2)return points.map(point=>[...point]);
 let distance=0;for(let i=1;i<points.length;i++)distance+=Math.hypot(points[i]![0]-points[i-1]![0],points[i]![1]-points[i-1]![1]);
 const count=Math.max(points.length,distance/5),result:[number,number][]=[];
 const interpolate=(a:number,b:number,c:number,d:number,t:number)=>{const left=(c-a)/2,right=(d-b)/2;return (2*(b-c)+left+right)*t*t*t+(-3*(b-c)-2*left-right)*t*t+left*t+b;};
 for(let i=0;i<count;i++){
  const position=i/(count-1)*points.length,index=Math.floor(position),t=position-index,n=points.length;
  const a=points[(index-1+n)%n]!,b=points[index%n]!,c=points[(index+1)%n]!,d=points[(index+2)%n]!;
  result.push([interpolate(a[0],b[0],c[0],d[0],t),interpolate(a[1],b[1],c[1],d[1],t)]);
 }
 return result;
}

/** Pixel-envelope packing. The caller supplies time-axis screen coordinates. */
export function layoutEventRiver(series:readonly RiverLayoutSeries[],tailLength:number,area:{y:number;height:number}){
 if(!Number.isFinite(tailLength)||tailLength<1||!Number.isFinite(area.y)||!Number.isFinite(area.height)||area.height<=0)throw new RangeError('事件河流布局区域或尾长无效');
 const groups=series.map((group,seriesIndex)=>{
  const events=group.data.map((event,eventIndex)=>{
   const weight=event.weight??1;
   if(!Number.isFinite(weight)||weight<0)throw new RangeError('事件权重无效');
   const points=event.evolution.map(point=>{if(!Number.isFinite(point.x)||!Number.isFinite(point.value)||point.value<0)throw new RangeError('事件坐标和值必须有限且值非负');return {x:point.x,thickness:point.value**.8};});
   for(let i=1;i<points.length;i++)if(points[i]!.x<points[i-1]!.x)throw new RangeError('事件时间必须递增');
   return {seriesIndex,eventIndex,weight,importance:points.reduce((sum,p)=>sum+p.thickness,0)*weight,points,y:0,offset:0};
  }).sort((a,b)=>b.importance-a.importance);
  const weight=group.weight??1;if(!Number.isFinite(weight)||weight<0)throw new RangeError('系列权重无效');
  return {events,importance:events.reduce((sum,event)=>sum+event.weight,0)*weight};
 }).sort((a,b)=>b.importance-a.importance);
 const events=groups.flatMap(group=>group.events).filter(event=>event.points.length);
 const heights=new Map<number,number>(),gaps=new Map<number,number>();let maximum=0,offset=0;
 for(const event of events){
  const samples:{x:number;half:number}[]=[];
  for(let i=0;i<event.points.length;i++){
   const current=event.points[i]!,next=event.points[i+1];const start=Math.trunc(current.x),end=next?Math.trunc(next.x):start+Math.trunc(tailLength),left=current.thickness/2,right=next?next.thickness/2:0;
   if(end-start>1000000)throw new RangeError('事件像素区间过大');
   for(let x=start;x<end;x++)samples.push({x,half:left+(right-left)*(x-start)/(end-start)});
   if(!next)samples.push({x:end,half:0});
  }
  for(const sample of samples){event.y=Math.max(event.y,sample.half+(heights.get(sample.x)??0));event.offset=Math.max(event.offset,4+(gaps.get(sample.x)??0));}
  for(const sample of samples){heights.set(sample.x,event.y+sample.half);gaps.set(sample.x,event.offset+4);}
  maximum=Math.max(maximum,event.y+Math.max(...event.points.map(p=>p.thickness)));offset=Math.max(offset,event.offset);
 }
 const scale=maximum>0?(area.height-offset)/maximum:0,offsetScale=offset/area.height>.5?.5:1;
 return events.map(event=>({seriesIndex:event.seriesIndex,eventIndex:event.eventIndex,importance:event.importance,y:area.y+event.y*scale+event.offset*offsetScale,points:event.points.map(point=>({x:point.x,thickness:point.thickness*scale})),tailX:event.points.at(-1)!.x+tailLength}));
}

export interface ScatterBatchPoint {x:number;y:number;radius:number;color:string}
/** Keep every point while reducing SVG element count to one path per color. */
export function buildScatterBatches(points:readonly ScatterBatchPoint[]){
 const groups=new Map<string,{color:string;count:number;paths:string[]}>();
 for(const point of points){
  if(![point.x,point.y,point.radius].every(Number.isFinite)||point.radius<=0)continue;
  const group=groups.get(point.color)??{color:point.color,count:0,paths:[]};
  group.paths.push(`M ${point.x-point.radius} ${point.y} a ${point.radius} ${point.radius} 0 1 0 ${point.radius*2} 0 a ${point.radius} ${point.radius} 0 1 0 ${-point.radius*2} 0`);
  group.count++;groups.set(point.color,group);
 }
 return [...groups.values()].map(({paths,...group})=>({...group,path:paths.join(' ')}));
}

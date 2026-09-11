export interface ScatterStatisticsPoint {x:number;y:number;category?:string}
export function scatterStatistics(data:readonly ScatterStatisticsPoint[],byCategory=false){
 const groups=new Map<string,{category:string;count:number;sumX:number;sumY:number;minY:number;maxY:number}>();
 for(const point of data){
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
  const key=byCategory?point.category??'':'';
  const group=groups.get(key)??{category:key,count:0,sumX:0,sumY:0,minY:Infinity,maxY:-Infinity};
  group.count++;group.sumX+=point.x;group.sumY+=point.y;group.minY=Math.min(group.minY,point.y);group.maxY=Math.max(group.maxY,point.y);groups.set(key,group);
 }
 return [...groups.values()].map(({sumX,sumY,...g})=>({...g,averageX:sumX/g.count,averageY:sumY/g.count}));
}

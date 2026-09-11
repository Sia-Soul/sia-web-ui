type Coordinate=readonly [number,number];
interface SourcePoint {name:string;geoCoord?:readonly number[]}
interface BuildingSeries {
 name?:string;geoCoord?:Record<string,readonly number[]>;
 markPoint?:{symbol?:string;symbolSize?:number;effect?:{show:boolean;color:string};data:readonly SourcePoint[]};
 markLine?:{symbol?:readonly string[];effect:{period:number;color:string;shadowBlur:number};data:readonly (readonly SourcePoint[])[]};
}
/** Resolve source names without deduplicating points or fabricating absent numeric values. */
export function createBuildingMapData(series:readonly BuildingSeries[],colors:readonly string[]){
 const coordinates=Object.assign({},...series.map(item=>item.geoCoord??{})) as Record<string,readonly number[]>;
 const resolve=(point:SourcePoint):Coordinate=>{
  const value=point.geoCoord??coordinates[point.name];
  if(!value||value.length!==2||value.some(v=>!Number.isFinite(v)))throw new Error(`百度大厦点位缺少坐标：${point.name}`);
  return [value[0]!,value[1]!];
 };
 return series.map((item,index)=>({
  name:item.name,index,color:colors[index%colors.length]!,
  points:(item.markPoint?.data??[]).map(point=>({name:point.name,coordinate:resolve(point),size:item.markPoint?.symbolSize??10,symbol:item.markPoint?.symbol??'pin',effect:item.markPoint?.effect})),
  lines:(item.markLine?.data??[]).map(pair=>{
   if(pair.length!==2)throw new Error('百度大厦线路需要两个端点');
   return {name:pair[0]!.name+' > '+pair[1]!.name,source:resolve(pair[0]!),target:resolve(pair[1]!),effect:item.markLine!.effect,symbols:item.markLine!.symbol??['circle','arrow']};
  }),
 }));
}

export interface RadarTransferSeries {name:string;data:readonly number[]}
export interface RadarTransferPanel<T extends RadarTransferSeries> {series:readonly T[]}
export interface RadarTransferAddress {panel:number;series:number}

/** Data transaction for whole-series drag/drop; UI hit testing is deliberately separate. */
export function transferRadarSeries<T extends RadarTransferSeries,P extends RadarTransferPanel<T>>(panels:readonly P[],source:RadarTransferAddress,target:{panel:number;series?:number}|null,connector=' & '):P[]{
 const item=panels[source.panel]?.series[source.series];
 if(!item)throw new RangeError('Radar drag source does not exist');
 if(target&&!panels[target.panel])throw new RangeError('Radar drop panel does not exist');
 const receiving=target?.series===undefined?undefined:panels[target.panel]?.series[target.series];
 if(target?.series!==undefined&&!receiving)throw new RangeError('Radar drop series does not exist');
 const result=panels.map(panel=>({...panel,series:panel.series.map(series=>({...series,data:[...series.data]}))})) as P[];
 if(target?.panel===source.panel&&target.series===source.series)return result;
 if(receiving&&receiving.data.length!==item.data.length)throw new RangeError('Radar merge dimensions must match');
 // Resolve the destination before removing the source, so same-panel indices cannot shift it.
 if(target){
  const destination=result[target.panel]!.series as T[];
  if(target.series===undefined)destination.push({...item,data:[...item.data]});
  else destination[target.series]={...receiving!,name:receiving!.name+connector+item.name,data:receiving!.data.map((value,index)=>Number((value+item.data[index]!).toPrecision(15)))};
 }
 (result[source.panel]!.series as T[]).splice(source.series,1);
 return result;
}

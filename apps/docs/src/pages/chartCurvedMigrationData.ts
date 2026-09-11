import source from './chartCurvedMigrationSource.json';
const option=source[0]!.option,coordinates=option.series[0]!.geoCoord as Record<string,number[]>;
export const curvedMigrationGroups=option.series.map(series=>({name:series.name,lines:series.markLine.data.map(pair=>{
 const from=pair[0] as {name:string;smoothness:number},to=pair[1] as {name:string;value:number};
 const start=coordinates[from.name],end=coordinates[to.name];
 if(!start||!end)throw new Error('缺少原始城市坐标');
 return {name:`${from.name} > ${to.name}`,source:[start[0]!,start[1]!] as const,target:[end[0]!,end[1]!] as const,value:to.value,curveness:from.smoothness};
})}));

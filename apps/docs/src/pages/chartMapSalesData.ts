import snapshot from './chartMapSalesSource.json';
export interface MapSalesSeries {name:string;data:{name:string;value:number}[]}
/** Preserve all 60 random draws in original series/region order. */
export function createMapSalesData(random:()=>number=Math.random):MapSalesSeries[]{
 return snapshot[0]!.option.series.map(series=>({name:series.name,data:series.data.map(item=>{
  const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw new Error('随机数必须在[0,1)范围内');
  return {name:item.name,value:Math.round(value*1000)};
 })}));
}
/** Missing series/regions are not fabricated as data; legend selection affects totals. */
export function aggregateMapSales(series:readonly MapSalesSeries[],selected:Readonly<Record<string,boolean>>){
 const regions=new Map<string,{name:string;value:number;contributors:{name:string;value:number}[]}>();
 for(const item of series){if(selected[item.name]===false)continue;for(const point of item.data){
  const region=regions.get(point.name)??{name:point.name,value:0,contributors:[]};region.value+=point.value;region.contributors.push({name:item.name,value:point.value});regions.set(point.name,region);
 }}return [...regions.values()];
}

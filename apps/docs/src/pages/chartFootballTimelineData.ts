type CoordinateValue=number|{$expression:string};
interface LabelStyle {show?:boolean;textStyle?:{color?:string;fontSize?:string|number}}
interface ItemStyle {normal?:{color?:string;borderWidth?:number;label?:LabelStyle}}
interface Player {name:string;value:string;geoCoord:readonly CoordinateValue[];itemStyle?:ItemStyle}
interface Endpoint {name:string;geoCoord:readonly CoordinateValue[]}
interface Series {
 markPoint:{symbol?:string;symbolSize?:number;itemStyle?:ItemStyle;data:readonly Player[]};
 markLine:{smooth?:boolean;effect?:{show:boolean;scaleSize:number;period:number;color:string};itemStyle?:ItemStyle;data:readonly (readonly Endpoint[])[]};
}
interface Frame {series:readonly Series[]}
/** Resolve only the five arithmetic random forms present in this example, never eval source JS. */
export function resolveFootballCoordinate(value:CoordinateValue,random:()=>number):number{
 if(typeof value==='number')return value;
 const supported:Record<string,readonly [number,number]>={
  '110+(Math.random()*3)':[110,3],'750-(Math.random()*3)':[750,-3],
  '110+(Math.random()*2)':[110,2],'296.913+(Math.random()*3)':[296.913,3],
  '750+(Math.random()*5)':[750,5],
 };
 const formula=supported[value.$expression];if(!formula)throw new Error(`未支持的足球坐标表达式：${value.$expression}`);
 return formula[0]+random()*formula[1];
}
/** Original formatter intentionally uses >10 (so the tenth node reads 00:010). */
export function footballTimelineLabel(value:number){return '00:'+(value>10?value:'0'+value);}
export function createFootballTimelineData(frames:readonly Frame[],random:()=>number=Math.random){
 const base=frames[0]?.series[0];if(!base)throw new Error('足球时间轴缺少首帧');
 const coordinate=(point:Endpoint):readonly [number,number]=>{
  if(point.geoCoord.length!==2)throw new Error(`足球点位需要二维坐标：${point.name}`);
  return [resolveFootballCoordinate(point.geoCoord[0]!,random),resolveFootballCoordinate(point.geoCoord[1]!,random)];
 };
 return frames.map(frame=>{
  const current=frame.series[0]!;
  const pointStyle={...base.markPoint.itemStyle?.normal,...current.markPoint.itemStyle?.normal};
  const lineStyle={...base.markLine.itemStyle?.normal,...current.markLine.itemStyle?.normal};
  const effect={...base.markLine.effect,...current.markLine.effect};
  return {
   points:current.markPoint.data.map(point=>({name:point.name,value:point.value,coordinate:coordinate(point),size:current.markPoint.symbolSize??base.markPoint.symbolSize??10,symbol:current.markPoint.symbol??base.markPoint.symbol??'pin',color:point.itemStyle?.normal?.color??pointStyle.color??'blue',borderWidth:point.itemStyle?.normal?.borderWidth??pointStyle.borderWidth??2,label:{...pointStyle.label,...point.itemStyle?.normal?.label}})),
   lines:current.markLine.data.map(pair=>{if(pair.length!==2)throw new Error('传球线需要两个端点');return {name:pair[0]!.name+' > '+pair[1]!.name,source:coordinate(pair[0]!),target:coordinate(pair[1]!),color:lineStyle.color??'gold',width:lineStyle.borderWidth??1,smooth:current.markLine.smooth??base.markLine.smooth??false,effect};}),
  };
 });
}

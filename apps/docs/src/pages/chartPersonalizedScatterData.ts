import type {ScatterDatum} from '@sia.soul/sia-react-ui';
import snapshot from './chartPersonalizedScatterSnapshot.json';
import {personalizedLineIcon} from './chartPersonalizedLineIcon';
export function personalizedScatterSize(item:ScatterDatum){
 if(item.symbol==='emptyTriangle')return 30;
 return item.category==='scatter1'?(item.x<2?2:item.x<8?Math.round((item.value??0)*3):20):Math.round((item.value??0)*3);
}
export const personalizedScatterData:ScatterDatum[]=snapshot.series.flatMap((series,row)=>series.data.map((datum,index)=>{
 const special=!Array.isArray(datum),value=special?datum.value:datum;
 return {name:`${series.name} ${index+1}`,category:series.name,x:value[0]!,y:value[1]!,value:value[2]!,
  symbolFill:'transparent',emphasisColor:special?'#ff4500':row===0?'lightgreen':undefined,emphasisBorderWidth:special?10:6,
  showLabel:row===0,showEmphasisLabel:true,labelFormatter:(item:ScatterDatum)=>item.value?.toLocaleString('en-US'),labelStyle:{fontSize:12,fontFamily:'微软雅黑, Arial, Verdana, sans-serif'},
  size:special?30:row===0?(value[0]!<2?2:value[0]!<8?Math.round(value[2]!*3):20):Math.round(value[2]!*3),
  symbol:special?'emptyTriangle':row===0?'emptyCircle':'image',symbolImage:row===1&&!special?personalizedLineIcon:undefined,
  symbolRotate:special?-90:undefined,borderWidth:special?8:4,color:special?'orange':row===0?'lightblue':'#b6a2de'};
}));

/** Original example generates 20 random triples per series, plus one fixed triangle. */
export function createPersonalizedScatterData(random:()=>number=Math.random):ScatterDatum[]{
 return personalizedScatterData.map(template=>{
  if(template.symbol==='emptyTriangle')return {...template};
  const next={...template,x:Number((random()*10).toFixed(2)),y:Number((random()*10).toFixed(2)),value:Number((random()*10).toFixed(2))};
  return {...next,size:personalizedScatterSize(next)};
 });
}

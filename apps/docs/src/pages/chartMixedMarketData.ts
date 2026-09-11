import source from './chartMixedMarketSource.json';

const snapshot=source[0]!;
/** One row owns all three panel values; zoom must never slice panels independently. */
export const mixedMarketRows=snapshot.bindings.axisData.map((date,index)=>{
 const candle=snapshot.option.series[0]!.data[index]!;
 return {date,open:candle[0]!,close:candle[1]!,low:candle[2]!,high:candle[3]!,
  amount:snapshot.bindings.option2.series[0]!.data[index]!,
  virtual:snapshot.bindings.option3.series[0]!.data[index]!};
});
export type MixedMarketRow=typeof mixedMarketRows[number];

export function mixedMarketWindow(rows:readonly MixedMarketRow[],zoom:readonly [number,number]){
 if(!zoom.every(Number.isFinite))throw new Error('缩放百分比必须为有限数值');
 if(!rows.length)return [];
 const low=Math.max(0,Math.min(100,Math.min(...zoom))),high=Math.max(0,Math.min(100,Math.max(...zoom)));
 const start=Math.min(rows.length-1,Math.floor(low/100*rows.length));
 const end=Math.max(start+1,Math.ceil(high/100*rows.length));
 return rows.slice(start,end);
}

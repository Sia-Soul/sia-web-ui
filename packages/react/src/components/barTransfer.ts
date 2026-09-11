import {transferCartesianValue} from './cartesianTransfer.ts';
import type {CartesianTransferAddress,CartesianIsland} from './cartesianTransfer.ts';

export interface TransferBarDatum {value:number;hidden?:boolean}
export interface TransferBarSeries {name:string;data:readonly (number|TransferBarDatum)[]}

/** Transfer only values: colors, gradients, labels and other destination cell metadata stay in place. */
export function transferBarValue<T extends TransferBarSeries>(series:readonly T[],source:CartesianTransferAddress,target:CartesianTransferAddress|null,categories:readonly string[]):{series:(Omit<T,'data'>&{data:(number|TransferBarDatum)[]})[];island?:CartesianIsland}{
 const scalar=series.map(s=>({name:s.name,data:s.data.map(d=>typeof d==='number'?(Number.isFinite(d)?d:null):d.hidden||!Number.isFinite(d.value)?null:d.value)}));
 const result=transferCartesianValue(scalar,source,target,categories);
 return {series:series.map((s,i)=>({...s,data:s.data.map((datum,j)=>{
  const next=result.series[i]!.data[j]!;
  // Untouched cells, including explicitly hidden source records, retain their identity.
  if(!(source.series===i&&source.index===j)&&!(target?.series===i&&target.index===j))return datum;
  if(target?.series===source.series&&target.index===source.index)return datum;
  if(next===null)return typeof datum==='number'?{value:NaN,hidden:true}:{...datum,value:NaN,hidden:true};
  return typeof datum==='number'?next:{...datum,value:next,hidden:false};
 })})),island:result.island};
}

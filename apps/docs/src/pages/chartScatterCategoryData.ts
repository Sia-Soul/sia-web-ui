import type {ScatterDatum} from '@sia-ui/react';
export const scatterCategories=Array.from({length:500},(_,i)=>i+1);
export function createScatterCategoryData(seed:number):ScatterDatum[]{
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 return ['series1','series2'].flatMap(category=>scatterCategories.map(x=>({name:`${category}（类目${x}）`,category,x,y:Number((random()*30).toFixed(2)),value:Number((random()*100).toFixed(2))})));
}
export const scatterCategorySize=(point:ScatterDatum)=>Math.round((point.value??0)/10);
export const scatterCategoryPieces=Array.from({length:5},(_,i)=>({min:i*20,max:(i+1)*20,label:`${i*20}–${(i+1)*20}`,color:`rgb(${Math.round(255+(144-255)*i/4)},${Math.round(165+(238-165)*i/4)},${Math.round(144*i/4)})`})).reverse();

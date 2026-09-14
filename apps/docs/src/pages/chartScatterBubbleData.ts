import type {ScatterDatum} from '@sia.soul/sia-react-ui';
/** Original random(): rounded 0–100, even positive and odd negative. */
export function createScatterBubbleData(seed:number):ScatterDatum[]{
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;const n=Math.round(state/4294967296*100);return n*(n%2===0?1:-1);};
 return ['scatter1','scatter2'].flatMap(category=>Array.from({length:100},(_,index)=>({name:`${category} ${index+1}`,category,x:random(),y:random(),value:Math.abs(random())})));
}
export const scatterBubbleSize=(point:ScatterDatum)=>Math.round((point.value??0)/5);

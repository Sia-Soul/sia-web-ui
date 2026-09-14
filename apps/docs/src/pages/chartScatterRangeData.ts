import type {ScatterDatum} from '@sia.soul/sia-react-ui';
export function createScatterRangeData(seed:number):ScatterDatum[]{
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 return Array.from({length:500},(_,i)=>{const value=Number((random()*100).toFixed(2));return {name:`scatter1 ${i+1}`,category:'scatter1',x:Number((random()*value+value).toFixed(2)),y:Number((random()*value).toFixed(2)),value,size:5};});
}

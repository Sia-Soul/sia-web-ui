import type {ScatterDatum} from '@sia.soul/sia-react-ui';
export function createScatterTimeData(seed:number):ScatterDatum[]{
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 return Array.from({length:1500},(_,i)=>({name:`series1 ${i+1}`,category:'series1',x:new Date(2014,9,1,0,Math.round(random()*10000)).getTime(),y:Number((random()*30).toFixed(2)),value:Number((random()*100).toFixed(2))}));
}
export function scatterTimeLabel(value:number){const d=new Date(value);return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}

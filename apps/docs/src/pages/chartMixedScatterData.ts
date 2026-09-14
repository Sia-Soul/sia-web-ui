import type {ScatterDatum} from '@sia.soul/sia-react-ui';

/** Original mix4 evaluation order: 200 x/y/value triples, then 30 line values. */
export function createMixedScatterData(random:()=>number=Math.random){
 const scatter:ScatterDatum[]=Array.from({length:200},(_,index)=>{
  const x=Math.round(random()*29)+1;
  const y=Number((random()*30).toFixed(2));
  const value=Number((random()*100).toFixed(2));
  return {name:`散点 ${index+1}`,category:'散点',x,y,value,size:Math.round(value/10)};
 });
 const categories=Array.from({length:30},(_,index)=>`2013-03-${index+1}`);
 const line=categories.map(()=>Math.round(random()*30));
 return {scatter,categories,line};
}

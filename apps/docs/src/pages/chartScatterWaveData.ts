import type {ScatterDatum} from '@sia.soul/sia-react-ui';
/** Locally implemented original formula, with a seeded random source for reproducible verification. */
export function createScatterWaveData(seed:number):ScatterDatum[]{
 let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const data:ScatterDatum[]=[];
 for(const category of ['sin','cos'])for(let remaining=9999;remaining>=0;remaining--){
  const x=Number((random()*10).toFixed(3));
  const y=Number(((category==='sin'?Math.sin(x):Math.cos(x))-x*(remaining%2?.1:-.1)*random()).toFixed(3));
  data.push({x,y,category,size:4});
 }
 return data;
}

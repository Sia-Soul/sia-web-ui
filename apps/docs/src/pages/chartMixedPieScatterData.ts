export type PieScatterPoint=readonly [number,number,number];
/** Original mix7: 200 calls for series 1, then 40 calls for series 2. */
export function createMixedPieScatterData(random:()=>number=Math.random){
 const first:PieScatterPoint[]=[],second:PieScatterPoint[]=[];
 for(let i=0;i<40;i++)first.push([
  Math.round(random()*10)*(Math.round(random()*10)>5?1:-1),
  Math.round(random()*10)*(Math.round(random()*10)>5?1:-1),
  Math.round(random()*20),
 ]);
 for(const [x,y] of first)second.push([x,y,Math.round(random()*15)]);
 return {first,second};
}

/** The original while(len--) paints index 39 first, index 0 last. */
export function mixedPieScatterGlyphs(data:ReturnType<typeof createMixedPieScatterData>){
 return data.first.map(([x,y,value],index)=>({index,x,y,radius:value+data.second[index]![2],values:[value,data.second[index]![2]] as const})).reverse();
}

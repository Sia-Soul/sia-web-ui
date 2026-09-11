export interface FunnelLayoutOptions {
  left: number; top: number; width: number; height: number;
  gap?: number; min?: number; max?: number; minSize?: number; maxSize?: number;
  sort?: "descending" | "ascending" | "none";
  align?: "left" | "center" | "right";
}

/** Layout only: retain source indices so sorting/filtering cannot reassign colors. */
export function layoutFunnelValues(values: readonly number[], options: FunnelLayoutOptions) {
  const {left,top,width,height,gap=0,min=0,max=100,minSize=0,maxSize=1,sort="descending",align="center"}=options;
  const items=values.map((value,index)=>({value,index})).filter(item=>Number.isFinite(item.value));
  if(sort!=="none")items.sort((a,b)=>sort==="ascending"?a.value-b.value:b.value-a.value);
  const sizeAt=(value:number)=>width*(minSize+(maxSize-minSize)*(value-min)/Math.max(Number.EPSILON,max-min));
  const offset=(size:number)=>left+(align==="left"?0:align==="right"?width-size:(width-size)/2);
  const step=Math.max(0,(height-Math.max(0,items.length-1)*gap)/Math.max(1,items.length));
  let upper=sort==="descending"?sizeAt(items[0]?.value??min):width*minSize;
  return items.map((item,index)=>{
    const lower=index===items.length-1?width*(sort==="descending"?minSize:maxSize):sizeAt(items[index+(sort==="descending"?1:0)]!.value);
    const y=top+index*(step+gap);
    const points:readonly (readonly [number,number])[]=[[offset(upper),y],[offset(upper)+upper,y],[offset(lower)+lower,y+step],[offset(lower),y+step]];
    upper=lower;
    return {...item,points,center:[(points[0]![0]+points[1]![0]+points[2]![0]+points[3]![0])/4,y+step/2] as const};
  });
}

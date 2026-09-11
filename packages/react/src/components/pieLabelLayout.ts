export interface PieLabelAnchor {y:number;right:boolean;visible:boolean}

/** Resolve each side independently, preserving its vertical order and input indices. */
export function layoutPieLabelY(anchors:readonly PieLabelAnchor[],top:number,bottom:number,gap=18):number[]{
 if(!Number.isFinite(top)||!Number.isFinite(bottom)||bottom<top||!Number.isFinite(gap)||gap<0)throw new RangeError('无效的饼图标签布局范围');
 const result=anchors.map(anchor=>anchor.y);
 for(const right of [false,true]){
  const side=anchors.map((anchor,index)=>({...anchor,index})).filter(anchor=>anchor.visible&&anchor.right===right&&Number.isFinite(anchor.y)).sort((a,b)=>a.y-b.y||a.index-b.index);
  const distance=side.length>1?Math.min(gap,(bottom-top)/(side.length-1)):0;
  side.forEach((anchor,index)=>{result[anchor.index]=Math.max(top,Math.min(bottom,anchor.y),index?result[side[index-1]!.index]!+distance:top);});
  if(side.length&&result[side.at(-1)!.index]!>bottom){
   result[side.at(-1)!.index]=bottom;
   for(let i=side.length-2;i>=0;i--)result[side[i]!.index]=Math.min(result[side[i]!.index]!,result[side[i+1]!.index]!-distance);
  }
 }
 return result;
}

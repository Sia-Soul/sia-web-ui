/** 矩形树图布局计算得到的矩形边界。 */
export interface TreemapLayoutBox {
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number}
export interface TreemapLayoutCell extends TreemapLayoutBox {index:number;value:number}

/** Preserve data order; choose each strip by the aspect ratio of its first cell. */
export function layoutTreemapValues(values:readonly number[],bounds:TreemapLayoutBox):TreemapLayoutCell[]{
 if(!Object.values(bounds).every(Number.isFinite)||bounds.width<=0||bounds.height<=0)return [];
 const items=values.map((value,index)=>({value,index})).filter(item=>Number.isFinite(item.value)&&item.value>0);
 // Normalize before summing to avoid overflowing on large finite weights.
 const maximum=Math.max(0,...items.map(item=>item.value));
 if(!maximum)return [];
 const total=items.reduce((sum,item)=>sum+item.value/maximum,0);
 const areas=items.map(item=>bounds.width*bounds.height*(item.value/maximum)/total);
 let {x,y,width,height}=bounds,cursor=0;
 const cells:TreemapLayoutCell[]=[];
 while(cursor<items.length&&width>0&&height>0){
  const vertical=width>=height,edge=vertical?height:width;
  let count=1,sum=areas[cursor]!;
  const score=(area:number)=>{const thickness=area/edge,firstLength=areas[cursor]!/thickness;return Math.min(thickness,firstLength)/Math.max(thickness,firstLength);};
  while(cursor+count<items.length){
   const next=sum+areas[cursor+count]!;
   if(score(sum)>=score(next))break;
   sum=next;count++;
  }
  const thickness=cursor+count===items.length?(vertical?width:height):sum/edge;
  let offset=0;
  for(let i=0;i<count;i++){
   const item=items[cursor+i]!;
   const length=i===count-1?edge-offset:areas[cursor+i]!/sum*edge;
   cells.push({...item,x:vertical?x:x+offset,y:vertical?y+offset:y,width:vertical?thickness:length,height:vertical?length:thickness});
   offset+=length;
  }
  if(vertical){x+=thickness;width=Math.max(0,width-thickness);}else{y+=thickness;height=Math.max(0,height-thickness);}
  cursor+=count;
 }
 return cells;
}

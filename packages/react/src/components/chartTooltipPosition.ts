/** Axis tooltip offsets and edge correction, in CSS pixels relative to the chart host. */
export function axisTooltipPosition(anchor:readonly [number,number],tooltip:readonly [number,number],host:readonly [number,number]):readonly [number,number]{
 let left=anchor[0]+10,top=anchor[1]+10;
 if(left+tooltip[0]>host[0])left-=tooltip[0]+40;
 if(top+tooltip[1]>host[1])top-=tooltip[1]-20;
 if(top<20)top=0;
 return [left,top];
}

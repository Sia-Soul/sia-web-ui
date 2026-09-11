/** The pointer's width is its half-width; its heel scales with that width. */
export function gaugePointerPoints(center:readonly [number,number],angle:number,length:number,halfWidth:number){
 if(![...center,angle,length,halfWidth].every(Number.isFinite)||length<0||halfWidth<0)return [];
 const direction=[Math.cos(angle),Math.sin(angle)] as const;
 const heel=halfWidth*(halfWidth>=length/3?1:2);
 return [
  [center[0]-direction[0]*heel,center[1]-direction[1]*heel],
  [center[0]+direction[1]*halfWidth,center[1]-direction[0]*halfWidth],
  [center[0]+direction[0]*length,center[1]+direction[1]*length],
  [center[0]-direction[1]*halfWidth,center[1]+direction[0]*halfWidth],
 ];
}

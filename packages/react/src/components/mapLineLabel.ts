type Point=readonly [number,number];
/** End labels use the chord direction, not the quadratic curve's tangent. */
export function mapLineEndLabel(source:Point,target:Point){
 let angle=Math.atan((source[1]-target[1])/(target[0]-source[0]))*180/Math.PI;
 if(target[0]<source[0])angle+=180;else if(source[1]<target[1])angle+=360;
 const [x,y]=target;
 if(angle>=30&&angle<=150)return {x,y:y-5,anchor:'middle' as const,baseline:'text-after-edge' as const};
 if(angle>150&&angle<210)return {x:x-5,y,anchor:'end' as const,baseline:'central' as const};
 if(angle>=210&&angle<=330)return {x,y:y+5,anchor:'middle' as const,baseline:'text-before-edge' as const};
 return {x:x+5,y,anchor:'start' as const,baseline:'central' as const};
}

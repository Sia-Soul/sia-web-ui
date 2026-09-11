type Point=readonly [number,number];
export interface BundleCurve {start:Point;c1:Point;c2:Point;end:Point;length:number;until:number}
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
/** Open cubic chain; tangent handles are weighted by neighboring chord lengths. */
export function smoothBundledPath(points:readonly Point[],smoothness=.1):BundleCurve[]{
 if(!Number.isFinite(smoothness)||smoothness<0)throw new RangeError('无效平滑系数');
 const handles=points.map((p,i)=>{
  if(i===0||i===points.length-1)return {incoming:p,outgoing:p};
  const before=points[i-1]!,after=points[i+1]!,a=distance(p,before),b=distance(p,after),sum=a+b;
  const dx=(after[0]-before[0])*smoothness,dy=(after[1]-before[1])*smoothness;
  return {incoming:[p[0]-dx*(sum?a/sum:0),p[1]-dy*(sum?a/sum:0)] as Point,outgoing:[p[0]+dx*(sum?b/sum:0),p[1]+dy*(sum?b/sum:0)] as Point};
 });
 let until=0;return points.slice(1).map((end,i)=>{const start=points[i]!,c1=handles[i]!.outgoing,c2=handles[i+1]!.incoming;
  const length=distance(start,c1)+distance(c1,c2)+distance(c2,end);until+=length;return {start,c1,c2,end,length,until};
 });
}
/** Timing follows cumulative control-polygon length, as used by the source polyline effect. */
export function sampleBundledPath(curves:readonly BundleCurve[],progress:number):Point{
 if(!curves.length)return [0,0];
 const amount=Math.max(0,Math.min(1,progress))*curves.at(-1)!.until;
 let low=0,high=curves.length-1;while(low<high){const mid=(low+high)>>1;if(curves[mid]!.until<amount)low=mid+1;else high=mid;}
 const curve=curves[low]!,t=curve.length?(amount-(curve.until-curve.length))/curve.length:0,u=1-t;
 return [0,1].map(axis=>u*u*u*curve.start[axis]!+3*u*u*t*curve.c1[axis]!+3*u*t*t*curve.c2[axis]!+t*t*t*curve.end[axis]!) as unknown as Point;
}

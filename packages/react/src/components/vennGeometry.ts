/** Exact two-arc boundary of the intersection of horizontally aligned circles. */
export function vennLensPath(x:number,y:number,r1:number,r2:number,d:number):string {
 if(![x,y,r1,r2,d].every(Number.isFinite)||r1<=0||r2<=0||d>=r1+r2)return '';
 if(d<=Math.abs(r1-r2)){
  const radius=Math.min(r1,r2),center=r1<=r2?x:x+d;
  return `M ${center-radius} ${y} A ${radius} ${radius} 0 1 0 ${center+radius} ${y} A ${radius} ${radius} 0 1 0 ${center-radius} ${y} Z`;
 }
 const a=(r1*r1-r2*r2+d*d)/(2*d),h=Math.sqrt(Math.max(0,r1*r1-a*a)),joint=x+a;
 return `M ${joint} ${y-h} A ${r1} ${r1} 0 ${a<0?1:0} 1 ${joint} ${y+h} A ${r2} ${r2} 0 ${d-a<0?1:0} 1 ${joint} ${y-h} Z`;
}

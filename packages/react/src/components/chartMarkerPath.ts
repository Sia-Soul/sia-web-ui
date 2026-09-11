export type ChartPathMarker = 'heart'|'droplet'|'pin'|'arrow';
/** Paths are centered on the data anchor; pin tips, rather than their circle centers, use that anchor. */
export function chartMarkerPath(kind:ChartPathMarker,x:number,y:number,size:number):string {
 const s=size;
 if(kind==='heart')return `M ${x} ${y-.3*s} C ${x+.25*s} ${y-5*s/6} ${x+s} ${y-s/30} ${x} ${y+.5*s} C ${x-s} ${y-s/30} ${x-.25*s} ${y-5*s/6} ${x} ${y-.3*s} Z`;
 if(kind==='droplet')return `M ${x} ${y+.5*s} C ${x+.5*s} ${y+.5*s} ${x+.75*s} ${y-s/6} ${x} ${y-.8*s} C ${x-.75*s} ${y-s/6} ${x-.5*s} ${y+.5*s} ${x} ${y+.5*s} Z`;
 if(kind==='arrow')return `M ${x} ${y-.5*s} L ${x-.4375*s} ${y+.5*s} L ${x} ${y+.25*s} L ${x+.4375*s} ${y+.5*s} Z`;
 const r=s/2,cy=y-.75*s;
 return `M ${x+r*Math.cos(.8*Math.PI)} ${cy+r*Math.sin(.8*Math.PI)} A ${r} ${r} 0 1 1 ${x+r*Math.cos(.2*Math.PI)} ${cy+r*Math.sin(.2*Math.PI)} L ${x} ${y} Z`;
}

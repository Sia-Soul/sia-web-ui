/** Alternating outer/inner vertices, beginning at the top tip. Size is the diameter. */
export function chartStarPoints(x:number,y:number,size:number,tips:5|6):readonly (readonly [number,number])[]{
 const radius=size/2,inner=radius*Math.cos(2*Math.PI/tips)/Math.cos(Math.PI/tips);
 return Array.from({length:tips*2},(_,i)=>{const angle=-Math.PI/2+i*Math.PI/tips,r=i%2?inner:radius;return [x+Math.cos(angle)*r,y+Math.sin(angle)*r] as const;});
}

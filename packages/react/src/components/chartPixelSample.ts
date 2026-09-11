/** Sample drawing indices only. The backing values and interaction indices remain intact. */
export function chartPixelSample(indices:readonly number[],pixelWidth:number):readonly number[]{
 const budget=Math.max(1,Math.floor(Number.isFinite(pixelWidth)?pixelWidth:indices.length));
 if(indices.length<=budget)return indices;
 return Array.from({length:budget},(_,index)=>indices[Math.floor(index*indices.length/budget)]!);
}

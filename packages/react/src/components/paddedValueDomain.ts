/** Finite data extent plus proportional padding, before nice-tick rounding. */
export function paddedValueExtent(values:readonly number[],padding=0.05):readonly [number,number]{
 if(!Number.isFinite(padding)||padding<0)throw new Error('padding must be finite and non-negative');
 const finite=values.filter(Number.isFinite);
 if(!finite.length)return [0,1];
 const minimum=Math.min(...finite),maximum=Math.max(...finite);
 const span=maximum-minimum||Math.abs(minimum)||1;
 return [minimum-span*padding,maximum+span*padding];
}
